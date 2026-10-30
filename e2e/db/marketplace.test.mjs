/**
 * Migrations 014 (open marketplace) + 015 (admin-only store fields) against a
 * throwaway Postgres. Proves three things:
 *   1. they apply on top of 001-013 and are safe to re-run,
 *   2. the marketplace / sign-up RPCs behave and are granted correctly,
 *   3. the QR-per-property flow and the /store/<slug> link are unchanged.
 *
 *   node e2e/db/marketplace.test.mjs
 */
import { makeDb, applyFile, as } from './pglite-db.mjs'

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const OWNER = '00000000-0000-4000-8000-00000000000b'
const OTHER = '00000000-0000-4000-8000-00000000000c'

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

// ── Baseline: the database as it is live today (001-013) ──────────────────
const db = await makeDb({ upTo: 13 })

await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${ADMIN}', 'admin@test.local'), ('${OWNER}', 'owner@test.local'), ('${OTHER}', 'other@test.local');
  UPDATE profiles SET role = 'admin' WHERE id = '${ADMIN}';

  -- A QR-only store near the villa (today's product).
  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, delivery_fee, min_order_amount)
  VALUES ('10000000-0000-4000-8000-000000000001', 'Souvlaki Corner', 'souvlaki-corner', 'restaurant',
          'Πλατεία 1', 'Άγιος Νικόλαος', 35.19, 25.72, 2, 8);
  INSERT INTO store_zones (store_id, name, area, city, delivery_fee, min_order)
  VALUES ('10000000-0000-4000-8000-000000000001', 'Κέντρο', 'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 2, 8);

  -- A store already on its own /store/<slug> link (PR #5).
  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, standalone_enabled, delivery_fee)
  VALUES ('10000000-0000-4000-8000-000000000002', 'Ταβέρνα Μαρίνα', 'taverna-marina', 'restaurant',
          'Ακτή 3', 'Ελούντα', 35.26, 25.72, true, 3);
  INSERT INTO store_zones (store_id, name, area, city, delivery_fee, min_order, free_above)
  VALUES ('10000000-0000-4000-8000-000000000002', 'Ελούντα', 'Ελούντα', 'Ελούντα', 4.5, 25, 60);

  INSERT INTO menu_items (id, store_id, name, price) VALUES
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Πίτα γύρος', 4),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Αρνί', 18.5);

  INSERT INTO properties (id, code, name, address, city, area, lat, lng)
  VALUES ('30000000-0000-4000-8000-000000000001', 'VILLA1', 'Villa Elena', 'Οδός 5',
          'Άγιος Νικόλαος', 'Άγιος Νικόλαος', 35.191, 25.721);
`)

const qrBefore = (await db.query(`SELECT store_name, delivery_fee FROM delivr_stores_for_property('VILLA1') ORDER BY 1`)).rows
const slugBefore = await one(db, `SELECT delivr_store_by_slug('taverna-marina') AS j`)

// ── 1. Apply, and re-apply ─────────────────────────────────────────────────
await step('014 + 015 apply on top of 001-013', async () => {
  await applyFile(db, '014_open_marketplace.sql')
  await applyFile(db, '015_guard_store_admin_fields.sql')
})
await step('014 + 015 are safe to run twice', async () => {
  await applyFile(db, '014_open_marketplace.sql')
  await applyFile(db, '015_guard_store_admin_fields.sql')
})
await step('Existing stores start NOT listed (nothing changes until opt-in)', async () => {
  const r = await one(db, `SELECT count(*)::int n FROM stores WHERE marketplace_listed`)
  assert(r.n === 0, `${r.n} stores listed by default`)
})

// ── 2. QR + store link unchanged ───────────────────────────────────────────
await step('QR flow: same stores and fees for the villa as before', async () => {
  const after = (await db.query(`SELECT store_name, delivery_fee FROM delivr_stores_for_property('VILLA1') ORDER BY 1`)).rows
  assert(JSON.stringify(after) === JSON.stringify(qrBefore), `${JSON.stringify(qrBefore)} → ${JSON.stringify(after)}`)
})
await step('Store link payload unchanged', async () => {
  const after = await one(db, `SELECT delivr_store_by_slug('taverna-marina') AS j`)
  assert(JSON.stringify(after.j) === JSON.stringify(slugBefore.j), 'store_by_slug payload changed')
})

// ── 3. Marketplace reads ───────────────────────────────────────────────────
await step('Empty marketplace answers [] for anon', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores() AS j, delivr_marketplace_areas() AS a`))
  assert(Array.isArray(r.j) && r.j.length === 0, JSON.stringify(r.j))
  assert(r.a.length === 0, JSON.stringify(r.a))
})

await db.exec(`UPDATE stores SET marketplace_listed = true WHERE slug = 'taverna-marina'`)

await step('A listed store shows up with its areas', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_areas() AS a`))
  assert(r.a.some(x => x.area === 'Ελούντα'), JSON.stringify(r.a))
  assert(!r.a.some(x => x.area === 'Άγιος Νικόλαος'), 'unlisted store leaked its area')
})
await step('Area match prices delivery from the zone', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores('ελουντα') AS j`))
  assert(r.j.length === 1, JSON.stringify(r.j))
  const s = r.j[0]
  assert(s.slug === 'taverna-marina' && s.delivers === true, JSON.stringify(s))
  assert(Number(s.delivery_fee) === 4.5 && Number(s.min_order) === 25, `fee ${s.delivery_fee} min ${s.min_order}`)
})
await step('An area no listed store covers returns nothing', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores('Χανιά') AS j`))
  assert(r.j.length === 0, JSON.stringify(r.j))
})
await step('A QR-only store never appears in the marketplace', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores('Άγιος Νικόλαος') AS j, delivr_marketplace_stores() AS b`))
  assert(!r.j.some(s => s.slug === 'souvlaki-corner') && !r.b.some(s => s.slug === 'souvlaki-corner'), 'leaked')
})
await step('Plans are readable by anon', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_public_plans() AS j`))
  assert(r.j.default && Array.isArray(r.j.plans), JSON.stringify(r.j))
})

// ── 4. Shop self sign-up ───────────────────────────────────────────────────
const payload = JSON.stringify({
  name: 'Καφέ Θάλασσα', category: 'cafe', phone: '6912345678', address: 'Παραλία 9',
  city: 'Ηράκλειο', area: 'Αμμουδάρα', postal_code: '71414',
  supports_delivery: true, supports_takeaway: true, delivery_fee: 1.5, min_order: 6,
})
let reg
await step('Anon cannot sign a shop up', async () => {
  await rejects(as(db, 'anon', null, () => db.query(`SELECT delivr_register_store($1::jsonb)`, [payload])), 'permission denied')
})
await step('A signed-in user signs a shop up → pending, owner, hours, first zone', async () => {
  reg = (await as(db, 'authenticated', OWNER, () => one(db, `SELECT delivr_register_store($1::jsonb) AS j`, [payload]))).j
  assert(reg.onboarding_status === 'pending', JSON.stringify(reg))
  assert(reg.slug === 'kafe-thalassa', `slug ${reg.slug}`)
  const s = await one(db, `SELECT * FROM stores WHERE id = $1`, [reg.id])
  assert(s.standalone_enabled && s.marketplace_listed && s.self_registered_at, 'flags not set')
  assert(Number(s.lat) === 0 && Number(s.lng) === 0, 'coords')
  const o = await one(db, `SELECT role FROM store_users WHERE store_id = $1 AND user_id = $2`, [reg.id, OWNER])
  assert(o?.role === 'owner', 'owner row missing')
  const h = await one(db, `SELECT count(*)::int n FROM store_hours WHERE store_id = $1`, [reg.id])
  assert(h.n === 7, `${h.n} hour rows`)
  const z = await one(db, `SELECT area, delivery_fee FROM store_zones WHERE store_id = $1`, [reg.id])
  assert(z?.area === 'Αμμουδάρα' && Number(z.delivery_fee) === 1.5, JSON.stringify(z))
  const p = await one(db, `SELECT role FROM profiles WHERE id = $1`, [OWNER])
  assert(p.role === 'store', `profile role ${p.role}`)
})
await step('Same account cannot sign up a second shop', async () => {
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`SELECT delivr_register_store($1::jsonb)`, [payload])), 'ALREADY_REGISTERED')
})
await step('Second shop with the same name gets a unique slug', async () => {
  const r = (await as(db, 'authenticated', OTHER, () => one(db, `SELECT delivr_register_store($1::jsonb) AS j`, [payload]))).j
  assert(r.slug === 'kafe-thalassa-2', r.slug)
})
await step('Bad input is refused with a clear code', async () => {
  const bad = JSON.stringify({ name: 'X', phone: '1', address: '', city: '' })
  await rejects(as(db, 'authenticated', ADMIN, () => db.query(`SELECT delivr_register_store($1::jsonb)`, [bad])), 'NAME_REQUIRED')
})
await step('A pending shop is not in the marketplace and cannot take orders', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores('Αμμουδάρα') AS j`))
  assert(r.j.length === 0, 'pending store listed')
  await db.exec(`INSERT INTO menu_items (id, store_id, name, price) VALUES ('20000000-0000-4000-8000-000000000003', '${reg.id}', 'Freddo', 3.5)`)
  await rejects(as(db, 'anon', null, () => db.query(
    `SELECT delivr_place_order(NULL, $1, 'pickup', '[{"menu_item_id":"20000000-0000-4000-8000-000000000003","quantity":2}]'::jsonb,
       '{"name":"Test","phone":"6900000000"}'::jsonb, NULL, NULL, 'cash', 'app', NULL)`, [reg.id])), 'STORE_NOT_FOUND')
})

// ── 5. 015: the owner cannot approve themselves ────────────────────────────
await step('Owner cannot set own onboarding_status / commission (015)', async () => {
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`UPDATE stores SET onboarding_status = 'active' WHERE id = $1`, [reg.id])), 'ADMIN_ONLY_FIELD')
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`UPDATE stores SET billing_mode = 'none' WHERE id = $1`, [reg.id])), 'ADMIN_ONLY_FIELD')
})
await step('Owner can still edit what the merchant screens edit', async () => {
  await as(db, 'authenticated', OWNER, () => db.query(
    `UPDATE stores SET name = 'Καφέ Θάλασσα!', delivery_fee = 2, is_open = true, marketplace_listed = true WHERE id = $1`, [reg.id]))
  const s = await one(db, `SELECT name FROM stores WHERE id = $1`, [reg.id])
  assert(s.name === 'Καφέ Θάλασσα!', s.name)
})
await step('Admin approves → listed, orderable with channel "app"', async () => {
  await as(db, 'authenticated', ADMIN, () => db.query(`UPDATE stores SET onboarding_status = 'active' WHERE id = $1`, [reg.id]))
  // Whatever the clock says when this runs, keep the shop open.
  await db.query(`UPDATE store_hours SET open_time = '00:00', close_time = '23:59' WHERE store_id = $1`, [reg.id])
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores('Αμμουδάρα') AS j`))
  assert(r.j.length === 1 && r.j[0].delivers === true, JSON.stringify(r.j))
  const o = await as(db, 'anon', null, () => one(db,
    `SELECT delivr_place_order(NULL, $1, 'delivery', '[{"menu_item_id":"20000000-0000-4000-8000-000000000003","quantity":2}]'::jsonb,
       '{"name":"Test","phone":"6900000000"}'::jsonb, NULL, NULL, 'cash', 'app',
       '{"street":"Οδός 1","area":"Αμμουδάρα","city":"Ηράκλειο"}'::jsonb) AS j`, [reg.id]))
  assert(o.j.ok === true, JSON.stringify(o.j))
  const row = await one(db, `SELECT channel, delivery_fee FROM orders WHERE id = $1`, [o.j.order_id])
  assert(row.channel === 'app', row.channel)
  assert(Number(row.delivery_fee) === 1.5, `fee ${row.delivery_fee}`)
})
await step('A self-registered shop stays out of the QR property list', async () => {
  await db.exec(`UPDATE properties SET area = 'Αμμουδάρα', city = 'Ηράκλειο' WHERE code = 'VILLA1'`)
  const r = (await db.query(`SELECT store_name FROM delivr_stores_for_property('VILLA1')`)).rows
  assert(!r.some(x => x.store_name.startsWith('Καφέ')), JSON.stringify(r))
  await db.exec(`UPDATE properties SET area = 'Άγιος Νικόλαος', city = 'Άγιος Νικόλαος' WHERE code = 'VILLA1'`)
})
await step('Takeaway-only area match by the store\'s own city', async () => {
  const r = await as(db, 'anon', null, () => one(db, `SELECT delivr_marketplace_stores(NULL, NULL, 'Ηράκλειο') AS j`))
  const s = r.j.find(x => x.slug === 'kafe-thalassa')
  assert(s && s.pickup === true, JSON.stringify(r.j))
})
await step('Admin-side writes and RPCs are unaffected by 015', async () => {
  await as(db, 'authenticated', ADMIN, () => db.query(`UPDATE stores SET billing_mode = 'commission', billing_value = 8 WHERE slug = 'souvlaki-corner'`))
  const o = await as(db, 'anon', null, () => one(db,
    `SELECT delivr_place_order('VILLA1', '10000000-0000-4000-8000-000000000001', 'delivery',
       '[{"menu_item_id":"20000000-0000-4000-8000-000000000001","quantity":3}]'::jsonb,
       '{"name":"Guest","phone":"6900000001"}'::jsonb) AS j`))
  assert(o.j.ok === true && o.j.property?.code === 'VILLA1', JSON.stringify(o.j))
})

console.log(failed ? `\n${failed} failed` : '\nAll DB checks passed')
process.exitCode = failed ? 1 : 0
