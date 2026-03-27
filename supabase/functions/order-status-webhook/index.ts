// supabase/functions/order-status-webhook/index.ts
// Handles Stripe webhooks for payment events
// Register at: Stripe Dashboard → Webhooks → Add endpoint
// URL: https://<project>.supabase.co/functions/v1/order-status-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const notifUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    switch (event.type) {

      // ── Payment succeeded ─────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const userId = pi.metadata.supabase_user_id
        const storeId = pi.metadata.store_id

        // Update order payment status
        const { data: order } = await supabase
          .from('orders')
          .update({ payment_status: 'paid', stripe_payment_id: pi.id })
          .eq('stripe_payment_id', pi.id)
          .select('id, total, store_id')
          .maybeSingle()

        if (order && userId) {
          await fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              userId,
              title: '✓ Πληρωμή επιτυχής!',
              body:  `€${Number(order.total).toFixed(2)} χρεώθηκαν επιτυχώς.`,
              type:  'order_update',
              data:  { orderId: order.id, status: 'paid' },
            }),
          })
        }
        break
      }

      // ── Payment failed ────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const userId = pi.metadata.supabase_user_id
        const failMsg = pi.last_payment_error?.message ?? 'Η πληρωμή απέτυχε'

        // Mark order as failed
        await supabase
          .from('orders')
          .update({ payment_status: 'failed', status: 'cancelled' })
          .eq('stripe_payment_id', pi.id)

        if (userId) {
          await fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              userId,
              title: '✗ Αποτυχία πληρωμής',
              body:  failMsg,
              type:  'order_update',
              data:  { status: 'payment_failed' },
            }),
          })
        }
        break
      }

      // ── Refund created ────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const pi = charge.payment_intent as string

        const { data: order } = await supabase
          .from('orders')
          .update({ payment_status: 'refunded' })
          .eq('stripe_payment_id', pi)
          .select('id, user_id, total')
          .maybeSingle()

        if (order?.user_id) {
          await fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              userId: order.user_id,
              title:  '💰 Επιστροφή χρημάτων',
              body:   `€${Number(order.total).toFixed(2)} θα επιστραφούν στην κάρτα σου εντός 5-10 ημερών.`,
              type:   'order_update',
              data:   { orderId: order.id, status: 'refunded' },
            }),
          })
        }
        break
      }

      // ── Customer updated saved card ────────────────────────
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        console.log('Customer updated:', customer.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
