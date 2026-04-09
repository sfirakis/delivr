import { useState, useEffect } from 'react'
import { Divider } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type AdminTab = 'overview' | 'stores' | 'orders' | 'drivers' | 'promos' | 'settings'

// ─── KPI Card ─────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, trend, color='bg-surface-2 border-surface-4' }: any) {
  return (
    <div className={`border rounded-2xl p-4 ${color}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${trend > 0 ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="font-display font-black text-2xl text-ink-1">{value}</p>
      <p className="text-xs font-semibold text-ink-1 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState({ orders: 0, stores: 0, drivers: 0, gmv: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('orders').select('id, total', { count: 'exact' }),
      supabase.from('stores').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('profiles').select('id', { count: 'exact' }),
    ]).then(([ordersRes, storesRes, profilesRes]) => {
      const gmv = (ordersRes.data ?? []).reduce((sum: number, o: any) => sum + (o.total ?? 0), 0)
      setStats({
        orders: ordersRes.count ?? 0,
        stores: storesRes.count ?? 0,
        drivers: profilesRes.count ?? 0,
        gmv,
      })
    })
  }, [])

  return (
    <div className="overflow-y-auto h-full pb-24 px-5">
      <div className="pt-5 pb-3">
        <h2 className="font-display font-black text-xl">Platform Overview</h2>
        <p className="text-xs text-ink-3 mt-0.5">Τελευταίες 24 ώρες</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <KPICard icon="💰" label="GMV"          value={`€${stats.gmv.toLocaleString()}`} sub="Gross Merchandise Value"  color="bg-brand-50 border-brand-100" />
        <KPICard icon="📦" label="Παραγγελίες"  value={stats.orders}     sub="Σύνολο"                   />
        <KPICard icon="🏪" label="Ενεργά stores" value={stats.stores}    sub="Ενεργά καταστήματα"       />
        <KPICard icon="🛵" label="Drivers"       value={stats.drivers}   sub="Εγγεγραμμένοι"            />
        <KPICard icon="👥" label="Νέοι χρήστες" value="—"               sub="Σήμερα"                   />
        <KPICard icon="⭐" label="Μ.Ο. βαθμολ." value="—"              sub="Τελευταίες 30 μέρες"     />
      </div>

      {/* Platform take rate */}
      <div className="bg-ink-1 rounded-2xl p-4 mb-5">
        <div className="flex justify-between items-center mb-3">
          <p className="font-display font-bold text-white">Take Rate</p>
          <span className="badge bg-white/15 text-white">Αυτή την εβδομάδα</span>
        </div>
        <div className="flex items-end gap-1 h-20">
          {[18,22,19,25,23,28,24].map((v,i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm"
                   style={{ height: `${(v/28)*100}%`, background: i===6?'#FF4500':'rgba(255,107,53,0.5)' }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-ink-3 mt-1">
          {['Δ','Τ','Τ','Π','Π','Σ','Κ'].map((d,i)=><span key={i}>{d}</span>)}
        </div>
        <Divider className="my-3 bg-white/10" />
        <div className="flex justify-between text-sm">
          <span className="text-ink-3">Μ.Ο. commission</span>
          <span className="font-display font-bold text-white">18.5%</span>
        </div>
      </div>

      {/* Recent orders */}
      <h3 className="font-display font-bold text-base mb-3">Τελευταίες παραγγελίες</h3>
      <div className="space-y-2">
        {[
          { id:'ORD-9918', store:'Avra Souvlaki', user:'Αντώνης Π.', total:9.5,  status:'on_the_way' },
          { id:'ORD-9917', store:'Burger House',  user:'Μαρία Κ.',   total:21.4, status:'preparing'  },
          { id:'ORD-9916', store:'Brew & Co',     user:'Νίκος Δ.',   total:6.3,  status:'delivered'  },
          { id:'ORD-9915', store:'Tokyo Sushi',   user:'Ελένη Σ.',   total:34.8, status:'confirmed'  },
        ].map(o => (
          <div key={o.id} className="flex items-center gap-3 bg-surface-2 rounded-xl p-3">
            <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center font-display font-bold text-xs text-brand flex-shrink-0">
              #{o.id.slice(-2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs truncate">{o.store}</p>
              <p className="text-[10px] text-ink-2">{o.user}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xs">{o.total.toFixed(2)}€</p>
              <span className={`text-[10px] font-semibold
                ${o.status==='delivered' ? 'text-success' : o.status==='on_the_way'||o.status==='preparing' ? 'text-brand' : 'text-amber-500'}`}>
                {o.status==='delivered' ? '✓ Παραδόθηκε' : o.status==='on_the_way' ? '🛵 Δρόμος' : o.status==='preparing' ? '👨‍🍳 Ετοιμασία' : '✓ Επιβεβ.'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stores Tab ───────────────────────────────────────────────
function StoresTab() {
  const [search, setSearch] = useState('')
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setStores(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = stores.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-black text-xl">Καταστήματα</h2>
          <button className="btn btn-primary btn-sm">+ Νέο</button>
        </div>
        <div className="flex items-center gap-2 bg-surface-2 rounded-full px-4 py-2.5">
          <span className="text-ink-3">🔍</span>
          <input className="flex-1 bg-transparent text-sm outline-none font-body placeholder:text-ink-3"
                 placeholder="Αναζήτηση..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-ink-3 text-sm animate-pulse">Φόρτωση...</p>
          </div>
        ) : filtered.map(store => (
          <div key={store.id} className="bg-surface-2 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{store.name}</p>
                <p className="text-xs text-ink-2">{store.category} · {store.city}</p>
              </div>
              <span className={`badge text-[10px] ${store.is_active ? 'badge-green' : 'badge-amber'}`}>
                {store.is_active ? '✓ Ενεργό' : '⏳ Pending'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { val: store.review_count ?? 'N/A', label:'Παραγγελίες' },
                { val: '-',                          label:'Έσοδα' },
                { val: `★${store.rating ?? '-'}`,    label:'Βαθμολογία'  },
              ].map(s => (
                <div key={s.label} className="bg-surface-1 rounded-lg py-1.5">
                  <p className="font-display font-bold text-sm text-ink-1">{s.val}</p>
                  <p className="text-[10px] text-ink-3">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-secondary btn-sm flex-1">Επεξεργασία</button>
              <button className="btn btn-secondary btn-sm flex-1">Αναφορά</button>
              <button className={`btn btn-sm ${store.is_active ? 'bg-red-100 text-danger' : 'btn-primary'}`}>
                {store.is_active ? 'Pause' : 'Approve'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Drivers Tab ──────────────────────────────────────────────
function DriversTab() {
  const [drivers, setDrivers] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => {
        // For now show all profiles; in production filter by role
        setDrivers(data ?? [])
      })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-black text-xl">Drivers</h2>
          <div className="flex gap-1.5">
            <span className="badge badge-green">{drivers.length} σύνολο</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-2">
        {drivers.map(d => (
          <div key={d.id} className="bg-surface-2 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white font-display font-black text-base flex-shrink-0">
              {(d.full_name ?? '?')[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{d.full_name ?? 'Χρήστης'}</p>
                <span className="w-2 h-2 rounded-full bg-surface-4" />
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-2 mt-0.5">
                <span>🏆 {d.loyalty_points ?? 0} πόντοι</span>
              </div>
            </div>
            <button className="btn-icon w-9 h-9 text-sm">👁️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function fetch() {
      let q = supabase
        .from('orders')
        .select('*, store:stores(name, emoji), profile:profiles!orders_user_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter !== 'all') {
        q = q.eq('status', filter)
      }

      const { data } = await q
      setOrders(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [filter])

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:    { label: '⏳ Αναμονή',    color: 'text-amber-500' },
    confirmed:  { label: '✓ Επιβεβ.',     color: 'text-blue-500' },
    preparing:  { label: '👨‍🍳 Ετοιμασία', color: 'text-brand' },
    ready:      { label: '📦 Έτοιμο',     color: 'text-purple-500' },
    picked_up:  { label: '🛵 Παραλαβή',   color: 'text-brand' },
    on_the_way: { label: '🛵 Δρόμος',     color: 'text-brand' },
    delivered:  { label: '✓ Παραδόθηκε',  color: 'text-success' },
    cancelled:  { label: '✗ Ακυρώθηκε',   color: 'text-danger' },
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="font-display font-black text-xl mb-3">Παραγγελίες</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'Όλες' },
            { id: 'pending', label: 'Αναμονή' },
            { id: 'preparing', label: 'Ετοιμασία' },
            { id: 'on_the_way', label: 'Δρόμος' },
            { id: 'delivered', label: 'Ολοκληρωμένες' },
            { id: 'cancelled', label: 'Ακυρωμένες' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                ${filter === f.id ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-ink-3 text-sm animate-pulse">Φόρτωση...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">📦</span>
            <p className="text-ink-3 text-sm">Δεν βρέθηκαν παραγγελίες</p>
          </div>
        ) : (
          orders.map(o => {
            const st = STATUS_LABELS[o.status] ?? { label: o.status, color: 'text-ink-2' }
            return (
              <div key={o.id} className="bg-surface-2 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display font-bold text-sm">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-ink-2 mt-0.5">{o.store?.emoji ?? '🏪'} {o.store?.name ?? 'Κατάστημα'}</p>
                  </div>
                  <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-2">👤 {o.profile?.full_name ?? 'Πελάτης'}</span>
                  <span className="font-display font-bold text-brand">{o.total?.toFixed(2) ?? '0.00'}€</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-ink-3 mt-1">
                  <span>{new Date(o.created_at).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{o.payment_method === 'cash' ? '💵 Μετρητά' : '💳 Κάρτα'}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Promos Tab ───────────────────────────────────────────────
function PromosTab() {
  const [showNew, setShowNew] = useState(false)
  const promos = [
    { code:'WELCOME20', type:'%', val:20, uses:142, limit:500, expires:'31/3',  active:true },
    { code:'DELIVR10',  type:'%', val:10, uses:89,  limit:null, expires:'15/4', active:true },
    { code:'SUMMER5',   type:'€', val:5,  uses:320, limit:300,  expires:'Λήξη', active:false },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-black text-xl">Promo Codes</h2>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(true)}>+ Νέος</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-3">
        {promos.map(p => (
          <div key={p.code} className={`rounded-xl p-4 border-2 ${p.active ? 'border-brand-100 bg-brand-50' : 'border-surface-4 bg-surface-2 opacity-60'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-display font-black text-lg text-brand">{p.code}</p>
                <p className="text-sm text-ink-2">
                  {p.type === '%' ? `-${p.val}%` : `-€${p.val}`} off
                  {p.limit ? ` · ${p.uses}/${p.limit} χρήσεις` : ` · ${p.uses} χρήσεις`}
                </p>
              </div>
              <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>
                {p.active ? '✓ Ενεργό' : '✗ Ανενεργό'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {p.limit && (
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width:`${(p.uses/p.limit)*100}%` }} />
                </div>
              )}
              <span className="text-xs text-ink-3">Λήξη: {p.expires}</span>
              <button className="btn btn-secondary btn-sm text-xs">Επεξεργασία</button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="sheet-overlay" onClick={()=>setShowNew(false)}>
          <div className="sheet p-5" onClick={e=>e.stopPropagation()}>
            <div className="sheet-handle"/>
            <h3 className="font-display font-bold text-lg mb-4">Νέος Promo Code</h3>
            <div className="space-y-3">
              {['Κωδικός','Έκπτωση (%)','Ελάχιστη παραγγελία (€)','Όριο χρήσεων'].map(label => (
                <div key={label}>
                  <label className="text-xs font-medium text-ink-2 mb-1 block">{label}</label>
                  <input className="w-full border border-surface-4 rounded-xl px-4 py-2.5 text-sm font-body outline-none focus:border-brand" />
                </div>
              ))}
              <button className="btn btn-primary btn-lg mt-2" onClick={()=>setShowNew(false)}>Δημιουργία</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Admin App ───────────────────────────────────────────
export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('overview')
  const { user } = useAuthStore()

  if (!user) return (
    <div className="flex flex-col h-full bg-surface-1 items-center justify-center gap-3 px-8 text-center">
      <div className="text-4xl">🔐</div>
      <p className="font-display font-semibold text-ink-1">Απαιτείται σύνδεση</p>
      <p className="text-sm text-ink-2">Συνδεθείτε με λογαριασμό διαχειριστή.</p>
    </div>
  )

  const NAV: { id: AdminTab; icon: string; label: string }[] = [
    { id:'overview',  icon:'📊', label:'Overview' },
    { id:'stores',    icon:'🏪', label:'Stores'   },
    { id:'orders',    icon:'📦', label:'Orders'   },
    { id:'drivers',   icon:'🛵', label:'Drivers'  },
    { id:'promos',    icon:'🏷️',  label:'Promos'  },
  ]

  return (
    <div className="flex flex-col h-full bg-surface-1">
      {/* Header */}
      <div className="bg-ink-1 px-5 pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-2xl text-white">delivr <span className="text-brand">admin</span></h1>
            <p className="text-ink-3 text-xs mt-0.5">Platform Management</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-success text-xs font-semibold">Live</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'stores'   && <StoresTab />}
        {tab === 'orders'   && <OrdersTab />}
        {tab === 'drivers'  && <DriversTab />}
        {tab === 'promos'   && <PromosTab />}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(t => (
          <button key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <span className="nav-item-icon">{t.icon}</span>
            <span className="nav-item-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
