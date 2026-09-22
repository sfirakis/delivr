import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getPublicSettings, placeOrder, notifyOrder, ApiError } from '@/lib/api'
import { money, fullAddress } from '@/lib/format'
import { useI18n, type TKey } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { TotalsCard } from '@/guest/CartWidgets'
import { Spinner } from '@/components/ui'
import { useShop } from '@/shop/useShop'
import AddressFields from '@/shop/AddressFields'

const GUEST_KEY = 'delivr_guest_details'

export default function ShopCheckoutPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { lines, storeId, service, subtotal, clear, address, setAddress } = useGuestCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [promo, setPromo] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // A ref, not state: the cart clears synchronously and the guard must already be up.
  const submittedRef = useRef(false)

  const settingsQ = useQuery({ queryKey: ['public-settings'], queryFn: getPublicSettings })
  const { store, storeQ, priced, areaUnserved } = useShop(slug)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '{}')
      if (saved.name) setName(saved.name)
      if (saved.phone) setPhone(saved.phone)
      if (saved.email) setEmail(saved.email)
    } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    if (lines.length === 0 && !submittedRef.current) navigate(`/store/${slug}`, { replace: true })
  }, [lines.length, slug, navigate])

  useDocumentTitle(t('checkout.title'))

  const settings = settingsQ.data
  const totals = cartTotals(subtotal(), priced, service)

  async function submit() {
    if (!storeId) return
    setSubmitting(true)
    setPromoError(null)
    try {
      const result = await placeOrder({
        // No property behind this order: the address is what the customer typed.
        code: null,
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
          delivery_notes: service === 'delivery' ? address.notes.trim() || null : null,
        },
        promo: promo.trim().toUpperCase() || null,
        payment: 'cash',
        channel: 'store',
        address: service === 'delivery' ? {
          street: address.street.trim(),
          area: address.area.trim(),
          postal_code: address.postal_code.trim(),
          city: address.city.trim(),
          floor: address.floor.trim(),
          doorbell: address.doorbell.trim(),
          notes: address.notes.trim(),
        } : null,
      })

      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }))
      } catch { /* private mode */ }

      void notifyOrder(result.order_id, result.public_token, lang)

      submittedRef.current = true
      clear()
      navigate(`/t/${result.public_token}?new=1`, { replace: true })
    } catch (err) {
      const e = err as ApiError
      const key = `err.${e.code}` as TKey
      const msg = t(key)
      const readable = msg.startsWith('err.') ? t('err.generic') : msg
      if (e.code.startsWith('PROMO')) setPromoError(readable)
      toast.error(readable)
      setSubmitting(false)
    }
  }

  if (settingsQ.isLoading || storeQ.isLoading || !store) {
    return <div className="h-full flex items-center justify-center"><Spinner size={32} /></div>
  }

  const phoneRequired = settings?.guest_requires_phone ?? true
  const phoneOk = !phoneRequired || phone.replace(/\D/g, '').length >= 8
  const addressOk = service !== 'delivery' ||
    (address.street.trim().length >= 3 && address.area.trim() !== '' && !areaUnserved)
  const canSubmit = name.trim().length >= 2 && phoneOk && addressOk && !submitting

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(`/store/${slug}/cart`)}>←</button>
        <h2 className="font-display font-bold text-lg">{t('checkout.title')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Where it goes */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold mb-2">
            {service === 'delivery' ? t('checkout.address') : t('shop.pickUpHere')}
          </p>
          {service === 'delivery' ? (
            <>
              <AddressFields store={store} value={address} onChange={setAddress} />
              {areaUnserved && <p className="text-[11px] text-danger mt-2">{t('shop.notServed')}</p>}
            </>
          ) : (
            <>
              <p className="font-bold text-sm text-ink-1">{store.name}</p>
              <p className="text-sm text-ink-2">{fullAddress(store.address, store.city)}</p>
            </>
          )}
        </div>

        {/* Who is ordering */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-3">
          <div>
            <label className="input-label" htmlFor="s-name">{t('checkout.name')} *</label>
            <input id="s-name" className="input-field" value={name} autoComplete="name"
                   onChange={e => setName(e.target.value)} placeholder={t('checkout.namePh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="s-phone">
              {t('checkout.phone')} {phoneRequired ? '*' : ''}
            </label>
            <input id="s-phone" className="input-field" value={phone} type="tel" autoComplete="tel"
                   onChange={e => setPhone(e.target.value)} placeholder={t('checkout.phonePh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="s-email">{t('checkout.email')}</label>
            <input id="s-email" className="input-field" value={email} type="email" autoComplete="email"
                   onChange={e => setEmail(e.target.value)} placeholder={t('checkout.emailPh')} />
          </div>
          <div>
            <label className="input-label" htmlFor="s-notes">{t('checkout.notes')}</label>
            <textarea id="s-notes" className="input-field min-h-[70px] resize-none" value={notes}
                      onChange={e => setNotes(e.target.value)} placeholder={t('checkout.notesPh')} maxLength={300} />
          </div>
        </div>

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

        {/* Promo code */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
          <label className="input-label" htmlFor="s-promo">{t('checkout.promo')}</label>
          <input id="s-promo" className="input-field uppercase" value={promo}
                 autoCapitalize="characters" autoComplete="off" maxLength={32}
                 placeholder={t('checkout.promoPh')}
                 onChange={e => { setPromo(e.target.value); setPromoError(null) }} />
          <p className={`text-[11px] mt-1 ${promoError ? 'text-danger' : 'text-ink-3'}`}>
            {promoError ?? t('checkout.promoHint')}
          </p>
        </div>

        {/* What is being ordered */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold">{t('checkout.items')}</p>
          {lines.map(line => (
            <div key={line.lineId} className="flex justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="text-ink-1"><span className="font-bold">{line.quantity}×</span> {line.name}</p>
                {line.modifiers.length > 0 && (
                  <p className="text-[11px] text-ink-3">+ {line.modifiers.map(m => m.name).join(', ')}</p>
                )}
                {line.notes && <p className="text-[11px] text-ink-3 italic">✏️ {line.notes}</p>}
              </div>
              <span className="font-semibold whitespace-nowrap">
                {money(line.unitPrice * line.quantity, lang)}
              </span>
            </div>
          ))}
        </div>

        <TotalsCard totals={totals} service={service} />

        <p className="text-[11px] text-ink-3 px-1">
          {t('checkout.terms')}{' '}
          <Link to="/terms" className="text-brand underline underline-offset-2">{t('terms.link')}</Link>
        </p>
      </div>

      <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
        <button className="btn btn-primary btn-lg w-full" disabled={!canSubmit} onClick={submit}>
          {submitting ? t('checkout.placing') : `${t('checkout.place')} · ${money(totals.total, lang)}`}
        </button>
      </div>
    </div>
  )
}
