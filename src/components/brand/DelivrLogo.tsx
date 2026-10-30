/**
 * «delivr by ActionWeb» — the ONE brand mark across the app.
 *
 *   variant  "full"    wordmark + small «by ActionWeb» under its right edge
 *            "compact" wordmark only (tight spaces)
 *   tone     "light"   for light surfaces: orange wordmark, dark «by»
 *            "dark"    for ink/black surfaces: orange wordmark, muted-light «by»
 *   size     font size of the wordmark; the «by» line scales in em.
 *
 * Delivr keeps its own colour (#FF4500) and font (Syne); the favicon and the
 * OG image are untouched on purpose.
 */
type Variant = 'full' | 'compact'
type Tone = 'light' | 'dark'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<Size, string> = {
  xs: 'text-lg',        // footers, inline
  sm: 'text-2xl',       // app top bars
  md: 'text-[32px]',    // dashboards
  lg: 'text-5xl',       // auth hero
  xl: 'text-[56px]',    // landing hero
}

export const BRAND = { name: 'delivr', by: 'by ActionWeb', fullName: 'Delivr by ActionWeb' } as const

export default function DelivrLogo({
  variant = 'full',
  tone = 'light',
  size = 'sm',
  decorative = false,
  className = '',
}: {
  variant?: Variant
  tone?: Tone
  size?: Size
  /** Hide from assistive tech when the name is already announced next to it. */
  decorative?: boolean
  className?: string
}) {
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': BRAND.fullName } as const)
  const by = tone === 'dark' ? 'text-ink-3' : 'text-ink-2'

  return (
    <span
      {...a11y}
      data-brand="delivr-logo"
      data-variant={variant}
      className={`font-display inline-flex shrink-0 flex-col items-end leading-none ${SIZE[size]} ${className}`}
    >
      <span aria-hidden="true" className="font-black tracking-tighter text-brand">{BRAND.name}</span>
      {variant === 'full' && (
        <span aria-hidden="true" className="-mt-[0.02em] flex">
          <span className={`whitespace-nowrap font-body font-semibold tracking-normal ${by}`}
                style={{ fontSize: 'max(0.3em, 10px)' }}>
            {BRAND.by}
          </span>
        </span>
      )}
    </span>
  )
}
