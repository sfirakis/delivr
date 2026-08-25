import type { Lang } from './i18n'

export const CURRENCY = 'EUR'

export function money(value: number | string | null | undefined, lang: Lang = 'el', currency = CURRENCY) {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return new Intl.NumberFormat(lang === 'el' ? 'el-GR' : 'en-GB', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

/** Percentages follow the same locale as money, so 10.0% reads as 10,0% in Greek. */
export function pct(value: number | string | null | undefined, digits = 1, lang: Lang = 'el') {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return new Intl.NumberFormat(lang === 'el' ? 'el-GR' : 'en-GB', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0) + '%'
}

export function num(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function time(iso: string | null | undefined, lang: Lang = 'el') {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(lang === 'el' ? 'el-GR' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' })
}

export function dateTime(iso: string | null | undefined, lang: Lang = 'el') {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB',
    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function dateOnly(iso: string | null | undefined, lang: Lang = 'el') {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB',
    { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Minutes from now until an ISO timestamp (never negative). */
export function minutesUntil(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
}

export function relativeMinutes(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

/** Lowercase and strip Greek/Latin accents, so «Ελούντα» matches «ΕΛΟΥΝΤΑ». */
function foldAccents(t: string): string {
  // Lowercase first: «ΑΓΙΟΣ» lowercases to a final sigma «αγιος», which only
  // matches «Άγιος» once both sigmas are folded to the same letter.
  const from = 'άέήίόύώϊϋΐΰςáéíóúàèìòùäëïöü'
  const to   = 'αεηιουωιυιυσaeiouaeiouaeiou'
  let out = ''
  for (const ch of t.toLowerCase()) {
    const i = from.indexOf(ch)
    out += i >= 0 ? to[i] : ch
  }
  return out.replace(/\s+/g, ' ').trim()
}

/**
 * Builds one address line from parts, skipping anything the address already says.
 *
 * Operators type the street however they like — some include the area, some
 * don't — so blindly appending area and city produces «Οδός Σχίσμα 14, Ελούντα,
 * Ελούντα». This keeps the first mention and drops the repeats.
 */
export function fullAddress(
  address: string | null | undefined,
  ...parts: (string | null | undefined)[]
): string {
  const base = (address ?? '').trim()
  const kept: string[] = base ? [base] : []
  let seen = foldAccents(base)

  for (const part of parts) {
    const value = (part ?? '').trim()
    if (!value) continue
    const folded = foldAccents(value)
    if (!folded || seen.includes(folded)) continue
    kept.push(value)
    seen += ` ${folded}`
  }

  return kept.join(', ')
}

/** Digits-only phone for tel: and wa.me links. */
export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}
