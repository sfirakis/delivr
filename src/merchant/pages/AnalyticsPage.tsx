import { useState } from 'react'
import { useStoreStats } from '@/admin/hooks'
import { Card, StatCard, Select, downloadFile, toCsv } from '@/admin/ui'
import { TimeSeries, Bars, RankedBars, Composition, ChartFrame, CHART_COLORS } from '@/admin/charts'
import { money, num, pct } from '@/lib/format'
import { Spinner, EmptyState } from '@/components/ui'

const RANGES = [
  { days: 7, label: '7 ημέρες' },
  { days: 30, label: '30 ημέρες' },
  { days: 90, label: '90 ημέρες' },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function MerchantAnalyticsPage({ storeId }: { storeId: string }) {
  const [days, setDays] = useState(30)
  const to = iso(new Date())
  const from = iso(new Date(Date.now() - (days - 1) * 86400000))
  const statsQ = useStoreStats(storeId, from, to)

  if (statsQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>
  if (statsQ.isError) {
    return <EmptyState emoji="⚠️" title="Δεν φορτώθηκαν τα στατιστικά"
                       subtitle={(statsQ.error as Error).message} />
  }

  const s = statsQ.data!
  const t = s.totals
  const f = s.fees

  const exportCsv = () => downloadFile(
    `store-report-${from}_${to}.csv`,
    toCsv(s.series.map(d => ({ Ημερομηνία: d.day, Παραγγελίες: d.orders, Τζίρος: d.turnover }))),
    'text/csv;charset=utf-8')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[150px]">
          <span className="input-label">Περίοδος</span>
          <Select value={days} onChange={e => setDays(Number(e.target.value))}>
            {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
          </Select>
        </div>
        <button className="btn btn-secondary btn-md" onClick={exportCsv}>⬇️ Εξαγωγή CSV</button>
        <p className="text-xs text-ink-3 pb-2 ml-auto">{from} → {to}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="💰" label="Τζίρος" value={money(t.turnover)}
                  sub={`${t.orders} παραγγελίες`} tone="brand" />
        <StatCard icon="🧾" label="Μέσο καλάθι" value={money(t.aov)}
                  sub={`${t.items_sold} προϊόντα`} />
        <StatCard icon="🏦" label="Προμήθειες πλατφόρμας" value={money(f.total)}
                  sub={num(f.subscription) > 0 ? `εκ των οποίων ${money(f.subscription)} συνδρομή` : 'ανά παραγγελία'} />
        <StatCard icon="📈" label="Καθαρά σε εσένα" value={money(f.net)}
                  sub="τζίρος μείον προμήθειες" tone="success" />
      </div>

      <ChartFrame title="Τζίρος ανά ημέρα" subtitle="Χωρίς τις ακυρωμένες παραγγελίες">
        <TimeSeries data={s.series.map(x => ({ day: x.day, value: num(x.turnover) }))}
                    label="Τζίρος" color={CHART_COLORS[0]} format={v => money(v)} />
      </ChartFrame>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartFrame title="Πότε παραγγέλνουν" subtitle="Παραγγελίες ανά ώρα της ημέρας">
          <Bars data={s.hours.map(h => ({ key: String(h.hour).padStart(2, '0'), value: h.orders }))}
                label="Παραγγελίες ανά ώρα" color={CHART_COLORS[1]} />
        </ChartFrame>

        <Card title="Τα προϊόντα που πουλάνε">
          <RankedBars
            data={s.top_items.slice(0, 8).map(i => ({
              name: i.name, value: num(i.revenue), sub: `${i.qty} τεμ.`,
            }))}
            format={v => money(v)}
          />
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Delivery vs Take away">
          <Composition
            segments={[
              { label: 'Delivery', value: t.delivery, color: CHART_COLORS[1] },
              { label: 'Take away', value: t.pickup, color: CHART_COLORS[2] },
            ]}
            format={v => `${Math.round(v)}`}
          />
          <div className="mt-3 pt-3 border-t border-surface-4 flex justify-between text-xs">
            <span className="text-ink-2">Εισπράξεις μεταφορικών</span>
            <span className="font-semibold">{money(t.delivery_fees)}</span>
          </div>
        </Card>

        <Card title="Λειτουργία">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">Παραδόθηκαν</span>
              <span className="font-bold">{t.delivered}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ακυρώθηκαν</span>
              <span className="font-bold text-danger">{t.cancelled}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Ποσοστό απόρριψης</span>
              <span className={`font-bold ${num(t.rejection_rate) > 10 ? 'text-danger' : 'text-success'}`}>
                {pct(t.rejection_rate)}
              </span></div>
            <div className="flex justify-between"><span className="text-ink-2">Μ.Ο. χρόνου ετοιμασίας</span>
              <span className="font-bold">{num(t.avg_prep)}′</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Πελάτες που ξαναπαρήγγειλαν</span>
              <span className="font-bold">{s.repeat_customers}</span></div>
          </div>
        </Card>

        <Card title="Εκκρεμείς χρεώσεις">
          <p className="font-display font-black text-3xl text-ink-1">{money(f.pending)}</p>
          <p className="text-xs text-ink-3 mt-1">
            Προμήθειες και συνδρομές που δεν έχουν εξοφληθεί ακόμη.
          </p>
          <div className="mt-3 pt-3 border-t border-surface-4 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-ink-2">Προμήθειες παραγγελιών</span>
              <span className="font-semibold">{money(f.commission)}</span></div>
            <div className="flex justify-between"><span className="text-ink-2">Συνδρομή</span>
              <span className="font-semibold">{money(f.subscription)}</span></div>
          </div>
        </Card>
      </div>

      {s.properties.length > 0 && (
        <Card title="Από ποια καταλύματα έρχονται παραγγελίες">
          <div className="overflow-x-auto">
            <table className="dash-table">
              <thead><tr><th>Κατάλυμα</th><th>Κωδικός</th><th>Περιοχή</th><th>Παραγγελίες</th><th>Τζίρος</th></tr></thead>
              <tbody>
                {s.properties.map(p => (
                  <tr key={p.code}>
                    <td className="font-semibold">{p.name}</td>
                    <td className="font-mono text-xs">{p.code}</td>
                    <td className="text-ink-2">{p.area ?? '—'}</td>
                    <td>{p.orders}</td>
                    <td className="font-semibold">{money(p.turnover)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
