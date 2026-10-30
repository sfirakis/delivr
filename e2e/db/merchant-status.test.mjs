/**
 * Migration 016 (merchant POS order status RPC) against a throwaway Postgres.
 *   1. applies on top of 001-015 and is safe to re-run,
 *   2. only staff of the order's store (or admin) can move an order,
 *   3. only the store's state machine is allowed, with the same side effects
 *      as the tokenised /s/<token> action,
 *   4. anon cannot call it; a direct UPDATE on orders stays blocked (011a).
 *
 *   node e2e/db/merchant-status.test.mjs
 */
import { makeDb, applyFile, as } from './pglite-db.mjs'

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const STAFF = '00000000-0000-4000-8000-00000000000b'
const OTHER = '00000000-0000-4000-8000-00000000000c'
const STORE = '10000000-0000-4000-8000-000000000001'
const STORE2 = '10000000-0000-4000-8000-000000000002'

let failed = 0
const step = async (name, fn) => {
  try { await fn(); console.log(`✅ ${name}`) }
  catch (e) { failed++; console.log(`❌ ${name} — ${e.message.split('\n')[0]}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
const rejects = async (p, code) => {
  try { await p } catch (e) {
    if (code && !String(e.message).includes(code)) throw new Error(`expected ${code}, got: ${e.message}`)
    return
  }
  throw new Error(`expected an error${code ? ` (${code})` : ''}`)
}
const one = async (db, sql, params) => (await db.query(sql, params)).rows[0]

const db = await makeDb({ upTo: 15 })
await db.exec(`
  -- Mirror live: migration 002's notify trigger is not on the live orders table
  -- (pg_trigger checked 30/10/2026); it compares order_status to text[] and
  -- would make every status change fail here, including /s/<token>.
  DROP TRIGGER IF EXISTS on_order_status_change ON orders;

  INSERT INTO auth.users (id, email) VALUES
    ('${ADMIN}', 'admin@test.local'), ('${STAFF}', 'staff@test.local'), ('${OTHER}', 'other@test.local');
  UPDATE profiles SET role = 'admin' WHERE id = '${ADMIN}';

  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, delivery_fee, min_order_amount)
  VALUES ('${STORE}', 'Souvlaki Corner', 'souvlaki-corner', 'restaurant', 'Πλατεία 1', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 8),
         ('${STORE2}', 'Pizza Napoli', 'pizza-napoli', 'restaurant', 'Οδός 2', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 8);
  INSERT INTO store_zones (store_id, name, area, city, delivery_fee, min_order)
  VALUES ('${STORE}', 'Κέντρο', 'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 2, 8);
  INSERT INTO menu_items (id, store_id, name, price)
  VALUES ('20000000-0000-4000-8000-000000000001', '${STORE}', 'Πίτα γύρος', 4);
  INSERT INTO properties (id, code, name, address, city, area, lat, lng)
  VALUES ('30000000-0000-4000-8000-000000000001', 'VILLA1', 'Villa Elena', 'Οδός 5',
          'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 35.191, 25.721);

  -- STAFF works at Souvlaki Corner; OTHER works at Pizza Napoli.
  INSERT INTO store_users (store_id, user_id, role) VALUES ('${STORE}', '${STAFF}', 'owner'), ('${STORE2}', '${OTHER}', 'owner');
`)

const place = async (service = 'delivery') => {
  const r = await as(db, 'anon', null, () => one(db,
    `SELECT delivr_place_order('VILLA1', '${STORE}', '${service}',
       '[{"menu_item_id":"20000000-0000-4000-8000-000000000001","quantity":3}]'::jsonb,
       '{"name":"Guest","phone":"6900000001"}'::jsonb) AS j`))
  assert(r.j.ok === true, JSON.stringify(r.j))
  return (await one(db, `SELECT id FROM orders WHERE order_number = $1`, [r.j.order_number])).id
}
const setStatus = (uid, id, action, prep = null, reason = null) =>
  as(db, 'authenticated', uid, () => one(db,
    `SELECT delivr_merchant_set_order_status($1, $2, $3, $4) AS j`, [id, action, prep, reason]))
const row = id => one(db, `SELECT * FROM orders WHERE id = $1`, [id])

await step('016 applies on top of 001-015', () => applyFile(db, '016_merchant_order_status.sql'))
await step('016 is safe to run twice', () => applyFile(db, '016_merchant_order_status.sql'))

const order = await place('delivery')

await step('Why 016 exists: a direct UPDATE on orders is still refused (011a)', async () => {
  await rejects(as(db, 'authenticated', STAFF, () =>
    db.query(`UPDATE orders SET status = 'confirmed' WHERE id = $1`, [order])), 'permission denied')
})
await step('anon cannot call the merchant RPC', async () => {
  await rejects(as(db, 'anon', null, () =>
    db.query(`SELECT delivr_merchant_set_order_status($1, 'accept')`, [order])), 'permission denied')
})
await step('Staff of another store gets FORBIDDEN', async () => {
  await rejects(setStatus(OTHER, order, 'accept', 15), 'FORBIDDEN')
  assert((await row(order)).status === 'pending', 'status changed')
})
await step('Skipping steps is refused (pending → ready)', async () => {
  await rejects(setStatus(STAFF, order, 'ready'), 'BAD_TRANSITION')
})
await step('Unknown action is refused', async () => {
  await rejects(setStatus(STAFF, order, 'teleport'), 'BAD_ACTION')
})
await step('Accept sets confirmed, prep minutes and ETA', async () => {
  const r = await setStatus(STAFF, order, 'accept', 15)
  assert(r.j.status === 'confirmed' && r.j.prep_minutes === 15, JSON.stringify(r.j))
  const o = await row(order)
  assert(o.status === 'confirmed' && o.confirmed_at && o.estimated_ready_at, JSON.stringify(o))
})
await step('Accepting twice is refused', async () => {
  await rejects(setStatus(STAFF, order, 'accept', 15), 'BAD_TRANSITION')
})
await step('Delivery order: preparing → ready → on the way → delivered (cash paid)', async () => {
  for (const a of ['preparing', 'ready']) await setStatus(STAFF, order, a)
  await rejects(setStatus(STAFF, order, 'delivered'), 'BAD_TRANSITION')   // a delivery must leave the store first
  await setStatus(STAFF, order, 'on_the_way')
  await setStatus(STAFF, order, 'delivered')
  const o = await row(order)
  assert(o.status === 'delivered' && o.prepared_at && o.picked_up_at && o.delivered_at, JSON.stringify(o))
  assert(o.payment_status === 'paid', `payment_status ${o.payment_status}`)
})
await step('Every step is in order_events as the store', async () => {
  const ev = (await db.query(`SELECT status, actor FROM order_events WHERE order_id = $1 AND actor = 'store' ORDER BY created_at, id`, [order])).rows
  const seen = ev.map(e => e.status)
  for (const s of ['confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']) assert(seen.includes(s), `missing ${s}: ${seen}`)
})
await step('A closed order cannot move', async () => {
  await rejects(setStatus(STAFF, order, 'reject', null, 'x'), 'ORDER_CLOSED')
})

const pickup = await place('pickup')
await step('Take away: ready → delivered (no "on the way")', async () => {
  for (const a of ['accept', 'ready']) await setStatus(STAFF, pickup, a, 10)
  await rejects(setStatus(STAFF, pickup, 'on_the_way'), 'BAD_TRANSITION')
  await setStatus(STAFF, pickup, 'delivered')
  assert((await row(pickup)).status === 'delivered', 'not delivered')
})

const rejected = await place('delivery')
await step('Reject keeps the reason', async () => {
  await setStatus(STAFF, rejected, 'reject', null, ' Τελείωσε ο γύρος ')
  const o = await row(rejected)
  assert(o.status === 'cancelled' && o.cancel_reason === 'Τελείωσε ο γύρος' && o.cancelled_at, JSON.stringify(o))
})

const printed = await place('delivery')
await step('Print marks printed_at without changing status', async () => {
  const r = await setStatus(STAFF, printed, 'print')
  const o = await row(printed)
  assert(r.j.printed === true && o.status === 'pending' && o.printed_at, JSON.stringify(o))
})
await step('Admin can move any store\'s order (logged as admin)', async () => {
  await setStatus(ADMIN, printed, 'accept', 20)
  const e = await one(db, `SELECT actor FROM order_events WHERE order_id = $1 AND status = 'confirmed'`, [printed])
  assert((await row(printed)).status === 'confirmed' && e.actor === 'admin', JSON.stringify(e))
})
await step('The tokenised /s/<token> action still works next to it', async () => {
  const t = (await row(printed)).store_token
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_store_action($1, 'preparing') AS j`, [t]))
  assert(r.j.status === 'preparing', JSON.stringify(r.j))
})

console.log(failed ? `\n${failed} failed` : '\nAll merchant-status DB checks passed')
process.exitCode = failed ? 1 : 0
