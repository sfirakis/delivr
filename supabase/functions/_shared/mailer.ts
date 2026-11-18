// ============================================================
// _shared/mailer.ts — one mail transport for every Delivr function
//
// SMTP first: every product sends from its own @actionweb.gr mailbox
// (HQ decision 17/11/2026). Resend is only a fallback, used when SMTP is not
// configured and RESEND_API_KEY is set. Secrets live in Supabase → Edge
// Functions → Secrets, never in code. See docs/EMAIL-SMTP.md.
//
// Supabase Edge blocks outbound ports 25 and 587, so use 465 (TLS).
// ============================================================

// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from 'npm:nodemailer@6.9.16'

export type MailProvider = 'smtp' | 'resend' | 'none'
export interface Mail { to: string[]; subject: string; html: string; replyTo?: string }
export interface MailResult {
  ok: boolean
  provider: MailProvider
  error?: string
  /** Addresses that were refused because they are not exactly one valid address. */
  rejected?: string[]
}

const env = (k: string) => (Deno.env.get(k) ?? '').trim()

export const NO_TRANSPORT = 'no mail transport: set SMTP_HOST/SMTP_USER/SMTP_PASS (or RESEND_API_KEY)'

// ── Small text helpers ───────────────────────────────────────
/** HTML-escape any value before it goes into an email body. */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** Strip CR/LF (and other control chars) and trim: for subjects and single-line values. */
export const oneLine = (s: unknown, max = 200) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Exactly ONE plain address. No lists ("a@x, b@y"), no display names, no
 * brackets or quotes, no whitespace: so a guest-typed field can never turn
 * into several recipients.
 */
const ONE_ADDRESS = /^[^\s@,;<>"'()\[\]\\]+@[^\s@,;<>"'()\[\]\\]+\.[^\s@,;<>"'()\[\]\\]{2,}$/
export function isSingleEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && ONE_ADDRESS.test(v)
}

// ── Transport selection ──────────────────────────────────────
/** Which SMTP variables are missing (empty list = SMTP fully configured). */
export function smtpMissing(): string[] {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(k => !env(k))
}

export function mailProvider(): MailProvider {
  if (smtpMissing().length === 0) return 'smtp'
  if (env('RESEND_API_KEY')) return 'resend'
  return 'none'
}

/** Explains why nothing can be sent, naming the missing SMTP variable(s). */
export function noTransportReason(): string {
  const missing = smtpMissing()
  if (missing.length > 0 && missing.length < 3) return `${missing.join(', ')} not set; ${NO_TRANSPORT}`
  return NO_TRANSPORT
}

function smtpPort(): number {
  const p = Number(env('SMTP_PORT'))
  return Number.isInteger(p) && p > 0 && p < 65536 ? p : 465
}

// ── Send ─────────────────────────────────────────────────────
export async function sendMail(m: Mail): Promise<MailResult> {
  const provider = mailProvider()
  const raw = m.to.map(v => (typeof v === 'string' ? v.trim() : v))
  const to = raw.filter(isSingleEmail)
  const rejected = raw.filter(v => !isSingleEmail(v)).map(v => oneLine(v, 120))
  const replyTo = m.replyTo && isSingleEmail(m.replyTo.trim()) ? m.replyTo.trim() : undefined
  const subject = oneLine(m.subject, 250)
  const base = rejected.length ? { rejected } : {}

  if (provider === 'none') return { ok: false, provider, error: noTransportReason(), ...base }
  if (to.length === 0) {
    return { ok: false, provider, error: rejected.length ? 'invalid recipient address' : 'no recipient', ...base }
  }

  try {
    if (provider === 'smtp') {
      const port = smtpPort()
      const secure = env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465
      const transport = nodemailer.createTransport({
        host: env('SMTP_HOST'), port, secure,
        auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      })
      try {
        await transport.sendMail({
          from: env('SMTP_FROM') || `Delivr <${env('SMTP_USER')}>`,
          // Each element is one validated address; pass as an array so
          // nothing is re-parsed from a joined string.
          to, subject, html: m.html, replyTo,
        })
      } finally {
        transport.close()
      }
      return { ok: true, provider, ...base }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('RESEND_FROM') || env('SMTP_FROM') || 'Delivr <onboarding@resend.dev>',
        to, subject, html: m.html, reply_to: replyTo,
      }),
    })
    if (res.ok) return { ok: true, provider, ...base }
    return { ok: false, provider, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`, ...base }
  } catch (err) {
    return { ok: false, provider, error: String((err as Error)?.message ?? err).slice(0, 500), ...base }
  }
}
