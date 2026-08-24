import { useState } from 'react'
import { usePlatformStats } from '../hooks'
import { Card, StatCard, Select, downloadFile, toCsv } from '../ui'
import { TimeSeries, Bars, RankedBars, Composition, ChartFrame, CHART_COLORS } from '../charts'
import { money, num, pct } from '@/lib/format'
import { Spinner, EmptyState } from '@/components/ui'

const RANGES = [
  { days: 7, label: '7 ημέρες' },
  { days: 30, label: '30 ημέρες' },
  { days: 90, label: '90 ημέρες' },
  { days: 365, label: '12 μήνες' },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const to = iso(new Date())
  const from = iso(new Date(Date.now() - (days - 1) * 86400000))
  const statsQ = usePlatformStats(from, to)

  if (statsQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>
  if (statsQ.isError) {
    return <EmptyState emoji="🔒" title="Δεν έχεις δικαιώματα διαχειριστή"
                       subtitle={(statsQ.error as Error).message} />
  }

  const s = statsQ.data!
  const t = s.totals
  const income = s.income

  const grossProfit = num(income.total) - num(s.payouts)
  const takeRate = num(t.gmv) > 0 ? (num(income.commission) / num(t.gmv)) * 100 : 0

  const exportStores = () => downloadFile(
    `delivr-stores-${from}_${to}.csv`,
    toCsv(s.by_store.map(x => ({
      Κατάστημα: x.name, Παραγγελίες: x.orders, Τζίρος: x.gmv,
      'Μ.Ο. καλαθιού': x.aov, Προμήθεια: x.commission, Ακυρώσεις: x.cancelled,
    }))), 'text/csv;charset=utf-8')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[150px]">
          <span className="input-label">Περίοδος</span>
          <Select value={days} onChange={e => setDays(Number(e.target.value))}>
            {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
          </Select>
        </div>
        <p className="text-xs text-ink-3 pb-2">{from} → {to}</p>
      </div>

      {/* ── The money line ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🛒" label="Τζίρος (GMV)" value={money(t.gmv)}
                  sub={`${t.live_orders} παραγγελίες · Μ.Ο. ${money(t.aov)}`} tone="brand" />
        <StatCard icon="🏦" label="Έσοδα πλατφόρμας" value={money(income.total)}
                  sub={`take rate ${pct(takeRate)}`} tone="success" />
        <StatCard icon="🏠" label="Αποδόσεις σε καταλύματα" value={money(s.payouts)} />
        <StatCard icon="📈" label="Μικτό κέρδος" value={money(grossProfit)}
                  sub={`${money(s.pending)} εκκρεμούν προς είσπραξη`}
                  tone={grossProfit >= 0 ? 'success' : 'warning'} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartFrame title="Τζίρος ανά ημέρα" subtitle="Αξία παραγγελιών που δεν ακυρώθηκαν">
          <TimeSeries data={s.series.map(x => ({ day: x.day, value: num(x.gmv) }))}
                      label="Τζίρος" color={CHART_COLORS[0]} format={v => money(v)} />
        </ChartFrame>

        <ChartFrame title="Έσοδα πλατφόρμας ανά ημέρα" subtitle="Προμήθειες και συνδρομές">
          <TimeSeries data={s.series.map(x => ({ day: x.day, value: num(x.commission) }))}
                      label="Έσοδα" color={CHART_COLORS[2]} format={v => money(v)} />
        </ChartFrame>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Από πού έρχονται τα έσοδα">
          <Composition
            segments={[
              { label: 'Προμήθειες παραγγελιών', value: num(income.commission), color: CHART_COLORS[0] },
              { label: 'Συνδρομές', value: num(income.subscriptions), color: CHART_COLORS[1] },
              { label: 'Λοιπές χρεώσεις', value: num(income.adjustments), color: CHART_COLORS[3] },
            ]}
            format={v => money(v)}
          />
          <div className="mt-3 pt-3 border-t border-surface-4 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-ink-2">Εισπραγμένα</span>
              <span className="font-semibold text-success">{money(s.paid)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Εκκρεμή</span>
              <span className="font-semibold text-amber-700">{money(s.pending)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">MRR συνδρομών</span>
              <span className="font-semibold">{money(s.subscriptions.mrr)}</span></div>
          </div>
        </Card>

        <Card title="Τρόπος παραλαβής">
          <Composition
            segments={[
              { label: 'Delivery', value: t.delivery_orders, color: CHART_COLORS[1] },
              { label: 'Take away', value: t.pickup_orders, color: CHART_COLORS[2] },
            ]}
            format={v => `${Math.round(v)}`}
          />
          <div className="mt-3 pt-3 border-t border-surface-4 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-ink-2">Από QR καταλύματος</span>
              <span className="font-semibold">{t.qr_orders}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Σαρώσεις QR</span>
              <span className="font-semibold">{t.scans}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Μετατροπή σάρωσης</span>
              <span className="font-semibold">
                {t.scans > 0 ? `${Math.round((t.qr_orders / t.scans) * 100)}%` : '—'}
              </span></div>
          </div>
        </Card>

        <Card title="Ποιότητα εξυπηρέτησης">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">Παραδόθηκαν</span>
              <span className="font-bold">{t.delivered}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ακυρώθηκαν</span>
              <span className="font-bold text-danger">{t.cancelled}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ποσοστό απόρριψης</span>
              <span className={`font-bold ${num(t.rejection_rate) > 10 ? 'text-danger' : 'text-success'}`}>
                {pct(t.rejection_rate)}
              </span></div>
            <div className="h-px bg-surface-4 my-1" />
            <div className="flex justify-between"><span className="text-ink-2">Ενεργές συνδρομές</span>
              <span className="font-bold">{s.subscriptions.active}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Σε δοκιμή</span>
              <span className="font-bold">{s.subscriptions.trials}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ληξιπρόθεσμες</span>
              <span className={`font-bold ${s.subscriptions.past_due > 0 ? 'text-amber-700' : ''}`}>
                {s.subscriptions.past_due}
              </span></div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartFrame title="Παραγγελίες ανά ώρα" subtitle="Πότε χτυπάει η κίνηση">
          <Bars data={s.hours.map(h => ({ key: String(h.hour).padStart(2, '0'), value: h.orders }))}
                label="Παραγγελίες ανά ώρα" color={CHART_COLORS[1]} />
        </ChartFrame>

        <Card title="Κορυφαία προϊόντα">
          <RankedBars
            data={s.top_items.slice(0, 8).map(i => ({
              name: i.name, value: num(i.revenue), sub: `${i.qty} τεμ.`,
            }))}
            format={v => money(v)}
          />
        </Card>
      </div>

      <Card title="Απόδοση ανά κατάστημα"
            action={<button className="btn btn-secondary btn-sm" onClick={exportStores}
                            disabled={s.by_store.length === 0}>⬇️ CSV</button>}>
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr><th>Κατάστημα</th><th>Παραγγελίες</th><th>Τζίρος</th><th>Μ.Ο. καλαθιού</th>
                  <th>Προμήθεια</th><th>Take rate</th><th>Ακυρώσεις</th></tr>
            </thead>
            <tbody>
              {s.by_store.map(x => (
                <tr key={x.id}>
                  <td className="font-semibold">{x.name}</td>
                  <td>{x.orders}</td>
                  <td className="font-semibold">{money(x.gmv)}</td>
                  <td>{money(x.aov)}</td>
                  <td className="text-success font-semibold">{money(x.commission)}</td>
                  <td className="text-ink-2">
                    {num(x.gmv) > 0 ? pct((num(x.commission) / num(x.gmv)) * 100) : '—'}
                  </td>
                  <td className={x.cancelled > 0 ? 'text-danger' : 'text-ink-3'}>{x.cancelled}</td>
                </tr>
              ))}
              {s.by_store.length === 0 && (
                <tr><td colSpan={7} className="text-center text-ink-3 py-6">Καμία παραγγελία στην περίοδο.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Απόδοση ανά κατάλυμα">
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr><th>Κατάλυμα</th><th>Κωδικός</th><th>Περιοχή</th><th>Παραγγελίες</th>
                  <th>Τζίρος</th><th>Απόδοση</th><th>Σαρώσεις</th></tr>
            </thead>
            <tbody>
              {s.by_property.map(x => (
                <tr key={x.id}>
                  <td className="font-semibold">{x.name}</td>
                  <td className="font-mono text-xs">{x.code}</td>
                  <td className="text-ink-2">{x.area ?? '—'}</td>
                  <td>{x.orders}</td>
                  <td className="font-semibold">{money(x.gmv)}</td>
                  <td className="text-brand font-semibold">{money(x.payout)}</td>
                  <td className="text-ink-2">{x.scans}</td>
                </tr>
              ))}
              {s.by_property.length === 0 && (
                <tr><td colSpan={7} className="text-center text-ink-3 py-6">
                  Καμία παραγγελία από QR καταλύματος στην περίοδο.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
