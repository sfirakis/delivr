// supabase/functions/confirm-order/index.ts
// Confirms an order after successful Stripe payment
// Sends notifications to merchant + customer
// Called by: frontend after payment succeeds

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { paymentIntentId, orderId } = await req.json()

    // 1. Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Πληρωμή δεν ολοκληρώθηκε. Status: ${paymentIntent.status}`)
    }

    // 2. Verify payment belongs to this user
    if (paymentIntent.metadata.supabase_user_id !== user.id) {
      throw new Error('Unauthorized payment')
    }

    // 3. Update order status
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        status:           'confirmed',
        payment_status:   'paid',
        stripe_payment_id: paymentIntentId,
        confirmed_at:     new Date().toISOString(),
        estimated_delivery_at: new Date(Date.now() + 35 * 60000).toISOString(),
      })
      .eq('id', orderId)
      .eq('user_id', user.id)
      .select('*, store:stores(name, phone), profiles(full_name, phone)')
      .single()

    if (orderError) throw orderError

    // 4. Award loyalty points (1 point per €1)
    const pointsEarned = Math.floor(Number(order.total))
    await supabaseAdmin
      .from('profiles')
      .update({
        loyalty_points: supabaseAdmin.rpc('increment_points', {
          user_id: user.id,
          points: pointsEarned,
        })
      })
      .eq('id', user.id)

    // 5. Trigger notifications (fire & forget)
    const notifUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Notify customer
    fetch(notifUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        userId:  user.id,
        title:   '✓ Παραγγελία επιβεβαιώθηκε!',
        body:    `Η παραγγελία σου από ${order.store?.name} επιβεβαιώθηκε. Εκτιμώμενη παράδοση σε ~35 λεπτά.`,
        type:    'order_update',
        data:    { orderId, status: 'confirmed' },
      }),
    }).catch(console.error)

    // Notify merchant via Supabase Realtime (already handled by DB trigger)
    // But also send push if they have FCM token
    fetch(notifUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        storeId: order.store_id,
        title:   `🔔 Νέα παραγγελία! #${orderId.slice(0,8).toUpperCase()}`,
        body:    `${order.profiles?.full_name ?? 'Πελάτης'} · €${order.total}`,
        type:    'new_order',
        data:    { orderId },
      }),
    }).catch(console.error)

    // 6. Try to auto-assign driver
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/assign-driver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ orderId, storeId: order.store_id }),
    }).catch(console.error)

    return new Response(
      JSON.stringify({
        success:      true,
        orderId,
        status:       'confirmed',
        pointsEarned,
        estimatedDelivery: order.estimated_delivery_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('confirm-order error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
