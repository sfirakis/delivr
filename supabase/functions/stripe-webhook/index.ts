// supabase/functions/stripe-webhook/index.ts
// Stripe → store plan (019). Deploy WITHOUT JWT verification (Stripe signs
// the request instead):  supabase functions deploy stripe-webhook --no-verify-jwt
// Endpoint: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.paid, invoice.payment_failed
// Secrets: STRIPE_WEBHOOK_SECRET (+ STRIPE_SECRET_KEY, STRIPE_PRICE_* for the
// price → plan mapping). The logic lives in ../_shared/planBilling.ts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleStripeWebhook, readConfig, type ApplyArgs } from '../_shared/planBilling.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const cfg = readConfig(name => Deno.env.get(name))
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const raw = await req.text()          // raw body: the signature is over these bytes
  const result = await handleStripeWebhook({
    raw,
    signature: req.headers.get('stripe-signature'),
    cfg,
    nowSec: Math.floor(Date.now() / 1000),
    apply: async (a: ApplyArgs) => {
      const { data, error } = await admin.rpc('delivr_stripe_apply', {
        p_event_id: a.event_id, p_event_type: a.event_type, p_action: a.action,
        p_store_id: a.store_id, p_plan_key: a.plan_key, p_status: a.status,
        p_customer: a.customer, p_subscription: a.subscription, p_price: a.price,
        p_period_end: a.period_end,
      })
      if (error) throw new Error(error.message)
      return data
    },
  })

  if (result.status >= 400) console.error('stripe-webhook', result.status, JSON.stringify(result.body))
  return new Response(JSON.stringify(result.body), {
    status: result.status, headers: { 'Content-Type': 'application/json' },
  })
})
