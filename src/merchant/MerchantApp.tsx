import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useMyStores } from './useMyStore'
import { Tabs, Select } from '@/admin/ui'
import { Spinner } from '@/components/ui'
import POSPage from './pages/POSPage'
import MerchantMenuPage from './pages/MenuPage'
import MerchantAnalyticsPage from './pages/AnalyticsPage'
import MerchantSettingsPage from './pages/SettingsPage'
import HelpPage from '@/help/HelpPage'
import DelivrLogo from '@/components/brand/DelivrLogo'

type TabId = 'pos' | 'menu' | 'analytics' | 'settings' | 'help'

export default function MerchantApp() {
  const [tab, setTab] = useState<TabId>('pos')
  const [storeId, setStoreId] = useState<string>('')
  const navigate = useNavigate()
  const { profile, signOut } = useAuthStore()
  const storesQ = useMyStores()

  const stores = useMemo(() => storesQ.data ?? [], [storesQ.data])
  useEffect(() => {
    if (!storeId && stores.length > 0) setStoreId(stores[0].id)
  }, [stores, storeId])

  if (storesQ.isLoading) {
    return <div className="dash-container py-20 flex justify-center"><Spinner size={30} /></div>
  }

  if (stores.length === 0) {
    return (
      <div className="dash-container px-5 py-16 text-center">
        <p className="text-4xl mb-3">🏪</p>
        <h1 className="font-display font-black text-xl">Δεν είσαι συνδεδεμένος με κατάστημα</h1>
        <p className="text-sm text-ink-2 mt-2 max-w-md mx-auto">
          Ζήτησε από τον διαχειριστή να συνδέσει τον λογαριασμό σου με ένα κατάστημα
          (Διαχείριση → Χρήστες → 🔗 Κατάστημα).
        </p>
        <p className="text-xs text-ink-3 mt-3">
          Λογαριασμός: <code>{profile?.id}</code>
        </p>
        <button className="btn btn-secondary btn-md mt-5" onClick={() => navigate('/')}>
          Επιστροφή στην αρχική
        </button>
      </div>
    )
  }

  const store = stores.find(s => s.id === storeId) ?? stores[0]

  const tabs: { id: TabId; label: string }[] = [
    { id: 'pos', label: '📋 Παραγγελίες' },
    { id: 'menu', label: '🍽️ Μενού' },
    { id: 'analytics', label: '📊 Στατιστικά' },
    { id: 'settings', label: '⚙️ Ρυθμίσεις' },
    { id: 'help', label: '📖 Οδηγός' },
  ]

  return (
    <div className="dash-container px-4 md:px-6 py-4">
      <header className="no-print flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <DelivrLogo variant="full" size="xs" className="mb-1" />
          <h1 className="font-display font-black text-2xl text-ink-1">{store.name}</h1>
          <p className="text-xs text-ink-3">
            {store.is_open ? '🟢 Ανοιχτό' : '🔴 Κλειστό'} · {store.address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stores.length > 1 && (
            <Select className="max-w-[220px]" value={store.id} onChange={e => setStoreId(e.target.value)}>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          {profile?.role === 'admin' && (
            <button className="btn btn-secondary btn-md" onClick={() => navigate('/admin')}>Διαχείριση</button>
          )}
          <button className="btn btn-ghost btn-md" onClick={() => { void signOut(); navigate('/auth') }}>Έξοδος</button>
        </div>
      </header>

      {store.onboarding_status === 'pending' && (
        <div className="no-print mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">⏳ Το κατάστημα περιμένει έγκριση από την ομάδα Delivr</p>
          <p className="mt-1">
            Στο μεταξύ ετοίμασέ το: <button className="underline font-semibold" onClick={() => setTab('menu')}>βάλε μενού</button>,
            έλεγξε <button className="underline font-semibold" onClick={() => setTab('settings')}>ωράριο, ζώνες &amp; μεταφορικά</button>.
            Μόλις εγκριθεί, εμφανίζεται στους πελάτες και δέχεται παραγγελίες.
          </p>
        </div>
      )}

      <div className="no-print"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

      <div className="py-5">
        {tab === 'pos' && <POSPage storeId={store.id} />}
        {tab === 'menu' && <MerchantMenuPage storeId={store.id} storeName={store.name} />}
        {tab === 'analytics' && <MerchantAnalyticsPage storeId={store.id} />}
        {tab === 'settings' && <MerchantSettingsPage store={store} />}
        {tab === 'help' && <HelpPage audience="store" />}
      </div>
    </div>
  )
}
