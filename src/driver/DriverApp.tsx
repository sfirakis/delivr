import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Toggle, Divider, OrderStatusBadge } from '@/components/ui'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────
interface DriverOrder {
  id: string
  store_name: string
  store_address: string
  customer_name: string
  delivery_address: string
  total: number
  items_count: number
  distance_km: number
  earn: number
  status: 'assigned' | 'picked_up' | 'on_the_way' | 'delivered'
  created_at: string
}

// ─── Incoming order alert ─────────────────────────────────────
function AssignmentAlert({ order, onAccept, onReject }: {
  order: DriverOrder; onAccept: () => void; onReject: () => void
}) {
  const [secs, setSecs] = useState(30)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => { if (s<=1) { onReject(); return 0 } return s-1 }), 1000)
    return () => clearInterval(t)
  }, [onReject])

  const ring = (30 - secs) / 30 * 100

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in">
      <div className="bg-surface-1 rounded-t-3xl w-full p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-black text-xl">Νέα ανάθεση!</h3>
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#F0EEE9" strokeWidth="3" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="#FF4500" strokeWidth="3"
                      strokeDasharray={`${125.6} 125.6`}
                      strokeDashoffset={125.6 - (ring/100)*125.6} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display font-black text-sm text-brand">
              {secs}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 bg-surface-2 rounded-2xl p-3.5">
            <span className="text-2xl">🏪</span>
            <div>
              <p className="font-semibold text-sm">{order.store_name}</p>
              <p className="text-xs text-ink-2">📍 {order.store_address}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-surface-2 rounded-2xl p-3.5">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-semibold text-sm">{order.customer_name}</p>
              <p className="text-xs text-ink-2">{order.delivery_address}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon:'🛵', val:`${order.distance_km} km`, label:'Απόσταση' },
              { icon:'📦', val:`${order.items_count} items`, label:'Αντικείμενα' },
              { icon:'💰', val:`${order.earn.toFixed(2)}€`, label:'Κέρδος' },
            ].map(s => (
              <div key={s.label} className="bg-brand-50 rounded-xl p-3 text-center">
                <div className="text-lg mb-0.5">{s.icon}</div>
                <p className="font-display font-bold text-sm text-brand">{s.val}</p>
                <p className="text-[10px] text-ink-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-md flex-1 border-2 border-danger text-danger bg-red-50" onClick={onReject}>
            ✗ Απόρριψη
          </button>
          <button className="btn btn-primary btn-md flex-1" onClick={onAccept}>
            ✓ Αποδοχή
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Active delivery card ─────────────────────────────────────
function ActiveDeliveryCard({ order, onAdvance }: {
  order: DriverOrder; onAdvance: (s: string) => void
}) {
  const NEXT: Record<string, { label: string; icon: string }> = {
    assigned:   { label: 'Παρέλαβα την παραγγελία', icon:'✓' },
    picked_up:  { label: 'Ξεκίνησα για παράδοση',   icon:'🛵' },
    on_the_way: { label: 'Παράδοση ολοκληρώθηκε',  icon:'📦' },
  }
  const next = NEXT[order.status]

  return (
    <div className="bg-surface-1 rounded-2xl border-2 border-brand p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-display font-black text-base">#{order.id}</p>
          <p className="text-xs text-ink-2 mt-0.5">{order.status === 'assigned' ? '⏳ Παραλαβή' : order.status === 'picked_up' ? '🛵 Στο δρόμο' : '📦 Παράδοση'}</p>
        </div>
        <span className="font-display font-black text-lg text-brand">{order.earn.toFixed(2)}€</span>
      </div>

      {/* Route */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">🏪</div>
          <div>
            <p className="font-semibold text-sm">{order.store_name}</p>
            <p className="text-xs text-ink-2">{order.store_address}</p>
          </div>
          <button className="ml-auto btn-icon w-8 h-8 bg-info/10 text-info text-sm">🗺️</button>
        </div>
        <div className="ml-4 w-0.5 h-4 bg-surface-4" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-lg flex-shrink-0">📍</div>
          <div>
            <p className="font-semibold text-sm">{order.customer_name}</p>
            <p className="text-xs text-ink-2">{order.delivery_address}</p>
          </div>
          <button className="ml-auto btn-icon w-8 h-8 bg-info/10 text-info text-sm">🗺️</button>
        </div>
      </div>

      {next && (
        <button className="btn btn-primary btn-md w-full gap-2"
                onClick={() => {
                  const nextStatus = order.status==='assigned' ? 'picked_up' : order.status==='picked_up' ? 'on_the_way' : 'delivered'
                  onAdvance(nextStatus)
                }}>
          {next.icon} {next.label}
        </button>
      )}

      <div className="flex gap-2 mt-2">
        <button className="btn btn-secondary btn-sm flex-1">📞 Κατάστημα</button>
        <button className="btn btn-secondary btn-sm flex-1">📞 Πελάτης</button>
      </div>
    </div>
  )
}

// ─── Driver Main App ──────────────────────────────────────────
type DriverTab = 'home' | 'history' | 'earnings' | 'profile'

export default function DriverApp() {
  const { user } = useAuthStore()
  const [isOnline, setIsOnline] = useState(false)
  const [tab, setTab]           = useState<DriverTab>('home')
  const [assignment, setAssignment] = useState<DriverOrder | null>(null)
  const [activeOrder, setActiveOrder] = useState<DriverOrder | null>(null)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
  const [history, setHistory] = useState<DriverOrder[]>([])

  // Listen for new assignments via Supabase Realtime
  useEffect(() => {
    if (!isOnline || !user) return

    const channel = supabase
      .channel(`driver:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `driver_id=eq.${user.id}`,
      }, (payload) => {
        const order = payload.new as any
        if (order.status === 'assigned' && !activeOrder) {
          // Fetch full order details
          supabase
            .from('orders')
            .select('*, store:stores(name, address)')
            .eq('id', order.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setAssignment({
                  id: data.id,
                  store_name: data.store?.name ?? 'Κατάστημα',
                  store_address: data.store?.address ?? '',
                  customer_name: 'Πελάτης',
                  delivery_address: typeof data.delivery_address === 'object' && data.delivery_address
                    ? `${(data.delivery_address as any).street ?? ''}, ${(data.delivery_address as any).city ?? ''}`
                    : 'Διεύθυνση παράδοσης',
                  total: data.total,
                  items_count: data.order_items?.length ?? 0,
                  distance_km: 0,
                  earn: data.delivery_fee ?? 3.00,
                  status: 'assigned',
                  created_at: data.created_at,
                })
              }
            })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOnline, user, activeOrder])

  // Fetch today's stats
  useEffect(() => {
    if (!user) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    supabase
      .from('orders')
      .select('id, delivery_fee, total')
      .eq('driver_id', user.id)
      .eq('status', 'delivered')
      .gte('created_at', today.toISOString())
      .then(({ data }) => {
        if (data) {
          setCompletedToday(data.length)
          setTodayEarnings(data.reduce((sum, o) => sum + (o.delivery_fee ?? 0), 0))
        }
      })
  }, [user])

  // Fetch history when tab changes
  useEffect(() => {
    if (tab !== 'history' || !user) return
    supabase
      .from('orders')
      .select('*, store:stores(name)')
      .eq('driver_id', user.id)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setHistory(data.map((o: any) => ({
            id: o.id,
            store_name: o.store?.name ?? 'Κατάστημα',
            store_address: '',
            customer_name: '',
            delivery_address: '',
            total: o.total,
            items_count: 0,
            distance_km: 0,
            earn: o.delivery_fee ?? 0,
            status: 'delivered' as const,
            created_at: o.created_at,
          })))
        }
      })
  }, [tab, user])

  const handleAccept = async () => {
    if (!assignment) return
    await supabase.from('orders').update({ status: 'picked_up' }).eq('id', assignment.id)
    setActiveOrder({ ...assignment })
    setAssignment(null)
    toast.success('✓ Ανάθεση αποδεκτή! Πήγαινε στο κατάστημα.')
  }

  const handleReject = async () => {
    if (assignment) {
      await supabase.from('orders').update({ driver_id: null, status: 'ready' }).eq('id', assignment.id)
    }
    setAssignment(null)
    toast('Ανάθεση απορρίφθηκε', { icon: '—' })
  }

  const handleAdvance = async (status: string) => {
    if (!activeOrder) return
    const updates: Record<string, any> = { status }
    if (status === 'picked_up') updates.picked_up_at = new Date().toISOString()
    if (status === 'on_the_way') updates.picked_up_at = new Date().toISOString()
    if (status === 'delivered') updates.delivered_at = new Date().toISOString()

    await supabase.from('orders').update(updates).eq('id', activeOrder.id)

    if (status === 'delivered') {
      toast.success(`🎉 Παράδοση ολοκληρώθηκε! +${activeOrder.earn.toFixed(2)}€`)
      setActiveOrder(null)
      // Refresh stats
      setCompletedToday(c => c + 1)
      setTodayEarnings(e => e + activeOrder.earn)
    } else {
      setActiveOrder(o => o ? { ...o, status: status as any } : null)
    }
  }

  const NAV: { id: DriverTab; icon: string; label: string }[] = [
    { id:'home',     icon:'🏠', label:'Αρχικό'  },
    { id:'history',  icon:'📦', label:'Ιστορικό' },
    { id:'earnings', icon:'💰', label:'Κέρδη'   },
    { id:'profile',  icon:'👤', label:'Προφίλ'  },
  ]

  return (
    <div className="flex flex-col h-full bg-surface-1">
      <div className="h-11 flex-shrink-0 bg-ink-1" />

      <div className="flex-1 overflow-hidden">
        {tab === 'home' && (
          <div className="flex flex-col h-full">
            {/* Map area */}
            <div className="map-bg relative flex-shrink-0" style={{ height: 240 }}>
              <div className="absolute inset-0 opacity-40"
                   style={{ backgroundImage:'linear-gradient(#d4d0ca 1px,transparent 1px),linear-gradient(90deg,#d4d0ca 1px,transparent 1px)', backgroundSize:'32px 32px' }} />
              <div className="absolute bg-white rounded-sm opacity-80" style={{top:'40%',left:0,right:0,height:4}} />
              <div className="absolute bg-white rounded-sm opacity-80" style={{left:'35%',top:0,bottom:0,width:4}} />
              <div className="absolute bg-white rounded-sm opacity-80" style={{left:'65%',top:0,bottom:0,width:4}} />

              {/* Driver position */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-xl shadow-brand">
                  🛵
                </div>
                {isOnline && (
                  <div className="absolute inset-0 rounded-full border-2 border-brand animate-ping opacity-50" />
                )}
              </div>

              {/* Status pill */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-full
                              px-5 py-2 font-display font-bold text-sm shadow-card whitespace-nowrap">
                {isOnline
                  ? activeOrder ? '📦 Ενεργή παράδοση' : '🟢 Online — Αναζήτηση'
                  : '⚫ Offline'}
              </div>
            </div>

            {/* Bottom panel */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-24 space-y-4">
              {/* Online toggle */}
              <div className={`rounded-2xl p-4 flex items-center justify-between border-2 transition-all
                ${isOnline ? 'border-success bg-green-50' : 'border-surface-4 bg-surface-2'}`}>
                <div>
                  <p className="font-display font-bold text-base">{isOnline ? '🟢 Online' : '⚫ Offline'}</p>
                  <p className="text-xs text-ink-2 mt-0.5">
                    {isOnline ? 'Δέχεσαι αναθέσεις' : 'Δεν δέχεσαι αναθέσεις'}
                  </p>
                </div>
                <Toggle checked={isOnline} onChange={v => { setIsOnline(v); if(v) toast('🟢 Online!') }} />
              </div>

              {/* Today stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val:`${todayEarnings.toFixed(2)}€`, label:'Σήμερα',     icon:'💰' },
                  { val:completedToday.toString(),       label:'Παραδόσεις', icon:'📦' },
                  { val:'94%',                           label:'Αποδοχή',   icon:'⭐' },
                ].map(s => (
                  <div key={s.label} className="bg-surface-2 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">{s.icon}</div>
                    <p className="font-display font-black text-base text-ink-1">{s.val}</p>
                    <p className="text-[10px] text-ink-3 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Active order */}
              {activeOrder && (
                <ActiveDeliveryCard order={activeOrder} onAdvance={handleAdvance} />
              )}

              {/* Tips */}
              {!activeOrder && isOnline && (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
                  <p className="font-semibold text-sm mb-2">💡 Συμβουλές</p>
                  <ul className="space-y-1.5 text-xs text-ink-2">
                    <li>• Μείνε κοντά σε δημοφιλείς περιοχές</li>
                    <li>• Ώρες αιχμής: 12:00-14:00 και 19:00-22:00</li>
                    <li>• Καλή αξιολόγηση = περισσότερες αναθέσεις</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'earnings' && (
          <div className="overflow-y-auto h-full pb-24">
            <div className="px-5 pt-6 pb-4">
              <h2 className="font-display font-black text-2xl mb-4">Κέρδη</h2>
              {/* Week summary */}
              <div className="bg-ink-1 rounded-2xl p-5 mb-4">
                <p className="text-ink-3 text-sm mb-1">Αυτή την εβδομάδα</p>
                <p className="font-display font-black text-4xl text-white mb-1">€{(todayEarnings * 3.2).toFixed(2)}</p>
                <p className="text-success text-sm">+18% vs περασμένη εβδομάδα</p>
              </div>
              {/* Daily breakdown */}
              <div className="space-y-2">
                {['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'].map((day, i) => {
                  const earn = [32,45,28,51,42,67,38][i]
                  const trips = [8,12,7,14,11,18,10][i]
                  return (
                    <div key={day} className="flex items-center gap-3 bg-surface-2 rounded-xl p-3.5">
                      <span className="text-sm font-medium w-20 text-ink-1">{day}</span>
                      <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand"
                             style={{ width: `${(earn/67)*100}%` }} />
                      </div>
                      <span className="text-xs text-ink-2 w-12 text-right">{trips} παρ.</span>
                      <span className="font-display font-bold text-sm w-14 text-right text-brand">€{earn}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="overflow-y-auto h-full px-5 pb-24">
            <h2 className="font-display font-black text-2xl pt-6 mb-4">Ιστορικό</h2>
            <div className="space-y-2">
              {history.map((order) => (
                <div key={order.id} className="bg-surface-2 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-ink-2">{order.store_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-sm text-brand">+€{order.earn.toFixed(2)}</p>
                    <p className="text-[11px] text-ink-3">{new Date(order.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-center text-ink-3 text-sm py-8">Δεν υπάρχει ιστορικό</p>
              )}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="overflow-y-auto h-full pb-24">
            <div className="bg-ink-1 px-5 pt-14 pb-8 text-white">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-2xl font-display font-black">Δ</div>
                <div>
                  <h2 className="font-display font-bold text-xl">Δημήτρης Π.</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-amber-400">★</span>
                    <span className="font-bold">4.92</span>
                    <span className="text-ink-3 text-sm">(342 αξιολογήσεις)</span>
                  </div>
                  <span className="badge bg-white/15 text-white mt-1.5">🏆 Top Driver</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val:'1,247', label:'Παραδόσεις' },
                  { val:'98%',   label:'Αποδοχή'   },
                  { val:'99%',   label:'Ολοκλήρωση' },
                ].map(s => (
                  <div key={s.label} className="bg-white/8 rounded-xl p-3 text-center">
                    <p className="font-display font-black text-lg">{s.val}</p>
                    <p className="text-[10px] text-ink-3 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 space-y-2">
              {[
                { icon:'🛵', label:'Στοιχεία οχήματος' },
                { icon:'🪪', label:'Έγγραφα & άδειες'  },
                { icon:'💳', label:'Τραπεζικός λογαριασμός' },
                { icon:'📊', label:'Αναλυτικά στατιστικά' },
                { icon:'❓', label:'Βοήθεια & υποστήριξη' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-4 bg-surface-2 rounded-xl cursor-pointer">
                  <span className="text-xl">{item.icon}</span>
                  <span className="flex-1 font-medium text-sm">{item.label}</span>
                  <span className="text-ink-3">›</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(t => (
          <button key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            <span className="nav-item-icon">{t.icon}</span>
            <span className="nav-item-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Assignment popup */}
      {assignment && (
        <AssignmentAlert order={assignment} onAccept={handleAccept} onReject={handleReject} />
      )}
    </div>
  )
}
