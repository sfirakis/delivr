import { money } from './format'
import type { Lang } from './i18n'
import { phoneDigits } from './format'

export interface WaOrderLine { name: string; quantity: number; subtotal: number | string; modifiers?: { name: string }[]; notes?: string | null }

export interface WaOrderPayload {
  orderNumber: string
  service: 'delivery' | 'pickup'
  storeName: string
  guestName: string
  guestPhone?: string | null
  propertyName?: string | null
  address?: string | null
  addressExtra?: string | null
  items: WaOrderLine[]
  subtotal: number | string
  discount?: number | string
  deliveryFee?: number | string
  total: number | string
  paymentLabel: string
  notes?: string | null
  trackUrl?: string | null
  scheduledFor?: string | null
}

/** Plain-text order summary that reads well inside WhatsApp. */
export function buildWhatsAppMessage(p: WaOrderPayload, lang: Lang = 'el'): string {
  const el = lang === 'el'
  const L: string[] = []

  L.push(el ? `🛵 *ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ* — ${p.orderNumber}` : `🛵 *NEW ORDER* — ${p.orderNumber}`)
  L.push(`*${p.storeName}*`)
  L.push('')
  L.push(el
    ? `${p.service === 'delivery' ? '🏠 Delivery' : '🥡 Take away'}`
    : `${p.service === 'delivery' ? '🏠 Delivery' : '🥡 Take away'}`)

  if (p.service === 'delivery' && p.address) {
    L.push(el ? `📍 Διεύθυνση: ${p.address}` : `📍 Address: ${p.address}`)
    if (p.propertyName) L.push(`   (${p.propertyName})`)
    if (p.addressExtra) L.push(`   ${p.addressExtra}`)
  }

  L.push(el ? `👤 Πελάτης: ${p.guestName}` : `👤 Customer: ${p.guestName}`)
  if (p.guestPhone) L.push(`📞 ${p.guestPhone}`)
  if (p.scheduledFor) L.push(el ? `🕒 Για: ${p.scheduledFor}` : `🕒 For: ${p.scheduledFor}`)

  L.push('')
  L.push(el ? '*Προϊόντα:*' : '*Items:*')
  for (const it of p.items) {
    L.push(`${it.quantity}× ${it.name} — ${money(it.subtotal, lang)}`)
    if (it.modifiers?.length) L.push(`   + ${it.modifiers.map(m => m.name).join(', ')}`)
    if (it.notes) L.push(`   ✏️ ${it.notes}`)
  }

  L.push('')
  L.push(`${el ? 'Υποσύνολο' : 'Subtotal'}: ${money(p.subtotal, lang)}`)
  if (Number(p.discount ?? 0) > 0) L.push(`${el ? 'Έκπτωση' : 'Discount'}: -${money(p.discount!, lang)}`)
  if (Number(p.deliveryFee ?? 0) > 0) L.push(`${el ? 'Μεταφορικά' : 'Delivery'}: ${money(p.deliveryFee!, lang)}`)
  L.push(`*${el ? 'ΣΥΝΟΛΟ' : 'TOTAL'}: ${money(p.total, lang)}*`)
  L.push(`💳 ${p.paymentLabel}`)

  if (p.notes) {
    L.push('')
    L.push(el ? `📝 Σημείωση: ${p.notes}` : `📝 Note: ${p.notes}`)
  }
  if (p.trackUrl) {
    L.push('')
    L.push(el ? `Παρακολούθηση: ${p.trackUrl}` : `Track: ${p.trackUrl}`)
  }

  return L.join('\n')
}

/** wa.me deep link — opens WhatsApp with the message pre-filled. */
export function waLink(phone: string | null | undefined, message: string): string | null {
  const digits = phoneDigits(phone)
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
