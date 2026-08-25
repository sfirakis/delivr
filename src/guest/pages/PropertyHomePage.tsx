import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPropertyByCode, getStoresForProperty, logScan, type MatchedStore, type ServiceType } from '@/lib/api'
import { money, num, fullAddress } from '@/lib/format'
import { useI18n, LangToggle } from '@/lib/i18n'
import { useGuestCart } from '@/guest/guestCart'
import { Spinner, EmptyState, StarRating } from '@/components/ui'

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽️', cafe: '☕', burger: '🍔', pizza: '🍕', sushi: '🍣',
  healthy: '🥗', supermarket: '🛒', pharmacy: '💊', other: '🏪',
}

function StoreRow({ store, service, onOpen }: { store: MatchedStore; service: ServiceType; onOpen: () => void }) {
  const { t, lang } = useI18n()
  const closed = !store.is_open_now
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-surface-1 border border-surface-4 rounded-2xl p-3 flex gap-3
        transition active:scale-[0.99] ${closed ? 'opacity-60' : ''}`}
    >
      <div className="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
        {store.logo_url
          ? <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
          : (CATEGORY_EMOJI[store.category] ?? '🏪')}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display font-bold text-[15px] text-ink-1 truncate">{store.store_name}</p>
          {store.is_promoted && <span className="badge badge-brand flex-shrink-0">★</span>}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {store.rating > 0 && <StarRating rating={num(store.rating)} count={store.review_count} />}
          {store.dist_km !== null && (
            <span className="text-[11px] text-ink-3">· {num(store.dist_km).toFixed(1)} km</span>
          )}
        </div>

        <p className="text-[11px] text-ink-3 truncate mt-0.5">
          {(store.cuisine_tags ?? []).slice(0, 3).join(' · ') || store.description}
        </p>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="badge badge-gray">⏱ {store.eta_min}′</span>
          {service === 'delivery' ? (
            <span className="badge badge-gray">
              🛵 {num(store.delivery_fee) === 0 ? t('common.free') : money(store.delivery_fee, lang)}
            </span>
          ) : (
            num(store.pickup_discount_pct) > 0 && (
              <span className="badge badge-green">−{num(store.pickup_discount_pct)}%</span>
            )
          )}
          {num(store.min_order) > 0 && (
            <span className="badge badge-gray">min {money(store.min_order, lang)}</span>
          )}
          {closed && <span className="badge bg-red-100 text-danger">{t('guest.closed')}</span>}
        </div>
      </div>
    </button>
  )
}

export default function PropertyHomePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { t, setLang } = useI18n()
  const { service, setService, setContext, count } = useGuestCart()
  const [search, setSearch] = useState('')

  const propertyQ = useQuery({
    queryKey: ['property', code],
    queryFn: () => getPropertyByCode(code),
    retry: false,
  })

  const storesQ = useQuery({
    queryKey: ['stores-for-property', code, service],
    queryFn: () => getStoresForProperty(code, service),
    enabled: !!propertyQ.data,
  })

  // Adopt the property's preferred language the first time we land here.
  useEffect(() => {
    if (!propertyQ.data) return
    setContext(code, service)
    logScan(code)
    const saved = (() => { try { return localStorage.getItem('delivr_lang') } catch { return null } })()
    if (!saved && (propertyQ.data.default_language === 'el' || propertyQ.data.default_language === 'en')) {
      setLang(propertyQ.data.default_language)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyQ.data, code])

  const filtered = useMemo(() => {
    const list = storesQ.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(s =>
      s.store_name.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      (s.cuisine_tags ?? []).some(tag => tag.toLowerCase().includes(q)))
  }, [storesQ.data, search])

  if (propertyQ.isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }

  if (propertyQ.isError) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <EmptyState emoji="🔍" title={t('guest.propertyNotFound')} subtitle={code} />
      </div>
    )
  }

  const property = propertyQ.data!
  const cartCount = count()

  return (
    <div className="h-full flex flex-col bg-surface-2">
      {/* Header */}
      <div className="bg-surface-1 px-5 pt-5 pb-3 border-b border-surface-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold">
              {t('guest.deliverTo')}
            </p>
            <p className="font-display font-black text-lg text-ink-1 truncate">{property.name}</p>
            <p className="text-xs text-ink-2 truncate">
              📍 {fullAddress(property.address, property.area, property.city)}
            </p>
          </div>
          <LangToggle className="flex-shrink-0 mt-1" />
        </div>

        {property.welcome_message && (
          <p className="text-xs text-ink-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 mt-3">
            {property.welcome_message}
          </p>
        )}

        {/* Service tabs */}
        <div className="flex gap-2 mt-3">
          {(['delivery', 'pickup'] as ServiceType[]).map(s => (
            <button
              key={s}
              onClick={() => setService(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border
                ${service === s
                  ? 'bg-ink-1 text-white border-ink-1'
                  : 'bg-surface-1 text-ink-2 border-surface-4'}`}
            >
              {s === 'delivery' ? `🏠 ${t('guest.delivery')}` : `🥡 ${t('guest.takeaway')}`}
            </button>
          ))}
        </div>

        <input
          className="input-field mt-3"
          placeholder={t('guest.searchStores')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Store list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
        {storesQ.isLoading && (
          <div className="py-10 flex justify-center"><Spinner size={28} /></div>
        )}

        {!storesQ.isLoading && filtered.length === 0 && (
          <EmptyState emoji="🛵" title={t('guest.noStores')} subtitle={t('guest.noStoresHint')} />
        )}

        {filtered.map(store => (
          <StoreRow
            key={store.store_id}
            store={store}
            service={service}
            onOpen={() => navigate(`/qr/${code}/store/${store.store_id}`)}
          />
        ))}

        <p className="text-center text-[10px] text-ink-3 pt-4 pb-2">
          {t('guest.poweredBy')} <span className="font-bold">Delivr</span>
        </p>
      </div>

      {/* Persistent cart bar */}
      {cartCount > 0 && (
        <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
          <button className="btn btn-primary btn-lg w-full" onClick={() => navigate(`/qr/${code}/cart`)}>
            🛒 {t('cart.title')} · {cartCount}
          </button>
        </div>
      )}
    </div>
  )
}
