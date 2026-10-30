import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAdminPlanUsage, useApplyPlanUpgrades, type PlanRef, type StorePlanUsageRow } from '../hooks'
import { Card } from '../ui'
import { money, num } from '@/lib/format'
import { Spinner } from '@/components/ui'

/**
 * Admin → Συνδρομές: stores near / over their monthly order limit (018).
 * Orders are never blocked; over the limit a store moves to the plan that
 * fits from the next month. «Εφαρμογή» runs delivr_apply_plan_upgrades()
 * for the current month (looks at last month) — safe to press twice.
 * Over the top plan: «Κατόπιν συμφωνίας», flagged here, nothing automatic.
 */
const STATE: Record<StorePlanUsageRow['state'], { label: string; cls: string }> = {
  ok:     { label: 'Εντός ορίου', cls: 'bg-surface-3 text-ink-2' },
  near:   { label: '≥ 80%', cls: 'bg-amber-100 text-amber-900' },
  over:   { label: 'Πάνω από το όριο', cls: 'bg-orange-100 text-orange-900' },
  custom: { label: 'Κατόπιν συμφωνίας', cls: 'bg-red-100 text-red-900' },
}

const monthLabel = (iso: string) => { const [y, m] = iso.split('-'); return `${m}/${y}` }
const planText = (p: PlanRef | null) =>
  p ? `${p.name} · ${num(p.price) > 0 ? `${money(p.price)}/μήνα` : 'δωρεάν'}${p.included_orders ? ` · έως ${p.included_orders}` : ''}` : '—'

export default function PlanLimitsCard() {
  const q = useAdminPlanUsage()
  const apply = useApplyPlanUpgrades()
  const [showAll, setShowAll] = useState(false)

  if (q.isLoading) return <Card title="Όρια παραγγελιών"><Spinner size={24} /></Card>
  if (q.error || !Array.isArray(q.data?.stores)) {
    return (
      <Card title="Όρια παραγγελιών">
        <p className="text-sm text-ink-3">Δεν είναι διαθέσιμο — χρειάζεται το migration 018 στη βάση.</p>
      </Card>
    )
  }

  const { month, prev_month, top_limit, stores } = q.data
  const flagged = stores.filter(s => s.state !== 'ok' || s.pending || s.applied)
  const rows = showAll ? stores : flagged
  const pending = stores.filter(s => s.pending)

  return (
    <Card title={`Όρια παραγγελιών — ${monthLabel(month)}`}
          action={<label className="text-xs text-ink-2 flex items-center gap-1.5">
            <input type="checkbox" className="accent-brand" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Όλα τα καταστήματα
          </label>}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-[260px] text-xs text-ink-3 space-y-1">
          <p>
            Οι παραγγελίες <strong>δεν μπλοκάρονται ποτέ</strong>. Όποιο κατάστημα ξεπέρασε το όριο τον
            {' '}{monthLabel(prev_month)} περνά από {monthLabel(month)} στο μικρότερο πακέτο που το καλύπτει.
            Πάνω από {top_limit ?? 500} παραγγελίες: κατόπιν συμφωνίας (μόνο σήμανση).
          </p>
          <p>Τρέξ' το στην αρχή του μήνα, <strong>πριν</strong> την «Έκδοση χρεώσεων περιόδου», ώστε να χρεωθεί η νέα τιμή.</p>
        </div>
        <button className="btn btn-primary btn-md" disabled={apply.isPending}
                onClick={() => apply.mutate(undefined, {
                  onSuccess: r => {
                    const n = r.upgraded.length, c = r.custom.length
                    toast.success(n || c
                      ? `Αλλαγές πακέτου: ${n}${c ? ` · κατόπιν συμφωνίας: ${c}` : ''}`
                      : 'Καμία αλλαγή — όλα εντός ορίων ή ήδη εφαρμοσμένα')
                  },
                  onError: e => toast.error((e as Error).message),
                })}>
          {apply.isPending ? 'Εφαρμογή…' : `Εφαρμογή αλλαγών πακέτων${pending.length ? ` (${pending.length})` : ''}`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="dash-table" data-testid="plan-limits-table">
          <thead>
            <tr><th>Κατάστημα</th><th>Πακέτο</th><th>Αυτόν τον μήνα</th><th>Κατάσταση</th>
                <th>Προτεινόμενο πακέτο</th><th>{monthLabel(prev_month)}</th><th>Από {monthLabel(month)}</th></tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.store_id}>
                <td className="font-semibold">{s.name}</td>
                <td className="text-ink-2">
                  {s.plan?.name ?? '—'}
                  {!s.subscribed && <span className="block text-[11px] text-ink-3">χωρίς συνδρομή</span>}
                </td>
                <td className="whitespace-nowrap">
                  <strong>{s.orders}</strong>{s.limit != null ? ` / ${s.limit}` : ''}
                  {s.pct != null && <span className="text-[11px] text-ink-3"> ({s.pct}%)</span>}
                </td>
                <td><span className={`badge ${STATE[s.state].cls}`}>{STATE[s.state].label}</span></td>
                <td className="text-xs">
                  {s.state === 'custom' ? <strong>Κατόπιν συμφωνίας</strong> : planText(s.suggested_plan)}
                </td>
                <td className="text-xs text-ink-2">{s.prev_orders}</td>
                <td className="text-xs">
                  {s.applied
                    ? <span className="text-success font-semibold">✓ {s.applied.kind === 'custom' ? 'σήμανση: κατόπιν συμφωνίας' : `→ ${s.applied.to_plan_name}`}</span>
                    : s.pending
                      ? <span className="font-semibold">{s.pending.kind === 'custom' ? '⚑ κατόπιν συμφωνίας' : `⏳ → ${planText(s.pending.to_plan)}`}</span>
                      : <span className="text-ink-3">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-ink-3 py-6">
                Κανένα κατάστημα κοντά ή πάνω από το όριό του.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
