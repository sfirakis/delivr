import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, useStoreMenu } from '@/hooks/useDelivr'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import MenuItemCard from '@/components/store/MenuItemCard'
import { BackHeader, StarRating, Skeleton } from '@/components/ui'
import toast from 'react-hot-toast'

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isFav, setIsFav] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: store, isLoading: storeLoading } = useStore(storeId!)
  const { data: menu, isLoading: menuLoading }  = useStoreMenu(storeId!)
  const cartCount = useCartStore(s => s.itemCount())
  const cartTotal = useCartStore(s => s.subtotal())
  const { clearIfDifferentStore } = useCartStore()

  const isLoading = storeLoading || menuLoading

  const handleAddFromDifferentStore = () => {
    if (storeId && clearIfDifferentStore(storeId)) {
      if (confirm('Το καλάθι σου περιέχει προϊόντα από άλλο κατάστημα. Να το αδειάσω;')) {
        useCartStore.getState().clearCart()
      }
    }
  }

  if (isLoading) return (
    <div className="screen">
      <Skeleton className="h-52 rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 mt-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
        </div>
      </div>
    </div>
  )

  if (!store) return null

  const categories = ['all', ...(menu?.categories.map(c => c.id) ?? [])]
  const categoryMap = Object.fromEntries(menu?.categories.map(c => [c.id, c.name]) ?? [])

  const filteredItems = activeCategory === 'all'
    ? (menu?.items ?? [])
    : (menu?.items ?? []).filter(i => i.category_id === activeCategory)

  const itemsByCategory = activeCategory === 'all'
    ? menu?.categories.map(cat => ({
        ...cat,
        items: menu.items.filter(i => i.category_id === cat.id)
      })).filter(c => c.items.length > 0) ?? []
    : []

  return (
    <div className="screen">
      <div className="h-11 bg-transparent absolute top-0 left-0 right-0 z-10 flex-shrink-0" />

      {/* ── Hero ── */}
      <div className="relative h-52 bg-surface-2 flex items-center justify-center text-8xl flex-shrink-0">
        {store.cover_url
          ? <img src={store.cover_url} alt={store.name} className="absolute inset-0 w-full h-full object-cover" />
          : <span>{store.emoji ?? '🏪'}</span>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Controls */}
        <button className="btn-icon absolute top-12 left-4 bg-white/90 shadow-card" onClick={() => navigate(-1)}>←</button>
        <button className={`btn-icon absolute top-12 right-4 shadow-card ${isFav ? 'bg-brand text-white' : 'bg-white/90'}`}
                onClick={() => { setIsFav(!isFav); toast(isFav ? 'Αφαιρέθηκε από αγαπημένα' : '❤️ Προστέθηκε στα αγαπημένα') }}>
          {isFav ? '❤️' : '♡'}
        </button>

        {store.discount_pct && (
          <span className="badge bg-brand text-white absolute bottom-3 left-4">-{store.discount_pct}% OFF</span>
        )}
      </div>

      {/* ── Store info ── */}
      <div className="px-5 py-4 flex-shrink-0 border-b border-surface-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="font-display font-black text-2xl">{store.name}</h1>
            <p className="text-sm text-ink-2 mt-0.5">{store.cuisine_tags.join(' · ')}</p>
          </div>
          <StarRating rating={store.rating} count={store.review_count} size="md" />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 mb-3">
          <span>⏱ {store.avg_delivery_time}'</span>
          {store.delivery_fee === 0
            ? <span className="text-success font-semibold">✓ Δωρεάν παράδοση</span>
            : <span>🛵 {store.delivery_fee.toFixed(2)}€ delivery</span>
          }
          <span>📋 Min {store.min_order_amount}€</span>
          <span className={store.is_open ? 'text-success font-semibold' : 'text-danger font-semibold'}>
            {store.is_open ? '✓ Ανοιχτό' : '✗ Κλειστό'}
          </span>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={`chip ${activeCategory === 'all' ? 'chip-active' : ''}`}
                  onClick={() => setActiveCategory('all')}>Όλα</button>
          {menu?.categories.map(cat => (
            <button key={cat.id}
                    className={`chip ${activeCategory === cat.id ? 'chip-active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Menu items ── */}
      <div className="scroll-area px-5 pb-32" ref={scrollRef}>
        {activeCategory === 'all'
          ? itemsByCategory.map(cat => (
              <div key={cat.id} className="mt-4">
                <h3 className="font-display font-bold text-base mb-1 text-ink-2 uppercase text-xs tracking-wider">
                  {cat.name}
                </h3>
                {cat.items.map(item => (
                  <MenuItemCard key={item.id} item={item} store={store} />
                ))}
              </div>
            ))
          : filteredItems.map(item => (
              <MenuItemCard key={item.id} item={item} store={store} />
            ))
        }
      </div>

      {/* ── Cart bar ── */}
      {cartCount > 0 && (
        <div className="cart-bar" onClick={() => navigate('/cart')}>
          <div className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center font-display font-bold text-sm">
            {cartCount}
          </div>
          <span className="font-semibold">Δες το καλάθι</span>
          <span className="font-display font-bold">{cartTotal.toFixed(2)}€</span>
        </div>
      )}
    </div>
  )
}
