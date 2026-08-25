import { useState } from 'react'
import { STORE_GUIDE, ADMIN_GUIDE, STORE_HANDOUT, type HelpSection } from './content'
import { Card } from '@/admin/ui'
import { usePlatformSettings } from '@/admin/hooks'

function Section({ section, open, onToggle }: {
  section: HelpSection; open: boolean; onToggle: () => void
}) {
  return (
    <div className="dash-card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-xl">{section.icon}</span>
        <span className="flex-1 font-display font-bold text-base text-ink-1">{section.title}</span>
        <span className="text-ink-3 text-lg">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-surface-4 pt-3">
          {section.intro && <p className="text-sm text-ink-2 mb-3">{section.intro}</p>}
          <ol className="space-y-3">
            {section.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-3 text-ink-2
                                 flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-ink-1">{s.title}</p>
                  <p className="text-sm text-ink-2 mt-0.5">{s.body}</p>
                  {s.tip && (
                    <p className="text-xs text-ink-2 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-1.5 mt-1.5">
                      💡 {s.tip}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

/** Printable one-pager handed to a store when it joins. */
function Handout({ lang, platformName, supportPhone, supportEmail }: {
  lang: 'el' | 'en'; platformName: string; supportPhone?: string | null; supportEmail?: string | null
}) {
  const h = STORE_HANDOUT[lang]
  return (
    <div className="handout bg-surface-1 border border-surface-4 rounded-2xl p-6">
      <p className="text-[11px] uppercase tracking-widest text-ink-3 font-bold">{platformName}</p>
      <h2 className="font-display font-black text-2xl text-ink-1 mt-1">{h.title}</h2>
      <p className="text-sm text-ink-2">{h.subtitle}</p>

      <div className="mt-5 space-y-4">
        {h.sections.map((s, i) => (
          <div key={i}>
            <p className="font-bold text-sm text-ink-1">{s.h}</p>
            <p className="text-sm text-ink-2 mt-0.5">{s.p}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-3 mt-6 pt-4 border-t border-surface-4">
        {h.footer}
        {supportPhone && ` · ${supportPhone}`}
        {supportEmail && ` · ${supportEmail}`}
      </p>
    </div>
  )
}

export default function HelpPage({ audience }: { audience: 'store' | 'admin' }) {
  const guide = audience === 'admin' ? ADMIN_GUIDE : STORE_GUIDE
  const [open, setOpen] = useState<string | null>(guide[0]?.id ?? null)
  const [handoutLang, setHandoutLang] = useState<'el' | 'en'>('el')
  const settingsQ = usePlatformSettings()

  const platformName = settingsQ.data?.platform_name ?? 'Delivr'

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="no-print space-y-3">
        {guide.map(section => (
          <Section
            key={section.id}
            section={section}
            open={open === section.id}
            onToggle={() => setOpen(o => o === section.id ? null : section.id)}
          />
        ))}
      </div>

      {audience === 'admin' && (
        <Card
          title="Έντυπο για το κατάστημα"
          action={
            <div className="flex gap-2 no-print">
              <div className="inline-flex rounded-full border border-surface-4 p-0.5">
                {(['el', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setHandoutLang(l)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition
                      ${handoutLang === l ? 'bg-ink-1 text-white' : 'text-ink-2'}`}>
                    {l === 'el' ? 'ΕΛ' : 'EN'}
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                🖨️ Εκτύπωση
              </button>
            </div>
          }
        >
          <p className="text-sm text-ink-2 mb-3 no-print">
            Μονοσέλιδο που δίνεις στον υπεύθυνο του καταστήματος όταν μπαίνει στην πλατφόρμα.
          </p>
          <Handout
            lang={handoutLang}
            platformName={platformName}
            supportPhone={settingsQ.data?.support_phone}
            supportEmail={settingsQ.data?.support_email}
          />
        </Card>
      )}

      {audience === 'store' && (
        <div className="no-print dash-card p-4">
          <p className="font-display font-bold text-base mb-1">Κάτι δεν δουλεύει;</p>
          <ul className="text-sm text-ink-2 space-y-1.5 list-disc pl-5">
            <li>Δεν λαμβάνεις email; Έλεγξε τα ανεπιθύμητα και το «Email παραγγελιών» στις Ρυθμίσεις.</li>
            <li>Δεν εμφανίζεσαι στους πελάτες; Δες αν το κατάστημα είναι Ανοιχτό και αν το ωράριο καλύπτει την τρέχουσα ώρα.</li>
            <li>Ο εκτυπωτής βγάζει κομμένο δελτίο; Στις ρυθμίσεις εκτύπωσης βάλε χαρτί 80mm και μηδενικά περιθώρια.</li>
            <li>Λάθος μεταφορικά; Οι ζώνες παράδοσης ορίζονται από τον διαχειριστή της πλατφόρμας.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
