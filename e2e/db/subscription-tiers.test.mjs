/**
 * Migration 018 (subscription tiers, monthly order limits, card in person)
 * against a throwaway Postgres (PGlite). Nothing touches the live project.
 *
 *   1. applies on top of 001-017 with the plan rows live has today, twice,
 *   2. plans: Basic/Pro/Plus/Premium, limits 15/100/250/500, no store
 *      commission, ids kept, «Host Partner» (property) untouched,
 *   3. delivr_place_order charges stores 0 platform fee; property side as before,
 *   4. payment: cash default (old clients), card at the counter always, card on
 *      delivery only when the store allows it, shown on /t and /s,
 *   5. the monthly meter (Europe/Athens), never blocks an order,
 *   6. delivr_apply_plan_upgrades: smallest plan that fits, > 500 flagged,
 *      idempotent, admin/service only; admin view; billing picks the new price,
 *   7. … and down again (seasonal shop: Premium → Plus → Pro → Basic → Plus),
 *      not on a partial first month, Basic never billed,
 *   8. «Προβολή στην κορυφή» from the plan (Plus/Premium) in the marketplace
 *      and the QR list, admin flag on top, gone when the plan goes.
 *
 *   node e2e/db/subscription-tiers.test.mjs
 */
import { makeDb, applyFile, as } from './pglite-db.mjs'

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const STAFF = '00000000-0000-4000-8000-00000000000b'
const OTHER = '00000000-0000-4000-8000-00000000000c'
const S1 = '10000000-0000-4000-8000-000000000001'   // Souvlaki Corner (no subscription = Basic)
const S2 = '10000000-0000-4000-8000-000000000002'   // Pizza Napoli (Pro)
const S3 = '10000000-0000-4000-8000-000000000003'   // Big Grill (Premium, > 500)
const S4 = '10000000-0000-4000-8000-000000000004'   // Quiet Cafe (under its limit)
const ITEM = '20000000-0000-4000-8000-000000000001'
const P_BASIC = '40000000-0000-4000-8000-000000000001'
const P_PRO = '40000000-0000-4000-8000-000000000002'
const P_PREM = '40000000-0000-4000-8000-000000000003'
const P_HOST = '40000000-0000-4000-8000-000000000004'

let failed = 0, passed = 0
const step = async (name, fn) => {
  try { await fn(); passed++; console.log(`✅ ${name}`) }
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
const n = v => Number(v)

const db = await makeDb({ upTo: 17 })
await db.exec(`
  DROP TRIGGER IF EXISTS on_order_status_change ON orders;   -- not on live (see merchant-status test)

  INSERT INTO auth.users (id, email) VALUES
    ('${ADMIN}', 'admin@test.local'), ('${STAFF}', 'staff@test.local'), ('${OTHER}', 'other@test.local');
  UPDATE profiles SET role = 'admin' WHERE id = '${ADMIN}';

  -- Platform default as live today: 10 % per order.
  UPDATE platform_settings SET store_billing_mode = 'commission', store_billing_value = 10 WHERE id = 1;

  -- The plan rows live has after 017 (prices/commission as checked 30/10/2026).
  INSERT INTO subscription_plans (id, name, description, audience, price, billing_cycle, trial_days,
                                  commission_mode, commission_value, features, sort_order) VALUES
    ('${P_BASIC}', 'Basic',   'x', 'store',    0,  'month', 0,  'commission', 12, '[]', 1),
    ('${P_PRO}',   'Pro',     'x', 'store',    29, 'month', 14, 'commission', 6,  '[]', 2),
    ('${P_PREM}',  'Premium', 'x', 'store',    79, 'month', 14, 'none',       0,  '[]', 3),
    ('${P_HOST}',  'Host Partner', 'Το κατάλυμα εισπράττει 8% σε κάθε παραγγελία', 'property', 0, 'month', 0,
                   'commission', 8, '["QR κάρτα","8% απόδοση","Αναφορά εσόδων"]', 1);

  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, delivery_fee, min_order_amount, standalone_enabled)
  VALUES ('${S1}', 'Souvlaki Corner', 'souvlaki-corner', 'restaurant', 'Πλατεία 1', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true),
         ('${S2}', 'Pizza Napoli', 'pizza-napoli', 'restaurant', 'Οδός 2', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true),
         ('${S3}', 'Big Grill', 'big-grill', 'restaurant', 'Οδός 3', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true),
         ('${S4}', 'Quiet Cafe', 'quiet-cafe', 'cafe', 'Οδός 4', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true);
  INSERT INTO store_hours (store_id, day_of_week, open_time, close_time, is_closed)
  SELECT s, d, '00:00', '23:59', false FROM unnest(ARRAY['${S1}','${S2}','${S3}','${S4}']::uuid[]) s, generate_series(0, 6) d
  ON CONFLICT DO NOTHING;
  INSERT INTO store_zones (store_id, name, area, city, delivery_fee, min_order)
  VALUES ('${S1}', 'Κέντρο', 'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 2, 0);
  INSERT INTO menu_items (id, store_id, name, price) VALUES ('${ITEM}', '${S1}', 'Πίτα γύρος', 10);
  INSERT INTO properties (id, code, name, address, city, area, lat, lng, billing_mode, billing_value, billing_direction)
  VALUES ('30000000-0000-4000-8000-000000000001', 'VILLA1', 'Villa Elena', 'Οδός 5',
          'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 35.191, 25.721, 'commission', 8, 'payout');

  INSERT INTO store_users (store_id, user_id, role) VALUES ('${S1}', '${STAFF}', 'owner'), ('${S2}', '${OTHER}', 'owner');
  INSERT INTO subscriptions (plan_id, party_type, party_id, status, price) VALUES
    ('${P_PRO}', 'store', '${S2}', 'active', 29),
    ('${P_PREM}', 'store', '${S3}', 'active', 79),
    ('${P_HOST}', 'property', '30000000-0000-4000-8000-000000000001', 'active', 0);
`)

// ── 1. Applies ───────────────────────────────────────────────
await step('018 applies on top of 001-017 (live plan rows present)', () => applyFile(db, '018_subscription_tiers.sql'))
await step('018 is safe to run twice (no duplicate Plus, same ids)', async () => {
  await applyFile(db, '018_subscription_tiers.sql')
  const r = await one(db, `SELECT count(*) AS c FROM subscription_plans WHERE name = 'Plus'`)
  assert(n(r.c) === 1, `Plus rows: ${r.c}`)
})

// ── 2. Plans ─────────────────────────────────────────────────
await step('Store plans: Basic 0€/15, Pro 39€/100, Plus 79€/250, Premium 150€/500, in that order', async () => {
  const rows = (await db.query(`SELECT id, name, price, included_orders, trial_days, sort_order
                                  FROM subscription_plans WHERE audience = 'store' ORDER BY sort_order`)).rows
  const got = rows.map(r => `${r.name}:${n(r.price)}:${r.included_orders}`).join(' ')
  assert(got === 'Basic:0:15 Pro:39:100 Plus:79:250 Premium:150:500', got)
  assert(rows.find(r => r.name === 'Pro').id === P_PRO, 'Pro id changed')
  assert(rows.find(r => r.name === 'Premium').id === P_PREM, 'Premium id changed')
  for (const r of rows) assert(r.trial_days === (n(r.price) > 0 ? 14 : 0), `${r.name} trial ${r.trial_days}`)
})
await step('No commission on any store plan; texts without commission wording', async () => {
  const rows = (await db.query(`SELECT name, commission_mode, commission_value, description, features::text AS f
                                  FROM subscription_plans WHERE audience = 'store'`)).rows
  for (const r of rows) {
    assert(r.commission_mode === 'none' && n(r.commission_value) === 0, `${r.name}: ${r.commission_mode} ${r.commission_value}`)
    assert(!/προμήθει|%|commission/i.test(r.description + r.f), `${r.name} text: ${r.description} ${r.f}`)
  }
})
await step('«Host Partner» (property) untouched: 8 %', async () => {
  const r = await one(db, `SELECT commission_mode, commission_value, price, description FROM subscription_plans WHERE id = $1`, [P_HOST])
  assert(r.commission_mode === 'commission' && n(r.commission_value) === 8 && n(r.price) === 0, JSON.stringify(r))
  assert(r.description.includes('8%'), r.description)
})
await step('Platform default for stores without a plan is now «none»', async () => {
  const r = await one(db, `SELECT store_billing_mode, store_billing_value, property_billing_mode FROM platform_settings WHERE id = 1`)
  assert(r.store_billing_mode === 'none' && n(r.store_billing_value) === 0, JSON.stringify(r))
})
await step('delivr_public_plans: 4 plans with limits, «custom above 500», no commission fields', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_public_plans() AS j`))
  assert(r.j.plans.length === 4 && r.j.custom_above === 500, JSON.stringify(r.j).slice(0, 200))
  assert(r.j.plans.map(p => p.included_orders).join() === '15,100,250,500', 'limits')
  assert(!/commission/.test(JSON.stringify(r.j)), 'commission leaked')
})

// ── 3. Billing ───────────────────────────────────────────────
const place = (store, service = 'pickup', payment, code = null, extra = {}) => as(db, 'anon', null, () => one(db,
  `SELECT delivr_place_order($1, $2, $3,
     '[{"menu_item_id":"${ITEM}","quantity":2}]'::jsonb,
     $4::jsonb ${payment === undefined ? '' : ', p_payment => $5'}) AS j`,
  payment === undefined
    ? [code, store, service, JSON.stringify({ name: 'Guest', phone: `69${Math.floor(Math.random() * 1e8)}`, ...extra })]
    : [code, store, service, JSON.stringify({ name: 'Guest', phone: `69${Math.floor(Math.random() * 1e8)}`, ...extra }), payment]))
const orderRow = num => one(db, `SELECT * FROM orders WHERE order_number = $1`, [num])

await step('Store without a subscription (Basic): platform fee 0, no store charge row', async () => {
  const r = await place(S1, 'pickup')
  const o = await orderRow(r.j.order_number)
  const c = await one(db, `SELECT count(*) AS c FROM order_charges WHERE order_id = $1 AND party_type = 'store'`, [o.id])
  assert(n(o.platform_fee) === 0 && n(c.c) === 0, `fee ${o.platform_fee}, charges ${c.c}`)
})
await step('Store on a plan: resolve_billing says plan/none and the order agrees', async () => {
  await db.exec(`INSERT INTO menu_items (store_id, name, price) VALUES ('${S2}', 'Margherita', 9)`)
  await db.exec(`INSERT INTO subscriptions (plan_id, party_type, party_id, status, price) VALUES ('${P_PRO}', 'store', '${S1}', 'trial', 39)`)
  const b = await one(db, `SELECT * FROM delivr_resolve_billing('store', '${S1}')`)
  assert(b.mode === 'none' && b.source === 'plan', JSON.stringify(b))
  const r = await place(S1, 'pickup')
  assert(n((await orderRow(r.j.order_number)).platform_fee) === 0, 'fee charged')
  await db.exec(`DELETE FROM subscriptions WHERE party_id = '${S1}'`)
})
await step('Property side unchanged: QR order still pays the property its 8 %', async () => {
  const r = await place(S1, 'delivery', undefined, 'VILLA1')
  const o = await orderRow(r.j.order_number)
  assert(n(o.platform_fee) === 0, `platform fee ${o.platform_fee}`)
  assert(n(o.property_fee) === 1.6, `property fee ${o.property_fee}`)    // 8 % of 20 €
  const c = await one(db, `SELECT direction, rate FROM order_charges WHERE order_id = $1 AND party_type = 'property'`, [o.id])
  assert(c.direction === 'payout' && n(c.rate) === 8, JSON.stringify(c))
})
await step('An explicit per-store override set by the admin still applies (by design)', async () => {
  await db.exec(`UPDATE stores SET billing_mode = 'commission', billing_value = 5 WHERE id = '${S1}'`)
  const r = await place(S1, 'pickup')
  assert(n((await orderRow(r.j.order_number)).platform_fee) === 1, 'override ignored')
  await db.exec(`UPDATE stores SET billing_mode = 'inherit', billing_value = 0 WHERE id = '${S1}'`)
})

// ── 4. Payment ───────────────────────────────────────────────
await step('Old client (5 arguments, no p_payment) → cash', async () => {
  const r = await place(S1, 'pickup')
  assert(r.j.payment_method === 'cash', r.j.payment_method)
  assert((await orderRow(r.j.order_number)).payment_method === 'cash', 'stored')
})
// delivery to an ad-hoc address needs one: use the 10-arg call for delivery cases.
const placeDelivery = (payment) => as(db, 'anon', null, () => one(db,
  `SELECT delivr_place_order(NULL, $1, 'delivery', '[{"menu_item_id":"${ITEM}","quantity":1}]'::jsonb,
     $2::jsonb, NULL, NULL, $3, 'app',
     '{"street":"Οδός 9","area":"Άγιος Νικόλαος","city":"Άγιος Νικόλαος"}'::jsonb) AS j`,
  [S1, JSON.stringify({ name: 'Guest', phone: `69${Math.floor(Math.random() * 1e8)}` }), payment]))

await step('Card at the counter (take away) is always accepted', async () => {
  const r = await place(S1, 'pickup', 'card')
  assert(r.j.payment_method === 'card', r.j.payment_method)
  assert((await orderRow(r.j.order_number)).payment_method === 'card', 'stored')
})
await step('Card on delivery is refused while the store has not enabled it', async () => {
  await rejects(placeDelivery('card'), 'CARD_NOT_ACCEPTED')
  const r = await placeDelivery('cash')
  assert(r.j.payment_method === 'cash', 'cash delivery')
})
await step('Card on delivery works once the store turns accepts_card_on_delivery on', async () => {
  await db.exec(`UPDATE stores SET accepts_card_on_delivery = true WHERE id = '${S1}'`)
  const r = await placeDelivery('card')
  assert(r.j.payment_method === 'card', r.j.payment_method)
})
await step('Online methods still need the platform switch; junk is refused', async () => {
  await rejects(place(S1, 'pickup', 'apple_pay'), 'ONLINE_PAYMENT_DISABLED')
  await rejects(place(S1, 'pickup', 'bitcoin'), 'BAD_PAYMENT')
})
await step('The store merchant can switch card-on-delivery from settings (not an admin-only field)', async () => {
  await as(db, 'authenticated', STAFF, () => db.query(`UPDATE stores SET accepts_card_on_delivery = false WHERE id = $1`, [S1]))
  const r = await one(db, `SELECT accepts_card_on_delivery AS v FROM stores WHERE id = $1`, [S1])
  assert(r.v === false, 'not saved')
  await db.exec(`UPDATE stores SET accepts_card_on_delivery = true WHERE id = '${S1}'`)
})
await step('delivr_store_payment_options is public and reflects the setting', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_store_payment_options($1) AS j`, [S1]))
  assert(r.j.cash === true && r.j.card_pickup === true && r.j.card_delivery === true, JSON.stringify(r.j))
})
await step('/t (order status) and /s (store view) show the method; card is paid on handover', async () => {
  const r = await placeDelivery('card')
  const o = await orderRow(r.j.order_number)
  const t = await as(db, 'anon', null, () => one(db, `SELECT delivr_order_status($1) AS j`, [o.public_token]))
  const s = await as(db, 'anon', null, () => one(db, `SELECT delivr_store_order($1) AS j`, [o.store_token]))
  assert(t.j.payment_method === 'card' && s.j.payment_method === 'card', 'method not shown')
  for (const a of ['accept', 'ready', 'on_the_way', 'delivered'])
    await as(db, 'authenticated', STAFF, () => db.query(`SELECT delivr_merchant_set_order_status($1, $2, 15)`, [o.id, a]))
  const after = await orderRow(r.j.order_number)
  assert(after.status === 'delivered' && after.payment_status === 'paid', `${after.status}/${after.payment_status}`)
})

// ── 5. Monthly meter ─────────────────────────────────────────
const bulk = (store, count, at, status = 'delivered') => db.exec(`
  INSERT INTO orders (store_id, subtotal, total, payment_method, status, created_at, channel)
  SELECT '${store}', 10, 10, 'cash', '${status}', '${at}'::timestamptz, 'app' FROM generate_series(1, ${count})`)

await step('Month boundary is Europe/Athens, cancelled orders do not count', async () => {
  await bulk(S4, 1, '2026-10-31 23:30:00+02')          // still October in Athens (UTC 21:30)
  await bulk(S4, 1, '2026-11-01 00:30:00+02')          // November in Athens, 31/10 in UTC
  await bulk(S4, 3, '2026-10-15 12:00:00+03', 'cancelled')
  const oct = await one(db, `SELECT delivr_store_month_orders($1, '2026-10-01') AS c`, [S4])
  const nov = await one(db, `SELECT delivr_store_month_orders($1, '2026-11-20') AS c`, [S4])
  assert(oct.c === 1 && nov.c === 1, `oct ${oct.c}, nov ${nov.c}`)
  const m = await one(db, `SELECT delivr_local_month('2026-10-31 22:30:00+00') AS d`)
  assert(String(m.d.toISOString?.() ?? m.d).startsWith('2026-1'), String(m.d))
})

// This month (in Athens): S1 so far has the orders placed above (all live statuses).
const meter = (uid, store) => as(db, 'authenticated', uid, () => one(db, `SELECT delivr_store_plan_usage($1) AS j`, [store]))
await step('Merchant meter: Basic 15, near at ≥ 80 %, suggests the next plan', async () => {
  const before = (await meter(STAFF, S1)).j
  assert(before.plan.name === 'Basic' && before.limit === 15, JSON.stringify(before))
  const now = await one(db, `SELECT now() AS t`)
  await bulk(S1, 12 - before.orders, now.t.toISOString())
  const u = (await meter(STAFF, S1)).j
  assert(u.orders === 12 && u.state === 'near' && u.pct === 80, JSON.stringify(u))
  assert(u.next_plan?.name === 'Pro', JSON.stringify(u.next_plan))
})
await step('Over the limit the order still goes through (never blocked); meter says over → Pro', async () => {
  const now = await one(db, `SELECT now() AS t`)
  await bulk(S1, 4, now.t.toISOString())
  const r = await place(S1, 'pickup')
  assert(r.j.ok === true, 'order blocked')
  const u = (await meter(STAFF, S1)).j
  assert(u.orders === 17 && u.state === 'over' && u.next_plan?.name === 'Pro', JSON.stringify(u))
})
await step('Meter: staff of another store gets FORBIDDEN, anon cannot call it, admin can', async () => {
  await rejects(meter(OTHER, S1), 'FORBIDDEN')
  await rejects(as(db, 'anon', null, () => db.query(`SELECT delivr_store_plan_usage($1)`, [S1])), 'permission denied')
  assert((await meter(ADMIN, S1)).j.orders === 17, 'admin view')
})
await step('Internal helpers are not callable from the API', async () => {
  for (const sql of [`SELECT delivr_store_month_orders('${S1}', '2026-10-01')`, `SELECT * FROM delivr_store_effective_plan('${S1}')`])
    await rejects(as(db, 'authenticated', STAFF, () => db.query(sql)), 'permission denied')
})

// ── 6. Month-start move ──────────────────────────────────────
// October 2026: S1 (no subscription, Basic 15) 20 orders → Pro;
// S2 (Pro 100) 120 → Plus (smallest that fits); S3 (Premium 500) 600 → flagged;
// S4 1 order → nothing.
await bulk(S1, 20, '2026-10-10 12:00:00+03')
await bulk(S2, 120, '2026-10-12 12:00:00+03')
await bulk(S3, 600, '2026-10-14 12:00:00+03')

await step('Apply: a store cannot run it; anon has no EXECUTE', async () => {
  await rejects(as(db, 'authenticated', STAFF, () => db.query(`SELECT delivr_apply_plan_upgrades('2026-11-01')`)), 'FORBIDDEN')
  await rejects(as(db, 'anon', null, () => db.query(`SELECT delivr_apply_plan_upgrades('2026-11-01')`)), 'permission denied')
})
await step('Admin view before the run: pending moves for November, nothing applied', async () => {
  const r = await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_admin_plan_usage('2026-11-01') AS j`))
  const by = Object.fromEntries(r.j.stores.map(s => [s.name, s]))
  assert(by['Souvlaki Corner'].prev_orders >= 20 && by['Souvlaki Corner'].pending?.to_plan?.name === 'Pro', JSON.stringify(by['Souvlaki Corner']))
  assert(by['Pizza Napoli'].pending?.to_plan?.name === 'Plus', JSON.stringify(by['Pizza Napoli'].pending))
  assert(by['Big Grill'].pending?.kind === 'custom', JSON.stringify(by['Big Grill'].pending))
  assert(by['Quiet Cafe'].pending === null, 'quiet cafe pending')
  await rejects(as(db, 'authenticated', STAFF, () => db.query(`SELECT delivr_admin_plan_usage()`)), 'FORBIDDEN')
})
let applied
await step('Admin runs it: Basic→Pro (new subscription), Pro→Plus, > 500 flagged only', async () => {
  applied = (await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_apply_plan_upgrades('2026-11-01') AS j`))).j
  const up = Object.fromEntries(applied.upgraded.map(u => [u.name, u]))
  assert(applied.evaluated_month.startsWith?.('2026-10') ?? true, applied.evaluated_month)
  assert(up['Souvlaki Corner']?.to === 'Pro' && up['Pizza Napoli']?.to === 'Plus', JSON.stringify(applied.upgraded))
  assert(applied.custom.length === 1 && applied.custom[0].name === 'Big Grill', JSON.stringify(applied.custom))
  assert(!up['Quiet Cafe'] && !up['Big Grill'], 'unexpected move')
  const s1 = await one(db, `SELECT s.status, s.price, s.started_on::text AS d, p.name FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.party_id = $1 AND s.status <> 'cancelled'`, [S1])
  assert(s1.name === 'Pro' && n(s1.price) === 39 && s1.status === 'active' && s1.d === '2026-11-01', JSON.stringify(s1))
  const s2 = await one(db, `SELECT s.price, s.notes, p.name FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.party_id = $1`, [S2])
  assert(s2.name === 'Plus' && n(s2.price) === 79 && s2.notes.includes('Pro → Plus'), JSON.stringify(s2))
  const s3 = await one(db, `SELECT p.name, s.price FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.party_id = $1`, [S3])
  assert(s3.name === 'Premium' && n(s3.price) === 79, 'Big Grill changed')
})
await step('Running it again changes nothing (one move per store per month)', async () => {
  const again = (await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_apply_plan_upgrades('2026-11-01') AS j`))).j
  assert(again.upgraded.length === 0 && again.custom.length === 0, JSON.stringify(again))
  const c = await one(db, `SELECT count(*) AS c FROM store_plan_changes`)
  assert(n(c.c) === 3, `changes ${c.c}`)
})
await step('pg_cron / service path: runs without a signed-in user (superuser session)', async () => {
  const r = await one(db, `SELECT delivr_apply_plan_upgrades('2026-11-01') AS j`)
  assert(r.j.ok === true, JSON.stringify(r.j))
  const sr = await as(db, 'service_role', null, () => one(db, `SELECT delivr_apply_plan_upgrades('2026-11-01') AS j`))
  assert(sr.j.ok === true, 'service_role')
})
await step('Admin view after the run shows what was applied', async () => {
  const r = await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_admin_plan_usage('2026-11-01') AS j`))
  const by = Object.fromEntries(r.j.stores.map(s => [s.name, s]))
  assert(by['Souvlaki Corner'].applied?.to_plan_name === 'Pro' && by['Souvlaki Corner'].pending === null, JSON.stringify(by['Souvlaki Corner']))
  assert(by['Big Grill'].applied?.kind === 'custom', 'custom not shown')
})
await step('November billing charges the new prices (39 € Pro, 79 € Plus)', async () => {
  const b = await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_bill_subscriptions('2026-11-01') AS j`))
  const rows = (await db.query(`SELECT party_id, amount FROM order_charges WHERE kind = 'subscription' AND period_start = '2026-11-01'`)).rows
  const amt = id => n(rows.find(r => r.party_id === id)?.amount)
  assert(amt(S1) === 39 && amt(S2) === 79, `${JSON.stringify(rows)} ${JSON.stringify(b.j)}`)
})
await step('Store-side order charges stayed at zero through all of this', async () => {
  const r = await one(db, `SELECT coalesce(sum(amount), 0) AS s FROM order_charges WHERE kind = 'order' AND party_type = 'store'`)
  assert(n(r.s) === 1, `store order charges ${r.s} (only the 1 € explicit-override order)`)
})

// ── 7. Downgrade (HQ review 12/11/2026: seasonal shops) ──────
// Beach Bar is on Premium since June 2027: August 300 orders (Premium fits,
// stays), September 120 → Plus, October 40 → Pro, November 5 → Basic, and
// back up to Plus after a 200-order December. New Taverna picked Pro on
// 20/10/2027: no move down on that partial October, Basic after November.
const S5 = '10000000-0000-4000-8000-000000000005'
const S6 = '10000000-0000-4000-8000-000000000006'
await db.exec(`
  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, delivery_fee, min_order_amount, standalone_enabled, rating)
  VALUES ('${S5}', 'Beach Bar', 'beach-bar', 'cafe', 'Παραλία 1', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true, 3.0),
         ('${S6}', 'New Taverna', 'new-taverna', 'restaurant', 'Οδός 6', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 0, true, 4.0);
  INSERT INTO store_hours (store_id, day_of_week, open_time, close_time, is_closed)
  SELECT s, d, '00:00', '23:59', false FROM unnest(ARRAY['${S5}','${S6}']::uuid[]) s, generate_series(0, 6) d
  ON CONFLICT DO NOTHING;
  INSERT INTO subscriptions (plan_id, party_type, party_id, status, price, started_on) VALUES
    ('${P_PREM}', 'store', '${S5}', 'active', 150, '2027-06-01'),
    ('${P_PRO}',  'store', '${S6}', 'active', 39,  '2027-10-20');
`)
await bulk(S5, 300, '2027-08-10 12:00:00+03')
await bulk(S5, 120, '2027-09-10 12:00:00+03')
await bulk(S5, 40, '2027-10-10 12:00:00+03')
await bulk(S5, 5, '2027-11-10 12:00:00+02')
await bulk(S5, 200, '2027-12-10 12:00:00+02')
await bulk(S6, 3, '2027-10-25 12:00:00+03')
await bulk(S6, 3, '2027-11-10 12:00:00+02')

const run = period => as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_apply_plan_upgrades($1) AS j`, [period])).then(r => r.j)
const subOf = store => one(db, `SELECT s.status, s.price, s.notes, p.name FROM subscriptions s
                                 JOIN subscription_plans p ON p.id = s.plan_id
                                WHERE s.party_type = 'store' AND s.party_id = $1 AND s.status <> 'cancelled'`, [store])
const names = list => list.map(x => x.name)

await step('Down: a busy August keeps Premium (300 fits only Premium); idle stores go back to Basic', async () => {
  const r = await run('2027-09-01')
  assert(!names(r.upgraded).includes('Beach Bar') && !names(r.downgraded).includes('Beach Bar'), JSON.stringify(r))
  assert((await subOf(S5)).name === 'Premium', 'Beach Bar moved')
  // Pizza Napoli (Plus since 11/2026) had no August orders → the free plan, never billed.
  const pn = r.downgraded.find(d => d.name === 'Pizza Napoli')
  assert(pn?.from === 'Plus' && pn?.to === 'Basic' && n(pn.price) === 0, JSON.stringify(r.downgraded))
})
await step('Down: admin view shows the pending move down before the run', async () => {
  const v = await as(db, 'authenticated', ADMIN, () => one(db, `SELECT delivr_admin_plan_usage('2027-10-01') AS j`))
  const bb = v.j.stores.find(s => s.name === 'Beach Bar')
  assert(bb.pending?.kind === 'downgrade' && bb.pending?.to_plan?.name === 'Plus' && bb.prev_orders === 120, JSON.stringify(bb))
})
await step('Down: 120 orders in September → Plus 79 € from October (smallest plan that fits)', async () => {
  const r = await run('2027-10-01')
  const bb = r.downgraded.find(d => d.name === 'Beach Bar')
  assert(bb?.from === 'Premium' && bb?.to === 'Plus' && n(bb.price) === 79, JSON.stringify(r))
  const s = await subOf(S5)
  assert(s.name === 'Plus' && n(s.price) === 79 && s.status === 'active' && s.notes.includes('Premium → Plus'), JSON.stringify(s))
  const c = await one(db, `SELECT kind, orders_counted FROM store_plan_changes WHERE store_id = $1 AND period_start = '2027-10-01'`, [S5])
  assert(c.kind === 'downgrade' && c.orders_counted === 120, JSON.stringify(c))
})
await step('Down: running it again changes nothing', async () => {
  const r = await run('2027-10-01')
  assert(r.downgraded.length === 0 && r.upgraded.length === 0 && r.custom.length === 0, JSON.stringify(r))
})
await step('Down: 40 in October → Pro 39 €; a shop that started mid-October stays (partial month)', async () => {
  const r = await run('2027-11-01')
  assert(r.downgraded.find(d => d.name === 'Beach Bar')?.to === 'Pro', JSON.stringify(r.downgraded))
  assert(!names(r.downgraded).includes('New Taverna'), 'moved on a partial month')
  assert((await subOf(S6)).name === 'Pro', 'New Taverna moved')
})
await step('Down: 5 in November → Basic (0 €); New Taverna after its first full month → Basic too', async () => {
  const r = await run('2027-12-01')
  const d = Object.fromEntries(r.downgraded.map(x => [x.name, x]))
  assert(d['Beach Bar']?.to === 'Basic' && d['New Taverna']?.to === 'Basic', JSON.stringify(r.downgraded))
  assert(n((await subOf(S5)).price) === 0, 'Basic price')
})
await step('Down: December billing charges nothing to a store on Basic', async () => {
  await as(db, 'authenticated', ADMIN, () => db.query(`SELECT delivr_bill_subscriptions('2027-12-01')`))
  const r = await one(db, `SELECT count(*) AS c FROM order_charges WHERE kind = 'subscription' AND period_start = '2027-12-01'
                             AND party_id IN ('${S5}', '${S6}')`)
  assert(n(r.c) === 0, `charges ${r.c}`)
})
await step('And back up: 200 orders in December → Plus from January (same subscription)', async () => {
  const r = await run('2028-01-01')
  assert(r.upgraded.find(u => u.name === 'Beach Bar')?.to === 'Plus', JSON.stringify(r.upgraded))
  const s = await subOf(S5)
  assert(s.name === 'Plus' && n(s.price) === 79, JSON.stringify(s))
  const c = await one(db, `SELECT count(*) AS c FROM subscriptions WHERE party_id = $1`, [S5])
  assert(n(c.c) === 1, `subscriptions ${c.c}`)
})

// ── 8. «Προβολή στην κορυφή» from the plan ───────────────────
await step('Promotion: Plus and Premium carry it, Basic and Pro do not', async () => {
  const rows = (await db.query(`SELECT name, promoted FROM subscription_plans WHERE audience = 'store' ORDER BY sort_order`)).rows
  assert(rows.map(r => `${r.name}:${r.promoted}`).join() === 'Basic:false,Pro:false,Plus:true,Premium:true', JSON.stringify(rows))
})
await db.exec(`
  UPDATE stores SET marketplace_listed = true WHERE id IN ('${S1}', '${S4}', '${S5}');
  UPDATE stores SET rating = 4.9 WHERE id = '${S1}';
  UPDATE stores SET rating = 4.5 WHERE id = '${S4}';
`)
const market = () => as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores() AS j`)).then(r => r.j)
await step('Promotion: a Plus store is listed first in the marketplace without any admin action', async () => {
  const j = await market()
  assert(j[0]?.name === 'Beach Bar' && j[0].is_promoted === true, JSON.stringify(j.map(s => [s.name, s.is_promoted])))
  assert(j.find(s => s.name === 'Souvlaki Corner').is_promoted === false, 'Basic store promoted')
  const raw = await one(db, `SELECT is_promoted FROM stores WHERE id = $1`, [S5])
  assert(raw.is_promoted === false, 'stores.is_promoted was written')
})
await step('Promotion: the admin flag still works on top (manual override)', async () => {
  await db.exec(`UPDATE stores SET is_promoted = true WHERE id = '${S4}'`)
  const j = await market()
  assert(j.slice(0, 2).map(s => s.name).join() === 'Quiet Cafe,Beach Bar', JSON.stringify(j.map(s => s.name)))
  assert(j.slice(0, 2).every(s => s.is_promoted) && j[2].name === 'Souvlaki Corner', JSON.stringify(j.map(s => [s.name, s.is_promoted])))
})
await step('Promotion: the QR store list (line B) puts plan-promoted stores first too', async () => {
  const rows = (await as(db, 'anon', null, () => db.query(`SELECT store_name, is_promoted, is_open_now FROM delivr_stores_for_property('VILLA1')`))).rows
  const bb = rows.find(r => r.store_name === 'Beach Bar')
  assert(bb?.is_promoted === true, JSON.stringify(rows))
  const open = rows.filter(r => r.is_open_now)
  const lastPromoted = open.map(r => r.is_promoted).lastIndexOf(true)
  const firstPlain = open.map(r => r.is_promoted).indexOf(false)
  assert(firstPlain === -1 || lastPromoted < firstPlain, JSON.stringify(rows.map(r => [r.store_name, r.is_promoted])))
})
await step('Promotion: follows the plan — down to Pro, or a cancelled subscription, and it is gone', async () => {
  await db.exec(`UPDATE subscriptions SET plan_id = '${P_PRO}', price = 39 WHERE party_id = '${S5}'`)
  let j = await market()
  assert(j.find(s => s.name === 'Beach Bar').is_promoted === false && j.at(-1).name === 'Beach Bar', JSON.stringify(j.map(s => s.name)))
  await db.exec(`UPDATE subscriptions SET plan_id = '${P_PREM}', price = 150 WHERE party_id = '${S5}'`)
  j = await market()
  assert(j.find(s => s.name === 'Beach Bar').is_promoted === true, 'Premium not promoted')
  await db.exec(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = now() WHERE party_id = '${S5}'`)
  j = await market()
  assert(j.find(s => s.name === 'Beach Bar').is_promoted === false, 'cancelled still promoted')
})
await step('Promotion helper and plan-move helper are not callable from the API', async () => {
  for (const sql of [`SELECT delivr_store_promoted('${S5}', false)`, `SELECT * FROM delivr_store_plan_move('${S5}', '2027-10-01')`])
    await rejects(as(db, 'anon', null, () => db.query(sql)), 'permission denied')
  await rejects(as(db, 'authenticated', STAFF, () => db.query(`SELECT * FROM delivr_store_plan_move('${S1}', '2027-10-01')`)), 'permission denied')
})

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\nAll ${passed} subscription-tier DB checks passed`)
process.exitCode = failed ? 1 : 0
