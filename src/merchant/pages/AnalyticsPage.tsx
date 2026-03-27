import { useState } from 'react'
import { useMerchantAnalytics } from '@/merchant/hooks'
import { Skeleton } from '@/components/ui'

function MiniBar({ value, max, color = '#FF4500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-end gap-1 h-full">
      <div className="flex-1 bg-surface-3 rounded-sm relative overflow-hidden" style={{ minHeight: 4 }}>
        <div className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-700"
             style={{ height: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function MerchantAnalyticsPage({ storeId }: { storeId: string }) {
  const [period, setPeriod] = useState(7)
  const { data, isLoading } = useMerchantAnalytics(storeId, period)

  const PERIODS = [
    { val: 7,  label: '7 μέρες' },
    { val: 14, label: '14 μέρες' },
    { val: 30, label: '30 μέρες' },
  ]

  const maxRev = Math.max(...(data?.dailyRevenue.map(d => d.revenue) ?? [1]))

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-black text-xl">Analytics</h2>
          <div className="flex bg-surface-2 rounded-full p-0.5 gap-0.5">
            {PERIODS.map(p => (
              <button key={p.val} onClick={() => setPeriod(p.val)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${period === p.val ? 'bg-brand text-white' : 'text-ink-2'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label:'Έσοδα',          val:`${data?.revenue.toFixed(2)}€`,       sub:`+12% vs περίοδο`, icon:'💰', color:'bg-brand-50 border-brand-100' },
              { label:'Παραγγελίες',    val:`${data?.totalOrders}`,                sub:`${period} μέρες`,            icon:'📦', color:'bg-blue-50 border-blue-100' },
              { label:'Μ.Ο. παραγγελία',val:`${data?.avgOrder.toFixed(2)}€`,       sub:'ανά παραγγελία',             icon:'📊', color:'bg-green-50 border-green-100' },
              { label:'Ανά ημέρα',      val:`${((data?.totalOrders??0)/period).toFixed(1)}`, sub:'παρ/ημέρα',      icon:'📅', color:'bg-amber-50 border-amber-100' },
            ].map(kpi => (
              <div key={kpi.label} className={`border rounded-2xl p-4 ${kpi.color}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl">{kpi.icon}</span>
                </div>
                <p className="font-display font-black text-xl text-ink-1">{kpi.val}</p>
                <p className="text-[11px] text-ink-2 mt-0.5">{kpi.label}</p>
                <p className="text-[10px] text-ink-3">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue chart */}
      <div className="px-5 mb-5">
        <h3 className="font-display font-bold text-base mb-3">Έσοδα ανά ημέρα</h3>
        {isLoading ? <Skeleton className="h-36 rounded-2xl" /> : (
          <div className="bg-surface-2 rounded-2xl p-4">
            <div className="flex items-end gap-1 h-28">
              {data?.dailyRevenue.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">Δεν υπάρχουν δεδομένα</div>
              )}
              {data?.dailyRevenue.map((d, i) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-ink-3 font-bold">{d.revenue > 0 ? d.revenue.toFixed(0) : ''}</span>
                  <div className="w-full flex items-end" style={{ height: 80 }}>
                    <div className="w-full rounded-t-sm transition-all duration-700"
                         style={{
                           height: `${maxRev > 0 ? (d.revenue/maxRev)*100 : 0}%`,
                           minHeight: d.revenue > 0 ? 4 : 0,
                           background: i === (data.dailyRevenue.length-1) ? '#FF4500' : '#FFB399'
                         }} />
                  </div>
                  <span className="text-[9px] text-ink-3">
                    {new Date(d.date).toLocaleDateString('el', { weekday:'narrow' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top items */}
      <div className="px-5 mb-5">
        <h3 className="font-display font-bold text-base mb-3">🔥 Top Προϊόντα</h3>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : data?.topItems.length === 0 ? (
          <div className="text-center py-8 text-ink-3 text-sm">Δεν υπάρχουν δεδομένα ακόμα</div>
        ) : (
          <div className="space-y-2">
            {data?.topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 bg-surface-2 rounded-xl p-3.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-sm
                  ${i===0 ? 'bg-amber-400 text-white' : i===1 ? 'bg-surface-3 text-ink-2' : i===2 ? 'bg-orange-300 text-white' : 'bg-surface-3 text-ink-3'}`}>
                  {i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name}</p>
                  <p className="text-xs text-ink-2">{item.count} πωλήσεις</p>
                </div>
                <p className="font-display font-bold text-sm text-brand">{item.revenue.toFixed(2)}€</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hours heatmap (static for now) */}
      <div className="px-5 mb-5">
        <h3 className="font-display font-bold text-base mb-3">⏰ Ώρες αιχμής</h3>
        <div className="bg-surface-2 rounded-2xl p-4">
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 24 }, (_, h) => {
              // Demo heatmap data
              const vals: Record<number,number> = {12:0.9,13:1.0,14:0.8,20:0.85,21:0.95,22:0.7,8:0.4,9:0.5,10:0.3}
              const v = vals[h] ?? Math.random()*0.2
              return (
                <div key={h} className="flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm" style={{ height:40, background:`rgba(255,69,0,${v})` }} title={`${h}:00`} />
                  {h % 4 === 0 && <span className="text-[9px] text-ink-3">{h}:00</span>}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 justify-end">
            <span className="text-[10px] text-ink-3">Χαμηλό</span>
            <div className="flex gap-0.5">
              {[0.1,0.3,0.5,0.7,0.9].map(v => (
                <div key={v} className="w-4 h-3 rounded-sm" style={{ background:`rgba(255,69,0,${v})` }} />
              ))}
            </div>
            <span className="text-[10px] text-ink-3">Υψηλό</span>
          </div>
        </div>
      </div>
    </div>
  )
}
