import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { money, dateTime, relativeMinutes, phoneDigits, num, fullAddress } from '@/lib/format'
import { Spinner, EmptyState } from '@/components/ui'
import { Card, StatCard, StatusChip, Tabs } from '@/admin/ui'

interface DriverOrder {
  id: string
  order_number: string | null
  status: string
  delivery_type: string
  guest_name: string | null
  guest_phone: string | null
  delivery_address: Record<string, string> | null
  customer_notes: string | null
  total: number
  delivery_fee: number
  payment_method: string
  payment_status: string
  driver_id: string | null
  created_at: string
  delivered_at: string | null
  estimated_ready_at: string | null
  stores: { name: string; address: string; phone: string | null; lat: number | null; lng: number | null } | null
  properties: { name: string; address: string; access_notes: string | null; lat: number | null; lng: number | null } | null
}

const SELECT = '*, stores(name,address,phone,lat,lng), properties(name,address,access_notes,lat,lng)'

function mapsHref(lat: number | null | undefined, lng: number | null | undefined, fallback: string) {
  return lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fallback)}`
}

function OrderCard({ order, onAction, busy }: {
  order: DriverOrder; busy: boolean; onAction: (patch: Record<string, unknown>) => void
}) {
  const addr = order.delivery_address
  const dest = fullAddress(order.properties?.address ?? addr?.street, addr?.area, addr?.city)
  const mine = !!order.driver_id

  return (
    <div className="dash-card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black">{order.order_number ?? order.id.slice(0, 8)}</span>
            <StatusChip status={order.status} />
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            {order.stores?.name} · {relativeMinutes(order.created_at)}′ πριν
          </p>
        </div>
        <div className="text-right">
          <p className="font-display font-black text-lg">{money(order.total)}</p>
          <p className="text-[11px] text-ink-3">
            {order.payment_method === 'cash'
              ? (order.payment_status === 'paid' ? 'Πληρωμένο' : '💶 Εισπράττεις')
              : 'Πληρωμένο online'}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2 text-sm">
        <div className="bg-surface-2 rounded-xl p-2.5">
          <p className="text-[11px] uppercase text-ink-3 font-bold">Παραλαβή</p>
          <p className="font-semibold">{order.stores?.name}</p>
          <p className="text-ink-2 text-xs">{order.stores?.address}</p>
          <div className="flex gap-2 mt-2">
            <a className="btn btn-secondary btn-sm flex-1"
               href={mapsHref(order.stores?.lat, order.stores?.lng, order.stores?.address ?? '')}
               target="_blank" rel="noopener noreferrer">🗺️ Πλοήγηση</a>
            {order.stores?.phone && (
              <a className="btn btn-secondary btn-sm" href={`tel:${phoneDigits(order.stores.phone)}`}>📞</a>
            )}
          </div>
        </div>

        <div className="bg-surface-2 rounded-xl p-2.5">
          <p className="text-[11px] uppercase text-ink-3 font-bold">Παράδοση</p>
          <p className="font-semibold">{order.properties?.name ?? addr?.label ?? order.guest_name}</p>
          <p className="text-ink-2 text-xs">{dest}</p>
          {(addr?.floor || addr?.doorbell) && (
            <p className="text-ink-3 text-[11px]">{[addr?.floor, addr?.doorbell].filter(Boolean).join(' · ')}</p>
          )}
          {order.properties?.access_notes && (
            <p className="text-ink-3 text-[11px] italic">{order.properties.access_notes}</p>
          )}
          <div className="flex gap-2 mt-2">
            <a className="btn btn-secondary btn-sm flex-1"
               href={mapsHref(order.properties?.lat, order.properties?.lng, dest)}
               target="_blank" rel="noopener noreferrer">🗺️ Πλοήγηση</a>
            {order.guest_phone && (
              <a className="btn btn-secondary btn-sm" href={`tel:${phoneDigits(order.guest_phone)}`}>📞</a>
            )}
          </div>
        </div>
      </div>

      {order.customer_notes && (
        <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mt-2">
          📝 {order.customer_notes}
        </p>
      )}

      <div className="mt-3">
        {!mine && (
          <button className="btn btn-primary btn-md w-full" disabled={busy}
                  onClick={() => onAction({ driver_id: 'self' })}>
            🙋 Ανάληψη παραγγελίας
          </button>
        )}
        {mine && order.status === 'ready' && (
          <button className="btn btn-primary btn-md w-full" disabled={busy}
                  onClick={() => onAction({ status: 'on_the_way', picked_up_at: new Date().toISOString() })}>
            🛵 Παρέλαβα — ξεκινάω
          </button>
        )}
        {mine && (order.status === 'on_the_way' || order.status === 'picked_up') && (
          <button className="btn btn-primary btn-md w-full" disabled={busy}
                  onClick={() => onAction({
                    status: 'delivered',
                    delivered_at: new Date().toISOString(),
                    ...(order.payment_method === 'cash' ? { payment_status: 'paid' } : {}),
                  })}>
            ✓ Παραδόθηκε{order.payment_method === 'cash' ? ` · εισέπραξα ${money(order.total)}` : ''}
          </button>
        )}
      </div>
    </div>
  )
}

export default function DriverApp() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, profile, signOut } = useAuthStore()
  const [tab, setTab] = useState<'available' | 'mine' | 'done'>('available')
  const [online, setOnline] = useState(true)

  const ordersQ = useQuery({
    queryKey: ['driver-orders', user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { data, error } = await supabase
        .from('orders').select(SELECT)
        .eq('delivery_type', 'delivery')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as DriverOrder[]
    },
  })

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
        () => qc.invalidateQueries({ queryKey: ['driver-orders', user.id] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user, qc])

  const act = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const body: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
      if (body.driver_id === 'self') body.driver_id = user!.id
      const { error } = await supabase.from('orders').update(body).eq('id', id)
      if (error) throw new Error(error.message)
      if (typeof body.status === 'string') {
        await supabase.from('order_events').insert({
          order_id: id, status: body.status, actor: 'driver',
        })
      }
    },
    onSuccess: () => {
      toast.success('Ενημερώθηκε')
      void qc.invalidateQueries({ queryKey: ['driver-orders', user?.id] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  if (!user) return null
  if (ordersQ.isLoading) {
    return <div className="dash-container py-20 flex justify-center"><Spinner size={30} /></div>
  }

  const all = ordersQ.data ?? []
  const available = all.filter(o => !o.driver_id && ['confirmed', 'preparing', 'ready'].includes(o.status))
  const mine = all.filter(o => o.driver_id === user.id && o.status !== 'delivered' && o.status !== 'cancelled')
  const done = all.filter(o => o.driver_id === user.id && o.status === 'delivered')

  const earnings = done.reduce((s, o) => s + num(o.delivery_fee), 0)
  const cashHeld = done.filter(o => o.payment_method === 'cash').reduce((s, o) => s + num(o.total), 0)

  const list = tab === 'available' ? available : tab === 'mine' ? mine : done

  return (
    <div className="dash-container px-4 md:px-6 py-4">
      <header className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl">Διανομή</h1>
          <p className="text-xs text-ink-3">{profile?.full_name ?? user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-brand w-4 h-4" checked={online}
                   onChange={e => setOnline(e.target.checked)} />
            {online ? '🟢 Διαθέσιμος' : '⚪ Εκτός βάρδιας'}
          </label>
          <button className="btn btn-ghost btn-md" onClick={() => { void signOut(); navigate('/auth') }}>Έξοδος</button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon="📦" label="Διαθέσιμες" value={available.length} tone="brand" />
        <StatCard icon="🛵" label="Σε εξέλιξη" value={mine.length} />
        <StatCard icon="✅" label="Παραδόθηκαν (24ω)" value={done.length} />
        <StatCard icon="💶" label="Μετρητά στα χέρια" value={money(cashHeld)}
                  sub={`Μεταφορικά: ${money(earnings)}`} tone="success" />
      </div>

      <Tabs
        tabs={[
          { id: 'available', label: 'Διαθέσιμες', badge: available.length },
          { id: 'mine', label: 'Οι δικές μου', badge: mine.length },
          { id: 'done', label: 'Ολοκληρωμένες' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="py-4 space-y-3">
        {!online && tab === 'available' && (
          <Card><p className="text-sm text-ink-2">Είσαι εκτός βάρδιας. Ενεργοποίησε τη διαθεσιμότητα για να αναλάβεις παραγγελίες.</p></Card>
        )}

        {list.length === 0 && (
          <EmptyState emoji="🛵" title="Καμία παραγγελία εδώ"
                      subtitle={tab === 'available' ? 'Θα εμφανιστούν μόλις τις επιβεβαιώσει το κατάστημα.' : undefined} />
        )}

        {tab === 'done'
          ? (
            <Card>
              <table className="dash-table">
                <thead><tr><th>Αριθμός</th><th>Κατάστημα</th><th>Παράδοση</th><th>Σύνολο</th><th>Ώρα</th></tr></thead>
                <tbody>
                  {done.map(o => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.order_number}</td>
                      <td>{o.stores?.name}</td>
                      <td className="text-ink-2">{o.properties?.name ?? o.guest_name}</td>
                      <td className="font-semibold">{money(o.total)}</td>
                      <td className="text-xs text-ink-3">{dateTime(o.delivered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
          : list.map(o => (
            <OrderCard key={o.id} order={o} busy={act.isPending}
                       onAction={patch => act.mutate({ id: o.id, patch })} />
          ))}
      </div>
    </div>
  )
}
