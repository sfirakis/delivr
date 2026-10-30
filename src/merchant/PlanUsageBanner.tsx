import { useQuery } from '@tanstack/react-query'
import { getStorePlanUsage, type PlanUsage } from '@/lib/api'
import { money, num } from '@/lib/format'

/**
 * «X / όριο παραγγελίες αυτόν τον μήνα» + a banner at ≥ 80 % and over the
 * limit (migration 018). Purely informative: orders are NEVER blocked. Over
 * the limit, the store moves to the plan that fits from the next month.
 * Renders nothing on a database without 018 (the RPC is missing).
 */
export default function PlanUsageBanner({ storeId }: { storeId: string }) {
  const q = useQuery({
    queryKey: ['plan-usage', storeId],
    queryFn: () => getStorePlanUsage(storeId),
    retry: false,
    refetchInterval: 60_000,
  })
  const u = q.data
  if (!u) return null

  const day1 = (iso: string) => { const [, m] = iso.split('-'); return `1/${Number(m)}` }
  const planLine = (p: NonNullable<PlanUsage['next_plan']>) =>
    `${p.name} (${num(p.price) > 0 ? `${money(p.price)}/μήνα` : 'δωρεάν'}, έως ${p.included_orders} παραγγελίες)`
  const pct = Math.min(100, u.pct ?? 0)
  const bar = u.state === 'over' || u.state === 'custom' ? 'bg-danger' : u.state === 'near' ? 'bg-amber-500' : 'bg-brand'

  return (
    <div className="no-print mb-4 space-y-2" data-testid="plan-usage">
      <div className="rounded-2xl border border-surface-4 bg-surface-1 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
          <p>
            <strong className="font-display text-base" data-testid="plan-usage-count">
              {u.limit != null ? `${u.orders} / ${u.limit}` : u.orders}
            </strong>{' '}
            παραγγελίες αυτόν τον μήνα
          </p>
          {u.plan && <p className="text-xs text-ink-3">Πακέτο <strong className="text-ink-1">{u.plan.name}</strong></p>}
        </div>
        {u.limit != null && (
          <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
            <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {u.state === 'near' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p className="font-semibold">⚠️ Πλησιάζεις το όριο του πακέτου σου ({u.orders}/{u.limit})</p>
          <p className="mt-1">
            Οι παραγγελίες συνεχίζουν κανονικά. Αν ξεπεράσεις το όριο, από τον επόμενο μήνα περνάς στο
            {u.next_plan ? <> πακέτο <strong>{planLine(u.next_plan)}</strong>.</> : ' επόμενο πακέτο.'}
          </p>
        </div>
      )}

      {u.state === 'over' && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900" role="status">
          <p className="font-semibold">📈 Ξεπέρασες το όριο του πακέτου {u.plan?.name} ({u.orders}/{u.limit})</p>
          <p className="mt-1">
            Δεν χάνεις καμία παραγγελία — συνεχίζουν κανονικά.
            {u.next_plan
              ? <> Από {day1(u.next_month)} περνάς αυτόματα στο πακέτο <strong>{planLine(u.next_plan)}</strong>.</>
              : ' Από τον επόμενο μήνα περνάς στο επόμενο πακέτο.'}
          </p>
        </div>
      )}

      {u.state === 'custom' && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900" role="status">
          <p className="font-semibold">🚀 Πάνω από {u.top_limit} παραγγελίες αυτόν τον μήνα</p>
          <p className="mt-1">
            Οι παραγγελίες συνεχίζουν κανονικά. Για τόση κίνηση το πακέτο ορίζεται
            <strong> κατόπιν συμφωνίας</strong> — θα επικοινωνήσουμε μαζί σου.
          </p>
        </div>
      )}
    </div>
  )
}
