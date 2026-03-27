import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useStores } from '@/hooks/useDelivr'
import { useCartStore } from '@/store/cartStore'
import StoreCard from '@/components/store/StoreCard'
import { Skeleton, SectionHeader, EmptyState } from '@/components/ui'
import type { StoreCategory } from '@/types'

const CATEGORIES = [
  { id: 'all',         label: 'Όλα',        emoji: '🍽️' },
  { id: 'restaurant',  label: 'Εστιατόρια', emoji: '🍴' },
  { id: 'cafe',        label: 'Καφέ',        emoji: '☕' },
  { id: 'burger',      label: 'Burger',      emoji: '🍔' },
  { id: 'pizza',       label: 'Pizza',       emoji: '🍕' },
  { id: 'sushi',       label: 'Sushi',       emoji: '🍣' },
  { id: 'healthy',     label: 'Healthy',     emoji: '🥗' },
  { id: 'supermarket', label: 'Market',      emoji: '🛒' },
  { id: 'pharmacy',    label: 'Φαρμακείο',  emoji: '💊' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [category, setCategory] = useState<StoreCategory | 'all'>('all')
  const [search, setSearch]     = useState('')

  const { data: stores, isLoading } = useStores({
    category: category === 'all' ? undefined : category,
    search: search || undefined,
  })

  const cartCount = useCartStore(s => s.itemCount())
  const cartTotal = useCartStore(s => s.subtotal())

  const promoted  = useMemo(() => stores?.filter(s => s.is_promoted) ?? [],  [stores])
  const regular   = useMemo(() => stores?.filter(s => !s.is_promoted) ?? [], [stores])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'φίλε'

  return (
    <div className="screen">
      {/* Status bar placeholder */}
      <div className="h-11 bg-surface-1 flex-shrink-0" />

      <div className="scroll-area">
        {/* ── Header ── */}
        <div className="px-5 pt-1 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <button className="flex items-center gap-1.5 text-sm text-ink-2 mb-1"
                      onClick={() => navigate('/profile')}>
                <span>📍</span>
                <span className="font-medium">Σύνταγμα, Αθήνα</span>
                <span className="text-brand">▾</span>
              </button>
              <h1 className="font-display font-black text-[26px] leading-tight">
                {search ? 'Αποτελέσματα' : `Γεια σου, ${firstName} 👋`}
              </h1>
            </div>
            <button className="relative w-11 h-11 rounded-full bg-ink-1 flex items-center justify-center
                               text-white font-display font-bold text-base flex-shrink-0"
                    onClick={() => navigate('/profile')}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : (profile?.full_name?.[0] ?? 'Α')
              }
              <span className="absolute top-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-surface-1" />
            </button>
          </div>

          {/* Search */}
          <div className="input-wrapper">
            <span className="text-ink-3 text-lg">🔍</span>
            <input className="input-field" placeholder="Εστιατόριο, πιάτο, κουζίνα..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} className="text-ink-3 text-sm px-1">✕</button>
            )}
          </div>
        </div>

        {/* ── Promo banner ── */}
        {!search && (
          <div className="px-5 mb-4 animate-fade-in-up">
            <div className="promo-banner cursor-pointer" onClick={() => {}}>
              <div className="relative z-10">
                <span className="badge bg-white/20 text-white mb-2">ΠΡΟΣΦΟΡΑ</span>
                <h3 className="font-display font-bold text-lg text-white mb-1">
                  -20% στην 1η παραγγελία
                </h3>
                <p className="text-white/75 text-sm">
                  Κωδικός <strong className="text-white">WELCOME20</strong> · Λήγει σήμερα
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Categories ── */}
        {!search && (
          <div className="px-5 mb-4 animate-fade-in-up stagger-1">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map(cat => (
                <button key={cat.id}
                  className={`chip ${category === cat.id ? 'chip-active' : ''}`}
                  onClick={() => setCategory(cat.id as any)}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Active order banner ── */}
        {!search && (
          <div className="px-5 mb-4 animate-fade-in-up stagger-2">
            <div className="border-[1.5px] border-brand bg-brand-50 rounded-2xl p-3.5
                            flex items-center gap-3 cursor-pointer"
                 onClick={() => navigate('/track/active')}>
              <span className="text-2xl">🛵</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">Παραγγελία σε εξέλιξη</p>
                <p className="text-xs text-ink-2">Green & Fresh · ~12 λεπτά</p>
              </div>
              <span className="text-brand text-xl font-bold">›</span>
            </div>
          </div>
        )}

        {/* ── Promoted stores ── */}
        {!search && promoted.length > 0 && (
          <div className="px-5 mb-5 animate-fade-in-up stagger-2">
            <SectionHeader title="⚡ Promoted" action="Δες όλα" onAction={() => {}} />
            <div className="flex gap-3 overflow-x-auto pb-1">
              {promoted.map(store => (
                <div key={store.id} className="w-[200px] flex-shrink-0">
                  <StoreCard store={store} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Store list ── */}
        <div className="px-5 pb-32">
          {!search
            ? <SectionHeader title={category === 'all' ? 'Κοντά σου 📍' : CATEGORIES.find(c => c.id === category)?.label ?? ''} />
            : <p className="text-sm text-ink-2 mb-4">{stores?.length ?? 0} αποτελέσματα για "{search}"</p>
          }

          {isLoading && (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden border border-surface-4">
                  <Skeleton className="h-36 rounded-none" />
                  <div className="p-3.5 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (regular.length === 0 && promoted.length === 0) && (
            <EmptyState
              emoji="🔍"
              title="Δε βρέθηκαν καταστήματα"
              subtitle="Δοκίμασε άλλη αναζήτηση ή κατηγορία"
              action="Καθαρισμός φίλτρων"
              onAction={() => { setSearch(''); setCategory('all') }}
            />
          )}

          <div className="space-y-4">
            {(search ? (stores ?? []) : regular).map((store, i) => (
              <div key={store.id} className={`animate-fade-in-up stagger-${Math.min(i+1,5)}`}>
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating cart bar ── */}
      {cartCount > 0 && (
        <div className="cart-bar" onClick={() => navigate('/cart')}>
          <div className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center
                          font-display font-bold text-sm flex-shrink-0">
            {cartCount}
          </div>
          <span className="font-semibold text-[15px]">Δες το καλάθι σου</span>
          <span className="font-display font-bold">{cartTotal.toFixed(2)}€</span>
        </div>
      )}
    </div>
  )
}
