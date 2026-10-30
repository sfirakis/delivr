import { Link, useNavigate } from 'react-router-dom'
import { money, dateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { EmptyState } from '@/components/ui'
import { listMyOrders } from './myOrders'

/** Orders placed from this device — each opens its live tracking page. */
export default function MyOrdersPage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const orders = listMyOrders()
  useDocumentTitle(t('market.myOrders'))

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate('/')} aria-label={t('common.back')}>←</button>
        <div>
          <h2 className="font-display font-bold text-lg leading-tight">{t('market.myOrders')}</h2>
          <p className="text-[11px] text-ink-3">{t('market.myOrdersHint')}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {orders.length === 0 && <EmptyState emoji="🧾" title={t('market.noOrders')} />}
        {orders.map(o => (
          <Link key={o.token} to={`/t/${o.token}`}
                className="block bg-surface-1 border border-surface-4 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{o.store}</p>
                <p className="text-[11px] text-ink-3">{o.number} · {dateTime(o.at, lang)}</p>
              </div>
              <span className="font-display font-black text-brand whitespace-nowrap">{money(o.total, lang)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
