import { useEffect, type ReactNode } from 'react'

export function StatCard({ icon, label, value, sub, tone = 'default' }: {
  icon: string; label: string; value: ReactNode; sub?: string
  tone?: 'default' | 'brand' | 'success' | 'warning'
}) {
  const tones = {
    default: 'bg-surface-1 border-surface-4',
    brand:   'bg-brand-50 border-brand-100',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
  }
  return (
    <div className={`border rounded-2xl p-4 ${tones[tone]}`}>
      <div className="text-xl mb-1.5">{icon}</div>
      <p className="font-display font-black text-2xl text-ink-1 leading-tight">{value}</p>
      <p className="text-xs font-semibold text-ink-1 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="input-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-field ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-field resize-none ${props.className ?? ''}`} />
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input-field ${props.className ?? ''}`}>{children}</select>
}

export function CheckRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
             className="accent-brand w-4 h-4 mt-0.5 flex-shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-1">{label}</span>
        {hint && <span className="block text-[11px] text-ink-3">{hint}</span>}
      </span>
    </label>
  )
}

export function Card({ title, action, children, className = '' }: {
  title?: string; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`dash-card p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          {title && <h3 className="font-display font-bold text-base text-ink-1">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-surface-1 rounded-2xl shadow-float w-full my-6 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-4 sticky top-0 bg-surface-1 rounded-t-2xl z-10">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string; badge?: number }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-surface-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition
            ${active === tab.id ? 'border-brand text-brand' : 'border-transparent text-ink-2 hover:text-ink-1'}`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="ml-1.5 badge badge-brand">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  pending: 'badge-amber', confirmed: 'badge-green', preparing: 'badge-amber',
  ready: 'badge-green', picked_up: 'badge-brand', on_the_way: 'badge-brand',
  delivered: 'badge-green', cancelled: 'bg-red-100 text-danger',
  paid: 'badge-green', invoiced: 'badge-brand', void: 'badge-gray',
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${STATUS_TONE[status] ?? 'badge-gray'}`}>{label ?? status}</span>
}

/** Download any text payload as a file — used for CSV exports and QR sheets. */
export function downloadFile(filename: string, content: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob(['﻿' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(';'), ...rows.map(r => headers.map(h => esc(r[h])).join(';'))].join('\n')
}
