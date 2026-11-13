import type { Lang } from './i18n'
import type { ServiceType } from './api'

/**
 * How the customer pays — always in person, straight to the store (018).
 * No money passes through the platform:
 *   cash — on delivery / at the counter;
 *   card — the store's own terminal: at the counter (take away, always) or
 *          the courier's terminal (delivery, only if the store enabled it).
 */
export type PayMethod = 'cash' | 'card'

const LABELS = {
  el: {
    cash: { delivery: 'Μετρητά κατά την παράδοση', pickup: 'Μετρητά κατά την παραλαβή', short: 'Μετρητά' },
    card: { delivery: 'Κάρτα κατά την παράδοση', pickup: 'Κάρτα στο ταμείο', short: 'Κάρτα' },
  },
  en: {
    cash: { delivery: 'Cash on delivery', pickup: 'Cash on pickup', short: 'Cash' },
    card: { delivery: 'Card on delivery', pickup: 'Card at the counter', short: 'Card' },
  },
} as const

export const paymentIcon = (method: string | null | undefined) => (method === 'card' ? '💳' : '💶')

/** «Κάρτα στο ταμείο», «Cash on delivery»… — or the short form («Κάρτα»). */
export function paymentLabel(
  method: string | null | undefined,
  service: ServiceType | string | null | undefined,
  lang: Lang = 'el',
  short = false,
): string {
  const m = method === 'card' || method === 'cash' ? method : null
  if (!m) return method ?? ''
  const l = LABELS[lang][m]
  if (short) return l.short
  return service === 'pickup' ? l.pickup : l.delivery
}
