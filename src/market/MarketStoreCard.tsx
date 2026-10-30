import type { MarketStore, ServiceType } from '@/lib/api'
import { money, num } from '@/lib/format'
import { useI18n, type TKey } from '@/lib/i18n'

export const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍴', cafe: '☕', burger: '🍔', pizza: '🍕', sushi: '🍣',
  healthy: '🥗', supermarket: '🛒', pharmacy: '💊', other: '🏪',
}

export const categoryLabel = (t: (k: TKey) => string, cat: string) => {
  const key = `cat.${cat}` as TKey
  const label = t(key)
  return label === key ? cat : label
}

/**
 * One store on the marketplace list. Ideas from the original customer app
 * (cover, emoji fallback, closed overlay, fee/min line) — without its fake
 * ratings: stars only appear once a store has real reviews.
 */
export default function MarketStoreCard({ store, service, onOpen }: {
  store: MarketStore; service: ServiceType; onOpen: () => void
}) {
  const { t, lang } = useI18n()
  const emoji = CATEGORY_EMOJI[store.category] ?? '🏪'
  const priced = store.delivers !== null
  const fee = num(store.delivery_fee)
  const tags = (store.cuisine_tags ?? []).slice(0, 3)

  return (
    <button type="button" onClick={onOpen} data-testid="market-store"
            className="store-card w-full text-left block">
      <div className="relative h-28 bg-surface-3 flex items-center justify-center text-5xl overflow-hidden">
        {store.cover_url
          ? <img src={store.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <span aria-hidden="true">{emoji}</span>}
        {num(store.discount_pct) > 0 && (
          <span className="badge bg-brand text-white absolute top-2.5 left-3">−{num(store.discount_pct)}%</span>
        )}
        {service === 'pickup' && num(store.pickup_discount_pct) > 0 && (
          <span className="badge bg-success text-white absolute top-2.5 right-3">🥡 −{num(store.pickup_discount_pct)}%</span>
        )}
        {!store.is_open_now && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-display font-bold text-lg">{t('market.closed')}</span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-base leading-tight truncate">{store.name}</h3>
            <p className="text-xs text-ink-2 mt-0.5 truncate">
              {[categoryLabel(t, store.category), ...tags].join(' · ')}
              {store.city ? ` · ${store.city}` : ''}
            </p>
          </div>
          {store.review_count > 0 && (
            <span className="text-xs font-semibold text-ink-1 whitespace-nowrap">
              ★ {num(store.rating).toFixed(1)} <span className="text-ink-3 font-normal">({store.review_count})</span>
            </span>
          )}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2 mt-2">
          <span>⏱ {service === 'pickup' ? store.prep_min : store.eta_min}′</span>
          {service === 'delivery' && priced && store.delivers && (
            <>
              <span className="text-ink-4">·</span>
              {fee === 0
                ? <span className="text-success font-semibold">✓ {t('market.free')}</span>
                : <span>{t('market.fee', { fee: money(fee, lang) })}</span>}
              {num(store.min_order) > 0 && (
                <>
                  <span className="text-ink-4">·</span>
                  <span>{t('market.min', { min: money(store.min_order, lang) })}</span>
                </>
              )}
            </>
          )}
          {service === 'delivery' && !store.supports_delivery && (
            <span className="badge badge-gray">{t('market.takeawayOnly')}</span>
          )}
          {service === 'pickup' && <span className="text-ink-3">· 🥡 {store.address}</span>}
        </p>
      </div>
    </button>
  )
}
