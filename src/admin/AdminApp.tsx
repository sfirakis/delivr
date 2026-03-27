import { useState } from 'react'
import { Divider } from '@/components/ui'

type AdminTab = 'overview' | 'stores' | 'orders' | 'drivers' | 'promos' | 'settings'

// ─── Mock data ────────────────────────────────────────────────
const MOCK_STORES = [
  { id:'1', name:'Avra Souvlaki',       category:'Εστιατόριο', city:'Αθήνα',  orders:342, revenue:4821, rating:4.8, status:'active' },
  { id:'2', name:'Brew & Co',           category:'Καφέ',       city:'Αθήνα',  orders:218, revenue:2190, rating:4.6, status:'active' },
  { id:'3', name:'Burger House',        category:'Burger',     city:'Αθήνα',  orders:567, revenue:8904, rating:4.5, status:'active' },
  { id:'4', name:'Tokyo Ramen & Sushi', category:'Ιαπωνική',  city:'Αθήνα',  orders:189, revenue:3780, rating:4.9, status:'pending' },
  { id:'5', name:'Green & Fresh',       category:'Healthy',    city:'Αθήνα',  orders:134, revenue:1876, rating:4.7, status:'active' },
  { id:'6', name:'AB Βασιλόπουλος',     category:'Supermarket',city:'Αθήνα', orders:890, revenue:12450,rating:4.4, status:'active' },
]

const MOCK_DRIVERS = [
  { id:'1', name:'Δημήτρης Π.', rating:4.9, deliveries:1247, status:'online',  earnings:342 },
  { id:'2', name:'Νίκος Α.',    rating:4.8, deliveries:892,  status:'online',  earnings:271 },
  { id:'3', name:'Γιώργος Μ.', rating:4.7, deliveries:634,  status:'offline', earnings:198 },
  { id:'4', name:'Κώστας Τ.',   rating:4.6, deliveries:421,  status:'active',  earnings:156 },
]

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
  return (
    <div className="overflow-y-auto h-full pb-24 px-5">
      <div className="pt-5 pb-3">
        <h2 className="font-display font-black text-xl">Platform Overview</h2>
        <p className="text-xs text-ink-3 mt-0.5">Τελευταίες 24 ώρες</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <KPICard icon="💰" label="GMV"          value="€14,821" trend={18}  sub="Gross Merchandise Value"  color="bg-brand-50 border-brand-100" />
        <KPICard icon="📦" label="Παραγγελίες"  value="342"     trend={12}  sub="Σήμερα"                   />
        <KPICard icon="🏪" label="Ενεργά stores" value="24"     trend={4}   sub="από 28 συνολικά"          />
        <KPICard icon="🛵" label="Drivers online" value="8"     trend={-2}  sub="από 15 εγγεγραμμένους"   />
        <KPICard icon="👥" label="Νέοι χρήστες" value="47"      trend={23}  sub="Σήμερα"                   />
        <KPICard icon="⭐" label="Μ.Ο. βαθμολ." value="4.7"     trend={2}   sub="Τελευταίες 30 μέρες"     />
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
  const filtered = MOCK_STORES.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

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
        {filtered.map(store => (
          <div key={store.id} className="bg-surface-2 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{store.name}</p>
                <p className="text-xs text-ink-2">{store.category} · {store.city}</p>
              </div>
              <span className={`badge text-[10px] ${store.status==='active' ? 'badge-green' : 'badge-amber'}`}>
                {store.status==='active' ? '✓ Ενεργό' : '⏳ Pending'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { val:store.orders,               label:'Παραγγελίες' },
                { val:`€${store.revenue.toLocaleString()}`, label:'Έσοδα' },
                { val:`★${store.rating}`,          label:'Βαθμολογία'  },
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
              <button className={`btn btn-sm ${store.status==='active' ? 'bg-red-100 text-danger' : 'btn-primary'}`}>
                {store.status==='active' ? 'Pause' : 'Approve'}
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
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-black text-xl">Drivers</h2>
          <div className="flex gap-1.5">
            <span className="badge badge-green">8 online</span>
            <span className="badge badge-gray">7 offline</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-2">
        {MOCK_DRIVERS.map(d => (
          <div key={d.id} className="bg-surface-2 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white font-display font-black text-base flex-shrink-0">
              {d.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{d.name}</p>
                <span className={`w-2 h-2 rounded-full ${d.status==='online'||d.status==='active' ? 'bg-success' : 'bg-surface-4'}`} />
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-2 mt-0.5">
                <span>★{d.rating}</span>
                <span>{d.deliveries} παραδ.</span>
                <span className="text-brand font-semibold">€{d.earnings} σήμερα</span>
              </div>
            </div>
            <button className="btn-icon w-9 h-9 text-sm">👁️</button>
          </div>
        ))}
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
        {tab === 'orders'   && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-3">
            <span className="text-4xl">📦</span>
            <p className="font-semibold">Όλες οι παραγγελίες</p>
            <p className="text-sm">Coming soon</p>
          </div>
        )}
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
