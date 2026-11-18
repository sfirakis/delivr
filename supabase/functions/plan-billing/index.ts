// supabase/functions/plan-billing/index.ts
// Store plan payment by card (019). One function, three actions:
//   { action: 'config' }                         → is online payment on? (no login needed)
//   { action: 'checkout', store_id, plan }       → Stripe Checkout URL (subscription mode)
//   { action: 'portal',   store_id }             → Stripe customer portal URL (cancel / card / invoices)
// Until the Stripe secrets exist, 'config' answers configured=false and the
// UI shows «σύντομα» — nothing unpayable is offered.
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_PLUS,
// STRIPE_PRICE_PREMIUM, and STRIPE_TAX_RATE_ID (24 % exclusive) or
// STRIPE_AUTOMATIC_TAX=true. Optional: STRIPE_PORTAL_CONFIGURATION_ID (bpc_…).
// The logic lives in ../_shared/planBilling.ts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  readConfig, startCheckout, startPortal, stripeCaller, PLAN_KEYS,
  type BillingDb, type PlanKey,
} from '../_shared/planBilling.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const cfg = readConfig(name => Deno.env.get(name))
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body = config */ }
  const action = String(body.action ?? 'config')

  if (action === 'config') {
    // Names only, never values.
    return json(200, { configured: cfg.configured, plans: cfg.payablePlans })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', code: 'unauthorized' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const db: BillingDb = {
    async canManage(userId, storeId) {
      const { data: su } = await admin.from('store_users').select('role')
        .eq('store_id', storeId).eq('user_id', userId).maybeSingle()
      if (su && (su.role === 'owner' || su.role === 'manager')) return true
      const { data: p } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
      return p?.role === 'admin'
    },
    async storeName(storeId) {
      const { data } = await admin.from('stores').select('name').eq('id', storeId).maybeSingle()
      return data?.name ?? null
    },
    async plan(planKey: PlanKey) {
      const { data } = await admin.from('subscription_plans')
        .select('id, name, price, trial_days, billing_cycle')
        .eq('audience', 'store').eq('is_active', true).ilike('name', planKey).limit(1).maybeSingle()
      return data ? { ...data, price: Number(data.price) } : null
    },
    async customerFor(storeId) {
      const { data } = await admin.from('store_billing_accounts').select('stripe_customer_id')
        .eq('store_id', storeId).maybeSingle()
      return data?.stripe_customer_id ?? null
    },
    async saveCustomer(storeId, customerId) {
      // First one wins (two tabs at once): never overwrite, return what is stored.
      const { error } = await admin.from('store_billing_accounts')
        .upsert({ store_id: storeId, stripe_customer_id: customerId }, { onConflict: 'store_id', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
      const { data } = await admin.from('store_billing_accounts').select('stripe_customer_id')
        .eq('store_id', storeId).maybeSingle()
      if (!data?.stripe_customer_id) throw new Error('customer_not_saved')
      return data.stripe_customer_id as string
    },
    async liveStripeSubscription(storeId) {
      const { data } = await admin.from('subscriptions')
        .select('status, subscription_plans(name)')
        .eq('party_type', 'store').eq('party_id', storeId)
        .in('status', ['trial', 'active', 'past_due', 'paused'])
        .not('stripe_subscription_id', 'is', null).limit(1).maybeSingle()
      if (!data) return null
      const plan = (data as { subscription_plans?: { name?: string } | null }).subscription_plans
      return { status: data.status as string, plan_name: plan?.name ?? '' }
    },
    async hadStripeSubscription(storeId) {
      const { count } = await admin.from('subscriptions').select('id', { count: 'exact', head: true })
        .eq('party_type', 'store').eq('party_id', storeId).not('stripe_subscription_id', 'is', null)
      return (count ?? 0) > 0
    },
    async appUrl() {
      const { data } = await admin.from('platform_settings').select('app_url').eq('id', 1).maybeSingle()
      return data?.app_url || 'https://delivr-ten.vercel.app'
    },
  }

  try {
    if (action === 'status') {
      const storeId = String(body.store_id ?? '')
      if (!(await db.canManage(user.id, storeId))) return json(403, { error: 'forbidden', code: 'forbidden' })
      const live = await db.liveStripeSubscription(storeId)
      return json(200, { configured: cfg.configured, plans: cfg.payablePlans, stripe: live })
    }
    if (!cfg.secretKey) return json(503, { error: 'billing_unavailable', code: 'billing_unavailable' })
    const stripe = stripeCaller(fetch, cfg.secretKey)
    if (action === 'checkout') {
      const r = await startCheckout({ cfg, stripe, db, user: { id: user.id, email: user.email ?? null },
        storeId: String(body.store_id ?? ''), planKey: String(body.plan ?? '') })
      return json(r.status, r.body)
    }
    if (action === 'portal') {
      const r = await startPortal({ cfg, stripe, db, user: { id: user.id }, storeId: String(body.store_id ?? '') })
      return json(r.status, r.body)
    }
    return json(400, { error: 'bad_action', plans: PLAN_KEYS })
  } catch (err) {
    console.error('plan-billing', action, (err as Error).message)
    return json(502, { error: 'stripe_error', code: 'stripe_error' })
  }
})
