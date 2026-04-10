import { useState, useEffect } from 'react'
import { useMerchantStore } from '@/merchant/merchantStore'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { Store } from '@/types'
import POSPage        from '@/merchant/pages/POSPage'
import MerchantMenuPage     from '@/merchant/pages/MenuPage'
import MerchantAnalyticsPage from '@/merchant/pages/AnalyticsPage'
import MerchantSettingsPage  from '@/merchant/pages/SettingsPage'

type TabId = 'pos' | 'menu' | 'analytics' | 'settings'

const NAV_TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'pos',       icon: '📋', label: 'POS'       },
  { id: 'menu',      icon: '🍽️',  label: 'Μενού'    },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { id: 'settings',  icon: '⚙️',  label: 'Ρυθμίσεις'},
]

export default function MerchantApp() {
  const [tab, setTab] = useState<TabId>('pos')
  const { user } = useAuthStore()
  const { setStore, pendingOrders, isOnline } = useMerchantStore()
  const [loading, setLoading] = useState(true)
  const [store, setLocalStore] = useState<Store | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMerchantStore() {
      if (!user) { setLoading(false); return }
      try {
        // Try to find store owned by this user (check email match or a store_users table)
        const { data, error: err } = await supabase
          .from('stores')
          .select('*')
          .eq('email', user.email)
          .single()

        if (err || !data) {
          // Fallback: try matching by user metadata or first active store
          const { data: fallback } = await supabase
            .from('stores')
            .select('*')
            .eq('is_active', true)
            .limit(1)
            .single()

          if (fallback) {
            setLocalStore(fallback as Store)
            setStore(fallback as Store)
          } else {
            setError('Δεν βρέθηκε κατάστημα για αυτόν τον λογαριασμό')
          }
        } else {
          setLocalStore(data as Store)
          setStore(data as Store)
        }
      } catch {
        setError('Σφάλμα φόρτωσης καταστήματος')
      } finally {
        setLoading(false)
      }
    }
    fetchMerchantStore()
  }, [user, setStore])

  if (loading) return (
    <div className="flex flex-col h-full bg-surface-2 items-center justify-center gap-3">
      <div className="text-4xl animate-pulse">🏪</div>
      <p className="font-display font-semibold text-ink-2">Φόρτωση καταστήματος...</p>
    </div>
  )

  if (error || !store) return (
    <div className="flex flex-col h-full bg-surface-2 items-center justify-center gap-3 px-8 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="font-display font-semibold text-ink-1">{error ?? 'Δεν βρέθηκε κατάστημα'}</p>
      <p className="text-sm text-ink-2">Βεβαιωθείτε ότι ο λογαριασμός σας είναι συνδεδεμένος με κατάστημα.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-surface-2">
      {/* Status bar */}
      <div className="h-11 bg-ink-1 flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-surface-1">
        {tab === 'pos'       && <POSPage storeId={store.id} />}
        {tab === 'menu'      && <MerchantMenuPage storeId={store.id} />}
        {tab === 'analytics' && <MerchantAnalyticsPage storeId={store.id} />}
        {tab === 'settings'  && <MerchantSettingsPage store={store} />}
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
