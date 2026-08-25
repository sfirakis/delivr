import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ============================================================
// Shared row types for the dashboards
// ============================================================

export interface AdminStore {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  cuisine_tags: string[] | null
  address: string
  city: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  email: string | null
  order_email: string | null
  order_whatsapp: string | null
  notify_email: boolean
  notify_whatsapp: boolean
  delivery_fee: number
  min_order_amount: number
  free_delivery_above: number | null
  avg_delivery_time: number
  delivery_radius_km: number
  pickup_radius_km: number
  pickup_discount_pct: number
  prep_time_min: number
  supports_delivery: boolean
  supports_takeaway: boolean
  accepts_cash: boolean
  accepts_online: boolean
  auto_accept: boolean
  billing_mode: 'inherit' | 'none' | 'flat' | 'commission'
  billing_value: number
  onboarding_status: 'pending' | 'active' | 'suspended'
  is_open: boolean
  is_active: boolean
  is_promoted: boolean
  rating: number
  review_count: number
  notes: string | null
  created_at: string
}

export interface AdminProperty {
  id: string
  code: string
  name: string
  type: string
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  whatsapp: string | null
  address: string
  city: string | null
  area: string | null
  postal_code: string | null
  lat: number | null
  lng: number | null
  floor: string | null
  doorbell: string | null
  access_notes: string | null
  default_language: string
  welcome_message: string | null
  billing_mode: 'inherit' | 'none' | 'flat' | 'commission'
  billing_value: number
  billing_direction: 'inherit' | 'charge' | 'payout'
  external_source: string | null
  external_ref: string | null
  is_active: boolean
  scan_count: number
  created_at: string
}

export interface AdminZone {
  id: string
  store_id: string
  name: string
  area: string | null
  postal_code: string | null
  city: string | null
  delivery_fee: number
  min_order: number
  extra_minutes: number
  free_above: number | null
  is_active: boolean
  sort_order: number
}

export interface AdminOrder {
  id: string
  order_number: string | null
  store_id: string
  property_id: string | null
  status: string
  delivery_type: string
  channel: string
  guest_name: string | null
  guest_phone: string | null
  subtotal: number
  delivery_fee: number
  discount_amount: number
  total: number
  platform_fee: number
  property_fee: number
  payment_method: string
  payment_status: string
  store_token: string | null
  public_token: string | null
  created_at: string
  stores?: { name: string } | null
  properties?: { name: string; code: string } | null
}

export interface AdminCharge {
  id: string
  order_id: string
  party_type: 'store' | 'property'
  party_id: string
  direction: 'charge' | 'payout'
  mode: 'flat' | 'commission'
  rate: number
  base_amount: number
  amount: number
  currency: string
  status: 'pending' | 'invoiced' | 'paid' | 'void'
  created_at: string
  orders?: { order_number: string | null; created_at: string } | null
}

export interface PlatformSettings {
  id: number
  platform_name: string
  currency: string
  timezone: string
  order_prefix: string
  support_phone: string | null
  support_email: string | null
  support_whatsapp: string | null
  brand_color: string
  logo_url: string | null
  terms_url: string | null
  store_billing_mode: 'none' | 'flat' | 'commission'
  store_billing_value: number
  property_billing_mode: 'none' | 'flat' | 'commission'
  property_billing_value: number
  property_billing_direction: 'charge' | 'payout'
  commission_base: 'subtotal' | 'total'
  default_prep_time: number
  guest_requires_phone: boolean
  guest_requires_email: boolean
  allow_cash: boolean
  allow_online_payment: boolean
  allow_scheduled_orders: boolean
  notify_store_email: boolean
  notify_store_whatsapp: boolean
  notify_property_email: boolean
  app_url: string
}

const throwIf = <T,>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// ============================================================
// Stores
// ============================================================

export function useAdminStores() {
  return useQuery({
    queryKey: ['admin-stores'],
    queryFn: async () => throwIf(await supabase.from('stores').select('*').order('name')) as AdminStore[],
  })
}

export function useUpsertStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (store: Partial<AdminStore>) => {
      if (store.id) {
        return throwIf(await supabase.from('stores')
          .update({ ...store, updated_at: new Date().toISOString() })
          .eq('id', store.id).select().single())
      }
      return throwIf(await supabase.from('stores').insert(store).select().single())
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-stores'] }) },
  })
}

export function useDeleteStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stores').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-stores'] }) },
  })
}

// ============================================================
// Zones
// ============================================================

export function useZones(storeId: string | null) {
  return useQuery({
    queryKey: ['admin-zones', storeId],
    queryFn: async () => throwIf(await supabase.from('store_zones').select('*')
      .eq('store_id', storeId!).order('sort_order')) as AdminZone[],
    enabled: !!storeId,
  })
}

export function useUpsertZone(storeId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (zone: Partial<AdminZone>) => {
      if (zone.id) {
        return throwIf(await supabase.from('store_zones').update(zone).eq('id', zone.id).select().single())
      }
      return throwIf(await supabase.from('store_zones').insert({ ...zone, store_id: storeId }).select().single())
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-zones', storeId] }) },
  })
}

export function useDeleteZone(storeId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('store_zones').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-zones', storeId] }) },
  })
}

// ============================================================
// Properties
// ============================================================

export function useAdminProperties() {
  return useQuery({
    queryKey: ['admin-properties'],
    queryFn: async () => throwIf(await supabase.from('properties').select('*').order('name')) as AdminProperty[],
  })
}

export function useUpsertProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (property: Partial<AdminProperty>) => {
      if (property.id) {
        return throwIf(await supabase.from('properties')
          .update({ ...property, updated_at: new Date().toISOString() })
          .eq('id', property.id).select().single())
      }
      return throwIf(await supabase.from('properties').insert(property).select().single())
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-properties'] }) },
  })
}

export function useBulkCreateProperties() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Partial<AdminProperty>[]) =>
      throwIf(await supabase.from('properties').insert(rows).select()) as AdminProperty[],
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-properties'] }) },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-properties'] }) },
  })
}

// ============================================================
// Orders
// ============================================================

export function useAdminOrders(opts: { status?: string; storeId?: string; days?: number } = {}) {
  return useQuery({
    queryKey: ['admin-orders', opts],
    queryFn: async () => {
      let q = supabase.from('orders')
        .select('*, stores(name), properties(name, code)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status)
      if (opts.storeId) q = q.eq('store_id', opts.storeId)
      if (opts.days) {
        const since = new Date(Date.now() - opts.days * 86400000).toISOString()
        q = q.gte('created_at', since)
      }
      return throwIf(await q) as AdminOrder[]
    },
    refetchInterval: 30000,
  })
}

// ============================================================
// Billing
// ============================================================

export function useCharges(opts: { status?: string; party?: string; days?: number } = {}) {
  return useQuery({
    queryKey: ['admin-charges', opts],
    queryFn: async () => {
      let q = supabase.from('order_charges')
        .select('*, orders(order_number, created_at)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status)
      if (opts.party && opts.party !== 'all') q = q.eq('party_type', opts.party)
      if (opts.days) {
        const since = new Date(Date.now() - opts.days * 86400000).toISOString()
        q = q.gte('created_at', since)
      }
      return throwIf(await q) as AdminCharge[]
    },
  })
}

export function useUpdateChargeStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from('order_charges')
        .update({ status, settled_at: status === 'paid' ? new Date().toISOString() : null })
        .in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-charges'] }) },
  })
}

// ============================================================
// Platform settings
// ============================================================

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => throwIf(await supabase.from('platform_settings').select('*').eq('id', 1).single()) as PlatformSettings,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<PlatformSettings>) =>
      throwIf(await supabase.from('platform_settings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', 1).select().single()),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['platform-settings'] }) },
  })
}

// ============================================================
// People
// ============================================================

export interface AdminProfile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  role: 'customer' | 'store' | 'driver' | 'admin'
  is_active: boolean
  created_at: string
}

export function useProfiles(role?: string) {
  return useQuery({
    queryKey: ['admin-profiles', role],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(300)
      if (role && role !== 'all') q = q.eq('role', role)
      return throwIf(await q) as AdminProfile[]
    },
  })
}

export function useUpdateProfileRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-profiles'] }) },
  })
}

export function useStoreUsers(storeId: string | null) {
  return useQuery({
    queryKey: ['store-users', storeId],
    queryFn: async () => throwIf(await supabase.from('store_users')
      .select('*, profiles(full_name, email, phone)').eq('store_id', storeId!)) as
      { id: string; user_id: string; role: string; profiles: { full_name: string; email: string | null; phone: string | null } | null }[],
    enabled: !!storeId,
  })
}

// ============================================================
// Subscriptions
// ============================================================

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  audience: 'store' | 'property'
  price: number
  billing_cycle: 'month' | 'year'
  trial_days: number
  commission_mode: 'none' | 'flat' | 'commission' | null
  commission_value: number | null
  included_orders: number | null
  features: string[]
  is_active: boolean
  sort_order: number
}

export interface Subscription {
  id: string
  plan_id: string
  party_type: 'store' | 'property'
  party_id: string
  status: 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled'
  price: number
  billing_cycle: 'month' | 'year'
  started_on: string
  trial_ends_on: string | null
  next_charge_on: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  notes: string | null
  subscription_plans?: { name: string; audience: string } | null
}

export function usePlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => throwIf(await supabase.from('subscription_plans')
      .select('*').order('audience').order('sort_order')) as SubscriptionPlan[],
  })
}

export function useUpsertPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan>) => {
      if (plan.id) {
        return throwIf(await supabase.from('subscription_plans')
          .update({ ...plan, updated_at: new Date().toISOString() })
          .eq('id', plan.id).select().single())
      }
      return throwIf(await supabase.from('subscription_plans').insert(plan).select().single())
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['subscription-plans'] }) },
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['subscription-plans'] }) },
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => throwIf(await supabase.from('subscriptions')
      .select('*, subscription_plans(name, audience)')
      .order('created_at', { ascending: false })) as Subscription[],
  })
}

export function useUpsertSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sub: Partial<Subscription>) => {
      if (sub.id) {
        return throwIf(await supabase.from('subscriptions')
          .update({ ...sub, updated_at: new Date().toISOString() })
          .eq('id', sub.id).select().single())
      }
      return throwIf(await supabase.from('subscriptions').insert(sub).select().single())
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscriptions'] })
      void qc.invalidateQueries({ queryKey: ['platform-stats'] })
    },
  })
}

export function useBillSubscriptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (period: string) =>
      throwIf(await supabase.rpc('delivr_bill_subscriptions', { p_period: period })) as
        { ok: boolean; created: number; total: number; period_start: string; period_end: string },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-charges'] })
      void qc.invalidateQueries({ queryKey: ['subscriptions'] })
      void qc.invalidateQueries({ queryKey: ['platform-stats'] })
    },
  })
}

// ============================================================
// Statistics
// ============================================================

export interface PlatformStats {
  from: string
  to: string
  totals: {
    orders: number; live_orders: number; gmv: number; aov: number
    delivered: number; cancelled: number; rejection_rate: number
    qr_orders: number; delivery_orders: number; pickup_orders: number; scans: number
  }
  income: { commission: number; subscriptions: number; adjustments: number; total: number }
  payouts: number
  net: number
  pending: number
  paid: number
  series: { day: string; orders: number; gmv: number; commission: number }[]
  by_store: { id: string; name: string; orders: number; gmv: number; aov: number; commission: number; cancelled: number }[]
  by_property: { id: string; name: string; code: string; area: string | null; orders: number; gmv: number; payout: number; scans: number }[]
  top_items: { name: string; qty: number; revenue: number }[]
  hours: { hour: number; orders: number }[]
  subscriptions: { active: number; mrr: number; past_due: number; trials: number }
}

export interface StoreStats {
  from: string
  to: string
  totals: {
    orders: number; turnover: number; aov: number; items_sold: number
    delivered: number; cancelled: number; rejection_rate: number; avg_prep: number
    delivery: number; pickup: number; delivery_fees: number
  }
  fees: { commission: number; subscription: number; total: number; pending: number; net: number }
  series: { day: string; orders: number; turnover: number }[]
  top_items: { name: string; qty: number; revenue: number }[]
  hours: { hour: number; orders: number }[]
  properties: { name: string; code: string; area: string | null; orders: number; turnover: number }[]
  repeat_customers: number
}

export function usePlatformStats(from: string, to: string) {
  return useQuery({
    queryKey: ['platform-stats', from, to],
    queryFn: async () => throwIf(await supabase.rpc('delivr_platform_stats',
      { p_from: from, p_to: to })) as PlatformStats,
  })
}

export function useStoreStats(storeId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['store-stats', storeId, from, to],
    queryFn: async () => throwIf(await supabase.rpc('delivr_store_stats',
      { p_store_id: storeId, p_from: from, p_to: to })) as StoreStats,
    enabled: !!storeId,
  })
}
