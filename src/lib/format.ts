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

// ── Phone numbers ────────────────────────────────────────────
// Greek numbers are stored however the merchant typed them ("694 412 3456",
// "+30 28210 12345", "0030281..."). Deep links need E.164, so everything is
// normalised through one place before it reaches a tel: or wa.me URL.

const DEFAULT_COUNTRY_CODE = '30'

/** Raw digits, no country logic. Internal helper — prefer phoneE164/phoneWa. */
function rawDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

/**
 * International digits without the leading '+' — what wa.me expects.
 * `6944123456` → `306944123456`, `2821012345` → `302821012345`,
 * `+30 694…` / `0030 694…` keep their existing country code.
 * Returns '' when the input cannot be a real number.
 */
export function phoneWa(phone: string | null | undefined, countryCode = DEFAULT_COUNTRY_CODE): string {
  const input = (phone ?? '').trim()
  let digits = rawDigits(input)
  if (!digits) return ''

  // Explicit international forms: '+30…' or '0030…'
  if (input.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)

  // Already carries the country code (30 + 10 national digits).
  if (digits.startsWith(countryCode) && digits.length === countryCode.length + 10) return digits

  // A national trunk '0' is not part of the Greek E.164 number.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')

  // Greek national numbers are 10 digits starting with 2 (fixed) or 6 (mobile).
  if (digits.length === 10 && /^[26]/.test(digits)) return countryCode + digits

  // Anything longer than a national number is assumed to be international already.
  if (digits.length > 10) return digits

  return countryCode + digits
}

/** E.164 with the leading '+' — what a tel: link should carry. */
export function phoneE164(phone: string | null | undefined, countryCode = DEFAULT_COUNTRY_CODE): string {
  const digits = phoneWa(phone, countryCode)
  return digits ? `+${digits}` : ''
}

/** href for a tel: link, or undefined when there is no usable number. */
export function telHref(phone: string | null | undefined): string | undefined {
  const e164 = phoneE164(phone)
  return e164.length >= 9 ? `tel:${e164}` : undefined
}

/** href for a wa.me link, or undefined when there is no usable number. */
export function waHref(phone: string | null | undefined, message?: string): string | undefined {
  const digits = phoneWa(phone)
  if (digits.length < 9) return undefined
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`
}
