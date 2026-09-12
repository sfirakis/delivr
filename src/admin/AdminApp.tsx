import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAdminOrders } from './hooks'
import { Tabs } from './ui'
import { LangToggle } from '@/lib/i18n'
import OverviewPage from './pages/OverviewPage'
import OrdersPage from './pages/OrdersPage'
import StoresPage from './pages/StoresPage'
import PropertiesPage from './pages/PropertiesPage'
import BillingPage from './pages/BillingPage'
import PeoplePage from './pages/PeoplePage'
import SettingsPage from './pages/SettingsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import HelpPage from '@/help/HelpPage'

type Tab = 'overview' | 'analytics' | 'orders' | 'stores' | 'properties' | 'billing' | 'subscriptions' | 'people' | 'settings' | 'help'

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>('overview')
  const navigate = useNavigate()
  const { profile, signOut } = useAuthStore()
  const pendingQ = useAdminOrders({ status: 'pending', days: 2 })
  const pendingCount = pendingQ.data?.length ?? 0

  if (profile && profile.role !== 'admin') {
    return (
      <div className="dash-container px-5 py-16 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="font-display font-black text-xl">Δεν έχεις δικαιώματα διαχειριστή</h1>
        <p className="text-sm text-ink-2 mt-2">
          Ο λογαριασμός <strong>{profile.full_name || profile.id}</strong> έχει ρόλο «{profile.role}».
        </p>
        <p className="text-xs text-ink-3 mt-3 max-w-md mx-auto">
          Ο πρώτος διαχειριστής ορίζεται μία φορά από τη βάση:
          <code className="block mt-2 bg-surface-3 rounded-lg p-2 text-left">
            update profiles set role = 'admin' where id = '{profile.id}';
          </code>
        </p>
        <button className="btn btn-secondary btn-md mt-5" onClick={() => navigate('/')}>
          Επιστροφή στην αρχική
        </button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview',      label: '📊 Επισκόπηση' },
    { id: 'analytics',     label: '📈 Στατιστικά' },
    { id: 'orders',        label: '📦 Παραγγελίες', badge: pendingCount },
    { id: 'stores',        label: '🏪 Καταστήματα' },
    { id: 'properties',    label: '🔑 Καταλύματα & QR' },
    { id: 'billing',       label: '🏦 Χρεώσεις' },
    { id: 'subscriptions', label: '🔁 Συνδρομές' },
    { id: 'people',        label: '👥 Χρήστες' },
    { id: 'settings',      label: '⚙️ Ρυθμίσεις' },
    { id: 'help',          label: '📖 Οδηγός' },
  ]

  return (
    <div className="dash-container px-4 md:px-6 py-4">
      <header className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display font-black text-2xl text-ink-1">Delivr — Διαχείριση</h1>
          <p className="text-xs text-ink-3">
            {profile?.full_name ? `Συνδεδεμένος ως ${profile.full_name}` : 'Master admin'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <button className="btn btn-secondary btn-md" onClick={() => navigate('/')}>Αρχική</button>
          <button className="btn btn-ghost btn-md" onClick={() => { void signOut(); navigate('/auth') }}>
            Έξοδος
          </button>
        </div>
      </header>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="py-5">
        {tab === 'overview'      && <OverviewPage />}
        {tab === 'analytics'     && <AnalyticsPage />}
        {tab === 'orders'        && <OrdersPage />}
        {tab === 'stores'        && <StoresPage />}
        {tab === 'properties'    && <PropertiesPage />}
        {tab === 'billing'       && <BillingPage />}
        {tab === 'subscriptions' && <SubscriptionsPage />}
        {tab === 'people'        && <PeoplePage />}
        {tab === 'settings'      && <SettingsPage />}
        {tab === 'help'          && <HelpPage audience="admin" />}
      </div>
    </div>
  )
}
