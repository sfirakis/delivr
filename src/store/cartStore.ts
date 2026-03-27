import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, MenuItem, Modifier, Store } from '@/types'

interface CartState {
  storeId: string | null
  storeName: string | null
  storeEmoji: string | null
  storeMinOrder: number
  storeDeliveryFee: number
  items: CartItem[]
  // Actions
  addItem: (item: MenuItem, store: Store, qty?: number, modifiers?: Modifier[]) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, qty: number) => void
  clearCart: () => void
  clearIfDifferentStore: (storeId: string) => boolean
  // Computed
  itemCount: () => number
  subtotal: () => number
  total: (deliveryFee?: number, discount?: number) => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      storeName: null,
      storeEmoji: null,
      storeMinOrder: 0,
      storeDeliveryFee: 0,
      items: [],

      addItem: (menuItem, store, qty = 1, modifiers = []) => {
        const state = get()

        // If adding from a different store, warn (caller handles confirmation)
        if (state.storeId && state.storeId !== store.id) return

        const modifiersTotal = modifiers.reduce((sum, m) => sum + m.price, 0)
        const lineTotal = (menuItem.price + modifiersTotal) * qty

        set((s) => {
          // Check if same item+modifiers exists
          const existingIdx = s.items.findIndex(
            (i) =>
              i.menuItem.id === menuItem.id &&
              JSON.stringify(i.selectedModifiers.map((m) => m.id).sort()) ===
                JSON.stringify(modifiers.map((m) => m.id).sort())
          )

          if (existingIdx >= 0) {
            const updated = [...s.items]
            const existing = updated[existingIdx]
            updated[existingIdx] = {
              ...existing,
              quantity: existing.quantity + qty,
              lineTotal: existing.lineTotal + lineTotal,
            }
            return { items: updated }
          }

          return {
            storeId: store.id,
            storeName: store.name,
            storeEmoji: store.emoji ?? null,
            storeMinOrder: store.min_order_amount,
            storeDeliveryFee: store.delivery_fee,
            items: [
              ...s.items,
              { menuItem, quantity: qty, selectedModifiers: modifiers, lineTotal },
            ],
          }
        })
      },

      removeItem: (itemId) =>
        set((s) => {
          const items = s.items.filter((i) => i.menuItem.id !== itemId)
          return items.length === 0
            ? { items: [], storeId: null, storeName: null, storeEmoji: null }
            : { items }
        }),

      updateQuantity: (itemId, qty) =>
        set((s) => {
          if (qty <= 0) {
            const items = s.items.filter((i) => i.menuItem.id !== itemId)
            return items.length === 0
              ? { items: [], storeId: null, storeName: null, storeEmoji: null }
              : { items }
          }
          return {
            items: s.items.map((i) => {
              if (i.menuItem.id !== itemId) return i
              const modifiersTotal = i.selectedModifiers.reduce((sum, m) => sum + m.price, 0)
              return {
                ...i,
                quantity: qty,
                lineTotal: (i.menuItem.price + modifiersTotal) * qty,
              }
            }),
          }
        }),

      clearCart: () =>
        set({ items: [], storeId: null, storeName: null, storeEmoji: null }),

      clearIfDifferentStore: (storeId) => {
        const { storeId: currentStore } = get()
        if (currentStore && currentStore !== storeId) {
          // Returns true = caller should ask user for confirmation
          return true
        }
        return false
      },

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () => get().items.reduce((sum, i) => sum + i.lineTotal, 0),

      total: (deliveryFee, discount = 0) => {
        const sub = get().subtotal()
        const fee = deliveryFee ?? get().storeDeliveryFee
        return Math.max(0, sub + fee - discount)
      },
    }),
    {
      name: 'delivr-cart',
      version: 1,
    }
  )
)
