/**
 * Store plans paid by card (migration 019 + the plan-billing / stripe-webhook
 * edge functions) against a throwaway Postgres (PGlite) and a MOCKED Stripe.
 * Nothing touches the live project or the real Stripe account.
 *
 * The webhook is exercised with SIGNED events (HMAC-SHA256 `t=…,v1=…` over
 * `${t}.${payload}`, exactly what Stripe sends) through the same
 * supabase/functions/_shared/planBilling.ts the edge function runs, with
 * delivr_stripe_apply() executed as service_role in PGlite.
 *
 *   node e2e/db/stripe-billing.test.mjs
 */
import { makeDb, applyFile, as } from './pglite-db.mjs'
import { randomBytes } from 'node:crypto'
import {
  readConfig, handleStripeWebhook, signStripePayload, startCheckout, startPortal, stripeCaller,
} from '../../supabase/functions/_shared/planBilling.ts'

const OWNER = '00000000-0000-4000-8000-0000000000a1'
const STAFF = '00000000-0000-4000-8000-0000000000a2'
const ADMIN = '00000000-0000-4000-8000-0000000000a3'
const S1 = '10000000-0000-4000-8000-000000000001'   // pays by card (Stripe)
const S2 = '10000000-0000-4000-8000-000000000002'   // Pro, admin-managed (no Stripe)
const S3 = '10000000-0000-4000-8000-000000000003'   // checkout tests
const P = {
  basic: '40000000-0000-4000-8000-000000000001', pro: '40000000-0000-4000-8000-000000000002',
  plus: '40000000-0000-4000-8000-000000000003', premium: '40000000-0000-4000-8000-000000000004',
}

let failed = 0, passed = 0
const step = async (name, fn) => {
  try { await fn(); passed++; console.log(`✅ ${name}`) }
  catch (e) { failed++; console.log(`❌ ${name} — ${String(e.message).split('\n')[0]}`) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
const rejects = async (p, code) => {
  try { await p } catch (e) {
    if (code && !String(e.message).includes(code)) throw new Error(`expected ${code}, got: ${e.message}`)
    return
  }
  throw new Error('expected an error')
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]

// ── Database: everything up to 019, plans as live after 018 ──────────────
const db = await makeDb()
await db.exec(`
  INSERT INTO auth.users (id, email) VALUES
    ('${OWNER}', 'owner@test.local'), ('${STAFF}', 'staff@test.local'), ('${ADMIN}', 'admin@test.local');
  UPDATE profiles SET role = 'admin' WHERE id = '${ADMIN}';
  INSERT INTO subscription_plans (id, name, audience, price, billing_cycle, trial_days, commission_mode,
                                  commission_value, included_orders, features, sort_order, promoted) VALUES
    ('${P.basic}',   'Basic',   'store', 0,   'month', 0,  'none', 0, 15,  '[]', 1, false),
    ('${P.pro}',     'Pro',     'store', 39,  'month', 14, 'none', 0, 100, '[]', 2, false),
    ('${P.plus}',    'Plus',    'store', 79,  'month', 14, 'none', 0, 250, '[]', 3, true),
    ('${P.premium}', 'Premium', 'store', 150, 'month', 14, 'none', 0, 500, '[]', 4, true);
  INSERT INTO stores (id, name, slug, category, address, city, lat, lng, delivery_fee, min_order_amount)
  VALUES ('${S1}', 'Card Shop', 'card-shop', 'restaurant', 'Οδός 1', 'Ηράκλειο', 35.3, 25.1, 2, 0),
         ('${S2}', 'Manual Shop', 'manual-shop', 'restaurant', 'Οδός 2', 'Ηράκλειο', 35.3, 25.1, 2, 0),
         ('${S3}', 'New Shop', 'new-shop', 'cafe', 'Οδός 3', 'Ηράκλειο', 35.3, 25.1, 2, 0);
  INSERT INTO store_users (store_id, user_id, role) VALUES
    ('${S1}', '${OWNER}', 'owner'), ('${S3}', '${OWNER}', 'owner'), ('${S3}', '${STAFF}', 'staff');
  -- S2 has paid Pro by bank transfer for months (admin-made subscription).
  INSERT INTO subscriptions (plan_id, party_type, party_id, status, price, billing_cycle, started_on)
  VALUES ('${P.pro}', 'store', '${S2}', 'active', 39, 'month', (date_trunc('month', CURRENT_DATE) - interval '3 months')::date);
`)

// ── Stripe config (fake ids, no real keys) ───────────────────────────────
const WHSEC = 'whsec_test_' + randomBytes(16).toString('hex')
const ENV = {
  STRIPE_SECRET_KEY: 'sk_test_mocked_' + randomBytes(8).toString('hex'),
  STRIPE_WEBHOOK_SECRET: WHSEC,
  STRIPE_TAX_RATE_ID: 'txr_test_vat24',
  STRIPE_PRICE_PRO: 'price_test_pro', STRIPE_PRICE_PLUS: 'price_test_plus', STRIPE_PRICE_PREMIUM: 'price_test_premium',
}
const cfg = readConfig(k => ENV[k])

const apply = a => as(db, 'service_role', null, async () => (await db.query(
  `SELECT delivr_stripe_apply($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10::timestamptz) AS r`,
  [a.event_id, a.event_type, a.action, a.store_id, a.plan_key, a.status, a.customer, a.subscription, a.price, a.period_end],
)).rows[0].r)

const now = () => Math.floor(Date.now() / 1000)
let evtN = 0
const event = (type, object, id = `evt_test_${++evtN}`) => JSON.stringify({ id, object: 'event', type, data: { object } })
const send = async (raw, { secret = WHSEC, t = now(), header } = {}) =>
  handleStripeWebhook({ raw, signature: header === undefined ? await signStripePayload(raw, secret, t) : header,
                        cfg, nowSec: now(), apply })
const s1sub = () => one(`SELECT s.*, p.name AS plan FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                          WHERE party_id = '${S1}' ORDER BY s.created_at DESC LIMIT 1`)
const count = async (sql) => Number((await one(sql)).n)

const META = { app: 'delivr', plan: 'plus', store_id: S1 }
const checkoutDone = (over = {}) => ({
  id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid',
  customer: 'cus_test_S1', subscription: 'sub_test_S1', client_reference_id: S1, metadata: META, ...over,
})
const invoice = (over = {}) => ({
  id: 'in_test_1', object: 'invoice', customer: 'cus_test_S1', subscription: 'sub_test_S1',
  amount_paid: 9796, billing_reason: 'subscription_cycle',
  subscription_details: { metadata: META },
  lines: { data: [{ price: { id: 'price_test_plus' }, proration: false, period: { start: now(), end: now() + 30 * 86400 } }] },
  ...over,
})
const subscription = (over = {}) => ({
  id: 'sub_test_S1', object: 'subscription', customer: 'cus_test_S1', status: 'active', metadata: META,
  items: { data: [{ price: { id: 'price_test_plus' } }] }, current_period_end: now() + 30 * 86400, ...over,
})

// ═══ 1. Migration ════════════════════════════════════════════════════════
await step('019 applies twice (additive, idempotent)', async () => {
  await applyFile(db, '019_stripe_plan_billing.sql')
  for (const col of ['stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id', 'current_period_end']) {
    const r = await one(`SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = $1`, [col])
    assert(r?.ok, `subscriptions.${col} missing`)
  }
})

await step('Only the service role may apply Stripe events; clients cannot read billing accounts', async () => {
  await rejects(as(db, 'anon', null, () => db.query(`SELECT delivr_stripe_apply('e', 't', 'activate')`)), 'permission denied')
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`SELECT delivr_stripe_apply('e', 't', 'activate')`)), 'permission denied')
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`SELECT * FROM store_billing_accounts`)), 'permission denied')
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`INSERT INTO stripe_webhook_events (id, type) VALUES ('x', 'y')`)), 'permission denied')
})

// ═══ 2. Webhook: signature ═══════════════════════════════════════════════
await step('Bad signature, wrong secret, missing header and stale timestamp are rejected (400), nothing written', async () => {
  const raw = event('checkout.session.completed', checkoutDone())
  const forged = await send(raw, { secret: 'whsec_wrong' })
  assert(forged.status === 400 && forged.body.error === 'invalid_signature', `forged → ${forged.status}`)
  const missing = await send(raw, { header: null })
  assert(missing.status === 400, `no header → ${missing.status}`)
  const garbage = await send(raw, { header: 't=123,v1=deadbeef' })
  assert(garbage.status === 400, `garbage → ${garbage.status}`)
  const stale = await send(raw, { t: now() - 3600 })
  assert(stale.status === 400, `stale → ${stale.status}`)
  const tampered = await (async () => {
    const h = await signStripePayload(raw, WHSEC, now())
    return handleStripeWebhook({ raw: raw.replace('"paid"', '"unpaid"'), signature: h, cfg, nowSec: now(), apply })
  })()
  assert(tampered.status === 400, `tampered body → ${tampered.status}`)
  assert(await count(`SELECT count(*) n FROM subscriptions WHERE party_id = '${S1}'`) === 0, 'a row was written')
  const noSecret = await handleStripeWebhook({ raw, signature: 'x', cfg: readConfig(() => undefined), nowSec: now(), apply })
  assert(noSecret.status === 400 && noSecret.body.error === 'webhook_not_configured', 'no secret must refuse')
})

// ═══ 3. Shared account: other products are ignored ═══════════════════════
await step('Events of other apps on the shared account are ignored (200), nothing written', async () => {
  const r1 = await send(event('checkout.session.completed', checkoutDone({ metadata: { app: 'staylink', user_id: 'u1', store_id: S1 } })))
  assert(r1.status === 200 && r1.body.ignored === 'not_delivr', JSON.stringify(r1.body))
  const r2 = await send(event('invoice.paid', invoice({ subscription_details: { metadata: {} }, lines: { data: [] } })))
  assert(r2.status === 200 && r2.body.ignored === 'not_delivr', JSON.stringify(r2.body))
  const r3 = await send(event('customer.subscription.deleted', subscription({ metadata: { app: 'rentflow' } })))
  assert(r3.status === 200 && r3.body.ignored === 'not_delivr', JSON.stringify(r3.body))
  const r4 = await send(event('payment_intent.succeeded', { id: 'pi_1', metadata: { app: 'delivr' } }))
  assert(r4.status === 200 && r4.body.ignored === 'event_type', JSON.stringify(r4.body))
  assert(await count(`SELECT count(*) n FROM subscriptions WHERE party_id = '${S1}'`) === 0, 'a row was written')
  assert(await count(`SELECT count(*) n FROM stripe_webhook_events`) === 0, 'foreign events must not be logged')
})

// ═══ 4. Paid ═════════════════════════════════════════════════════════════
const paidEvt = event('checkout.session.completed', checkoutDone(), 'evt_paid_1')
await step('Paid checkout → store on Plus (79 €), active, Stripe ids kept, top placement on', async () => {
  const r = await send(paidEvt)
  assert(r.status === 200 && r.body.result?.ok, JSON.stringify(r.body))
  const s = await s1sub()
  assert(s.plan === 'Plus' && Number(s.price) === 79 && s.status === 'active', `${s.plan} ${s.price} ${s.status}`)
  assert(s.stripe_subscription_id === 'sub_test_S1' && s.stripe_customer_id === 'cus_test_S1', 'stripe ids')
  const acct = await one(`SELECT stripe_customer_id FROM store_billing_accounts WHERE store_id = '${S1}'`)
  assert(acct?.stripe_customer_id === 'cus_test_S1', 'customer not linked to the store')
  const eff = await one(`SELECT plan_name, plan_limit FROM delivr_store_effective_plan('${S1}')`)
  assert(eff.plan_name === 'Plus' && eff.plan_limit === 250, `effective plan ${eff.plan_name}`)
  const promo = await one(`SELECT delivr_store_promoted('${S1}', false) AS p`)
  assert(promo.p === true, 'Plus must be promoted')
})

await step('The same event delivered twice changes nothing (idempotent)', async () => {
  await db.query(`UPDATE subscriptions SET notes = 'marker' WHERE party_id = '${S1}'`)
  const r = await send(paidEvt)
  assert(r.status === 200 && r.body.result?.duplicate === true, JSON.stringify(r.body))
  assert(await count(`SELECT count(*) n FROM subscriptions WHERE party_id = '${S1}'`) === 1, 'second row')
  assert((await s1sub()).notes === 'marker', 'row was rewritten')
})

await step('Renewal paid (invoice.paid) → active, period end stored; €0 trial invoice ignored', async () => {
  const r = await send(event('invoice.paid', invoice()))
  assert(r.status === 200 && r.body.result?.ok, JSON.stringify(r.body))
  const s = await s1sub()
  assert(s.status === 'active' && s.current_period_end, 'period end missing')
  const zero = await send(event('invoice.paid', invoice({ amount_paid: 0, billing_reason: 'subscription_create' })))
  assert(zero.body.ignored === 'zero_amount', JSON.stringify(zero.body))
})

// ═══ 5. Failed ═══════════════════════════════════════════════════════════
await step('Payment failed → past_due (orders keep flowing; plan unchanged)', async () => {
  const r = await send(event('invoice.payment_failed', invoice({ amount_paid: 0 })))
  assert(r.status === 200 && r.body.result?.status === 'past_due', JSON.stringify(r.body))
  const s = await s1sub()
  assert(s.status === 'past_due' && s.plan === 'Plus', `${s.status} ${s.plan}`)
  // the retry succeeds
  await send(event('invoice.paid', invoice()))
  assert((await s1sub()).status === 'active', 'retry did not reactivate')
})

// ═══ 6. Updated (plan change in the portal) ══════════════════════════════
await step('Subscription updated to the Premium price → Premium 150 € (price wins over stale metadata)', async () => {
  const r = await send(event('customer.subscription.updated', subscription({ items: { data: [{ price: { id: 'price_test_premium' } }] } })))
  assert(r.status === 200 && r.body.result?.ok, JSON.stringify(r.body))
  const s = await s1sub()
  assert(s.plan === 'Premium' && Number(s.price) === 150 && s.stripe_price_id === 'price_test_premium', `${s.plan} ${s.price}`)
  const trial = await send(event('customer.subscription.updated', subscription({ status: 'incomplete' })))
  assert(trial.body.ignored === 'status_incomplete', JSON.stringify(trial.body))
})

await step('Proration invoice (1st line = credit for the OLD price) keeps Premium; period end only from the regular line', async () => {
  const before = await s1sub()
  const t0 = now()
  // Classic shape: only proration lines → nothing is taken from the lines.
  const r1 = await send(event('invoice.paid', invoice({ billing_reason: 'subscription_update', amount_paid: 8680, lines: { data: [
    { price: { id: 'price_test_plus' }, proration: true, amount: -7900, period: { start: t0, end: t0 + 20 * 86400 } },
    { price: { id: 'price_test_premium' }, proration: true, amount: 15000, period: { start: t0, end: t0 + 20 * 86400 } },
  ] } })))
  assert(r1.status === 200 && r1.body.result?.ok, JSON.stringify(r1.body))
  let s = await s1sub()
  assert(s.plan === 'Premium' && Number(s.price) === 150 && s.stripe_price_id === 'price_test_premium', `went back to ${s.plan} / ${s.stripe_price_id}`)
  assert(String(s.current_period_end) === String(before.current_period_end), 'period end taken from a proration line')
  // Basil shape: credit first, then the regular line (parent.subscription_item_details.proration=false).
  const end = t0 + 40 * 86400
  const r2 = await send(event('invoice.paid', invoice({ amount_paid: 23680, lines: { data: [
    { pricing: { price_details: { price: 'price_test_plus' } }, parent: { subscription_item_details: { proration: true } }, period: { end: t0 } },
    { pricing: { price_details: { price: 'price_test_premium' } }, parent: { subscription_item_details: { proration: false } }, period: { end } },
  ] } })))
  assert(r2.status === 200 && r2.body.result?.ok, JSON.stringify(r2.body))
  s = await s1sub()
  assert(s.plan === 'Premium' && s.stripe_price_id === 'price_test_premium', `went back to ${s.plan}`)
  assert(new Date(s.current_period_end).getTime() === end * 1000, `period end ${s.current_period_end}`)
  // Even a regular line naming another price does not move a row this subscription owns.
  await send(event('invoice.paid', invoice({ lines: { data: [{ price: { id: 'price_test_plus' }, proration: false, period: { end } }] } })))
  s = await s1sub()
  assert(s.plan === 'Premium', `invoice moved the plan to ${s.plan}`)
})

// ═══ 7. Ledger & automatic moves leave Stripe rows alone ═════════════════
await step('Monthly «Έκδοση χρεώσεων» skips the card-paid store, still bills the bank-transfer one', async () => {
  const r = await as(db, 'authenticated', ADMIN, () => db.query(`SELECT delivr_bill_subscriptions() AS r`))
  assert(r.rows[0].r.ok, 'billing run failed')
  assert(await count(`SELECT count(*) n FROM order_charges WHERE kind = 'subscription' AND party_id = '${S1}'`) === 0,
         'Stripe-paid store charged twice')
  assert(await count(`SELECT count(*) n FROM order_charges WHERE kind = 'subscription' AND party_id = '${S2}'`) === 1,
         'manual store not billed')
  await rejects(as(db, 'authenticated', OWNER, () => db.query(`SELECT delivr_bill_subscriptions()`)), 'FORBIDDEN')
})

await step('Automatic plan move: none for the card-paid store, unchanged for the others', async () => {
  // Both had 0 orders last month; S2 (Pro since 3 months) would move down to Basic.
  await db.query(`UPDATE subscriptions SET started_on = (date_trunc('month', CURRENT_DATE) - interval '3 months')::date WHERE party_id = '${S1}'`)
  const m1 = await db.query(`SELECT * FROM delivr_store_plan_move('${S1}', date_trunc('month', CURRENT_DATE)::date)`)
  assert(m1.rows.length === 0, `card-paid store would move: ${JSON.stringify(m1.rows)}`)
  const m2 = await one(`SELECT move_kind FROM delivr_store_plan_move('${S2}', date_trunc('month', CURRENT_DATE)::date)`)
  assert(m2?.move_kind === 'downgrade', `manual store: ${m2?.move_kind}`)
})

// ═══ 8. Cancel ═══════════════════════════════════════════════════════════
await step('Subscription deleted (cancel) → cancelled, the store is Basic again, no top placement', async () => {
  const r = await send(event('customer.subscription.deleted', subscription({ status: 'canceled' })))
  assert(r.status === 200 && r.body.result?.status === 'cancelled', JSON.stringify(r.body))
  const s = await s1sub()
  assert(s.status === 'cancelled' && s.cancelled_at, 'not cancelled')
  const eff = await one(`SELECT plan_name FROM delivr_store_effective_plan('${S1}')`)
  assert(eff.plan_name === 'Basic', `effective plan ${eff.plan_name}`)
  assert((await one(`SELECT delivr_store_promoted('${S1}', false) AS p`)).p === false, 'still promoted')
  const late = await send(event('invoice.paid', invoice()))
  assert(late.status === 200 && late.body.result?.ignored === 'subscription_cancelled', `late event: ${JSON.stringify(late.body)}`)
})

// ═══ 9. Unknown / malformed / DB down ════════════════════════════════════
await step('Unknown store or customer → 200 ignored (never a 500 that Stripe retries forever)', async () => {
  const ghost = '10000000-0000-4000-8000-0000000000ff'
  const r1 = await send(event('checkout.session.completed', checkoutDone({
    metadata: { ...META, store_id: ghost }, client_reference_id: ghost, customer: 'cus_x', subscription: 'sub_x' })))
  assert(r1.status === 200 && r1.body.result?.ignored === 'unknown_store', JSON.stringify(r1.body))
  const r2 = await send(event('checkout.session.completed', checkoutDone({
    metadata: { ...META, store_id: 'not-a-uuid' }, client_reference_id: null, customer: 'cus_y', subscription: 'sub_y' })))
  assert(r2.status === 200 && r2.body.result?.ignored === 'unknown_store', JSON.stringify(r2.body))
  const r3 = await send(event('invoice.payment_failed', invoice({ customer: 'cus_z', subscription: 'sub_z',
    subscription_details: { metadata: { app: 'delivr' } } })))
  assert(r3.status === 200 && r3.body.result?.ignored === 'unknown_store', JSON.stringify(r3.body))
})

await step('Database failure → 500 so Stripe retries', async () => {
  const r = await handleStripeWebhook({ raw: paidEvt.replace('evt_paid_1', 'evt_paid_9'), signature: null, cfg, nowSec: now(),
    apply: async () => { throw new Error('db down') } })
  assert(r.status === 400, 'unsigned must still be 400')
  const raw = event('checkout.session.completed', checkoutDone(), 'evt_dbdown')
  const r2 = await handleStripeWebhook({ raw, signature: await signStripePayload(raw, WHSEC, now()), cfg, nowSec: now(),
    apply: async () => { throw new Error('db down') } })
  assert(r2.status === 500, `got ${r2.status}`)
})

// ═══ 10. Checkout & portal with a mocked Stripe ══════════════════════════
const testDb = {
  async canManage(userId, storeId) {
    const r = await one(`SELECT role FROM store_users WHERE store_id = $1 AND user_id = $2`, [storeId, userId])
    if (r && ['owner', 'manager'].includes(r.role)) return true
    return (await one(`SELECT role FROM profiles WHERE id = $1`, [userId]))?.role === 'admin'
  },
  async storeName(id) { return (await one(`SELECT name FROM stores WHERE id = $1`, [id]))?.name ?? null },
  async plan(k) {
    const r = await one(`SELECT id, name, price, trial_days, billing_cycle FROM subscription_plans
                          WHERE audience = 'store' AND is_active AND lower(name) = $1`, [k])
    return r ? { ...r, price: Number(r.price) } : null
  },
  async customerFor(id) { return (await one(`SELECT stripe_customer_id FROM store_billing_accounts WHERE store_id = $1`, [id]))?.stripe_customer_id ?? null },
  async saveCustomer(id, c) {
    await db.query(`INSERT INTO store_billing_accounts (store_id, stripe_customer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, c])
    return (await one(`SELECT stripe_customer_id FROM store_billing_accounts WHERE store_id = $1`, [id])).stripe_customer_id
  },
  async liveStripeSubscription(id) {
    const r = await one(`SELECT s.status, p.name AS plan_name FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                          WHERE party_type = 'store' AND party_id = $1 AND status IN ('trial','active','past_due','paused')
                            AND stripe_subscription_id IS NOT NULL LIMIT 1`, [id])
    return r ?? null
  },
  async hadStripeSubscription(id) { return (await count(`SELECT count(*) n FROM subscriptions WHERE party_id = '${id}' AND stripe_subscription_id IS NOT NULL`)) > 0 },
  async appUrl() { return 'https://delivr.example/' },
}

function mockStripe(prices, { taxRate = TAX_RATE, subs = [], open = [] } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const u = new URL(url)
    const params = new URLSearchParams(init.body ?? u.search.slice(1))
    calls.push({ method: init.method, path: u.pathname, params, auth: init.headers.Authorization,
                 idem: init.headers['Idempotency-Key'] })
    const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (u.pathname.startsWith('/v1/prices/')) return ok(prices[u.pathname.split('/').pop()] ?? {})
    if (u.pathname.startsWith('/v1/tax_rates/')) return ok(taxRate)
    if (u.pathname === '/v1/subscriptions' && init.method === 'GET') return ok({ data: subs })
    if (u.pathname === '/v1/checkout/sessions' && init.method === 'GET') return ok({ data: open })
    if (/\/v1\/checkout\/sessions\/[^/]+\/expire$/.test(u.pathname)) return ok({ status: 'expired' })
    if (u.pathname === '/v1/customers') return ok({ id: 'cus_new_S3' })
    if (u.pathname === '/v1/checkout/sessions') return ok({ id: 'cs_new', url: 'https://checkout.stripe.test/c/cs_new' })
    if (u.pathname === '/v1/billing_portal/sessions') return ok({ url: 'https://billing.stripe.test/p/1' })
    return new Response('{}', { status: 404 })
  }
  return { calls, stripe: stripeCaller(fetchImpl, ENV.STRIPE_SECRET_KEY) }
}
const TAX_RATE = { id: 'txr_test_vat24', active: true, inclusive: false, percentage: 24 }
const PRICES = {
  price_test_pro: { id: 'price_test_pro', active: true, unit_amount: 3900, currency: 'eur', recurring: { interval: 'month' }, tax_behavior: 'exclusive' },
  price_test_plus: { id: 'price_test_plus', active: true, unit_amount: 7900, currency: 'eur', recurring: { interval: 'month' }, tax_behavior: 'exclusive' },
  price_test_premium: { id: 'price_test_premium', active: true, unit_amount: 15000, currency: 'eur', recurring: { interval: 'month' }, tax_behavior: 'exclusive' },
}

await step('No keys → not configured, every plan «σύντομα», checkout refused (503)', async () => {
  const off = readConfig(() => undefined)
  assert(!off.configured && off.payablePlans.length === 0, 'should be off')
  assert(off.missing.includes('STRIPE_SECRET_KEY') && off.missing.includes('STRIPE_PRICE_PLUS'), off.missing.join())
  const noVat = readConfig(k => (k.includes('TAX') ? undefined : ENV[k]))
  assert(!noVat.configured, 'without VAT (+ ΦΠΑ) it must stay off')
  const onlyPro = readConfig(k => (k === 'STRIPE_PRICE_PLUS' || k === 'STRIPE_PRICE_PREMIUM' ? undefined : ENV[k]))
  assert(onlyPro.configured && onlyPro.payablePlans.join() === 'pro', 'only Pro payable')
  const { stripe, calls } = mockStripe(PRICES)
  const r = await startCheckout({ cfg: off, stripe, db: testDb, user: { id: OWNER, email: 'owner@test.local' }, storeId: S3, planKey: 'plus' })
  assert(r.status === 503 && r.body.code === 'billing_unavailable' && calls.length === 0, JSON.stringify(r.body))
})

await step('Checkout: subscription mode, app=delivr + plan + store_id on session AND subscription, VAT added, 14-day trial', async () => {
  const { stripe, calls } = mockStripe(PRICES)
  const r = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: 'owner@test.local' }, storeId: S3, planKey: 'Plus' })
  assert(r.status === 200 && r.body.url === 'https://checkout.stripe.test/c/cs_new', JSON.stringify(r.body))
  const cust = calls.find(c => c.path === '/v1/customers')
  assert(cust?.params.get('metadata[app]') === 'delivr' && cust.params.get('metadata[store_id]') === S3, 'customer metadata')
  assert(cust.idem === `delivr-customer-${S3}`, 'customer creation must be idempotent per store')
  const s = calls.find(c => c.path === '/v1/checkout/sessions' && c.method === 'POST').params
  const expect = {
    mode: 'subscription', customer: 'cus_new_S3', client_reference_id: S3,
    'line_items[0][price]': 'price_test_plus', 'line_items[0][quantity]': '1',
    'metadata[app]': 'delivr', 'metadata[plan]': 'plus', 'metadata[store_id]': S3,
    'subscription_data[metadata][app]': 'delivr', 'subscription_data[metadata][plan]': 'plus',
    'subscription_data[metadata][store_id]': S3, 'subscription_data[trial_period_days]': '14',
    'subscription_data[default_tax_rates][0]': 'txr_test_vat24', 'tax_id_collection[enabled]': 'true',
    success_url: 'https://delivr.example/merchant?billing=success', cancel_url: 'https://delivr.example/merchant?billing=cancel',
  }
  for (const [k, v] of Object.entries(expect)) assert(s.get(k) === v, `${k} = ${s.get(k)} (want ${v})`)
  assert(calls.every(c => c.auth === `Bearer ${ENV.STRIPE_SECRET_KEY}`), 'auth header')
  assert((await testDb.customerFor(S3)) === 'cus_new_S3', 'customer not saved')
})

await step('Checkout refuses a Stripe price that differs from the published plan (no wrong charge)', async () => {
  const { stripe, calls } = mockStripe({ ...PRICES, price_test_pro: { ...PRICES.price_test_pro, unit_amount: 2900 } })
  const r = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S3, planKey: 'pro' })
  assert(r.status === 503 && r.body.error === 'price_mismatch', JSON.stringify(r.body))
  assert(!calls.some(c => c.path === '/v1/checkout/sessions' && c.method === 'POST'), 'session was created')
  const { stripe: s2 } = mockStripe({ ...PRICES, price_test_pro: { ...PRICES.price_test_pro, tax_behavior: 'inclusive' } })
  const r2 = await startCheckout({ cfg, stripe: s2, db: testDb, user: { id: OWNER, email: null }, storeId: S3, planKey: 'pro' })
  assert(r2.status === 503, 'VAT-inclusive price must be refused (+ ΦΠΑ)')
})

await step('Checkout: staff (not owner/manager) 403, bad plan 400, already card-paid 409, no trial the second time', async () => {
  const { stripe } = mockStripe(PRICES)
  const staff = await startCheckout({ cfg, stripe, db: testDb, user: { id: STAFF, email: null }, storeId: S3, planKey: 'pro' })
  assert(staff.status === 403, `staff → ${staff.status}`)
  const basic = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S3, planKey: 'basic' })
  assert(basic.status === 400, `basic → ${basic.status}`)
  // S3 subscribes (webhook), then tries again
  await send(event('checkout.session.completed', checkoutDone({ metadata: { app: 'delivr', plan: 'pro', store_id: S3 },
    client_reference_id: S3, customer: 'cus_new_S3', subscription: 'sub_test_S3', payment_status: 'no_payment_required' })))
  const st = await one(`SELECT status FROM subscriptions WHERE party_id = '${S3}' AND stripe_subscription_id = 'sub_test_S3'`)
  assert(st?.status === 'trial', `trial checkout → ${st?.status}`)
  const again = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S3, planKey: 'plus' })
  assert(again.status === 409 && again.body.code === 'already_subscribed', JSON.stringify(again.body))
  // S1 (cancelled earlier) may subscribe again — without a new free trial.
  const { stripe: s3, calls } = mockStripe(PRICES)
  const back = await startCheckout({ cfg, stripe: s3, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  assert(back.status === 200, JSON.stringify(back.body))
  const p = calls.find(c => c.path === '/v1/checkout/sessions' && c.method === 'POST').params
  assert(p.get('subscription_data[trial_period_days]') === null, 'second trial granted')
  assert(p.get('customer') === 'cus_test_S1' && !calls.some(c => c.path === '/v1/customers'), 'customer not reused')
})

await step('Portal: owner gets the Stripe portal (cancel), others 403, store without card 404', async () => {
  const { stripe, calls } = mockStripe(PRICES)
  const r = await startPortal({ cfg, stripe, db: testDb, user: { id: OWNER }, storeId: S3 })
  assert(r.status === 200 && r.body.url === 'https://billing.stripe.test/p/1', JSON.stringify(r.body))
  const p = calls.find(c => c.path === '/v1/billing_portal/sessions').params
  assert(p.get('customer') === 'cus_new_S3' && p.get('return_url') === 'https://delivr.example/merchant', 'portal params')
  assert((await startPortal({ cfg, stripe, db: testDb, user: { id: STAFF }, storeId: S3 })).status === 403, 'staff')
  assert((await startPortal({ cfg, stripe, db: testDb, user: { id: ADMIN }, storeId: S2 })).status === 404, 'no customer')
  assert((await startPortal({ cfg: readConfig(() => undefined), stripe, db: testDb, user: { id: OWNER }, storeId: S3 })).status === 503, 'off')
})

// ═══ 11. Review fixes (D1–D7) ════════════════════════════════════════════
await step('D2 VAT on top is guaranteed: wrong / inclusive / inactive Tax Rate, or Stripe Tax with a non-exclusive price → 503', async () => {
  for (const tr of [{ ...TAX_RATE, percentage: 23 }, { ...TAX_RATE, inclusive: true }, { ...TAX_RATE, active: false }]) {
    const { stripe, calls } = mockStripe(PRICES, { taxRate: tr })
    const r = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
    assert(r.status === 503 && r.body.error === 'tax_rate_mismatch', `${JSON.stringify(tr)} → ${JSON.stringify(r.body)}`)
    assert(!calls.some(c => c.path === '/v1/checkout/sessions' && c.method === 'POST'), 'session created')
  }
  const auto = readConfig(k => (k === 'STRIPE_TAX_RATE_ID' ? undefined : k === 'STRIPE_AUTOMATIC_TAX' ? 'true' : ENV[k]))
  const { stripe } = mockStripe({ ...PRICES, price_test_pro: { ...PRICES.price_test_pro, tax_behavior: 'unspecified' } })
  const r = await startCheckout({ cfg: auto, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  assert(r.status === 503 && r.body.error === 'price_mismatch', JSON.stringify(r.body))
  const { stripe: ok2, calls } = mockStripe(PRICES)
  const r2 = await startCheckout({ cfg: auto, stripe: ok2, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  const sp = calls.find(c => c.path === '/v1/checkout/sessions' && c.method === 'POST')?.params
  assert(r2.status === 200 && sp.get('automatic_tax[enabled]') === 'true' && sp.get('subscription_data[default_tax_rates][0]') === null,
         'Stripe Tax session params')
})

await step('D3 Stripe already has a live subscription (webhook not in yet) → 409; open checkout reused / other plan expired', async () => {
  const { stripe, calls } = mockStripe(PRICES, { subs: [{ id: 'sub_race', status: 'incomplete' }] })
  const r = await startCheckout({ cfg, stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  assert(r.status === 409 && r.body.code === 'already_subscribed', JSON.stringify(r.body))
  assert(!calls.some(c => c.path === '/v1/checkout/sessions' && c.method === 'POST'), 'session created')
  const same = mockStripe(PRICES, { open: [{ id: 'cs_open', url: 'https://checkout.stripe.test/c/cs_open', metadata: { app: 'delivr', plan: 'pro', store_id: S1 } }] })
  const r2 = await startCheckout({ cfg, stripe: same.stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  assert(r2.status === 200 && r2.body.url === 'https://checkout.stripe.test/c/cs_open' && r2.body.reused, JSON.stringify(r2.body))
  assert(!same.calls.some(c => c.path === '/v1/checkout/sessions' && c.method === 'POST'), 'second session created')
  const other = mockStripe(PRICES, { open: [{ id: 'cs_old', url: 'https://x', metadata: { app: 'delivr', plan: 'premium' } },
                                            { id: 'cs_foreign', url: 'https://y', metadata: { app: 'staylink' } }] })
  const r3 = await startCheckout({ cfg, stripe: other.stripe, db: testDb, user: { id: OWNER, email: null }, storeId: S1, planKey: 'pro' })
  assert(r3.status === 200 && r3.body.url === 'https://checkout.stripe.test/c/cs_new', JSON.stringify(r3.body))
  const expired = other.calls.filter(c => c.path.endsWith('/expire')).map(c => c.path)
  assert(expired.length === 1 && expired[0].includes('cs_old'), `expired: ${expired}`)
})

await step('D3 a second Stripe subscription never re-points the live row (logged as conflict for the admin)', async () => {
  const before = await one(`SELECT plan_id, stripe_subscription_id, status FROM subscriptions WHERE party_id = '${S3}' AND status <> 'cancelled'`)
  const r = await send(event('invoice.paid', invoice({ customer: 'cus_new_S3', subscription: 'sub_other_S3',
    subscription_details: { metadata: { app: 'delivr', plan: 'premium', store_id: S3 } },
    lines: { data: [{ price: { id: 'price_test_premium' }, period: { end: now() + 86400 } }] } }), 'evt_conflict'))
  assert(r.status === 200 && r.body.result?.conflict === true, JSON.stringify(r.body))
  const after = await one(`SELECT plan_id, stripe_subscription_id, status FROM subscriptions WHERE party_id = '${S3}' AND status <> 'cancelled'`)
  assert(JSON.stringify(after) === JSON.stringify(before), 'live row changed')
  const log = await one(`SELECT result FROM stripe_webhook_events WHERE id = 'evt_conflict'`)
  assert(log?.result?.incoming_subscription === 'sub_other_S3', 'conflict not logged')
})

await step('D1 unpaid checkout only links the customer; the plan switches on async_payment_succeeded (manual row kept until then)', async () => {
  const before = await one(`SELECT s.status, p.name, s.stripe_subscription_id FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                             WHERE party_id = '${S2}' AND status <> 'cancelled'`)
  const sess = checkoutDone({ id: 'cs_unpaid', payment_status: 'unpaid', metadata: { app: 'delivr', plan: 'premium', store_id: S2 },
                              client_reference_id: S2, customer: 'cus_S2', subscription: 'sub_S2' })
  const r = await send(event('checkout.session.completed', sess))
  assert(r.status === 200 && r.body.result?.linked === true, JSON.stringify(r.body))
  const mid = await one(`SELECT s.status, p.name, s.stripe_subscription_id FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                          WHERE party_id = '${S2}' AND status <> 'cancelled'`)
  assert(JSON.stringify(mid) === JSON.stringify(before) && before.name === 'Pro', `manual row changed: ${JSON.stringify(mid)}`)
  assert((await testDb.customerFor(S2)) === 'cus_S2', 'customer not linked')
  const fail = await send(event('invoice.payment_failed', invoice({ customer: 'cus_S2', subscription: 'sub_S2',
    subscription_details: { metadata: { app: 'delivr', plan: 'premium', store_id: S2 } } })))
  assert(fail.body.result?.ignored === 'no_subscription', `failed payment touched the bank-transfer row: ${JSON.stringify(fail.body)}`)
  const ok = await send(event('checkout.session.async_payment_succeeded', { ...sess, payment_status: 'paid' }))
  assert(ok.status === 200 && ok.body.result?.ok, JSON.stringify(ok.body))
  const after = await one(`SELECT s.status, p.name, s.stripe_subscription_id FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                            WHERE party_id = '${S2}' AND status <> 'cancelled'`)
  assert(after.name === 'Premium' && after.status === 'active' && after.stripe_subscription_id === 'sub_S2', JSON.stringify(after))
})

await step('D4 unknown Stripe price is not our plan; portal uses STRIPE_PORTAL_CONFIGURATION_ID when set', async () => {
  const r = await send(event('customer.subscription.updated', subscription({ id: 'sub_S2', customer: 'cus_S2',
    metadata: { app: 'delivr', plan: 'premium', store_id: S2 }, items: { data: [{ price: { id: 'price_someone_else' } }] } })))
  assert(r.body.ignored === 'unknown_price', JSON.stringify(r.body))
  const inv = await send(event('invoice.paid', invoice({ customer: 'cus_S2', subscription: 'sub_S2',
    subscription_details: { metadata: { app: 'delivr', plan: 'premium', store_id: S2 } },
    lines: { data: [{ price: { id: 'price_someone_else' }, proration: false }] } })))
  assert(inv.body.ignored === 'unknown_price', JSON.stringify(inv.body))
  const withPortal = readConfig(k => (k === 'STRIPE_PORTAL_CONFIGURATION_ID' ? 'bpc_test_delivr' : ENV[k]))
  const { stripe, calls } = mockStripe(PRICES)
  await startPortal({ cfg: withPortal, stripe, db: testDb, user: { id: OWNER }, storeId: S3 })
  assert(calls.find(c => c.path === '/v1/billing_portal/sessions').params.get('configuration') === 'bpc_test_delivr', 'configuration')
  const { stripe: s2, calls: c2 } = mockStripe(PRICES)
  await startPortal({ cfg, stripe: s2, db: testDb, user: { id: OWNER }, storeId: S3 })
  assert(c2.find(c => c.path === '/v1/billing_portal/sessions').params.get('configuration') === null, 'no configuration by default')
})

await step('D6 a customer already linked to another store never raises (no endless retries)', async () => {
  const r = await send(event('checkout.session.completed', checkoutDone({ id: 'cs_x', payment_status: 'unpaid',
    metadata: { app: 'delivr', plan: 'pro', store_id: S1 }, client_reference_id: S1, customer: 'cus_new_S3', subscription: 'sub_x2' })))
  assert(r.status === 200 && r.body.result?.ok, JSON.stringify(r.body))
  assert((await testDb.customerFor(S1)) === 'cus_test_S1', 'S1 customer overwritten')
})

await step('D7 invoice events without a subscription id are ignored', async () => {
  const r1 = await send(event('invoice.paid', invoice({ subscription: null })))
  assert(r1.body.ignored === 'no_subscription', JSON.stringify(r1.body))
  const r2 = await send(event('invoice.payment_failed', invoice({ subscription: null })))
  assert(r2.body.ignored === 'no_subscription', JSON.stringify(r2.body))
})

console.log(`\n${failed === 0 ? '✅' : '❌'} stripe-billing: ${passed}/${passed + failed}`)
process.exit(failed === 0 ? 0 : 1)
