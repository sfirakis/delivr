import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStoresForProperty } from '@/lib/api'
import { money } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { CartProgress } from '@/guest/CartWidgets'
import { EmptyState, QtyStepper } from '@/components/ui'

export default function GuestCartPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { lines, storeId, storeName, service, setQty, clear, subtotal } = useGuestCart()

  const storesQ = useQuery({
    queryKey: ['stores-for-property', code, service],
    queryFn: () => getStoresForProperty(code, service),
  })

  useDocumentTitle(t('cart.title'))

  const store = storesQ.data?.find(s => s.store_id === storeId)
  const totals = cartTotals(subtotal(), store, service)
  const { subtotal: sub, discountPct: takeawayPct, discount, fee, total, missingToMin: missing } = totals

  if (lines.length === 0) {
    return (
      <div className="h-full flex flex-col bg-surface-2">
        <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4">
          <button className="btn-icon" onClick={() => navigate(`/qr/${code}`)}>←</button>
          <h2 className="font-display font-bold text-lg">{t('cart.title')}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState emoji="🛒" title={t('cart.empty')}
            action={t('cart.addMore')} onAction={() => navigate(`/qr/${code}`)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(`/qr/${code}/store/${storeId}`)}>←</button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg leading-tight">{t('cart.title')}</h2>
          <p className="text-[11px] text-ink-3 truncate">{storeName}</p>
        </div>
        <button className="text-[11px] text-danger font-semibold" onClick={clear}>
          {t('cart.clear')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {lines.map(line => (
          <div key={line.lineId} className="bg-surface-1 border border-surface-4 rounded-2xl p-3 flex gap-3">
            <div className="w-11 h-11 rounded-lg bg-surface-3 flex items-center justify-center text-xl flex-shrink-0">
              {line.emoji ?? '🍽️'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-ink-1">{line.name}</p>
              {line.modifiers.length > 0 && (
                <p className="text-[11px] text-ink-3">+ {line.modifiers.map(m => m.name).join(', ')}</p>
              )}
              {line.notes && <p className="text-[11px] text-ink-2 italic">✏️ {line.notes}</p>}
              <p className="text-sm font-display font-bold text-ink-1 mt-1">
                {money(line.unitPrice * line.quantity, lang)}
              </p>
            </div>
            <div className="flex items-center">
              <QtyStepper value={line.quantity} onChange={v => setQty(line.lineId, v)} min={0} />
            </div>
          </div>
        ))}

        <button className="w-full text-center text-sm font-semibold text-brand py-3"
                onClick={() => navigate(`/qr/${code}/store/${storeId}`)}>
          + {t('cart.addMore')}
        </button>

        {/* Totals */}
        <div className="bg-surface-1 border border-surface-4 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-2">{t('cart.subtotal')}</span>
            <span className="font-semibold">{money(sub, lang)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <span>{t('store.takeawayDiscount')} (−{takeawayPct}%)</span>
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

        <CartProgress totals={totals} service={service} />
      </div>

      <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
        <button
          className="btn btn-primary btn-lg w-full"
          disabled={missing > 0}
          onClick={() => navigate(`/qr/${code}/checkout`)}
        >
          {t('cart.checkout')} · {money(total, lang)}
        </button>
      </div>
    </div>
  )
}
