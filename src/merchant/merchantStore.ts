import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Order, Store } from '@/types'

interface MerchantState {
  store: Store | null
  isOnline: boolean
  pendingOrders: Order[]
  activeOrders: Order[]
  completedToday: Order[]
  loading: boolean
  // Actions
  setStore: (s: Store) => void
  toggleOnline: () => Promise<void>
  fetchOrders: (storeId: string) => Promise<void>
  acceptOrder: (orderId: string, prepMins: number) => Promise<void>
  rejectOrder: (orderId: string, reason: string) => Promise<void>
  updateOrderStatus: (orderId: string, status: string) => Promise<void>
  subscribeToOrders: (storeId: string) => () => void
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  store: null,
  isOnline: true,
  pendingOrders: [],
  activeOrders: [],
  completedToday: [],
  loading: false,

  setStore: (store) => set({ store }),

  toggleOnline: async () => {
    const { store, isOnline } = get()
    if (!store) return
    const next = !isOnline
    await supabase.from('stores').update({ is_open: next }).eq('id', store.id)
    set({ isOnline: next })
  },

  fetchOrders: async (storeId) => {
    set({ loading: true })
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), profiles(full_name, phone)')
      .eq('store_id', storeId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    const orders = (data ?? []) as Order[]
    set({
      pendingOrders:  orders.filter(o => o.status === 'pending'),
      activeOrders:   orders.filter(o => ['confirmed','preparing','ready'].includes(o.status)),
      completedToday: orders.filter(o => ['delivered','cancelled'].includes(o.status)),
      loading: false,
    })
  },

  acceptOrder: async (orderId, prepMins) => {
    const eta = new Date(Date.now() + prepMins * 60000).toISOString()
    await supabase.from('orders').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      estimated_ready_at: eta,
    }).eq('id', orderId)

    set(s => ({
      pendingOrders: s.pendingOrders.filter(o => o.id !== orderId),
      activeOrders: [
        ...s.activeOrders,
        { ...s.pendingOrders.find(o => o.id === orderId)!, status: 'confirmed' as any },
      ],
    }))
  },

  rejectOrder: async (orderId, reason) => {
    await supabase.from('orders').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    }).eq('id', orderId)

    set(s => ({
      pendingOrders: s.pendingOrders.filter(o => o.id !== orderId),
    }))
  },

  updateOrderStatus: async (orderId, status) => {
    const updates: Record<string, string> = { status }
    if (status === 'preparing') updates.confirmed_at = new Date().toISOString()
    if (status === 'ready')     updates.prepared_at  = new Date().toISOString()
    if (status === 'picked_up') updates.picked_up_at = new Date().toISOString()

    await supabase.from('orders').update(updates).eq('id', orderId)

    set(s => ({
      activeOrders: s.activeOrders.map(o =>
        o.id === orderId ? { ...o, status: status as any } : o
      ),
    }))
  },

  subscribeToOrders: (storeId) => {
    const channel = supabase
      .channel(`merchant:${storeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        const order = payload.new as Order
        if (order.status === 'pending') {
          set(s => ({ pendingOrders: [order, ...s.pendingOrders] }))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        const order = payload.new as Order
        set(s => ({
          pendingOrders:  s.pendingOrders.map(o => o.id === order.id ? order : o).filter(o => o.status === 'pending'),
          activeOrders:   s.activeOrders.map(o => o.id === order.id ? order : o),
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },
}))
