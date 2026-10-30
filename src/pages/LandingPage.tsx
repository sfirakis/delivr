import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'
import DelivrLogo from '@/components/brand/DelivrLogo'

/**
 * /qr — the Delivr QR product line (B): tells a guest who typed the address by
 * hand that ordering starts from the QR code in their room, and gives partners
 * a way into their dashboard. Deliberately bilingual — a guest arriving here
 * has not picked a language yet. (Until 30/10/2026 this was the root URL; the
 * root is now the Delivr Stores marketplace, product line A.)
 */
export default function LandingPage() {
  const { t } = useI18n()
  // No useDocumentTitle here on purpose: index.html already carries the right
  // title for the root URL, which is also what gets shared and indexed.

  return (
    <div className="h-full flex flex-col items-center justify-center bg-ink-1 px-8 text-center">
      <h1><DelivrLogo variant="full" tone="dark" size="xl" /></h1>

      <div className="mt-8 space-y-2 max-w-[300px]">
        <p className="text-base text-white font-medium leading-snug">
          Σκάναρε το QR του καταλύματός σου για να παραγγείλεις
        </p>
        <p className="text-sm text-ink-3 leading-snug">
          Scan the QR code in your accommodation to order
        </p>
      </div>

      <div className="mt-10 text-4xl" aria-hidden="true">📱</div>

      <Link
        to="/auth"
        className="mt-12 text-xs text-ink-3 underline underline-offset-4 min-h-[44px] inline-flex items-center px-3"
      >
        {t('landing.partner')}
      </Link>

      <Link to="/" className="mt-1 text-xs text-ink-3 underline underline-offset-4 min-h-[44px] inline-flex items-center px-3">
        🛵 Delivr Stores — delivery &amp; take away
      </Link>

      <Link to="/terms" className="mt-1 text-[11px] text-ink-3 min-h-[44px] inline-flex items-center px-3">
        {t('terms.link')}
      </Link>
    </div>
  )
}
