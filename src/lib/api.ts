import { supabase } from './supabase'

// ============================================================
// Types returned by the delivr_* RPCs
// ============================================================

export type ServiceType = 'delivery' | 'pickup'

export interface PublicSettings {
  platform_name: string
  currency: string
  timezone: string
  brand_color: string
  logo_url: string | null
  support_phone: string | null
  support_email: string | null
  support_whatsapp: string | null
  terms_url: string | null
  allow_cash: boolean
  allow_online_payment: boolean
  allow_scheduled_orders: boolean
  guest_requires_phone: boolean
  guest_requires_email: boolean
  default_prep_time: number
}

export interface PublicProperty {
  id: string
  code: string
  name: string
  type: string
  address: string
  city: string | null
  area: string | null
  postal_code: string | null
  lat: number | null
  lng: number | null
  floor: string | null
  doorbell: string | null
  access_notes: string | null
  welcome_message: string | null
  cover_url: string | null
  default_language: string
}

export interface MatchedStore {
  store_id: string
  store_name: string
  slug: string
  description: string | null
  category: string
  cuisine_tags: string[] | null
  logo_url: string | null
  cover_url: string | null
  store_address: string
  store_city: string | null
  store_phone: string | null
  rating: number
  review_count: number
  is_promoted: boolean
  discount_pct: number | null
  pickup_discount_pct: number
  delivery_fee: number
  min_order: number
  free_above: number | null
  eta_min: number
  dist_km: number | null
  match_type: 'zone' | 'radius' | 'pickup' | 'none'
  is_open_now: boolean
  supports_delivery: boolean
  supports_takeaway: boolean
  accepts_cash: boolean
}

export interface PlaceOrderItem {
  menu_item_id: string
  quantity: number
  modifier_ids?: string[]
  notes?: string | null
}

export interface PlacedOrder {
  ok: true
  order_id: string
  order_number: string
  public_token: string
  status: string
  service: ServiceType
  subtotal: number
  discount: number
  delivery_fee: number
  total: number
  eta_min: number
  currency: string
  payment_method: string
  items: { name: string; quantity: number; price: number; modifiers: { name: string; price: number }[]; notes: string | null; subtotal: number }[]
  store: { id: string; name: string; phone: string | null; address: string; whatsapp: string | null; notify_whatsapp: boolean; notify_email: boolean }
  property: { id: string; code: string; name: string; address: string; area: string | null; city: string | null; floor: string | null; doorbell: string | null } | null
}

export interface OrderEvent { status: string; actor: string; note: string | null; at: string }

export interface GuestOrderStatus {
  order_number: string
  status: string
  service: ServiceType
  created_at: string
  confirmed_at: string | null
  prepared_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  estimated_ready_at: string | null
  estimated_delivery_at: string | null
  scheduled_for: string | null
  prep_minutes: number | null
  subtotal: number
  discount_amount: number
  delivery_fee: number
  total: number
  payment_method: string
  payment_status: string
  guest_name: string | null
  delivery_address: Record<string, unknown> | null
  customer_notes: string | null
  store: { id: string; name: string; phone: string | null; address: string; logo_url: string | null }
  items: { name: string; quantity: number; price: number; modifiers: { name: string; price: number }[]; notes: string | null; subtotal: number }[]
  events: OrderEvent[]
}

export interface StoreOrderView extends Omit<GuestOrderStatus, 'guest_name' | 'delivery_address'> {
  order_id: string
  channel: string
  platform_fee: number
  promo_code: string | null
  delivery_notes: string | null
  printed_at: string | null
  guest: { name: string | null; phone: string | null; email: string | null }
  address: Record<string, unknown> | null
  property: {
    name: string; code: string; address: string; area: string | null; city: string | null
    floor: string | null; doorbell: string | null; access_notes: string | null
    lat: number | null; lng: number | null
  } | null
  store: { id: string; name: string; phone: string | null; address: string; logo_url: string | null; print_format: string; prep_time_min: number }
  settings: { currency: string; platform_name: string; support_phone: string | null }
}

// ============================================================
// Error handling — maps Postgres exceptions to i18n keys
// ============================================================

export class ApiError extends Error {
  code: string
  detail?: string
  constructor(code: string, detail?: string) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

const KNOWN_CODES = [
  'STORE_CLOSED', 'OUT_OF_RANGE', 'MIN_ORDER', 'EMPTY_CART', 'NAME_REQUIRED',
  'PHONE_REQUIRED', 'EMAIL_REQUIRED', 'ITEM_UNAVAILABLE', 'RATE_LIMIT',
  'PROPERTY_NOT_FOUND', 'STORE_NOT_FOUND', 'ORDER_NOT_FOUND', 'ORDER_CLOSED',
  'STORE_NO_CASH', 'CASH_DISABLED', 'ONLINE_PAYMENT_DISABLED', 'BAD_SERVICE',
  'BAD_ACTION', 'PROPERTY_REQUIRED', 'SCHEDULING_DISABLED',
  'PROMO_INVALID', 'PROMO_EXPIRED', 'PROMO_MIN_ORDER', 'PROMO_LIMIT',
]

function toApiError(error: { message?: string } | null): ApiError {
  const msg = error?.message ?? ''
  for (const code of KNOWN_CODES) {
    if (msg.includes(code)) {
      const detail = msg.split(`${code}:`)[1]?.trim()
      return new ApiError(code, detail)
    }
  }
  return new ApiError('generic', msg)
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toApiError(error)
  return data as T
}

// ============================================================
// Public (no auth) API
// ============================================================

export const getPublicSettings = () => rpc<PublicSettings>('delivr_public_settings')

export const getPropertyByCode = (code: string) =>
  rpc<PublicProperty>('delivr_property_by_code', { p_code: code })

export const getStoresForProperty = (code: string, service: ServiceType) =>
  rpc<MatchedStore[]>('delivr_stores_for_property', { p_code: code, p_service: service })

export const logScan = (code: string) =>
  rpc<void>('delivr_log_scan', {
    p_code: code,
    p_user_agent: navigator.userAgent.slice(0, 400),
    p_referrer: document.referrer.slice(0, 400) || null,
    p_language: navigator.language,
  }).catch(() => { /* analytics must never block the guest */ })

export const placeOrder = (input: {
  code: string | null
  storeId: string
  service: ServiceType
  items: PlaceOrderItem[]
  guest: { name: string; phone: string; email?: string | null; notes?: string | null; delivery_notes?: string | null }
  promo?: string | null
  scheduledFor?: string | null
  payment?: string
  channel?: string
}) => rpc<PlacedOrder>('delivr_place_order', {
  p_code: input.code,
  p_store_id: input.storeId,
  p_service: input.service,
  p_items: input.items,
  p_guest: input.guest,
  p_promo: input.promo ?? null,
  p_scheduled: input.scheduledFor ?? null,
  p_payment: input.payment ?? 'cash',
  p_channel: input.channel ?? 'qr',
})

export const getOrderStatus = (token: string) =>
  rpc<GuestOrderStatus>('delivr_order_status', { p_token: token })

export const getStoreOrder = (token: string) =>
  rpc<StoreOrderView>('delivr_store_order', { p_token: token })

export const storeAction = (token: string, action: string, prepMinutes?: number, reason?: string) =>
  rpc<{ ok: boolean; status: string; prep_minutes: number | null }>('delivr_store_action', {
    p_token: token, p_action: action,
    p_prep_minutes: prepMinutes ?? null, p_reason: reason ?? null,
  })

// ============================================================
// Store menu (public read via RLS)
// ============================================================

export interface PublicMenuItem {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  emoji: string | null
  is_available: boolean
  is_popular: boolean
  is_vegan: boolean
  is_vegetarian: boolean
  is_gluten_free: boolean
  allergens: string[] | null
  sort_order: number
  modifier_groups?: {
    id: string; name: string; is_required: boolean; min_select: number; max_select: number
    modifiers: { id: string; name: string; price: number; is_default: boolean }[]
  }[]
}

/** Row shape as PostgREST returns it — embedded resources keep their table names. */
interface MenuItemRow extends Omit<PublicMenuItem, 'modifier_groups'> {
  item_modifier_groups?: {
    id: string; name: string; is_required: boolean; min_select: number; max_select: number; sort_order: number
    item_modifiers: { id: string; name: string; price: number; is_default: boolean; sort_order: number }[]
  }[]
}

const bySortOrder = (a: { sort_order?: number }, b: { sort_order?: number }) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0)

export async function getStoreMenu(storeId: string) {
  const [{ data: cats, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    supabase.from('menu_categories').select('id,name,description,sort_order')
      .eq('store_id', storeId).eq('is_active', true).order('sort_order'),
    supabase.from('menu_items')
      .select('*, item_modifier_groups(id,name,is_required,min_select,max_select,sort_order, item_modifiers(id,name,price,is_default,sort_order))')
      .eq('store_id', storeId)
      // A guest must never be offered something the kitchen has switched off.
      .eq('is_available', true)
      .order('sort_order')
      // Modifier groups and their options carry their own order — without these
      // the embedded rows come back in whatever order Postgres happens to pick.
      .order('sort_order', { referencedTable: 'item_modifier_groups', ascending: true })
      .order('sort_order', { referencedTable: 'item_modifier_groups.item_modifiers', ascending: true }),
  ])
  if (e1) throw toApiError(e1)
  if (e2) throw toApiError(e2)

  // Re-shape to the names the UI uses, and keep the sort as a client-side guarantee.
  const mapped: PublicMenuItem[] = ((items ?? []) as MenuItemRow[]).map(row => {
    const { item_modifier_groups, ...item } = row
    return {
      ...item,
      modifier_groups: [...(item_modifier_groups ?? [])].sort(bySortOrder).map(g => ({
        id: g.id,
        name: g.name,
        is_required: g.is_required,
        min_select: g.min_select,
        max_select: g.max_select,
        modifiers: [...(g.item_modifiers ?? [])].sort(bySortOrder),
      })),
    }
  })

  return {
    categories: (cats ?? []) as { id: string; name: string; description: string | null; sort_order: number }[],
    items: mapped,
  }
}

/** Fire the notification edge function; never throws — dispatch is best-effort. */
export async function notifyOrder(orderId: string, publicToken: string, lang = 'el') {
  try {
    const { data, error } = await supabase.functions.invoke('notify-order', {
      body: { order_id: orderId, public_token: publicToken, lang },
    })
    if (error) return { ok: false as const, error: error.message }
    return { ok: true as const, ...(data as Record<string, unknown>) }
  } catch (err) {
    return { ok: false as const, error: (err as Error).message }
  }
}
