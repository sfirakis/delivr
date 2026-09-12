import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import type { Store, MenuItem, MenuCategory, Order, Review, PromoCode, StoreCategory } from '@/types'

// ─── Query keys ─────────────────────────────────────────────
export const QK = {
  stores:       (filters?: object) => ['stores', filters],
  store:        (id: string)       => ['store', id],
  menu:         (storeId: string)  => ['menu', storeId],
  orders:       (userId: string)   => ['orders', userId],
  order:        (id: string)       => ['order', id],
  profile:      (userId: string)   => ['profile', userId],
  addresses:    (userId: string)   => ['addresses', userId],
  favorites:    (userId: string)   => ['favorites', userId],
  notifications:(userId: string)   => ['notifications', userId],
  promoCode:    (code: string)     => ['promo', code],
}

// ─── Stores ──────────────────────────────────────────────────
interface StoreFilters {
  category?: StoreCategory
  search?: string
  city?: string
}

export function useStores(filters: StoreFilters = {}) {
  return useQuery({
    queryKey: QK.stores(filters),
    queryFn: async () => {
      let q = supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('is_promoted', { ascending: false })
        .order('rating', { ascending: false })

      if (filters.category) q = q.eq('category', filters.category)
      if (filters.city)     q = q.eq('city', filters.city)
      if (filters.search) {
        q = q.or(
          `name.ilike.%${filters.search}%,cuisine_tags.cs.{${filters.search}}`
        )
      }

      const { data, error } = await q
      if (error) throw error
      return data as Store[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useStore(storeId: string) {
  return useQuery({
    queryKey: QK.store(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single()
      if (error) throw error
      return data as Store
    },
    enabled: !!storeId,
  })
}

// ─── Menu ────────────────────────────────────────────────────
export function useStoreMenu(storeId: string) {
  return useQuery({
    queryKey: QK.menu(storeId),
    queryFn: async () => {
      const [{ data: categories }, { data: items }] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select(`
            *,
            modifier_groups:item_modifier_groups(
              *,
              modifiers:item_modifiers(* )
            )
          `)
          .eq('store_id', storeId)
          .eq('is_available', true)
          .order('sort_order'),
      ])
      return {
        categories: (categories ?? []) as MenuCategory[],
        items: (items ?? []) as MenuItem[],
      }
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 10,
  })
}

// ─── Orders ──────────────────────────────────────────────────
export function useOrders(userId: string) {
  return useQuery({
    queryKey: QK.orders(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          store:stores(id, name, logo_url, emoji),
          order_items(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Order[]
    },
    enabled: !!userId,
  })
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: QK.order(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          store:stores(*),
          order_items(*)
        `)
        .eq('id', orderId)
        .single()
      if (error) throw error
      return data as Order
    },
    enabled: !!orderId,
  })
}

// Real-time order tracking
export function useOrderRealtime(orderId: string, onUpdate?: (order: Order) => void) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as Order
          qc.setQueryData(QK.order(orderId), updated)
          onUpdate?.(updated)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, qc, onUpdate])
}

// Order creation lives server-side: the guest flow calls the delivr_place_order
// RPC (see src/lib/api.ts). Clients have no INSERT rights on orders/order_items,
// so the old direct-insert useCreateOrder hook could only ever fail.

// ─── Favorites ───────────────────────────────────────────────
export function useFavorites(userId: string) {
  return useQuery({
    queryKey: QK.favorites(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('store_id, stores(*)')
        .eq('user_id', userId)
      if (error) throw error
      return data?.map((f) => f.stores) as unknown as Store[]
    },
    enabled: !!userId,
  })
}

export function useToggleFavorite(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, isFav }: { storeId: string; isFav: boolean }) => {
      if (isFav) {
        await supabase.from('favorites').delete().match({ user_id: userId, store_id: storeId })
      } else {
        await supabase.from('favorites').insert({ user_id: userId, store_id: storeId })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.favorites(userId) }),
  })
}

// ─── Promo Codes ─────────────────────────────────────────────
export function useValidatePromo(code: string, orderTotal: number) {
  return useQuery({
    queryKey: QK.promoCode(code),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !data) throw new Error('Μη έγκυρος κωδικός')

      const promo = data as PromoCode
      if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
        throw new Error('Ο κωδικός έχει λήξει')
      }
      if (orderTotal < (promo.min_order ?? 0)) {
        throw new Error(`Ελάχιστη παραγγελία ${promo.min_order}€ για αυτόν τον κωδικό`)
      }

      const discount =
        promo.discount_type === 'percentage'
          ? Math.min(orderTotal * (promo.discount_value / 100), promo.max_discount ?? Infinity)
          : promo.discount_value

      return { promo, discount: Math.round(discount * 100) / 100 }
    },
    enabled: code.length >= 3,
    retry: false,
  })
}

// ─── Addresses ───────────────────────────────────────────────
export function useAddresses(userId: string) {
  return useQuery({
    queryKey: QK.addresses(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

// ─── Reviews ─────────────────────────────────────────────────
export function useStoreReviews(storeId: string) {
  return useQuery({
    queryKey: ['reviews', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profile:profiles(full_name, avatar_url)')
        .eq('store_id', storeId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as Review[]
    },
    enabled: !!storeId,
  })
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (review: {
      order_id: string
      user_id: string
      store_id: string
      food_rating: number
      delivery_rating?: number
      comment?: string
    }) => {
      const { error } = await supabase.from('reviews').insert(review)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['reviews', vars.store_id] })
      qc.invalidateQueries({ queryKey: QK.store(vars.store_id) })
    },
  })
}
