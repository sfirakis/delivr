import { useState, useEffect } from 'react'
import { useMerchantStore } from '@/merchant/merchantStore'
import POSPage        from '@/merchant/pages/POSPage'
import MerchantMenuPage     from '@/merchant/pages/MenuPage'
import MerchantAnalyticsPage from '@/merchant/pages/AnalyticsPage'
import MerchantSettingsPage  from '@/merchant/pages/SettingsPage'

// Demo store ID — in production this comes from auth/session
const DEMO_STORE_ID = 'demo-store-id'
const DEMO_STORE = {
  id: DEMO_STORE_ID, name: 'Avra Souvlaki', slug:'avra',
  category: 'restaurant' as any, cuisine_tags: ['Ελληνική'],
  address: 'Ερμού 45', city: 'Αθήνα', lat: 37.97, lng: 23.73,
  delivery_fee: 1.50, min_order_amount: 5, avg_delivery_time: 25,
  delivery_radius_km: 5, is_open: true, is_active: true, is_promoted: false,
  rating: 4.8, review_count: 342, free_delivery_above: null, discount_pct: null,
  logo_url: null, cover_url: null, phone: null, email: null,
  description: null, created_at: '', updated_at: '', emoji: '🥙',
}

type TabId = 'pos' | 'menu' | 'analytics' | 'settings'

const NAV_TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'pos',       icon: '📋', label: 'POS'       },
  { id: 'menu',      icon: '🍽️',  label: 'Μενού'    },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { id: 'settings',  icon: '⚙️',  label: 'Ρυθμίσεις'},
]

export default function MerchantApp() {
  const [tab, setTab] = useState<TabId>('pos')
  const { setStore, pendingOrders, isOnline } = useMerchantStore()

  useEffect(() => {
    setStore(DEMO_STORE as any)
  }, [setStore])

  return (
    <div className="flex flex-col h-full bg-surface-2">
      {/* Status bar */}
      <div className="h-11 bg-ink-1 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-surface-1">
        {tab === 'pos'       && <POSPage storeId={DEMO_STORE_ID} />}
        {tab === 'menu'      && <MerchantMenuPage storeId={DEMO_STORE_ID} />}
        {tab === 'analytics' && <MerchantAnalyticsPage storeId={DEMO_STORE_ID} />}
        {tab === 'settings'  && <MerchantSettingsPage store={DEMO_STORE as any} />}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV_TABS.map(t => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}>
            <div className="nav-item-icon relative">
              {t.icon}
              {t.id === 'pos' && pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-danger text-white text-[10px]
                                 font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {pendingOrders.length}
                </span>
              )}
            </div>
            <span className="nav-item-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
