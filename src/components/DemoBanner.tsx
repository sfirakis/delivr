import { useI18n } from '@/lib/i18n'

/**
 * «Demo» notice for the seeded sample stores / properties (see lib/demo.ts).
 * EL + EN through i18n, like everything the guest sees.
 */
export function DemoBanner({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <div role="note" data-testid="demo-banner"
         className={`bg-amber-50 border-amber-200 text-amber-900 text-xs px-4 py-2 border-y ${className}`}>
      <p className="font-bold">🧪 {t('demo.title')}</p>
      <p className="mt-0.5">{t('demo.body')}</p>
    </div>
  )
}

export function DemoBadge() {
  const { t } = useI18n()
  return (
    <span data-testid="demo-badge"
          className="badge bg-amber-100 text-amber-900 border border-amber-200 flex-shrink-0">
      {t('demo.badge')}
    </span>
  )
}
