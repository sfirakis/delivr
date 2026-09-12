import { money } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { ServiceType } from '@/lib/api'
import type { CartTotals } from '@/guest/guestCart'

/** Thin progress rail, clamped so a full bar never overflows its track. */
function Rail({ ratio, tone }: { ratio: number; tone: 'brand' | 'success' }) {
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)))
  return (
    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all ${tone === 'success' ? 'bg-success' : 'bg-brand'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/**
 * Tells the guest exactly what stands between the current cart and a cheaper,
 * sendable order: the minimum first (it blocks checkout), then the free-delivery
 * threshold (it only saves money).
 */
export function CartProgress({ totals, service, className = '' }: {
  totals: CartTotals; service: ServiceType; className?: string
}) {
  const { t, lang } = useI18n()
  const { subtotal, minOrder, missingToMin, freeAbove, missingToFree, freeDelivery } = totals

  const showMin = minOrder > 0
  const showFree = service === 'delivery' && freeAbove !== null
  if (!showMin && !showFree) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {showMin && (
        missingToMin > 0 ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <p className="text-[11px] text-amber-900">
              {t('cart.minProgress', { missing: money(missingToMin, lang), amount: money(minOrder, lang) })}
            </p>
            <Rail ratio={subtotal / minOrder} tone="brand" />
          </div>
        ) : (
          <p className="text-[11px] text-success font-semibold px-1">{t('cart.minReached')}</p>
        )
      )}

      {showFree && (
        freeDelivery ? (
          <p className="text-[11px] text-success font-semibold px-1">{t('cart.freeDeliveryReached')}</p>
        ) : (
          <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
            <p className="text-[11px] text-ink-2">
              🛵 {t('cart.freeDeliveryProgress', { missing: money(missingToFree, lang) })}
            </p>
            <Rail ratio={subtotal / (freeAbove as number)} tone="success" />
          </div>
        )
      )}
    </div>
  )
}

/** Sticky bottom bar: how many items are in the cart and what they come to. */
export function CartBar({ count, total, onOpen }: {
  count: number; total: number; onOpen: () => void
}) {
  const { t, lang } = useI18n()
  if (count <= 0) return null
  return (
    <div className="flex-shrink-0 p-3 border-t border-surface-4 bg-surface-1">
      <button className="btn btn-primary btn-lg w-full flex items-center justify-between gap-3" onClick={onOpen}>
        <span className="flex items-center gap-2">
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-white/25 text-[12px]
                           inline-flex items-center justify-center font-bold">{count}</span>
          {t('cart.title')}
        </span>
        <span className="font-display font-black">{money(total, lang)}</span>
      </button>
    </div>
  )
}
