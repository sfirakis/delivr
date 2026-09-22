import { useQuery } from '@tanstack/react-query'
import { getStoreBySlug, type MatchedStore, type StandaloneStore, type StoreZone } from '@/lib/api'
import { foldMatch } from '@/lib/format'
import { useGuestCart } from '@/guest/guestCart'

/** The store behind /store/:slug, or an ApiError the page can show. */
export function useShopStore(slug: string) {
  return useQuery({
    queryKey: ['shop-store', slug],
    queryFn: () => getStoreBySlug(slug),
    retry: false,
  })
}

/** The zone whose area (or postcode) matches what the customer picked or typed. */
export function findZone(store: StandaloneStore | undefined, area: string, postal: string): StoreZone | undefined {
  if (!store) return undefined
  const cleanPostal = postal.replace(/\s/g, '')
  return store.zones.find(z =>
    (z.area && area && foldMatch(z.area, area)) ||
    (z.postal_code && cleanPostal && z.postal_code.replace(/\s/g, '') === cleanPostal))
}

/**
 * The pricing side of a store, in the shape the cart already understands.
 * A zone overrides the store's own fee, minimum and free-delivery threshold —
 * which is why the area has to be chosen before the totals mean anything.
 */
export function asMatchedStore(store: StandaloneStore, zone: StoreZone | undefined): MatchedStore {
  return {
    store_id: store.id,
    store_name: store.name,
    slug: store.slug,
    description: store.description,
    category: store.category,
    cuisine_tags: store.cuisine_tags,
    logo_url: store.logo_url,
    cover_url: store.cover_url,
    store_address: store.address,
    store_city: store.city,
    store_phone: store.phone,
    rating: store.rating,
    review_count: store.review_count,
    is_promoted: false,
    discount_pct: store.discount_pct,
    pickup_discount_pct: store.pickup_discount_pct,
    delivery_fee: zone ? zone.fee : store.delivery_fee,
    min_order: zone ? zone.min_order : store.min_order,
    free_above: zone ? zone.free_above : store.free_above,
    eta_min: store.eta_min + (zone?.extra_min ?? 0),
    dist_km: null,
    match_type: zone ? 'zone' : 'radius',
    is_open_now: store.is_open_now,
    supports_delivery: store.supports_delivery,
    supports_takeaway: store.supports_takeaway,
    accepts_cash: store.accepts_cash,
  }
}

/** Everything a shop page needs: the store, the chosen zone and the priced view. */
export function useShop(slug: string) {
  const storeQ = useShopStore(slug)
  const { address, service } = useGuestCart()
  const store = storeQ.data
  const zone = findZone(store, address.area, address.postal_code)
  const priced = store ? asMatchedStore(store, service === 'delivery' ? zone : undefined) : undefined

  // With zones drawn, an unmatched area means we cannot price a delivery at all.
  const areaUnserved = !!store && service === 'delivery' && store.zones_required && !zone

  return { storeQ, store, zone, priced, areaUnserved }
}
