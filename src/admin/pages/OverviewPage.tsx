import { useMemo } from 'react'
import { useAdminOrders, useAdminProperties, useAdminStores, useCharges } from '../hooks'
import { StatCard, Card, StatusChip } from '../ui'
import { money, dateTime, num } from '@/lib/format'
import { Spinner } from '@/components/ui'

export default function OverviewPage() {
  const ordersQ = useAdminOrders({ days: 30 })
  const storesQ = useAdminStores()
  const propsQ = useAdminProperties()
  const chargesQ = useCharges({ days: 30 })

  const stats = useMemo(() => {
    const orders = ordersQ.data ?? []
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const today = orders.filter(o => new Date(o.created_at) >= startOfDay)
    const live = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'].includes(o.status))
    const paidOrders = orders.filter(o => o.status !== 'cancelled')

    const gmvToday = today.filter(o => o.status !== 'cancelled').reduce((s, o) => s + num(o.total), 0)
    const gmv30 = paidOrders.reduce((s, o) => s + num(o.total), 0)

    const charges = chargesQ.data ?? []
    const commission30 = charges.filter(c => c.direction === 'charge' && c.status !== 'void')
      .reduce((s, c) => s + num(c.amount), 0)
    const payouts30 = charges.filter(c => c.direction === 'payout' && c.status !== 'void')
      .reduce((s, c) => s + num(c.amount), 0)
    const pendingCharges = charges.filter(c => c.status === 'pending')
      .reduce((s, c) => s + num(c.amount), 0)

    const stores = storesQ.data ?? []
    const properties = propsQ.data ?? []

    const rejected = orders.filter(o => o.status === 'cancelled').length
    const acceptRate = orders.length > 0 ? Math.round(100 * (1 - rejected / orders.length)) : 100

    return {
      todayCount: today.length, liveCount: live.length, gmvToday, gmv30,
      commission30, payouts30, pendingCharges, acceptRate,
      activeStores: stores.filter(s => s.is_active && s.onboarding_status === 'active').length,
      totalStores: stores.length,
      activeProperties: properties.filter(p => p.is_active).length,
      totalProperties: properties.length,
      scans: properties.reduce((s, p) => s + (p.scan_count ?? 0), 0),
      qrOrders: orders.filter(o => o.channel === 'qr').length,
    }
  }, [ordersQ.data, storesQ.data, propsQ.data, chargesQ.data])

  if (ordersQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>

  const recent = (ordersQ.data ?? []).slice(0, 12)
  const topStores = Object.entries(
    (ordersQ.data ?? []).filter(o => o.status !== 'cancelled').reduce<Record<string, { name: string; count: number; total: number }>>((acc, o) => {
      const name = o.stores?.name ?? '—'
      acc[o.store_id] ??= { name, count: 0, total: 0 }
      acc[o.store_id].count++
      acc[o.store_id].total += num(o.total)
      return acc
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

  const topProperties = Object.entries(
    (ordersQ.data ?? []).filter(o => o.property_id).reduce<Record<string, { name: string; count: number; total: number }>>((acc, o) => {
      const name = o.properties?.name ?? '—'
      acc[o.property_id!] ??= { name, count: 0, total: 0 }
      acc[o.property_id!].count++
      acc[o.property_id!].total += num(o.total)
      return acc
    }, {}),
  ).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📦" label="Παραγγελίες σήμερα" value={stats.todayCount} sub={`${stats.liveCount} σε εξέλιξη`} tone="brand" />
        <StatCard icon="💰" label="Τζίρος σήμερα" value={money(stats.gmvToday)} sub={`${money(stats.gmv30)} / 30 ημέρες`} />
        <StatCard icon="🏦" label="Προμήθειες 30 ημ." value={money(stats.commission30)} sub={`${money(stats.pendingCharges)} εκκρεμούν`} tone="success" />
        <StatCard icon="🏠" label="Αποδόσεις σε σπίτια" value={money(stats.payouts30)} sub="τελευταίες 30 ημέρες" />
        <StatCard icon="🏪" label="Ενεργά καταστήματα" value={stats.activeStores} sub={`από ${stats.totalStores} συνολικά`} />
        <StatCard icon="🔑" label="Ενεργά καταλύματα" value={stats.activeProperties} sub={`από ${stats.totalProperties} συνολικά`} />
        <StatCard icon="📲" label="Σαρώσεις QR" value={stats.scans} sub={`${stats.qrOrders} παραγγελίες από QR`} />
        <StatCard icon="✅" label="Ποσοστό αποδοχής" value={`${stats.acceptRate}%`} sub="τελευταίες 30 ημέρες" tone={stats.acceptRate < 80 ? 'warning' : 'default'} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Κορυφαία καταστήματα (30 ημ.)">
          {topStores.length === 0 && <p className="text-sm text-ink-3">Καμία παραγγελία ακόμη.</p>}
          <div className="space-y-2">
            {topStores.map(([id, s]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="text-ink-1 truncate pr-2">{s.name}</span>
                <span className="text-ink-2 whitespace-nowrap">{s.count} × · <span className="font-bold text-ink-1">{money(s.total)}</span></span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Κορυφαία καταλύματα (30 ημ.)">
          {topProperties.length === 0 && <p className="text-sm text-ink-3">Καμία παραγγελία από QR ακόμη.</p>}
          <div className="space-y-2">
            {topProperties.map(([id, p]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="text-ink-1 truncate pr-2">{p.name}</span>
                <span className="text-ink-2 whitespace-nowrap">{p.count} × · <span className="font-bold text-ink-1">{money(p.total)}</span></span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Τελευταίες παραγγελίες">
        <div className="overflow-x-auto">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Αριθμός</th><th>Κατάστημα</th><th>Κατάλυμα</th><th>Πελάτης</th>
                <th>Τύπος</th><th>Σύνολο</th><th>Προμήθεια</th><th>Κατάσταση</th><th>Ώρα</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.order_number ?? '—'}</td>
                  <td>{o.stores?.name ?? '—'}</td>
                  <td className="text-ink-2">{o.properties?.name ?? '—'}</td>
                  <td className="text-ink-2">{o.guest_name ?? '—'}</td>
                  <td>{o.delivery_type === 'delivery' ? '🏠' : '🥡'} {o.channel === 'qr' ? 'QR' : o.channel}</td>
                  <td className="font-semibold">{money(o.total)}</td>
                  <td className="text-ink-2">{money(o.platform_fee)}</td>
                  <td><StatusChip status={o.status} /></td>
                  <td className="text-ink-3 text-xs whitespace-nowrap">{dateTime(o.created_at)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={9} className="text-center text-ink-3 py-6">Καμία παραγγελία ακόμη.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
