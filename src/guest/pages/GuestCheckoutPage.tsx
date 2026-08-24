import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getPropertyByCode, getPublicSettings, getStoresForProperty,
  placeOrder, notifyOrder, ApiError,
} from '@/lib/api'
import { money, num } from '@/lib/format'
import { useI18n, type TKey } from '@/lib/i18n'
import { useGuestCart } from '@/guest/guestCart'
import { Spinner } from '@/components/ui'

const GUEST_KEY = 'delivr_guest_details'

export default function GuestCheckoutPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { lines, storeId, service, subtotal, clear } = useGuestCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [payment] = useState<'cash'>('cash')
  const [scheduleLater, setScheduleLater] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // A ref, not state: the cart clears synchronously and the guard must already be up.
  const submittedRef = useRef(false)

  const settingsQ = useQuery({ queryKey: ['public-settings'], queryFn: getPublicSettings })
  const propertyQ = useQuery({ queryKey: ['property', code], queryFn: () => getPropertyByCode(code) })
  const storesQ = useQuery({
    queryKey: ['stores-for-property', code, service],
    queryFn: () => getStoresForProperty(code, service),
  })

  // Remember the guest between orders in the same house.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '{}')
      if (saved.name) setName(saved.name)
      if (saved.phone) setPhone(saved.phone)
      if (saved.email) setEmail(saved.email)
    } catch { /* private mode */ }
  }, [])

  // An empty cart means the guest landed here by accident — but not right after
  // a successful order, when the cart is cleared on purpose.
  useEffect(() => {
    if (lines.length === 0 && !submittedRef.current) navigate(`/qr/${code}`, { replace: true })
  }, [lines.length, code, navigate])

  const store = storesQ.data?.find(s => s.store_id === storeId)
  const property = propertyQ.data
  const settings = settingsQ.data

  const sub = subtotal()
  const takeawayPct = service === 'pickup' ? num(store?.pickup_discount_pct) : 0
  const discount = takeawayPct > 0 ? +(sub * takeawayPct / 100).toFixed(2) : 0
  const freeAbove = store?.free_above != null ? num(store.free_above) : null
  const fee = service === 'delivery'
    ? (freeAbove !== null && sub >= freeAbove ? 0 : num(store?.delivery_fee))
    : 0
  const total = +(sub - discount + fee).toFixed(2)

  async function submit() {
    if (!storeId) return
    setSubmitting(true)
    try {
      const result = await placeOrder({
        code,
        storeId,
        service,
        items: lines.map(l => ({
          menu_item_id: l.itemId,
          quantity: l.quantity,
          modifier_ids: l.modifiers.map(m => m.id),
          notes: l.notes,
        })),
        guest: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          notes: notes.trim() || null,
        },
        scheduledFor: scheduleLater && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        payment,
        channel: 'qr',
      })

      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }))
      } catch { /* private mode */ }

      // Best-effort dispatch: email to the store. Never blocks the guest.
      void notifyOrder(result.order_id, result.public_token, lang)

      submittedRef.current = true
      clear()
      navigate(`/t/${result.public_token}?new=1`, { replace: true })
    } catch (err) {
      const e = err as ApiError
      const key = `err.${e.code}` as TKey
      const msg = t(key)
      toast.error(msg.startsWith('err.') ? t('err.generic') : msg)
      setSubmitting(false)
    }
  }

  if (settingsQ.isLoading || propertyQ.isLoading || storesQ.isLoading) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }

  const phoneRequired = settings?.guest_requires_phone ?? true
  const phoneOk = !phoneRequired || phone.replace(/\D/g, '').length >= 8
  const canSubmit = name.trim().length >= 2 && phoneOk && !submitting &&
    (!scheduleLater || !!scheduledAt)

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(`/qr/${code}/cart`)}>←</button>
        <h2 className="font-display font-bold text-lg">{t('checkout.title')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Address / pickup */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold mb-1">
            {service === 'delivery' ? t('checkout.address') : t('guest.pickupHere')}
          </p>
          {service === 'delivery' ? (
            <>
              <p className="font-bold text-sm text-ink-1">{property?.name}</p>
              <p className="text-sm text-ink-2">{property?.address}</p>
              {(property?.floor || property?.doorbell) && (
                <p className="text-xs text-ink-3 mt-0.5">
                  {property?.floor && `${property.floor} · `}{property?.doorbell}
                </p>
              )}
              {property?.access_notes && (
                <p className="text-xs text-ink-3 mt-1 italic">{property.access_notes}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-bold text-sm text-ink-1">{store?.store_name}</p>
              <p className="text-sm text-ink-2">{store?.store_address}</p>
            </>
          )}
        </div>

        {/* Guest details */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-3">
          <div>
            <label className="input-label" htmlFor="g-name">{t('checkout.name')} *</label>
            <input id="g-name" className="input-field" value={name} autoComplete="name"
                   onChange={e => setName(e.target.value)} placeholder={t('checkout.namePh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="g-phone">
              {t('checkout.phone')} {phoneRequired ? '*' : ''}
            </label>
            <input id="g-phone" className="input-field" value={phone} type="tel" autoComplete="tel"
                   onChange={e => setPhone(e.target.value)} placeholder={t('checkout.phonePh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="g-email">{t('checkout.email')}</label>
            <input id="g-email" className="input-field" value={email} type="email" autoComplete="email"
                   onChange={e => setEmail(e.target.value)} placeholder={t('checkout.emailPh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="g-notes">{t('checkout.notes')}</label>
            <textarea id="g-notes" className="input-field min-h-[70px] resize-none" value={notes}
                      onChange={e => setNotes(e.target.value)} placeholder={t('checkout.notesPh')} maxLength={300} />
          </div>
        </div>

        {/* Timing */}
        {settings?.allow_scheduled_orders && (
          <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold mb-2">
              {t('checkout.schedule')}
            </p>
            <div className="flex gap-2">
              {[false, true].map(later => (
                <button key={String(later)} onClick={() => setScheduleLater(later)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition
                    ${scheduleLater === later ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}>
                  {later ? t('checkout.later') : t('checkout.asap')}
                </button>
              ))}
            </div>
            {scheduleLater && (
              <input type="datetime-local" className="input-field mt-3" value={scheduledAt}
                     min={new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16)}
                     onChange={e => setScheduledAt(e.target.value)} />
            )}
          </div>
        )}

        {/* Payment */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold mb-2">
            {t('checkout.payment')}
          </p>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-brand bg-brand-50">
            <input type="radio" checked readOnly className="accent-brand w-4 h-4" />
            <span className="flex-1 text-sm font-semibold text-ink-1">
              💶 {service === 'delivery' ? t('checkout.cash') : t('checkout.cashPickup')}
            </span>
          </div>
          {!settings?.allow_online_payment && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-surface-4 mt-2 opacity-60">
              <input type="radio" disabled className="w-4 h-4" />
              <span className="flex-1 text-sm text-ink-2">💳 {t('checkout.card')}</span>
              <span className="badge badge-gray">{t('checkout.cardSoon')}</span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-2">{t('cart.subtotal')}</span>
            <span className="font-semibold">{money(sub, lang)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('store.takeawayDiscount')}</span>
              <span className="font-semibold">−{money(discount, lang)}</span>
            </div>
          )}
          {service === 'delivery' && (
            <div className="flex justify-between">
              <span className="text-ink-2">{t('cart.deliveryFee')}</span>
              <span className="font-semibold">{fee === 0 ? t('common.free') : money(fee, lang)}</span>
            </div>
          )}
          <div className="h-px bg-surface-4" />
          <div className="flex justify-between text-base">
            <span className="font-display font-bold">{t('cart.total')}</span>
            <span className="font-display font-black text-brand">{money(total, lang)}</span>
          </div>
        </div>

        <p className="text-[11px] text-ink-3 px-1">{t('checkout.terms')}</p>
      </div>

      <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
        <button className="btn btn-primary btn-lg w-full" disabled={!canSubmit} onClick={submit}>
          {submitting ? t('checkout.placing') : `${t('checkout.place')} · ${money(total, lang)}`}
        </button>
      </div>
    </div>
  )
}
