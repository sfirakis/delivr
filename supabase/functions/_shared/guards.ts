// ============================================================
// _shared/guards.ts — small pure checks used by the mail functions
// (kept apart from the handlers so they can be unit-tested)
// ============================================================

/** Constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

/**
 * True only when the request carries `Authorization: Bearer <service role key>`.
 * This is what every internal caller of send-notification already sends
 * (confirm-order, assign-driver, order-status-webhook, the pg_net trigger).
 */
export function isServiceRoleRequest(req: Request, serviceKey: string | undefined): boolean {
  if (!serviceKey) return false
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return !!m && safeEqual(m[1].trim(), serviceKey)
}

export interface DispatchRow { channel: string; target: string | null; status: string }

/**
 * Idempotency for notify-order: which emails for this order already went out.
 * The guest copy is the `sent` email row whose target is the guest address;
 * any other `sent` email row is the store email.
 */
export function sentEmails(rows: DispatchRow[], guestEmail: string | null | undefined) {
  const guest = (guestEmail ?? '').trim().toLowerCase()
  let store = false, guestSent = false
  for (const r of rows) {
    if (r.channel !== 'email' || r.status !== 'sent') continue
    if (guest && (r.target ?? '').trim().toLowerCase() === guest) guestSent = true
    else store = true
  }
  return { store, guest: guestSent }
}
