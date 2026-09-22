import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStoreMenu, type PublicMenuItem } from '@/lib/api'
import { money, num } from '@/lib/format'
import { useI18n, LangToggle } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { CartBar, CartProgress } from '@/guest/CartWidgets'
import { CategoryChips, ItemSheet, MenuSections, useGroupedMenu } from '@/guest/StoreMenu'
import { Spinner, EmptyState } from '@/components/ui'
import { useShop } from '@/shop/useShop'

export default function ShopMenuPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { service, setService, setStoreContext, address, setAddress, count, subtotal } = useGuestCart()
  const [openItem, setOpenItem] = useState<PublicMenuItem | null>(null)

  const { storeQ, store, priced, areaUnserved } = useShop(slug)

  // Landing on a different store's link empties a cart from the previous one.
  useEffect(() => {
    if (store) setStoreContext(slug, store.supports_delivery ? service : 'pickup')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, slug])

  const menuQ = useQuery({
    queryKey: ['store-menu', store?.id],
    queryFn: () => getStoreMenu(store!.id),
    enabled: !!store,
  })

  const grouped = useGroupedMenu(menuQ.data)
  const totals = cartTotals(subtotal(), priced, service)
  const cartCount = count()

  useDocumentTitle(store?.name ?? null)

  if (storeQ.isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }
  if (storeQ.isError || !store) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <EmptyState emoji="🔒" title={t('shop.notFound')} subtitle="" />
      </div>
    )
  }

  const canDeliver = store.supports_delivery
  const canPickup = store.supports_takeaway

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <div className="flex items-start gap-3 px-4 pt-3">
          <div className="w-11 h-11 rounded-xl bg-surface-3 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
            {store.logo_url ? <img src={store.logo_url} alt="" className="w-full h-full object-cover" /> : '🏪'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-lg leading-tight truncate">{store.name}</p>
            <p className="text-[11px] text-ink-3 truncate">{t('shop.orderDirect')}</p>
          </div>
          <LangToggle />
        </div>

        {store.intro && <p className="px-4 pt-2 text-xs text-ink-2">{store.intro}</p>}

        {/* Delivery or takeaway */}
        <div className="flex gap-2 px-4 pt-3">
          {canDeliver && (
            <button
              onClick={() => setService('delivery')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition
                ${service === 'delivery' ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}
            >
              🛵 {t('guest.delivery')}
            </button>
          )}
          {canPickup && (
            <button
              onClick={() => setService('pickup')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition
                ${service === 'pickup' ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}
            >
              🥡 {t('guest.takeaway')}
            </button>
          )}
        </div>
        {!canDeliver && <p className="px-4 pt-2 text-[11px] text-ink-3">{t('shop.noDelivery')}</p>}
        {!canPickup && <p className="px-4 pt-2 text-[11px] text-ink-3">{t('shop.noTakeaway')}</p>}

        {/* The area decides the fee and the minimum, so it is asked before the menu. */}
        {service === 'delivery' && store.zones_required && (
          <div className="px-4 pt-3">
            <label className="input-label" htmlFor="shop-area">{t('shop.chooseArea')}</label>
            <select
              id="shop-area"
              className="input-field"
              value={address.area}
              onChange={e => {
                const zone = store.zones.find(z => (z.area ?? z.name) === e.target.value)
                setAddress({
                  ...address,
                  area: e.target.value,
                  city: zone?.city ?? address.city,
                  postal_code: zone?.postal_code ?? address.postal_code,
                })
              }}
            >
              <option value="">{t('shop.chooseAreaPh')}</option>
              {store.zones.map(z => (
                <option key={z.id} value={z.area ?? z.name}>{z.area ?? z.name}</option>
              ))}
            </select>
          </div>
        )}

        <p className="px-4 py-2 text-[11px] text-ink-3">
          {service === 'delivery'
            ? `🛵 ${num(priced?.delivery_fee) === 0 ? t('common.free') : money(priced?.delivery_fee ?? 0, lang)} · ⏱ ${priced?.eta_min ?? '—'}′`
            : `🥡 ${t('shop.pickUpHere')} · ⏱ ${priced?.eta_min ?? '—'}′`}
          {num(priced?.min_order) > 0 && ` · min ${money(priced?.min_order ?? 0, lang)}`}
        </p>

        {!store.is_open_now && (
          <p className="bg-amber-50 text-amber-800 text-xs px-4 py-2 border-t border-amber-100">
            ⏰ {t('store.closedNow')}
          </p>
        )}
        {service === 'pickup' && num(store.pickup_discount_pct) > 0 && (
          <p className="bg-green-50 text-success text-xs px-4 py-2 border-t border-green-100 font-semibold">
            🥡 {t('store.takeawayDiscount')} −{num(store.pickup_discount_pct)}%
          </p>
        )}

        <CategoryChips grouped={grouped} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {menuQ.isLoading && <div className="flex justify-center py-10"><Spinner size={28} /></div>}
        {!menuQ.isLoading && grouped.length === 0 && (
          <EmptyState emoji="📋" title={t('store.menu')} subtitle="—" />
        )}
        <MenuSections grouped={grouped} onOpen={setOpenItem} />
      </div>

      {cartCount > 0 && (
        <div className="flex-shrink-0 bg-surface-1">
          {areaUnserved
            ? <p className="px-4 pt-3 text-[11px] text-danger">{t('shop.notServed')}</p>
            : <CartProgress totals={totals} service={service} className="px-3 pt-3 border-t border-surface-4" />}
          <CartBar count={cartCount} total={totals.total} onOpen={() => navigate(`/store/${slug}/cart`)} />
        </div>
      )}

      {openItem && (
        <ItemSheet item={openItem} storeId={store.id} storeName={store.name}
                   onClose={() => setOpenItem(null)} />
      )}
    </div>
  )
}
