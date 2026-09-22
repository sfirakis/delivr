import { useNavigate, useParams } from 'react-router-dom'
import { money } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useGuestCart, cartTotals } from '@/guest/guestCart'
import { CartProgress, TotalsCard } from '@/guest/CartWidgets'
import { EmptyState, QtyStepper } from '@/components/ui'
import { useShop } from '@/shop/useShop'

export default function ShopCartPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { lines, storeName, service, setQty, clear, subtotal } = useGuestCart()
  const { priced, areaUnserved } = useShop(slug)

  useDocumentTitle(t('cart.title'))

  const totals = cartTotals(subtotal(), priced, service)

  if (lines.length === 0) {
    return (
      <div className="h-full flex flex-col bg-surface-2">
        <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4">
          <button className="btn-icon" onClick={() => navigate(`/store/${slug}`)}>←</button>
          <h2 className="font-display font-bold text-lg">{t('cart.title')}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState emoji="🛒" title={t('cart.empty')}
            action={t('cart.addMore')} onAction={() => navigate(`/store/${slug}`)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(`/store/${slug}`)}>←</button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg leading-tight">{t('cart.title')}</h2>
          <p className="text-[11px] text-ink-3 truncate">{storeName}</p>
        </div>
        <button className="text-[11px] text-danger font-semibold" onClick={clear}>{t('cart.clear')}</button>
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
                onClick={() => navigate(`/store/${slug}`)}>
          + {t('cart.addMore')}
        </button>

        <TotalsCard totals={totals} service={service} />

        {areaUnserved
          ? <p className="text-[11px] text-danger px-1">{t('shop.notServed')}</p>
          : <CartProgress totals={totals} service={service} />}
      </div>

      <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
        <button
          className="btn btn-primary btn-lg w-full"
          disabled={totals.missingToMin > 0 || areaUnserved}
          onClick={() => navigate(`/store/${slug}/checkout`)}
        >
          {t('cart.checkout')} · {money(totals.total, lang)}
        </button>
      </div>
    </div>
  )
}
