// ─── Skeleton loader ────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

// ─── Star rating ─────────────────────────────────────────────
export function StarRating({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  return (
    <div className={`flex items-center gap-1 ${size === 'md' ? 'text-sm' : 'text-xs'}`}>
      <span className="text-amber-400">★</span>
      <span className="font-semibold text-ink-1">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-ink-3">({count})</span>}
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────
export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-surface-4 ${className}`} />
}

// ─── Section header ──────────────────────────────────────────
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-header">
      <h2 className="section-title">{title}</h2>
      {action && (
        <button className="section-link" onClick={onAction}>{action} →</button>
      )}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────
export function EmptyState({ emoji, title, subtitle, action, onAction }: {
  emoji: string; title: string; subtitle?: string; action?: string; onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
      <div className="text-5xl">{emoji}</div>
      <div>
        <p className="font-display font-bold text-lg text-ink-1">{title}</p>
        {subtitle && <p className="text-sm text-ink-3 mt-1">{subtitle}</p>}
      </div>
      {action && onAction && (
        <button className="btn btn-primary btn-md" onClick={onAction}>{action}</button>
      )}
    </div>
  )
}

// ─── Quantity stepper ─────────────────────────────────────────
export function QtyStepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="qty-stepper">
      <button className="qty-btn qty-btn-minus" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="w-6 text-center font-bold text-base">{value}</span>
      <button className="qty-btn qty-btn-plus" onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────────────────
export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative w-12 h-6 cursor-pointer flex-shrink-0">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track peer-checked:bg-brand" />
      <div className="toggle-thumb peer-checked:translate-x-6" />
    </label>
  )
}

// ─── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 24, color = '#FF4500' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.2" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── Status badge ─────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Εκκρεμεί',       cls: 'badge-amber' },
  confirmed:  { label: 'Επιβεβαιώθηκε',  cls: 'badge-green' },
  preparing:  { label: 'Ετοιμάζεται',    cls: 'badge-amber' },
  ready:      { label: 'Έτοιμο',          cls: 'badge-green' },
  picked_up:  { label: 'Παραλήφθηκε',    cls: 'badge-brand' },
  on_the_way: { label: 'Στο δρόμο 🛵',   cls: 'badge-brand' },
  delivered:  { label: '✓ Παραδόθηκε',   cls: 'badge-green' },
  cancelled:  { label: '✗ Ακυρώθηκε',    cls: 'bg-red-100 text-danger badge' },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// ─── Back header ──────────────────────────────────────────────
export function BackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-4 flex-shrink-0">
      <button className="btn-icon" onClick={onBack}>←</button>
      <h2 className="font-display font-bold text-xl flex-1">{title}</h2>
      {right}
    </div>
  )
}

// ─── Loyalty progress ─────────────────────────────────────────
export function LoyaltyBar({ points, goal = 500 }: { points: number; goal?: number }) {
  const pct = Math.min(100, (points / goal) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-ink-2">🏆 {points} πόντοι</span>
        <span className="text-brand font-bold">{goal - points} για δώρο</span>
      </div>
      <div className="loyalty-bar">
        <div className="loyalty-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
