import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { num } from '@/lib/format'
import type { MatchedStore, PublicMenuItem, ServiceType } from '@/lib/api'

export interface GuestCartLine {
  lineId: string
  itemId: string
  name: string
  emoji: string | null
  unitPrice: number
  quantity: number
  modifiers: { id: string; name: string; price: number }[]
  notes: string | null
}

/** What a walk-up customer types when there is no property behind the order. */
export interface CustomerAddress {
  street: string
  area: string
  postal_code: string
  city: string
  floor: string
  doorbell: string
  notes: string
}

export const emptyAddress: CustomerAddress = {
  street: '', area: '', postal_code: '', city: '', floor: '', doorbell: '', notes: '',
}

interface GuestCartState {
  propertyCode: string | null
  /** Set instead of propertyCode when the order came from a store's own link. */
  storeSlug: string | null
  /** Remembered on this device so a returning customer does not retype it. */
  address: CustomerAddress
  storeId: string | null
  storeName: string | null
  service: 'delivery' | 'pickup'
  lines: GuestCartLine[]

  setContext: (propertyCode: string, service: 'delivery' | 'pickup') => void
  setStoreContext: (slug: string, service: 'delivery' | 'pickup') => void
  setAddress: (address: CustomerAddress) => void
  setService: (s: 'delivery' | 'pickup') => void
  addItem: (storeId: string, storeName: string, item: PublicMenuItem,
            modifiers: { id: string; name: string; price: number }[], qty: number, notes: string | null) => void
  setQty: (lineId: string, qty: number) => void
  removeLine: (lineId: string) => void
  clear: () => void
  subtotal: () => number
  count: () => number
}

const lineKey = (itemId: string, mods: { id: string }[], notes: string | null) =>
  [itemId, ...mods.map(m => m.id).sort(), notes ?? ''].join('|')

export const useGuestCart = create<GuestCartState>()(
  persist(
    (set, get) => ({
      propertyCode: null,
      storeSlug: null,
      address: emptyAddress,
      storeId: null,
      storeName: null,
      service: 'delivery',
      lines: [],

      setContext: (propertyCode, service) => {
        const { propertyCode: prev, storeSlug } = get()
        // A different property means a different address — never carry a cart across.
        // Arriving from a store link is the same kind of switch.
        if ((prev && prev !== propertyCode) || storeSlug) {
          set({ propertyCode, storeSlug: null, service, storeId: null, storeName: null, lines: [] })
        } else {
          set({ propertyCode, service })
        }
      },

      setStoreContext: (slug, service) => {
        const { storeSlug: prev, propertyCode } = get()
        if ((prev && prev !== slug) || propertyCode) {
          set({ storeSlug: slug, propertyCode: null, service, storeId: null, storeName: null, lines: [] })
        } else {
          set({ storeSlug: slug, service })
        }
      },

      setAddress: (address) => set({ address }),

      setService: (service) => set({ service }),

      addItem: (storeId, storeName, item, modifiers, qty, notes) => {
        const state = get()
        // One store per cart — switching stores resets it.
        const lines = state.storeId && state.storeId !== storeId ? [] : [...state.lines]
        const key = lineKey(item.id, modifiers, notes)
        const existing = lines.find(l => l.lineId === key)
        if (existing) {
          existing.quantity += qty
        } else {
          lines.push({
            lineId: key,
            itemId: item.id,
            name: item.name,
            emoji: item.emoji,
            unitPrice: Number(item.price) + modifiers.reduce((s, m) => s + Number(m.price), 0),
            quantity: qty,
            modifiers,
            notes,
          })
        }
        set({ storeId, storeName, lines })
      },

      setQty: (lineId, qty) => set(s => ({
        lines: qty <= 0 ? s.lines.filter(l => l.lineId !== lineId)
                        : s.lines.map(l => l.lineId === lineId ? { ...l, quantity: qty } : l),
      })),

      removeLine: (lineId) => set(s => ({ lines: s.lines.filter(l => l.lineId !== lineId) })),

      clear: () => set({ lines: [], storeId: null, storeName: null }),

      subtotal: () => get().lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
      count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
    }),
    { name: 'delivr_guest_cart' },
  ),
)

// ── Totals ───────────────────────────────────────────────────
// These numbers are for display only — delivr_place_order prices the order
// again server-side, and its result is what the guest is charged.

export interface CartTotals {
  subtotal: number
  discountPct: number
  discount: number
  fee: number
  total: number
  /** Minimum order for this store, 0 when it has none. */
  minOrder: number
  /** How much is still missing before the order can be sent. */
  missingToMin: number
  /** Order value above which delivery is free, null when the store has no such offer. */
  freeAbove: number | null
  /** How much is still missing before delivery becomes free. */
  missingToFree: number
  freeDelivery: boolean
}

/** One place that turns a cart subtotal plus the store's terms into what the guest owes. */
export function cartTotals(
  subtotal: number,
  store: MatchedStore | undefined,
  service: ServiceType,
): CartTotals {
  const sub = +subtotal.toFixed(2)
  const discountPct = service === 'pickup' ? num(store?.pickup_discount_pct) : 0
  const discount = discountPct > 0 ? +(sub * discountPct / 100).toFixed(2) : 0

  const freeAbove = store?.free_above != null && num(store.free_above) > 0 ? num(store.free_above) : null
  const freeDelivery = service === 'delivery' && freeAbove !== null && sub >= freeAbove
  const fee = service === 'delivery' && !freeDelivery ? num(store?.delivery_fee) : 0

  const minOrder = num(store?.min_order)

  return {
    subtotal: sub,
    discountPct,
    discount,
    fee,
    total: +(sub - discount + fee).toFixed(2),
    minOrder,
    missingToMin: +Math.max(0, minOrder - sub).toFixed(2),
    freeAbove,
    missingToFree: freeAbove === null ? 0 : +Math.max(0, freeAbove - sub).toFixed(2),
    freeDelivery,
  }
}
