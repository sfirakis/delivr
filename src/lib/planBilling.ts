import { supabase } from './supabase'

/**
 * Store plan payment by card — client side of the `plan-billing` edge
 * function (migration 019). Online payment counts as ON only when the
 * function says so; any error (function not deployed, no keys, offline)
 * means OFF, and the UI says «σύντομα» instead of offering a payment that
 * cannot be taken.
 */
export type PaidPlanKey = 'pro' | 'plus' | 'premium'

export interface BillingConfig {
  configured: boolean
  plans: PaidPlanKey[]
}

export interface BillingStatus extends BillingConfig {
  /** live card-paid (Stripe) subscription of the store, if any */
  stripe: { plan_name: string; status: string } | null
}

const OFF: BillingConfig = { configured: false, plans: [] }

export const planKey = (name: string): PaidPlanKey | null => {
  const k = name.trim().toLowerCase()
  return k === 'pro' || k === 'plus' || k === 'premium' ? k : null
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('plan-billing', { body })
  if (error) {
    // FunctionsHttpError carries the JSON body ({ code }) in context.
    let code = 'unavailable'
    try { code = (await (error as { context?: Response }).context?.json())?.code ?? code } catch { /* not JSON */ }
    throw Object.assign(new Error(code), { code })
  }
  return data as T
}

export async function getBillingConfig(): Promise<BillingConfig> {
  try {
    const r = await call<BillingConfig>({ action: 'config' })
    return { configured: r?.configured === true, plans: Array.isArray(r?.plans) ? r.plans : [] }
  } catch { return OFF }
}

export async function getBillingStatus(storeId: string): Promise<BillingStatus> {
  try {
    const r = await call<BillingStatus>({ action: 'status', store_id: storeId })
    return { configured: r?.configured === true, plans: Array.isArray(r?.plans) ? r.plans : [], stripe: r?.stripe ?? null }
  } catch { return { ...OFF, stripe: null } }
}

/** Redirects to Stripe Checkout. Throws { code } when it cannot start. */
export async function startPlanCheckout(storeId: string, plan: PaidPlanKey): Promise<void> {
  const r = await call<{ url?: string }>({ action: 'checkout', store_id: storeId, plan })
  if (!r?.url) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })
  window.location.assign(r.url)
}

/** Redirects to the Stripe customer portal (cancel, card, invoices). */
export async function openBillingPortal(storeId: string): Promise<void> {
  const r = await call<{ url?: string }>({ action: 'portal', store_id: storeId })
  if (!r?.url) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })
  window.location.assign(r.url)
}

export const BILLING_ERRORS: Record<string, string> = {
  already_subscribed: 'Έχεις ήδη συνδρομή με κάρτα. Άλλαξέ την από «Διαχείριση συνδρομής».',
  billing_unavailable: 'Η online πληρωμή δεν είναι ακόμα ενεργή.',
  forbidden: 'Μόνο ο ιδιοκτήτης ή ο υπεύθυνος του καταστήματος πληρώνει τη συνδρομή.',
  no_customer: 'Δεν υπάρχει ακόμα συνδρομή με κάρτα.',
  stripe_error: 'Η σύνδεση με τον πάροχο πληρωμών απέτυχε. Δοκίμασε ξανά σε λίγο.',
  unauthorized: 'Χρειάζεται σύνδεση.',
}
