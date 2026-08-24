// src/hooks/useStripe.ts
// Stripe Elements integration for the checkout flow
// Usage:
//   const { pay, loading, error } = useStripePayment()
//   await pay({ amount: 12.50, storeId, orderItems })

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PaymentOptions {
  amount: number
  storeId: string
  orderId: string
  orderItems: Array<{ name: string; price: number; quantity: number }>
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

      // Dynamically import stripe-js to avoid SSR issues
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(stripeKey)
      if (!stripe) throw new Error('Stripe failed to load')

      // 3. Confirm payment with saved card (off-session)
      //    For new cards, use stripe.confirmCardPayment with Elements UI
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: { token: 'tok_visa' }, // Replace with actual Elements card in production
          billing_details: {},
        },
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Payment failed')
      }

      if (result.paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment not completed')
      }

      // 4. Confirm order server-side
      const _confirmation = await confirmOrderAfterPayment(opts.orderId, paymentIntentId)

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

// ─── Stripe Elements component for card input ─────────────────
// Install: npm install @stripe/react-stripe-js @stripe/stripe-js
// Usage: Wrap your payment form with <StripeProvider> and use <CardElement>
//
// Example:
//
// import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
// import { loadStripe } from '@stripe/stripe-js'
//
// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
//
// function CardPaymentForm({ clientSecret, onSuccess }) {
//   const stripe   = useStripe()
//   const elements = useElements()
//
//   const handlePay = async () => {
//     const cardElement = elements!.getElement(CardElement)!
//     const result = await stripe!.confirmCardPayment(clientSecret, {
//       payment_method: { card: cardElement }
//     })
//     if (result.error) {
//       // Show error
//     } else if (result.paymentIntent.status === 'succeeded') {
//       onSuccess(result.paymentIntent.id)
//     }
//   }
//
//   return (
//     <div>
//       <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
//       <button onClick={handlePay}>Πληρωμή</button>
//     </div>
//   )
// }
//
// function CheckoutPage() {
//   return (
//     <Elements stripe={stripePromise} options={{ clientSecret }}>
//       <CardPaymentForm clientSecret={clientSecret} onSuccess={handleSuccess} />
//     </Elements>
//   )
// }
