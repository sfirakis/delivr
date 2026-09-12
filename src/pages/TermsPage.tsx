import { useNavigate } from 'react-router-dom'
import { useI18n, LangToggle, type TKey } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const SECTIONS: { h: TKey; p: TKey }[] = [
  { h: 'terms.service.h', p: 'terms.service.p' },
  { h: 'terms.orders.h',  p: 'terms.orders.p'  },
  { h: 'terms.prices.h',  p: 'terms.prices.p'  },
  { h: 'terms.cancel.h',  p: 'terms.cancel.p'  },
  { h: 'terms.data.h',    p: 'terms.data.p'    },
  { h: 'terms.contact.h', p: 'terms.contact.p' },
]

/** Static terms + GDPR note, linked from guest checkout and from /auth. */
export default function TermsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  useDocumentTitle(t('terms.title'))

  return (
    <div className="h-full flex flex-col bg-surface-2">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-b border-surface-4 flex-shrink-0">
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label={t('common.back')}>←</button>
        <h1 className="flex-1 font-display font-bold text-lg truncate">{t('terms.title')}</h1>
        <LangToggle className="flex-shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {SECTIONS.map(s => (
          <section key={s.h}>
            <h2 className="font-display font-bold text-sm text-ink-1 mb-1">{t(s.h)}</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">{t(s.p)}</p>
          </section>
        ))}

        <p className="text-center text-[10px] text-ink-3 pt-2 pb-4">
          {t('guest.poweredBy')} <span className="font-bold">Delivr</span>
        </p>
      </div>
    </div>
  )
}
