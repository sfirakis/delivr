import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStorePaymentOptions, type ServiceType } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { paymentIcon, paymentLabel, type PayMethod } from '@/lib/payment'

/**
 * «Μετρητά» or «Κάρτα» at checkout (QR, store link and marketplace).
 * Payment happens in person, straight to the store — nothing online:
 *   take away → card is always possible (pay at the counter);
 *   delivery  → card only if the store turned on «κάρτα στην παράδοση».
 * delivr_place_order checks the same rule on the server (018).
 */
export default function PaymentChoice({ storeId, service, value, onChange }: {
  storeId: string | null
  service: ServiceType
  value: PayMethod
  onChange: (m: PayMethod) => void
}) {
  const { t, lang } = useI18n()
  const optsQ = useQuery({
    queryKey: ['payment-options', storeId],
    queryFn: () => getStorePaymentOptions(storeId!),
    enabled: !!storeId,
    staleTime: 60_000,
  })
  const opts = optsQ.data ?? { cash: true, card_pickup: false, card_delivery: false }
  const cardOk = service === 'pickup' ? opts.card_pickup : opts.card_delivery
  const cashOk = opts.cash

  // Never leave an option selected that this store/service does not take.
  useEffect(() => {
    if (value === 'card' && !cardOk && optsQ.isFetched) onChange('cash')
    if (value === 'cash' && !cashOk && cardOk) onChange('card')
  }, [value, cardOk, cashOk, optsQ.isFetched, onChange])

  const option = (m: PayMethod, enabled: boolean, note?: string) => (
    <label key={m}
           className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition
             ${!enabled ? 'border-surface-4 opacity-60' : value === m ? 'border-brand bg-brand-50' : 'border-surface-4 cursor-pointer'}`}>
      <input type="radio" name="payment" value={m} checked={value === m} disabled={!enabled}
             onChange={() => onChange(m)} className="accent-brand w-4 h-4" data-testid={`pay-${m}`} />
      <span className={`flex-1 text-sm ${value === m ? 'font-semibold text-ink-1' : 'text-ink-2'}`}>
        {paymentIcon(m)} {paymentLabel(m, service, lang)}
      </span>
      {note && <span className="text-[11px] text-ink-3 text-right max-w-[45%]">{note}</span>}
    </label>
  )

  return (
    <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-3 font-semibold mb-2">
        {t('checkout.payment')}
      </p>
      <div className="space-y-2" role="radiogroup" aria-label={t('checkout.payment')}>
        {cashOk && option('cash', true)}
        {/* Delivery without a card terminal: shown but not selectable, so the
            customer knows why — take away always allows card. */}
        {option('card', cardOk, !cardOk && service === 'delivery' ? t('checkout.cardNotOnDelivery') : undefined)}
      </div>
      <p className="text-[11px] text-ink-3 mt-2">{t('checkout.payInPerson')}</p>
    </div>
  )
}
