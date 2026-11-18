// Delivr store plans ↔ Stripe (subscription mode) — the pure core.
//
// Runtime-agnostic on purpose: the Edge Functions (Deno) wrap it, and the
// Node tests import the very same file (Node strips the types), so what is
// tested is what runs. Only Web APIs here: fetch, crypto.subtle, TextEncoder.
//
// Shared Stripe account «Actionweb.gr» (CentralBilling, HQ 11/11/2026):
//   * every Checkout Session AND its subscription carry metadata
//     app=delivr + plan + store_id — CentralBilling turns the 1st charge
//     (checkout.session.completed) and every renewal (invoice.paid) into a
//     weberp invoice draft → myDATA;
//   * the account sends EVERY event of every product to our webhook, so we
//     act only on objects tagged app=delivr and never 500 on strangers.
// Prices are published «+ ΦΠΑ»: the Stripe Prices are tax-EXCLUSIVE and VAT
// is added on top (a Tax Rate or Stripe Tax) — checkout refuses to start
// without one, and refuses a Price whose amount differs from the plan.

export const STRIPE_APP = 'delivr'
export const PLAN_KEYS = ['pro', 'plus', 'premium'] as const
export type PlanKey = typeof PLAN_KEYS[number]

export type Env = (name: string) => string | undefined

export interface BillingConfig {
  secretKey: string | null
  webhookSecret: string | null
  taxRateId: string | null
  automaticTax: boolean
  prices: Record<PlanKey, string | null>
  /** Optional Stripe customer-portal configuration (bpc_…); default portal otherwise. */
  portalConfigurationId: string | null
  /** Online payment can start: key + webhook + VAT + at least one price. */
  configured: boolean
  /** Plans whose button may open Checkout. */
  payablePlans: PlanKey[]
  /** Names of what is missing (never values). */
  missing: string[]
}

const clean = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : null)

export function readConfig(env: Env): BillingConfig {
  const secretKey = clean(env('STRIPE_SECRET_KEY'))
  const webhookSecret = clean(env('STRIPE_WEBHOOK_SECRET'))
  const taxRateId = clean(env('STRIPE_TAX_RATE_ID'))
  const automaticTax = (clean(env('STRIPE_AUTOMATIC_TAX')) ?? '').toLowerCase() === 'true'
  const prices = {
    pro: clean(env('STRIPE_PRICE_PRO')),
    plus: clean(env('STRIPE_PRICE_PLUS')),
    premium: clean(env('STRIPE_PRICE_PREMIUM')),
  } as Record<PlanKey, string | null>

  const missing: string[] = []
  if (!secretKey) missing.push('STRIPE_SECRET_KEY')
  if (!webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET')
  if (!taxRateId && !automaticTax) missing.push('STRIPE_TAX_RATE_ID|STRIPE_AUTOMATIC_TAX')
  for (const k of PLAN_KEYS) if (!prices[k]) missing.push(`STRIPE_PRICE_${k.toUpperCase()}`)

  const base = !!secretKey && !!webhookSecret && (!!taxRateId || automaticTax)
  const payablePlans = base ? PLAN_KEYS.filter(k => !!prices[k]) : []
  const portalConfigurationId = clean(env('STRIPE_PORTAL_CONFIGURATION_ID'))
  return { secretKey, webhookSecret, taxRateId, automaticTax, prices, portalConfigurationId, configured: payablePlans.length > 0, payablePlans, missing }
}

export function planKeyFromName(name: string | null | undefined): PlanKey | null {
  const k = (name ?? '').trim().toLowerCase()
  return (PLAN_KEYS as readonly string[]).includes(k) ? (k as PlanKey) : null
}

export function planKeyForPrice(cfg: BillingConfig, priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null
  return PLAN_KEYS.find(k => cfg.prices[k] === priceId) ?? null
}

// ── Stripe signature (scheme v1: HMAC-SHA256 over `${t}.${raw}`) ─────────
const enc = new TextEncoder()

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
  return Array.from(sig, b => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Same check as stripe.webhooks.constructEvent: any v1 may match, 5′ tolerance. */
export async function verifyStripeSignature(
  raw: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false
  let t = NaN
  const v1: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map(s => s?.trim())
    if (k === 't') t = Number(v)
    else if (k === 'v1' && v) v1.push(v)
  }
  if (!Number.isFinite(t) || v1.length === 0) return false
  if (Math.abs(nowSec - t) > toleranceSec) return false
  const expected = await hmacHex(secret, `${t}.${raw}`)
  return v1.some(s => safeEqual(s, expected))
}

/** For tests and local tooling: a header Stripe would send. */
export async function signStripePayload(raw: string, secret: string, t: number): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${raw}`)}`
}

// ── Webhook → one DB action ─────────────────────────────────────────────
export type DbStatus = 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled'

export interface ApplyArgs {
  event_id: string
  event_type: string
  /** link = only remember customer/subscription ids (unpaid checkout), no plan/status change */
  action: 'activate' | 'past_due' | 'cancel' | 'link'
  store_id: string | null
  plan_key: PlanKey | null
  status: DbStatus | null
  customer: string | null
  subscription: string | null
  price: string | null
  period_end: string | null   // ISO
}

export type Meta = Record<string, string> | null | undefined
type Obj = Record<string, any>

export function mapStripeStatus(s: string | null | undefined): DbStatus | null {
  switch (s) {
    case 'active': return 'active'
    case 'trialing': return 'trial'
    case 'past_due':
    case 'unpaid': return 'past_due'
    case 'paused': return 'paused'
    case 'canceled':
    case 'incomplete_expired': return 'cancelled'
    default: return null          // incomplete: nothing is paid yet
  }
}

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : (v && typeof v === 'object' && typeof (v as Obj).id === 'string' ? (v as Obj).id : null)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A tag that is not a uuid must never reach the database (an error there = endless Stripe retries). */
export const uuidOrNull = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null)

const isoFromUnix = (v: unknown): string | null =>
  typeof v === 'number' && v > 0 ? new Date(v * 1000).toISOString() : null

/** Subscription metadata as an invoice carries it (old and new API versions). */
export function invoiceMeta(inv: Obj): Meta {
  return inv?.subscription_details?.metadata
    ?? inv?.parent?.subscription_details?.metadata
    ?? inv?.lines?.data?.[0]?.metadata
    ?? inv?.metadata
    ?? null
}

function subscriptionPrice(sub: Obj): string | null {
  return idOf(sub?.items?.data?.[0]?.price) ?? null
}

function subscriptionPeriodEnd(sub: Obj): string | null {
  return isoFromUnix(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? sub?.trial_end)
}

export type Decision = { apply: ApplyArgs } | { ignore: string }

export function decide(event: Obj, cfg: BillingConfig): Decision {
  const type = String(event?.type ?? '')
  const o: Obj = event?.data?.object ?? {}
  const base = { event_id: String(event?.id ?? ''), event_type: type }
  const ours = (m: Meta) => m?.app === STRIPE_APP

  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (!ours(o.metadata)) return { ignore: 'not_delivr' }
      if (o.mode !== 'subscription' || !o.subscription) return { ignore: 'not_a_subscription' }
      const store_id = uuidOrNull(o.metadata.store_id) ?? uuidOrNull(o.client_reference_id)
      const ids = { customer: idOf(o.customer), subscription: idOf(o.subscription), price: null, period_end: null }
      if (o.payment_status !== 'paid' && o.payment_status !== 'no_payment_required') {
        // Not paid yet (delayed payment method): remember the ids only; the plan
        // switches on invoice.paid / checkout.session.async_payment_succeeded.
        return { apply: { ...base, action: 'link', store_id, plan_key: null, status: null, ...ids } }
      }
      return { apply: { ...base, action: 'activate', store_id, plan_key: planKeyFromName(o.metadata.plan),
        status: o.payment_status === 'no_payment_required' ? 'trial' : 'active', ...ids } }
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      if (!ours(o.metadata)) return { ignore: 'not_delivr' }
      const status = type === 'customer.subscription.deleted' ? 'cancelled' : mapStripeStatus(o.status)
      if (!status) return { ignore: `status_${o.status}` }
      const price = subscriptionPrice(o)
      // A plan changed in the portal changes the Price; metadata.plan stays old,
      // so the Price decides. A Price that is not one of ours is not our plan.
      const plan = price ? planKeyForPrice(cfg, price) : null
      if (price && !plan && status !== 'cancelled') return { ignore: 'unknown_price' }
      return { apply: { ...base, action: status === 'cancelled' ? 'cancel' : status === 'past_due' ? 'past_due' : 'activate',
        store_id: uuidOrNull(o.metadata.store_id), plan_key: plan, status, customer: idOf(o.customer),
        subscription: o.id ?? null, price, period_end: subscriptionPeriodEnd(o) } }
    }
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const m = invoiceMeta(o)
      if (!ours(m)) return { ignore: 'not_delivr' }
      // €0 trial invoice: nothing paid, the trial status comes from the subscription.
      if (!(Number(o.amount_paid) > 0)) return { ignore: 'zero_amount' }
      const subscription = idOf(o.subscription) ?? idOf(o?.parent?.subscription_details?.subscription)
      if (!subscription) return { ignore: 'no_subscription' }
      // Only the regular (non-proration) subscription line says anything about
      // the current price / period: after a plan change the first line can be
      // the credit for the OLD price. No such line → take nothing from lines.
      // The plan of a row already on this Stripe subscription is owned by the
      // customer.subscription.* events; delivr_stripe_apply() uses an invoice's
      // plan only to create or first link a row (019).
      const line = (o?.lines?.data ?? []).find((l: Obj) =>
        l?.proration === false || l?.parent?.subscription_item_details?.proration === false) ?? null
      const linePrice = line ? (idOf(line.price) ?? idOf(line.pricing?.price_details?.price)) : null
      const plan = linePrice ? planKeyForPrice(cfg, linePrice) : planKeyFromName(m?.plan)
      if (linePrice && !plan) return { ignore: 'unknown_price' }
      return { apply: { ...base, action: 'activate', store_id: uuidOrNull(m?.store_id),
        plan_key: plan, status: 'active', customer: idOf(o.customer), subscription,
        price: linePrice, period_end: isoFromUnix(line?.period?.end) } }
    }
    case 'invoice.payment_failed': {
      const m = invoiceMeta(o)
      if (!ours(m)) return { ignore: 'not_delivr' }
      const subscription = idOf(o.subscription) ?? idOf(o?.parent?.subscription_details?.subscription)
      if (!subscription) return { ignore: 'no_subscription' }
      return { apply: { ...base, action: 'past_due', store_id: uuidOrNull(m?.store_id), plan_key: null,
        status: 'past_due', customer: idOf(o.customer), subscription, price: null, period_end: null } }
    }
    default:
      return { ignore: 'event_type' }
  }
}

export interface HttpResult { status: number; body: Record<string, unknown> }

/**
 * The whole webhook, minus HTTP and the database:
 *   400 — bad/missing signature (Stripe shows it as failed, nothing applied);
 *   200 — applied, ignored (other product / event) or unknown store;
 *   500 — our database failed → Stripe retries (apply is idempotent per event id).
 */
export async function handleStripeWebhook(opts: {
  raw: string
  signature: string | null
  cfg: BillingConfig
  nowSec: number
  apply: (args: ApplyArgs) => Promise<unknown>
}): Promise<HttpResult> {
  const { raw, signature, cfg } = opts
  if (!cfg.webhookSecret) return { status: 400, body: { error: 'webhook_not_configured' } }
  if (!(await verifyStripeSignature(raw, signature, cfg.webhookSecret, opts.nowSec))) {
    return { status: 400, body: { error: 'invalid_signature' } }
  }
  let event: Obj
  try { event = JSON.parse(raw) } catch { return { status: 400, body: { error: 'invalid_json' } } }

  const d = decide(event, cfg)
  if ('ignore' in d) return { status: 200, body: { received: true, ignored: d.ignore } }
  try {
    const result = await opts.apply(d.apply)
    return { status: 200, body: { received: true, result: result as Record<string, unknown> } }
  } catch (err) {
    return { status: 500, body: { error: 'apply_failed', detail: String((err as Error)?.message ?? err) } }
  }
}

// ── Stripe REST (form-encoded) ──────────────────────────────────────────
export type StripeCall = (method: 'GET' | 'POST', path: string, params?: Record<string, unknown>,
                          opts?: { idempotencyKey?: string }) => Promise<Obj>

/** Stripe's bracket form encoding: a[b][0][c]=v */
export function formEncode(params: Record<string, unknown>): string {
  const out: string[] = []
  const walk = (prefix: string, v: unknown) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x))
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v as Obj)) walk(`${prefix}[${k}]`, x)
    else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`)
  }
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'object') walk(k, v)
    else out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return out.join('&')
}

export function stripeCaller(fetchImpl: typeof fetch, secretKey: string): StripeCall {
  return async (method, path, params, opts) => {
    const body = params ? formEncode(params) : ''
    const url = `https://api.stripe.com${path}${method === 'GET' && body ? `?${body}` : ''}`
    const res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
        ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: method === 'POST' ? body : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`stripe_${res.status}: ${json?.error?.code ?? json?.error?.type ?? 'error'}`)
    return json
  }
}

// ── Checkout & portal ───────────────────────────────────────────────────
export interface StorePlanRow { id: string; name: string; price: number; trial_days: number; billing_cycle: string }

/** What the edge function reads/writes with the service role. */
export interface BillingDb {
  /** owner/manager of the store (or platform admin) */
  canManage(userId: string, storeId: string): Promise<boolean>
  storeName(storeId: string): Promise<string | null>
  plan(planKey: PlanKey): Promise<StorePlanRow | null>
  customerFor(storeId: string): Promise<string | null>
  /** keeps the first customer saved for the store; returns the one that is stored */
  saveCustomer(storeId: string, customerId: string): Promise<string>
  /** live Stripe-managed subscription of the store, if any */
  liveStripeSubscription(storeId: string): Promise<{ plan_name: string; status: string } | null>
  hadStripeSubscription(storeId: string): Promise<boolean>
  appUrl(): Promise<string>
}

export async function startCheckout(opts: {
  cfg: BillingConfig; stripe: StripeCall; db: BillingDb
  user: { id: string; email: string | null }; storeId: string; planKey: string
}): Promise<HttpResult> {
  const { cfg, stripe, db, user, storeId } = opts
  if (!uuidOrNull(storeId)) return { status: 400, body: { error: 'bad_store', code: 'bad_store' } }
  const planKey = planKeyFromName(opts.planKey)
  if (!planKey) return { status: 400, body: { error: 'bad_plan', code: 'bad_plan' } }
  if (!cfg.payablePlans.includes(planKey)) return { status: 503, body: { error: 'billing_unavailable', code: 'billing_unavailable' } }
  if (!(await db.canManage(user.id, storeId))) return { status: 403, body: { error: 'forbidden', code: 'forbidden' } }

  const live = await db.liveStripeSubscription(storeId)
  if (live) return { status: 409, body: { error: 'already_subscribed', code: 'already_subscribed', plan: live.plan_name } }

  const plan = await db.plan(planKey)
  if (!plan || !(Number(plan.price) > 0)) return { status: 400, body: { error: 'bad_plan', code: 'bad_plan' } }

  // Never charge a price other than the published one (+ ΦΠΑ on top).
  const priceId = cfg.prices[planKey]!
  const price = await stripe('GET', `/v1/prices/${encodeURIComponent(priceId)}`)
  const expectCents = Math.round(Number(plan.price) * 100)
  const okPrice = price?.active !== false && price?.unit_amount === expectCents
    && String(price?.currency).toLowerCase() === 'eur'
    && price?.recurring?.interval === (plan.billing_cycle === 'year' ? 'year' : 'month')
    && (cfg.automaticTax ? price?.tax_behavior === 'exclusive' : price?.tax_behavior !== 'inclusive')
  if (!okPrice) return { status: 503, body: { error: 'price_mismatch', code: 'billing_unavailable' } }

  // «+ ΦΠΑ»: VAT must really be added on top — a 24 % exclusive, active Tax Rate.
  if (!cfg.automaticTax) {
    const tr = await stripe('GET', `/v1/tax_rates/${encodeURIComponent(cfg.taxRateId ?? '')}`)
    if (tr?.active !== true || tr?.inclusive !== false || Number(tr?.percentage) !== 24) {
      return { status: 503, body: { error: 'tax_rate_mismatch', code: 'billing_unavailable' } }
    }
  }

  let customer = await db.customerFor(storeId)
  if (!customer) {
    // Same key for 24 h → two clicks / two tabs get the same Stripe customer.
    const c = await stripe('POST', '/v1/customers', {
      email: user.email ?? undefined,
      name: (await db.storeName(storeId)) ?? undefined,
      metadata: { app: STRIPE_APP, store_id: storeId },
    }, { idempotencyKey: `delivr-customer-${storeId}` })
    customer = await db.saveCustomer(storeId, String(c.id))
  }

  // Stripe is the truth for «already paying»: the webhook may not have arrived yet.
  const subs = await stripe('GET', '/v1/subscriptions', { customer, status: 'all', limit: 20 })
  const LIVE = ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused']
  if ((subs?.data ?? []).some((x: Obj) => LIVE.includes(x?.status))) {
    return { status: 409, body: { error: 'already_subscribed', code: 'already_subscribed' } }
  }
  // An open Checkout for the same plan is reused; one for another plan is closed first.
  const open = await stripe('GET', '/v1/checkout/sessions', { customer, status: 'open', limit: 10 })
  for (const cs of (open?.data ?? []) as Obj[]) {
    if (cs?.metadata?.app !== STRIPE_APP) continue
    if (cs?.metadata?.plan === planKey && cs?.url) return { status: 200, body: { url: cs.url, reused: true } }
    await stripe('POST', `/v1/checkout/sessions/${encodeURIComponent(String(cs.id))}/expire`)
  }

  const meta = { app: STRIPE_APP, plan: planKey, store_id: storeId }
  const trialDays = !(await db.hadStripeSubscription(storeId)) && plan.trial_days > 0 ? plan.trial_days : undefined
  const appUrl = (await db.appUrl()).replace(/\/+$/, '')

  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: storeId,
    line_items: [{ price: priceId, quantity: 1 }],
    // CentralBilling: app on the session (1st charge) AND the subscription (renewals).
    metadata: meta,
    subscription_data: {
      metadata: meta,
      trial_period_days: trialDays,
      default_tax_rates: cfg.taxRateId && !cfg.automaticTax ? [cfg.taxRateId] : undefined,
    },
    automatic_tax: cfg.automaticTax ? { enabled: true } : undefined,
    // ΑΦΜ → invoice instead of receipt; kept on the customer for renewals.
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    billing_address_collection: 'required',
    locale: 'el',
    success_url: `${appUrl}/merchant?billing=success`,
    cancel_url: `${appUrl}/merchant?billing=cancel`,
  })
  return { status: 200, body: { url: session.url } }
}

export async function startPortal(opts: {
  cfg: BillingConfig; stripe: StripeCall; db: BillingDb; user: { id: string }; storeId: string
}): Promise<HttpResult> {
  const { cfg, stripe, db, user, storeId } = opts
  if (!cfg.configured) return { status: 503, body: { error: 'billing_unavailable', code: 'billing_unavailable' } }
  if (!uuidOrNull(storeId)) return { status: 400, body: { error: 'bad_store', code: 'bad_store' } }
  if (!(await db.canManage(user.id, storeId))) return { status: 403, body: { error: 'forbidden', code: 'forbidden' } }
  const customer = await db.customerFor(storeId)
  if (!customer) return { status: 404, body: { error: 'no_customer', code: 'no_customer' } }
  const appUrl = (await db.appUrl()).replace(/\/+$/, '')
  const s = await stripe('POST', '/v1/billing_portal/sessions', {
    customer, return_url: `${appUrl}/merchant`, locale: 'el',
    configuration: cfg.portalConfigurationId ?? undefined,
  })
  return { status: 200, body: { url: s.url } }
}
