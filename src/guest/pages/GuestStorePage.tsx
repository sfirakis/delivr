import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStoreMenu, getStoresForProperty, type PublicMenuItem } from '@/lib/api'
import { money, num } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { CartBar, CartProgress } from '@/guest/CartWidgets'
import { CategoryChips, ItemSheet, MenuSections, useGroupedMenu } from '@/guest/StoreMenu'
import { Spinner, EmptyState } from '@/components/ui'

export default function GuestStorePage() {
  const { code = '', storeId = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { service, count, subtotal, storeId: cartStoreId } = useGuestCart()
  const [openItem, setOpenItem] = useState<PublicMenuItem | null>(null)

  const storesQ = useQuery({
    queryKey: ['stores-for-property', code, service],
    queryFn: () => getStoresForProperty(code, service),
  })
  const menuQ = useQuery({
    queryKey: ['store-menu', storeId],
    queryFn: () => getStoreMenu(storeId),
  })

  const store = storesQ.data?.find(s => s.store_id === storeId)
  const cartCount = count()
  // The cart may still belong to another store (it is reset on the next add);
  // price it against whichever store it actually holds.
  const cartStore = storesQ.data?.find(s => s.store_id === cartStoreId)
  const totals = cartTotals(subtotal(), cartStore, service)

  useDocumentTitle(store?.store_name ?? null)

  const grouped = useGroupedMenu(menuQ.data)

  if (menuQ.isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }

  return (
    <div className="h-full flex flex-col bg-surface-2">
      {/* Header */}
      <div className="bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button className="btn-icon" onClick={() => navigate(`/qr/${code}`)} aria-label={t('common.back')}>←</button>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-base truncate">{store?.store_name ?? ''}</p>
            <p className="text-[11px] text-ink-3 truncate">
              {service === 'delivery'
                ? `🛵 ${num(store?.delivery_fee) === 0 ? t('common.free') : money(store?.delivery_fee ?? 0, lang)} · ⏱ ${store?.eta_min ?? '—'}′`
                : `🥡 ${t('guest.pickupHere')} · ⏱ ${store?.eta_min ?? '—'}′`}
              {num(store?.min_order) > 0 && ` · min ${money(store?.min_order ?? 0, lang)}`}
            </p>
          </div>
        </div>

        {store && !store.is_open_now && (
          <p className="bg-amber-50 text-amber-800 text-xs px-4 py-2 border-t border-amber-100">
            ⏰ {t('store.closedNow')}
          </p>
        )}
        {service === 'pickup' && num(store?.pickup_discount_pct) > 0 && (
          <p className="bg-green-50 text-success text-xs px-4 py-2 border-t border-green-100 font-semibold">
            🥡 {t('store.takeawayDiscount')} −{num(store?.pickup_discount_pct)}%
          </p>
        )}

        <CategoryChips grouped={grouped} />
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {grouped.length === 0 && <EmptyState emoji="📋" title={t('store.menu')} subtitle="—" />}
        <MenuSections grouped={grouped} onOpen={setOpenItem} />
      </div>

      {/* Cart bar + what is still worth adding */}
      {cartCount > 0 && (
        <div className="flex-shrink-0 bg-surface-1">
          {cartStoreId === storeId && (
            <CartProgress totals={totals} service={service} className="px-3 pt-3 border-t border-surface-4" />
          )}
          <CartBar count={cartCount} total={totals.total} onOpen={() => navigate(`/qr/${code}/cart`)} />
        </div>
      )}

      {openItem && store && (
        <ItemSheet
          item={openItem}
          storeId={storeId}
          storeName={store.store_name}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  )
}
