import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getPublicPlans } from '@/lib/api'
import { money, num } from '@/lib/format'
import {
  getBillingStatus, startPlanCheckout, openBillingPortal, planKey, BILLING_ERRORS, type PaidPlanKey,
} from '@/lib/planBilling'
import { Spinner } from '@/components/ui'

/**
 * «Πακέτο & πληρωμή» (migration 019): the store pays its plan by card
 * through Stripe Checkout and cancels / changes card in the Stripe portal.
 * Until the platform's Stripe keys exist the buttons honestly say «σύντομα».
 * Prices are the published ones, before VAT («+ ΦΠΑ»).
 */
export default function PlanBillingCard({ storeId }: { storeId: string }) {
  const plansQ = useQuery({ queryKey: ['public-plans'], queryFn: getPublicPlans })
  const statusQ = useQuery({ queryKey: ['plan-billing', storeId], queryFn: () => getBillingStatus(storeId), retry: false })
  const [busy, setBusy] = useState<string | null>(null)

  // Back from Stripe Checkout.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const b = p.get('billing')
    if (!b) return
    if (b === 'success') toast.success('Η πληρωμή ολοκληρώθηκε. Το πακέτο ενημερώνεται σε λίγα δευτερόλεπτα.')
    if (b === 'cancel') toast('Η πληρωμή ακυρώθηκε. Δεν χρεώθηκε τίποτα.')
    p.delete('billing')
    const q = p.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''))
  }, [])

  const st = statusQ.data
  const paid = (plansQ.data?.plans ?? []).filter(p => num(p.price) > 0)

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try { await fn() } catch (e) {
      toast.error(BILLING_ERRORS[(e as { code?: string }).code ?? ''] ?? 'Δεν ήταν δυνατή η πληρωμή. Δοκίμασε ξανά.')
      setBusy(null)
    }
  }

  return (
    <section className="no-print mb-5 rounded-2xl border border-surface-4 bg-surface-1 p-4" data-testid="plan-billing">
      <h2 className="font-display font-bold text-lg">Πακέτο & πληρωμή</h2>
      {(plansQ.isLoading || statusQ.isLoading) && <Spinner size={22} />}

      {st?.stripe ? (
        <div className="mt-2 text-sm">
          <p>Πληρώνεις με κάρτα το πακέτο <strong>{st.stripe.plan_name}</strong>
            {st.stripe.status === 'past_due' && <span className="text-danger font-semibold"> · η τελευταία πληρωμή απέτυχε</span>}
            {st.stripe.status === 'trial' && <span className="text-ink-3"> · δοκιμαστική περίοδος</span>}.
          </p>
          <button className="btn btn-secondary btn-md mt-3" disabled={!!busy || !st.configured}
                  data-testid="billing-portal"
                  onClick={() => run('portal', () => openBillingPortal(storeId))}>
            {busy === 'portal' ? <Spinner size={18} /> : 'Διαχείριση ή ακύρωση συνδρομής'}
          </button>
          <p className="text-[11px] text-ink-3 mt-2">Αλλαγή κάρτας, αποδείξεις και ακύρωση γίνονται στη σελίδα του Stripe.</p>
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          {paid.map(p => {
            const key = planKey(p.name) as PaidPlanKey | null
            const on = !!st?.configured && !!key && st.plans.includes(key)
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-ink-2">
                    {money(p.price)}/μήνα + ΦΠΑ{p.included_orders != null ? ` · έως ${p.included_orders} παραγγελίες` : ''}
                  </p>
                </div>
                {on ? (
                  <button className="btn btn-primary btn-md whitespace-nowrap" disabled={!!busy}
                          data-testid="plan-pay" onClick={() => run(p.id, () => startPlanCheckout(storeId, key!))}>
                    {busy === p.id ? <Spinner size={18} color="white" /> : 'Πληρωμή με κάρτα'}
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-md whitespace-nowrap" disabled aria-disabled
                          data-testid="plan-pay-soon" title="Η online πληρωμή δεν είναι ακόμα ενεργή">
                    Κάρτα: σύντομα
                  </button>
                )}
              </div>
            )
          })}
          <p className="text-[11px] text-ink-3">
            {st?.configured
              ? 'Ασφαλής πληρωμή μέσω Stripe. Τιμές χωρίς ΦΠΑ· ο ΦΠΑ προστίθεται στην πληρωμή. Ακυρώνεις όποτε θέλεις.'
              : 'Η online πληρωμή της συνδρομής με κάρτα δεν είναι ακόμα ενεργή: έρχεται σύντομα.'}
          </p>
        </div>
      )}
    </section>
  )
}
