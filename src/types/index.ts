// ============================================================
// Core domain types — mirrors the Supabase schema
// ============================================================

export type StoreCategory =
  | 'restaurant' | 'cafe' | 'burger' | 'pizza' | 'sushi'
  | 'healthy' | 'supermarket' | 'pharmacy' | 'other'

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready'
  | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled'

export type DeliveryType = 'delivery' | 'pickup'
export type PaymentMethod = 'card' | 'cash' | 'apple_pay' | 'google_pay' | 'wallet'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed'

// ─── Profile ────────────────────────────────────────────────
export type UserRole = 'customer' | 'store' | 'driver' | 'admin'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: UserRole
  avatar_url: string | null
  loyalty_points: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Address ────────────────────────────────────────────────
export interface Address {
  id: string
  user_id: string
  label: string
  street: string
  city: string
  postal_code: string | null
  floor: string | null
  doorbell: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  is_default: boolean
  created_at: string
}

// ─── Store ──────────────────────────────────────────────────
export interface Store {
  id: string
  name: string
  slug: string
  description: string | null
  category: StoreCategory
  cuisine_tags: string[]
  logo_url: string | null
  cover_url: string | null
  address: string
  city: string
  lat: number
  lng: number
  phone: string | null
  email: string | null
  delivery_fee: number
  free_delivery_above: number | null
  min_order_amount: number
  avg_delivery_time: number
  delivery_radius_km: number
  is_open: boolean
  is_active: boolean
  is_promoted: boolean
  discount_pct: number | null
  rating: number
  review_count: number
  created_at: string
  updated_at: string
  // UI helper (not in DB)
  emoji?: string
}

// ─── Menu ───────────────────────────────────────────────────
export interface MenuCategory {
  id: string
  store_id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface MenuItem {
  id: string
  store_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  emoji: string | null
  is_available: boolean
  is_popular: boolean
  is_new: boolean
  is_vegan: boolean
  is_vegetarian: boolean
  is_gluten_free: boolean
  is_weight_based: boolean
  unit: string
  allergens: string[]
  calories: number | null
  sort_order: number
  // Joined
  category?: MenuCategory
  modifier_groups?: ModifierGroup[]
}

export interface ModifierGroup {
  id: string
  item_id: string
  name: string
  is_required: boolean
  min_select: number
  max_select: number
  sort_order: number
  modifiers: Modifier[]
}

export interface Modifier {
  id: string
  group_id: string
  name: string
  price: number
  is_default: boolean
  sort_order: number
}

// ─── Cart ───────────────────────────────────────────────────
export interface CartItem {
  menuItem: MenuItem
  quantity: number
  selectedModifiers: Modifier[]
  notes?: string
  // computed
  lineTotal: number
}

export interface Cart {
  storeId: string | null
  storeName: string | null
  items: CartItem[]
}

// ─── Order ──────────────────────────────────────────────────
export interface Order {
  id: string
  user_id: string
  store_id: string
  delivery_type: DeliveryType
  delivery_address: Address | null
  delivery_notes: string | null
  status: OrderStatus
  estimated_ready_at: string | null
  estimated_delivery_at: string | null
  confirmed_at: string | null
  prepared_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  subtotal: number
  delivery_fee: number
  discount_amount: number
  tip_amount: number
  total: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  promo_code: string | null
  driver_id: string | null
  driver_location: { lat: number; lng: number; updated_at: string } | null
  points_earned: number
  points_used: number
  customer_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  store?: Store
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  modifiers: { name: string; price: number }[]
  notes: string | null
  subtotal: number
}

// ─── Review ─────────────────────────────────────────────────
export interface Review {
  id: string
  order_id: string
  user_id: string
  store_id: string
  driver_id: string | null
  food_rating: number | null
  delivery_rating: number | null
  comment: string | null
  photos: string[]
  is_visible: boolean
  created_at: string
  // Joined
  profile?: { full_name: string; avatar_url: string | null }
}

// ─── Promo ──────────────────────────────────────────────────
export interface PromoCode {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_order: number
  max_discount: number | null
  is_active: boolean
  valid_until: string | null
  store_id: string | null
}

// ─── Notification ───────────────────────────────────────────
export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: 'order_update' | 'promo' | 'loyalty' | 'system'
  data: Record<string, unknown>
  is_read: boolean
  created_at: string
}

// ─── Supabase Database type (for createClient generic) ──────
type TableDef<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles:        TableDef<Profile>
      addresses:       TableDef<Address>
      stores:          TableDef<Store>
      menu_categories: TableDef<MenuCategory>
      menu_items:      TableDef<MenuItem>
      orders:          TableDef<Order>
      order_items:     TableDef<OrderItem>
      reviews:         TableDef<Review>
      notifications:   TableDef<Notification>
      favorites:       TableDef<{ id: string; user_id: string; store_id: string; created_at: string }>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
