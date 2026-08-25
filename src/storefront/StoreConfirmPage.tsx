import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getStoreOrder, storeAction, ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { money, dateTime, time, phoneDigits, relativeMinutes, fullAddress } from '@/lib/format'
import { useI18n, LangToggle, type TKey } from '@/lib/i18n'
import { Spinner, EmptyState } from '@/components/ui'
import PrintTicket from './PrintTicket'

const PREP_OPTIONS = [10, 15, 20, 30, 45, 60]

const REJECT_REASONS_EL = ['Πολύς φόρτος', 'Εξαντλήθηκε προϊόν', 'Εκτός ζώνης παράδοσης', 'Κλείνουμε', 'Άλλο']
const REJECT_REASONS_EN = ['Too busy', 'Item out of stock', 'Outside delivery zone', 'Closing', 'Other']

export default function StoreConfirmPage() {
  const { token = '' } = useParams()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [prep, setPrep] = useState<number | null>(null)

  const orderQ = useQuery({
    queryKey: ['store-order', token],
    queryFn: () => getStoreOrder(token),
    retry: false,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (orderQ.data && prep === null) setPrep(orderQ.data.store.prep_time_min || 20)
  }, [orderQ.data, prep])

  useEffect(() => {
    const channel = supabase
      .channel(`store-order-${token}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_token=eq.${token}` },
        () => qc.invalidateQueries({ queryKey: ['store-order', token] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [token, qc])

  const act = useMutation({
    mutationFn: (v: { action: string; prep?: number; reason?: string }) =>
      storeAction(token, v.action, v.prep, v.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-order', token] })
      setRejecting(false)
    },
    onError: (err) => {
      const e = err as ApiError
      const key = `err.${e.code}` as TKey
      const msg = t(key)
      toast.error(msg.startsWith('err.') ? t('err.generic') : msg)
    },
  })

  if (orderQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-2"><Spinner size={32} /></div>
  }
  if (orderQ.isError || !orderQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-2">
        <EmptyState emoji="🔍" title={t('err.ORDER_NOT_FOUND')} />
      </div>
    )
  }

  const o = orderQ.data
  const el = lang === 'el'
  const addr = o.address as Record<string, string> | null
  const isPending = o.status === 'pending'
  const isClosed = o.status === 'delivered' || o.status === 'cancelled'
  const waitMin = relativeMinutes(o.created_at)
  const mapsHref = o.property?.lat && o.property?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${o.property.lat},${o.property.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        fullAddress(addr?.street ?? o.property?.address, o.property?.area, o.property?.city))}`

  const nextActions: { action: string; label: string; cls: string }[] = (() => {
    switch (o.status) {
      case 'confirmed':  return [{ action: 'preparing',  label: el ? '👨‍🍳 Ξεκίνησε η προετοιμασία' : '👨‍🍳 Start preparing', cls: 'btn-secondary' }]
      case 'preparing':  return [{ action: 'ready',      label: el ? '🥡 Έτοιμη' : '🥡 Ready',                            cls: 'btn-primary' }]
      case 'ready':      return o.service === 'delivery'
        ? [{ action: 'on_the_way', label: el ? '🛵 Έφυγε για παράδοση' : '🛵 Out for delivery', cls: 'btn-primary' }]
        : [{ action: 'delivered',  label: el ? '✓ Παραλήφθηκε' : '✓ Picked up',                 cls: 'btn-primary' }]
      case 'on_the_way': return [{ action: 'delivered',  label: el ? '✓ Παραδόθηκε' : '✓ Delivered', cls: 'btn-primary' }]
      default: return []
    }
  })()

  return (
    <div className="min-h-screen bg-surface-2">
      <PrintTicket order={o} lang={lang} />

      <div className="no-print max-w-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-3 font-bold">{o.store.name}</p>
            <h1 className="font-display font-black text-2xl text-ink-1">{o.order_number}</h1>
            <p className="text-xs text-ink-2">
              {dateTime(o.created_at, lang)}
              {isPending && waitMin > 0 && ` · ${el ? 'αναμονή' : 'waiting'} ${waitMin}′`}
            </p>
          </div>
          <LangToggle />
        </div>

        {/* Status banner */}
        <div className={`rounded-2xl p-4 mb-4 text-center
          ${o.status === 'cancelled' ? 'bg-red-50 border border-red-200'
            : isPending ? 'bg-amber-50 border border-amber-200'
            : 'bg-green-50 border border-green-200'}`}>
          <p className="font-display font-black text-lg text-ink-1">
            {t(`order.status.${o.status}` as TKey)}
          </p>
          {o.status === 'confirmed' && o.estimated_ready_at && (
            <p className="text-xs text-ink-2 mt-0.5">
              {el ? 'Έτοιμη περίπου' : 'Ready around'} {time(o.estimated_ready_at, lang)}
            </p>
          )}
          {o.cancel_reason && <p className="text-xs text-danger mt-0.5">{o.cancel_reason}</p>}
        </div>

        {/* Type + payment */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-surface-1 border border-surface-4 rounded-2xl p-3 text-center">
            <p className="text-[11px] text-ink-3 font-semibold uppercase">{el ? 'Τύπος' : 'Type'}</p>
            <p className="font-display font-bold text-base">
              {o.service === 'delivery' ? `🏠 ${t('guest.delivery')}` : `🥡 ${t('guest.takeaway')}`}
            </p>
          </div>
          <div className="bg-surface-1 border border-surface-4 rounded-2xl p-3 text-center">
            <p className="text-[11px] text-ink-3 font-semibold uppercase">{el ? 'Πληρωμή' : 'Payment'}</p>
            <p className="font-display font-bold text-base">
              {o.payment_method === 'cash' ? `💶 ${el ? 'Μετρητά' : 'Cash'}` : o.payment_method}
            </p>
          </div>
        </div>

        {o.scheduled_for && (
          <div className="bg-info/10 border border-info/30 rounded-2xl p-3 mb-4 text-center">
            <p className="text-sm font-bold text-info">
              🕒 {el ? 'Προγραμματισμένη για' : 'Scheduled for'} {dateTime(o.scheduled_for, lang)}
            </p>
          </div>
        )}

        {/* Customer + address */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 mb-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-bold mb-1">
            {el ? 'Πελάτης' : 'Customer'}
          </p>
          <p className="font-bold text-base text-ink-1">{o.guest.name}</p>
          {o.guest.phone && (
            <div className="flex gap-2 mt-2">
              <a href={`tel:${phoneDigits(o.guest.phone)}`} className="btn btn-secondary btn-md flex-1">
                📞 {o.guest.phone}
              </a>
              <a href={`https://wa.me/${phoneDigits(o.guest.phone)}`} target="_blank" rel="noopener noreferrer"
                 className="btn btn-md bg-[#25D366] text-white px-4">💬</a>
            </div>
          )}

          {o.service === 'delivery' && (
            <>
              <div className="h-px bg-surface-4 my-3" />
              <p className="text-[11px] uppercase tracking-wide text-ink-3 font-bold mb-1">
                {el ? 'Διεύθυνση παράδοσης' : 'Delivery address'}
              </p>
              {o.property?.name && <p className="font-bold text-sm">{o.property.name}</p>}
              <p className="text-sm text-ink-2">
                {fullAddress(addr?.street ?? o.property?.address, o.property?.area,
                             o.property?.city, addr?.postal_code)}
              </p>
              {(addr?.floor || addr?.doorbell) && (
                <p className="text-xs text-ink-3">{[addr?.floor, addr?.doorbell].filter(Boolean).join(' · ')}</p>
              )}
              {o.property?.access_notes && (
                <p className="text-xs text-ink-2 italic mt-1">📝 {o.property.access_notes}</p>
              )}
              <a href={mapsHref} target="_blank" rel="noopener noreferrer"
                 className="btn btn-secondary btn-md w-full mt-2">🗺️ {el ? 'Άνοιγμα σε χάρτη' : 'Open in maps'}</a>
            </>
          )}
        </div>

        {/* Items */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 mb-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-3 font-bold mb-2">
            {el ? 'Προϊόντα' : 'Items'}
          </p>
          <div className="space-y-2">
            {o.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="min-w-0 pr-2">
                  <p className="text-ink-1"><span className="font-black">{it.quantity}×</span> {it.name}</p>
                  {it.modifiers?.length > 0 && (
                    <p className="text-[11px] text-ink-3">+ {it.modifiers.map(m => m.name).join(', ')}</p>
                  )}
                  {it.notes && (
                    <p className="text-[11px] font-bold text-brand">⚠️ {it.notes}</p>
                  )}
                </div>
                <span className="font-semibold whitespace-nowrap">{money(it.subtotal, lang)}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-surface-4 my-3" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-ink-2">{t('cart.subtotal')}</span><span>{money(o.subtotal, lang)}</span></div>
            {Number(o.discount_amount) > 0 && (
              <div className="flex justify-between text-success"><span>{t('cart.discount')}</span><span>−{money(o.discount_amount, lang)}</span></div>
            )}
            {Number(o.delivery_fee) > 0 && (
              <div className="flex justify-between"><span className="text-ink-2">{t('cart.deliveryFee')}</span><span>{money(o.delivery_fee, lang)}</span></div>
            )}
            <div className="flex justify-between text-lg pt-1">
              <span className="font-display font-bold">{t('cart.total')}</span>
              <span className="font-display font-black text-brand">{money(o.total, lang)}</span>
            </div>
            {Number(o.platform_fee) > 0 && (
              <p className="text-[11px] text-ink-3 pt-1">
                {el ? 'Προμήθεια πλατφόρμας' : 'Platform commission'}: {money(o.platform_fee, lang)}
              </p>
            )}
          </div>

          {(o.customer_notes || o.delivery_notes) && (
            <p className="text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3">
              📝 {[o.customer_notes, o.delivery_notes].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-3 sticky bottom-0">
            {isPending && !rejecting && (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ink-3 font-bold mb-2">
                    {el ? 'Χρόνος ετοιμασίας' : 'Preparation time'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {PREP_OPTIONS.map(m => (
                      <button key={m} onClick={() => setPrep(m)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition
                          ${prep === m ? 'bg-ink-1 text-white border-ink-1' : 'bg-surface-1 text-ink-2 border-surface-4'}`}>
                        {m}′
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary btn-lg w-full"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ action: 'accept', prep: prep ?? 20 })}>
                  ✅ {el ? `Αποδοχή · έτοιμη σε ${prep}′` : `Accept · ready in ${prep}′`}
                </button>
                <button className="btn btn-ghost btn-md w-full text-danger" onClick={() => setRejecting(true)}>
                  {el ? 'Απόρριψη παραγγελίας' : 'Reject order'}
                </button>
              </>
            )}

            {isPending && rejecting && (
              <>
                <p className="text-sm font-bold text-ink-1">{el ? 'Λόγος απόρριψης' : 'Rejection reason'}</p>
                <div className="flex flex-wrap gap-2">
                  {(el ? REJECT_REASONS_EL : REJECT_REASONS_EN).map(r => (
                    <button key={r} onClick={() => setReason(r)}
                      className={`chip ${reason === r ? 'chip-active' : ''}`}>{r}</button>
                  ))}
                </div>
                <input className="input-field" value={reason} onChange={e => setReason(e.target.value)}
                       placeholder={el ? 'Προαιρετικό σχόλιο' : 'Optional note'} />
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-md flex-1" onClick={() => setRejecting(false)}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn btn-danger btn-md flex-1" disabled={act.isPending}
                          onClick={() => act.mutate({ action: 'reject', reason })}>
                    {el ? 'Απόρριψη' : 'Reject'}
                  </button>
                </div>
              </>
            )}

            {nextActions.map(a => (
              <button key={a.action} className={`btn ${a.cls} btn-lg w-full`}
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: a.action })}>
                {a.label}
              </button>
            ))}

            <button className="btn btn-secondary btn-md w-full"
                    onClick={() => { act.mutate({ action: 'print' }); setTimeout(() => window.print(), 150) }}>
              🖨️ {t('common.print')}
              {o.printed_at && ` · ${time(o.printed_at, lang)}`}
            </button>
          </div>
        )}

        {isClosed && (
          <button className="btn btn-secondary btn-md w-full"
                  onClick={() => window.print()}>🖨️ {t('common.print')}</button>
        )}

        <p className="text-center text-[10px] text-ink-3 mt-6">
          {o.settings.platform_name} · {el ? 'Σύνδεσμος καταστήματος' : 'Store link'}
        </p>
      </div>
    </div>
  )
}
