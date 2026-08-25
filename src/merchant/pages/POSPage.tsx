import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { storeAction, getStoreOrder, type StoreOrderView } from '@/lib/api'
import { money, dateTime, relativeMinutes, phoneDigits, num } from '@/lib/format'
import { Spinner, EmptyState } from '@/components/ui'
import { Card, StatusChip } from '@/admin/ui'
import PrintTicket from '@/storefront/PrintTicket'

interface PosOrder {
  id: string
  order_number: string | null
  status: string
  delivery_type: string
  channel: string
  guest_name: string | null
  guest_phone: string | null
  delivery_address: Record<string, string> | null
  customer_notes: string | null
  subtotal: number
  delivery_fee: number
  discount_amount: number
  total: number
  payment_method: string
  prep_minutes: number | null
  scheduled_for: string | null
  estimated_ready_at: string | null
  store_token: string | null
  public_token: string | null
  printed_at: string | null
  created_at: string
  order_items: { id: string; name: string; quantity: number; subtotal: number; notes: string | null; modifiers: { name: string }[] | null }[]
  properties: { name: string; code: string; access_notes: string | null; lat: number | null; lng: number | null } | null
}

const PREP_OPTIONS = [10, 15, 20, 30, 45, 60]
const LIVE = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way']

/** Short beep so a busy kitchen notices a new order without extra hardware. */
function useOrderChime(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  return useMemo(() => () => {
    if (!enabled) return
    try {
      ctxRef.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const ctx = ctxRef.current
      const now = ctx.currentTime
      for (const [i, freq] of [880, 1320].entries()) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.0001, now + i * 0.18)
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(now + i * 0.18); osc.stop(now + i * 0.18 + 0.18)
      }
    } catch { /* autoplay blocked until the user interacts — harmless */ }
  }, [enabled])
}

function OrderCard({ order, onAction, busy, onPrint }: {
  order: PosOrder
  busy: boolean
  onAction: (action: string, prep?: number, reason?: string) => void
  onPrint: (order: PosOrder) => void
}) {
  const [prep, setPrep] = useState(order.prep_minutes ?? 20)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const waited = relativeMinutes(order.created_at)
  const isPending = order.status === 'pending'
  const urgent = isPending && waited >= 3
  const addr = order.delivery_address

  const next = (() => {
    switch (order.status) {
      case 'confirmed':  return { action: 'preparing',  label: '👨‍🍳 Έναρξη ετοιμασίας' }
      case 'preparing':  return { action: 'ready',      label: '🥡 Έτοιμη' }
      case 'ready':      return order.delivery_type === 'delivery'
        ? { action: 'on_the_way', label: '🛵 Έφυγε' }
        : { action: 'delivered',  label: '✓ Παραλήφθηκε' }
      case 'on_the_way': return { action: 'delivered', label: '✓ Παραδόθηκε' }
      default: return null
    }
  })()

  return (
    <div className={`rounded-2xl border-2 p-4 ${
      isPending ? (urgent ? 'border-danger bg-red-50' : 'border-brand bg-brand-50') : 'border-surface-4 bg-surface-1'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black text-base">{order.order_number ?? order.id.slice(0, 8)}</span>
            <StatusChip status={order.status} />
            {order.channel === 'qr' && <span className="badge badge-gray">QR</span>}
            {urgent && <span className="badge bg-red-100 text-danger">⚠️ {waited}′</span>}
          </div>
          <p className="text-xs text-ink-2 mt-0.5">
            {order.delivery_type === 'delivery' ? '🏠 Delivery' : '🥡 Take away'} ·{' '}
            {order.guest_name ?? 'Πελάτης'} · {dateTime(order.created_at)}
          </p>
        </div>
        <span className="font-display font-black text-lg text-brand whitespace-nowrap">{money(order.total)}</span>
      </div>

      {order.scheduled_for && (
        <p className="text-xs font-bold text-info bg-info/10 rounded-lg px-2 py-1 mb-2">
          🕒 Για {dateTime(order.scheduled_for)}
        </p>
      )}

      {order.delivery_type === 'delivery' && (addr || order.properties) && (
        <div className="bg-surface-2 rounded-xl p-2.5 mb-2 text-xs">
          <p className="font-bold">{order.properties?.name ?? addr?.label}</p>
          <p className="text-ink-2">{addr?.street ?? ''}</p>
          {(addr?.floor || addr?.doorbell) && (
            <p className="text-ink-3">{[addr?.floor, addr?.doorbell].filter(Boolean).join(' · ')}</p>
          )}
          {order.properties?.access_notes && <p className="text-ink-3 italic">{order.properties.access_notes}</p>}
        </div>
      )}

      <div className="bg-surface-2 rounded-xl p-2.5 mb-2 space-y-1">
        {order.order_items?.map(item => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="min-w-0 pr-2">
              <span className="font-black text-brand mr-1">{item.quantity}×</span>{item.name}
              {item.modifiers?.length ? <span className="text-[11px] text-ink-3"> +{item.modifiers.map(m => m.name).join(', ')}</span> : null}
              {item.notes && <span className="block text-[11px] font-bold text-brand">⚠️ {item.notes}</span>}
            </span>
            <span className="font-medium whitespace-nowrap">{money(item.subtotal)}</span>
          </div>
        ))}
      </div>

      {order.customer_notes && (
        <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mb-2">
          📝 {order.customer_notes}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-ink-2 mb-3">
        <span>💶 {order.payment_method === 'cash' ? 'Μετρητά' : order.payment_method}</span>
        {num(order.delivery_fee) > 0 && <span>· 🛵 {money(order.delivery_fee)}</span>}
        {num(order.discount_amount) > 0 && <span>· 🎟 −{money(order.discount_amount)}</span>}
      </div>

      {isPending && !rejecting && (
        <>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {PREP_OPTIONS.map(m => (
              <button key={m} onClick={() => setPrep(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition
                  ${prep === m ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}>
                {m}′
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-md flex-1" disabled={busy}
                    onClick={() => onAction('accept', prep)}>
              ✅ Αποδοχή · {prep}′
            </button>
            <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => setRejecting(true)}>
              ✕
            </button>
          </div>
        </>
      )}

      {isPending && rejecting && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {['Πολύς φόρτος', 'Εξαντλήθηκε', 'Εκτός ζώνης', 'Κλείνουμε'].map(r => (
              <button key={r} className={`chip ${reason === r ? 'chip-active' : ''}`} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-md flex-1" onClick={() => setRejecting(false)}>Άκυρο</button>
            <button className="btn btn-danger btn-md flex-1" disabled={busy}
                    onClick={() => onAction('reject', undefined, reason)}>Απόρριψη</button>
          </div>
        </div>
      )}

      {next && (
        <button className="btn btn-primary btn-md w-full" disabled={busy}
                onClick={() => onAction(next.action)}>{next.label}</button>
      )}

      <div className="flex gap-2 mt-2">
        <button className="btn btn-secondary btn-sm flex-1" onClick={() => onPrint(order)}>
          🖨️ Εκτύπωση{order.printed_at ? ' ✓' : ''}
        </button>
        {order.guest_phone && (
          <a className="btn btn-secondary btn-sm" href={`tel:${phoneDigits(order.guest_phone)}`}>📞</a>
        )}
        {order.delivery_type === 'delivery' && (order.properties?.lat || addr?.street) && (
          <a className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer"
             href={order.properties?.lat
               ? `https://www.google.com/maps/search/?api=1&query=${order.properties.lat},${order.properties.lng}`
               : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr?.street ?? '')}`}>
            🗺️
          </a>
        )}
      </div>
    </div>
  )
}

export default function POSPage({ storeId }: { storeId: string }) {
  const qc = useQueryClient()
  const [soundOn, setSoundOn] = useState(true)
  const [printing, setPrinting] = useState<StoreOrderView | null>(null)
  const chime = useOrderChime(soundOn)
  const knownIds = useRef<Set<string>>(new Set())

  const ordersQ = useQuery({
    queryKey: ['pos-orders', storeId],
    refetchInterval: 20000,
    queryFn: async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), properties(name, code, access_notes, lat, lng)')
        .eq('store_id', storeId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as PosOrder[]
    },
  })

  // Realtime: a new order should land on the screen without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`pos-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => qc.invalidateQueries({ queryKey: ['pos-orders', storeId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [storeId, qc])

  // Chime once per newly arrived pending order.
  useEffect(() => {
    const orders = ordersQ.data ?? []
    let isNew = false
    for (const o of orders) {
      if (!knownIds.current.has(o.id)) {
        if (o.status === 'pending' && knownIds.current.size > 0) isNew = true
        knownIds.current.add(o.id)
      }
    }
    if (isNew) chime()
  }, [ordersQ.data, chime])

  const act = useMutation({
    mutationFn: async (v: { token: string; action: string; prep?: number; reason?: string }) =>
      storeAction(v.token, v.action, v.prep, v.reason),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['pos-orders', storeId] }) },
    onError: (e) => toast.error((e as Error).message),
  })

  const doPrint = async (order: PosOrder) => {
    if (!order.store_token) return
    try {
      const full = await getStoreOrder(order.store_token)
      setPrinting(full)
      void storeAction(order.store_token, 'print')
      setTimeout(() => { window.print(); qc.invalidateQueries({ queryKey: ['pos-orders', storeId] }) }, 200)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const orders = ordersQ.data ?? []
  const pending = orders.filter(o => o.status === 'pending')
  const active = orders.filter(o => LIVE.includes(o.status) && o.status !== 'pending')
  const done = orders.filter(o => !LIVE.includes(o.status))
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + num(o.total), 0)

  const handle = (order: PosOrder) => (action: string, prep?: number, reason?: string) => {
    if (!order.store_token) { toast.error('Λείπει το token της παραγγελίας'); return }
    act.mutate({ token: order.store_token, action, prep, reason })
  }

  if (ordersQ.isLoading) return <div className="py-16 flex justify-center"><Spinner size={30} /></div>

  return (
    <div className="space-y-4">
      {printing && <PrintTicket order={printing} />}

      <div className="no-print flex flex-wrap items-center gap-3">
        <span className="badge badge-amber">{pending.length} εκκρεμείς</span>
        <span className="badge badge-green">{active.length} σε εξέλιξη</span>
        <span className="badge badge-gray">{done.length} ολοκληρωμένες</span>
        <span className="text-sm text-ink-2">Τζίρος σήμερα: <strong>{money(revenue)}</strong></span>
        <label className="flex items-center gap-2 text-sm ml-auto cursor-pointer">
          <input type="checkbox" checked={soundOn} className="accent-brand w-4 h-4"
                 onChange={e => setSoundOn(e.target.checked)} />
          🔔 Ήχος νέας παραγγελίας
        </label>
      </div>

      <div className="no-print grid lg:grid-cols-3 gap-4">
        <div>
          <h3 className="font-display font-bold text-base mb-2">🔔 Νέες</h3>
          <div className="space-y-3">
            {pending.map(o => (
              <OrderCard key={o.id} order={o} busy={act.isPending} onAction={handle(o)} onPrint={doPrint} />
            ))}
            {pending.length === 0 && (
              <p className="text-sm text-ink-3 border border-dashed border-surface-4 rounded-2xl p-6 text-center">
                Καμία νέα παραγγελία.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-display font-bold text-base mb-2">👨‍🍳 Σε εξέλιξη</h3>
          <div className="space-y-3">
            {active.map(o => (
              <OrderCard key={o.id} order={o} busy={act.isPending} onAction={handle(o)} onPrint={doPrint} />
            ))}
            {active.length === 0 && (
              <p className="text-sm text-ink-3 border border-dashed border-surface-4 rounded-2xl p-6 text-center">
                Τίποτα σε εξέλιξη.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-display font-bold text-base mb-2">✅ Σήμερα</h3>
          <Card>
            {done.length === 0 && <EmptyState emoji="📦" title="Καμία ολοκληρωμένη" />}
            <div className="space-y-2">
              {done.map(o => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-surface-4 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.order_number ?? o.id.slice(0, 8)}</p>
                    <p className="text-[11px] text-ink-3">{o.guest_name} · {dateTime(o.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{money(o.total)}</p>
                    <StatusChip status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
