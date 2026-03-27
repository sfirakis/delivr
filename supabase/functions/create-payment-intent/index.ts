// supabase/functions/create-payment-intent/index.ts
// Creates a Stripe PaymentIntent for an order
// Called by: frontend CartPage before checkout

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
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Parse request
    const { amount, currency = 'eur', storeId, orderItems, metadata = {} } = await req.json()

    if (!amount || amount < 50) { // Stripe minimum 0.50€
      throw new Error('Μη έγκυρο ποσό')
    }

    // 3. Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // 4. Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        supabase_user_id: user.id,
        store_id: storeId,
        ...metadata,
      },
      // Save card for future use
      setup_future_usage: 'off_session',
    })

    return new Response(
      JSON.stringify({
        clientSecret:     paymentIntent.client_secret,
        paymentIntentId:  paymentIntent.id,
        amount:           paymentIntent.amount,
        currency:         paymentIntent.currency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('create-payment-intent error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
