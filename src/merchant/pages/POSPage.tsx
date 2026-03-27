import { useEffect, useState, useCallback } from 'react'
import { useMerchantStore } from '@/merchant/merchantStore'
import { Divider, OrderStatusBadge, Spinner } from '@/components/ui'
import type { Order } from '@/types'
import toast from 'react-hot-toast'

// ─── Order card for POS ───────────────────────────────────────
function POSOrderCard({ order, onAccept, onReject, onAdvance }: {
  order: Order
  onAccept?: (prepMins: number) => void
  onReject?: (reason: string) => void
  onAdvance?: (status: string) => void
}) {
  const [prepMins, setPrepMins] = useState(20)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000))
    }, 30000)
    setElapsed(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000))
    return () => clearInterval(t)
  }, [order.created_at])

  const NEXT_STATUS: Record<string, { label: string; status: string; color: string }> = {
    confirmed: { label: 'Έναρξη ετοιμασίας 👨‍🍳', status: 'preparing', color: 'bg-amber-500' },
    preparing: { label: 'Έτοιμο για παράδοση ✓',  status: 'ready',     color: 'bg-success'   },
    ready:     { label: 'Παραλήφθηκε από rider 🛵', status: 'picked_up', color: 'bg-info'      },
  }
  const next = NEXT_STATUS[order.status]

  const isUrgent = order.status === 'pending' && elapsed >= 3

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${
      order.status === 'pending'
        ? isUrgent ? 'border-danger bg-red-50 animate-pulse' : 'border-brand bg-brand-50'
        : 'border-surface-4 bg-surface-1'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-black text-base">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <OrderStatusBadge status={order.status} />
            {isUrgent && <span className="badge bg-red-100 text-danger">⚠️ Εκκρεμεί</span>}
          </div>
          <p className="text-xs text-ink-2">
            {(order as any).profiles?.full_name ?? 'Πελάτης'} ·
            {order.delivery_type === 'delivery' ? ' 🛵 Delivery' : ' 🏪 Pickup'} ·
            <span className={elapsed >= 5 ? 'text-danger font-bold' : 'text-ink-2'}> {elapsed}' πριν</span>
          </p>
        </div>
        <span className="font-display font-black text-lg text-brand">{order.total.toFixed(2)}€</span>
      </div>

      {/* Items */}
      <div className="bg-surface-2 rounded-xl p-3 mb-3 space-y-1.5">
        {order.order_items?.map(item => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              <span className="font-bold text-brand mr-1.5">{item.quantity}×</span>
              {item.name}
              {item.notes && <span className="text-xs text-ink-3 ml-1">({item.notes})</span>}
            </span>
            <span className="font-medium">{item.subtotal.toFixed(2)}€</span>
          </div>
        ))}
        {order.customer_notes && (
          <div className="border-t border-surface-4 pt-1.5 text-xs text-ink-2">
            📝 {order.customer_notes}
          </div>
        )}
      </div>

      {/* Delivery address */}
      {order.delivery_type === 'delivery' && order.delivery_address && (
        <div className="text-xs text-ink-2 mb-3 flex items-center gap-1.5">
          <span>📍</span>
          <span>{(order.delivery_address as any).street}, {(order.delivery_address as any).city}</span>
        </div>
      )}

      {/* Actions */}
      {order.status === 'pending' && !showReject && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-ink-2 font-medium">Χρόνος:</span>
            {[10, 15, 20, 30, 45].map(m => (
              <button key={m} onClick={() => setPrepMins(m)}
                className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all
                  ${prepMins === m ? 'bg-brand border-brand text-white' : 'border-surface-4 text-ink-2'}`}>
                {m}'
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-md flex-1 gap-2"
                    onClick={() => onAccept?.(prepMins)}>
              ✓ Αποδοχή ({prepMins}')
            </button>
            <button className="btn btn-md gap-2 border-2 border-danger text-danger bg-red-50"
                    onClick={() => setShowReject(true)}>
              ✗ Απόρριψη
            </button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="space-y-2">
          <select className="w-full border border-surface-4 rounded-xl px-3 py-2.5 text-sm font-body outline-none"
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
            <option value="">Επίλεξε λόγο...</option>
            <option value="Πολύ πολυάσχολοι αυτή τη στιγμή">Πολύ πολυάσχολοι</option>
            <option value="Το προϊόν δεν είναι διαθέσιμο">Προϊόν μη διαθέσιμο</option>
            <option value="Το κατάστημα κλείνει σύντομα">Κλείνουμε σύντομα</option>
            <option value="Τεχνικό πρόβλημα">Τεχνικό πρόβλημα</option>
          </select>
          <div className="flex gap-2">
            <button className="btn btn-md flex-1 border-2 border-danger text-danger bg-red-50"
                    onClick={() => { if (rejectReason) onReject?.(rejectReason); else toast.error('Επίλεξε λόγο') }}>
              Επιβεβαίωση απόρριψης
            </button>
            <button className="btn btn-secondary btn-md" onClick={() => setShowReject(false)}>Ακύρωση</button>
          </div>
        </div>
      )}

      {next && (
        <button className={`btn btn-md w-full text-white ${next.color}`}
                onClick={() => onAdvance?.(next.status)}>
          {next.label}
        </button>
      )}
    </div>
  )
}

// ─── Main POS Screen ──────────────────────────────────────────
export default function MerchantPOSPage({ storeId }: { storeId: string }) {
  const {
    isOnline, pendingOrders, activeOrders, completedToday,
    fetchOrders, acceptOrder, rejectOrder, updateOrderStatus,
    subscribeToOrders, toggleOnline,
  } = useMerchantStore()
  const [tab, setTab] = useState<'pending'|'active'|'done'>('pending')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrders(storeId)
    const unsub = subscribeToOrders(storeId)
    return unsub
  }, [storeId, fetchOrders, subscribeToOrders])

  const handleAccept = useCallback(async (orderId: string, prepMins: number) => {
    setLoading(true)
    await acceptOrder(orderId, prepMins)
    toast.success('✓ Παραγγελία αποδεκτή')
    setLoading(false)
    if (tab === 'pending') setTab('active')
  }, [acceptOrder, tab])

  const handleReject = useCallback(async (orderId: string, reason: string) => {
    await rejectOrder(orderId, reason)
    toast('Παραγγελία απορρίφθηκε', { icon: '✗' })
  }, [rejectOrder])

  const handleAdvance = useCallback(async (orderId: string, status: string) => {
    await updateOrderStatus(orderId, status)
    toast.success(`Κατάσταση → ${status}`)
  }, [updateOrderStatus])

  const tabs = [
    { id:'pending', label:'Νέες', count: pendingOrders.length, urgent: pendingOrders.some(o => o.status==='pending') },
    { id:'active',  label:'Ενεργές', count: activeOrders.length, urgent: false },
    { id:'done',    label:'Σήμερα',  count: completedToday.length, urgent: false },
  ] as const

  const currentOrders =
    tab === 'pending' ? pendingOrders :
    tab === 'active'  ? activeOrders :
    completedToday

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* ── Header ── */}
      <div className="bg-ink-1 px-5 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display font-black text-2xl text-white">POS</h1>
            <p className="text-ink-3 text-xs mt-0.5">Διαχείριση παραγγελιών</p>
          </div>
          {/* Online toggle */}
          <button onClick={toggleOnline}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all
              ${isOnline ? 'bg-success text-white' : 'bg-surface-3 text-ink-2'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-ink-3'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label:'Σήμερα',  val: completedToday.length, unit:'παρ.' },
            { label:'Έσοδα',   val: completedToday.reduce((s,o)=>s+Number(o.total),0).toFixed(0), unit:'€' },
            { label:'Μ.Ο.',    val: completedToday.length ? (completedToday.reduce((s,o)=>s+Number(o.total),0)/completedToday.length).toFixed(1) : '0', unit:'€/παρ' },
          ].map(s => (
            <div key={s.label} className="bg-white/8 rounded-xl px-3 py-2.5 text-center">
              <p className="font-display font-black text-lg text-white">{s.val}<span className="text-xs font-normal text-ink-3 ml-0.5">{s.unit}</span></p>
              <p className="text-[10px] text-ink-3 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-surface-4 flex-shrink-0 bg-surface-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3.5 flex items-center justify-center gap-2 text-sm font-semibold
              border-b-2 transition-all ${tab === t.id ? 'border-brand text-brand' : 'border-transparent text-ink-2'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full text-xs font-bold px-2 py-0.5
                ${t.urgent ? 'bg-danger text-white animate-pulse' : 'bg-surface-3 text-ink-2'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Orders list ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}

        {!loading && currentOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-5xl">{tab==='pending' ? '🎉' : tab==='active' ? '⏳' : '📊'}</span>
            <p className="font-display font-bold text-lg text-ink-1">
              {tab==='pending' ? 'Καμία νέα παραγγελία' : tab==='active' ? 'Δεν υπάρχουν ενεργές' : 'Δεν υπάρχουν ολοκληρωμένες'}
            </p>
            <p className="text-sm text-ink-3">
              {tab==='pending' ? 'Νέες παραγγελίες εμφανίζονται εδώ αυτόματα' : ''}
            </p>
          </div>
        )}

        {currentOrders.map(order => (
          <POSOrderCard
            key={order.id}
            order={order}
            onAccept={(mins) => handleAccept(order.id, mins)}
            onReject={(reason) => handleReject(order.id, reason)}
            onAdvance={(status) => handleAdvance(order.id, status)}
          />
        ))}
      </div>
    </div>
  )
}
