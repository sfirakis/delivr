import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMarketAreas, getMarketStores, type MarketStore } from '@/lib/api'
import { foldMatch } from '@/lib/format'
import { useI18n, LangToggle } from '@/lib/i18n'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { CartBar } from '@/guest/CartWidgets'
import { Skeleton, EmptyState } from '@/components/ui'
import DelivrLogo from '@/components/brand/DelivrLogo'
import MarketStoreCard, { CATEGORY_EMOJI, categoryLabel } from './MarketStoreCard'
import { listMyOrders } from './myOrders'

/**
 * Delivr Stores — the open marketplace home (product line A).
 *
 * The customer picks their area, chooses delivery or take away, and sees
 * every participating store that serves them, priced by that store's zone.
 * Ordering continues on /stores/<slug> — the same server-priced flow as a
 * store's own link, with no account needed.
 *
 * Product line B (Delivr QR) never comes through here: guests land on
 * /qr/<code> straight from the QR in their room.
 */
export default function MarketHomePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { address, setAddress, service, setService, count, subtotal, storeSlug } = useGuestCart()
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  const area = address.area.trim()
  const areasQ = useQuery({ queryKey: ['market-areas'], queryFn: getMarketAreas })
  const storesQ = useQuery({
    queryKey: ['market-stores', area, address.city],
    queryFn: () => getMarketStores(area ? { area, city: address.city } : null),
  })

  const areas = areasQ.data ?? []
  const all = useMemo(() => storesQ.data ?? [], [storesQ.data])

  // Delivery tab: stores that deliver here. Take away tab: stores near enough
  // to pick up from. Before an area is picked: everything that offers the service.
  const forService = useMemo(() => all.filter(s =>
    service === 'delivery'
      ? (s.delivers ?? s.supports_delivery)
      : (s.pickup ?? s.supports_takeaway)), [all, service])

  const categories = useMemo(
    () => Array.from(new Set(forService.map(s => s.category))).sort(),
    [forService])

  const shown = useMemo(() => {
    const q = search.trim()
    const list = forService.filter(s =>
      (category === 'all' || s.category === category) &&
      (!q || foldMatch(s.name, q) || s.name.toLowerCase().includes(q.toLowerCase())
          || (s.cuisine_tags ?? []).some(tag => tag.toLowerCase().includes(q.toLowerCase()))
          || categoryLabel(t, s.category).toLowerCase().includes(q.toLowerCase())))
    // Open first; the server already put promoted and better-rated stores first.
    return [...list].sort((a, b) => Number(b.is_open_now) - Number(a.is_open_now))
  }, [forService, category, search, t])

  const myOrders = listMyOrders()
  const cartCount = count()

  const pickArea = (value: string) => {
    const a = areas.find(x => x.area === value)
    setAddress({ ...address, area: value, city: a?.city ?? '', postal_code: '' })
    setCategory('all')
  }

  const open = (s: MarketStore) => navigate(`/stores/${s.slug}`)

  return (
    <div className="h-full flex flex-col bg-surface-2">
      {/* ── Header ── */}
      <div className="bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <DelivrLogo variant="full" size="sm" />
          <div className="flex items-center gap-1">
            {myOrders.length > 0 && (
              <Link to="/orders" className="btn-icon" aria-label={t('market.myOrders')} title={t('market.myOrders')}>🧾</Link>
            )}
            <LangToggle />
          </div>
        </div>

        {!area && (
          <div className="px-4 pt-3">
            <h1 className="font-display font-black text-[22px] leading-tight">{t('market.hero')}</h1>
            <p className="text-xs text-ink-2 mt-1">{t('market.heroSub')}</p>
          </div>
        )}

        {/* Area */}
        <div className="px-4 pt-3">
          <label className="input-label" htmlFor="market-area">📍 {t('market.where')}</label>
          <div className="input-wrapper">
            <select id="market-area" className="input-field font-semibold bg-transparent" value={area}
                    onChange={e => pickArea(e.target.value)}>
              <option value="">{t('market.wherePh')}</option>
              {areas.map(a => (
                <option key={a.area} value={a.area}>
                  {a.area}{a.city && !foldMatch(a.city, a.area) ? ` — ${a.city}` : ''} ({a.stores})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Delivery / take away */}
        <div className="flex gap-2 px-4 pt-3" role="tablist">
          {(['delivery', 'pickup'] as const).map(s => (
            <button key={s} role="tab" aria-selected={service === s}
                    onClick={() => setService(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition
                      ${service === s ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}>
              {s === 'delivery' ? `🛵 ${t('guest.delivery')}` : `🥡 ${t('guest.takeaway')}`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="input-wrapper">
            <span className="text-ink-3" aria-hidden="true">🔍</span>
            <input id="market-search" className="input-field" placeholder={t('market.search')}
                   value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} className="text-ink-3 text-sm px-1" aria-label="✕">✕</button>}
          </div>
        </div>

        {/* Categories — only the ones that actually have stores here */}
        {categories.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            <button className={`chip ${category === 'all' ? 'chip-active' : ''}`} onClick={() => setCategory('all')}>
              {t('market.all')}
            </button>
            {categories.map(c => (
              <button key={c} className={`chip whitespace-nowrap ${category === c ? 'chip-active' : ''}`}
                      onClick={() => setCategory(c)}>
                {CATEGORY_EMOJI[c] ?? '🏪'} {categoryLabel(t, c)}
              </button>
            ))}
          </div>
        ) : <div className="h-3" />}
      </div>

      {/* ── Stores ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <h2 className="font-display font-bold text-base">
            {area ? t('market.storesIn', { area }) : t('market.storesAll')}
          </h2>
          {!area && <p className="text-xs text-ink-3 mt-0.5">{t('market.pickAreaHint')}</p>}
        </div>

        {storesQ.isLoading && [1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden border border-surface-4 bg-surface-1">
            <Skeleton className="h-28 rounded-none" />
            <div className="p-3.5 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
          </div>
        ))}

        {!storesQ.isLoading && shown.length === 0 && (
          <div className="bg-surface-1 rounded-2xl border border-surface-4">
            <EmptyState
              emoji="🛵"
              title={all.length === 0 ? t('market.none') : t('market.noneService', {
                service: service === 'delivery' ? t('guest.delivery') : t('guest.takeaway') })}
              subtitle={all.length === 0 ? t('market.noneHint') : undefined}
              action={all.length === 0 ? t('market.forShopsCta') : undefined}
              onAction={all.length === 0 ? () => navigate('/join') : undefined}
            />
          </div>
        )}

        {shown.map(s => (
          <MarketStoreCard key={s.id} store={s} service={service} onOpen={() => open(s)} />
        ))}

        {/* ── Two product lines, one platform ── */}
        <div className="grid gap-3 pt-2">
          <Link to="/join" className="block rounded-2xl bg-ink-1 text-white p-4">
            <p className="font-display font-bold text-base">🏪 {t('market.forShops')}</p>
            <p className="text-xs text-white/70 mt-1">{t('market.forShopsSub')}</p>
            <span className="inline-block mt-3 text-sm font-semibold text-brand">{t('market.forShopsCta')} →</span>
          </Link>
          <Link to="/qr" className="block rounded-2xl bg-surface-1 border border-surface-4 p-4">
            <p className="font-display font-bold text-base">🔑 {t('market.forStays')}</p>
            <p className="text-xs text-ink-2 mt-1">{t('market.forStaysSub')}</p>
            <span className="inline-block mt-3 text-sm font-semibold text-brand">{t('market.forStaysCta')} →</span>
          </Link>
        </div>

        <p className="text-center text-[11px] text-ink-3">📱 {t('market.inStay')}</p>

        <div className="flex justify-center gap-4 pb-2">
          <Link to="/auth" className="text-[11px] text-ink-3 underline underline-offset-4 min-h-[44px] inline-flex items-center">
            {t('market.partner')}
          </Link>
          <Link to="/terms" className="text-[11px] text-ink-3 min-h-[44px] inline-flex items-center">
            {t('terms.link')}
          </Link>
        </div>
      </div>

      {/* A cart started in a marketplace store follows the customer home. */}
      {cartCount > 0 && storeSlug && (
        <CartBar count={cartCount} total={cartTotals(subtotal(), undefined, service).total}
                 onOpen={() => navigate(`/stores/${storeSlug}/cart`)} />
      )}
    </div>
  )
}
