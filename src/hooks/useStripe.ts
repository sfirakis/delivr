// src/hooks/useStripe.ts
// Stripe Elements integration for the checkout flow
// Usage:
//   const { pay, loading, error } = useStripePayment()
//   await pay({ amount: 12.50, storeId, orderItems })

import { useState, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '@/lib/supabase'

interface PaymentOptions {
  amount: number
  storeId: string
  orderId: string
  orderItems: Array<{ name: string; price: number; quantity: number }>
  cardElement?: any  // Stripe CardElement reference for new card payments
}

interface PaymentResult {
  success: boolean
  paymentIntentId?: string
  error?: string
}

// ─── Create PaymentIntent via Edge Function ───────────────────
async function createPaymentIntent(opts: PaymentOptions) {
  const session = await supabase.auth.getSession()
  const token   = session.data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount:     opts.amount,
        currency:   'eur',
        storeId:    opts.storeId,
        orderItems: opts.orderItems,
        metadata:   { orderId: opts.orderId },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Failed to create payment intent')
  }

  return res.json() as Promise<{
    clientSecret:    string
    paymentIntentId: string
    amount:          number
    currency:        string
  }>
}

// ─── Confirm order via Edge Function ──────────────────────────
async function confirmOrderAfterPayment(orderId: string, paymentIntentId: string) {
  const session = await supabase.auth.getSession()
  const token   = session.data.session?.access_token

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-order`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, paymentIntentId }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Failed to confirm order')
  }

  return res.json()
}

// ─── Main payment hook ────────────────────────────────────────
export function useStripePayment() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const pay = useCallback(async (opts: PaymentOptions): Promise<PaymentResult> => {
    setLoading(true)
    setError(null)

    try {
      // 1. Create PaymentIntent server-side
      const { clientSecret, paymentIntentId } = await createPaymentIntent(opts)

      // 2. Load Stripe.js dynamically
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (!stripeKey) throw new Error('Missing VITE_STRIPE_PUBLISHABLE_KEY')

      const stripe = await loadStripe(stripeKey)
      if (!stripe) throw new Error('Stripe failed to load')

      // 3. Confirm payment
      //    - New card: use cardElement from Stripe Elements
      //    - Saved card / Apple Pay / Google Pay: payment method already attached server-side
      const result = opts.cardElement
        ? await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: opts.cardElement },
          })
        : await stripe.confirmCardPayment(clientSecret)

      if (result.error) {
        throw new Error(result.error.message ?? 'Payment failed')
      }

      if (result.paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment not completed')
      }

      // 4. Confirm order server-side
      const confirmation = await confirmOrderAfterPayment(opts.orderId, paymentIntentId)

      return {
        success:         true,
        paymentIntentId: paymentIntentId,
      }

    } catch (err: any) {
      const message = err.message ?? 'Σφάλμα κατά την πληρωμή'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { pay, loading, error }
}

// ─── Stripe Elements card input for new card payments ────────
let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

export { getStripe }
