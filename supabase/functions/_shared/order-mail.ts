// ============================================================
// _shared/order-mail.ts — send an order email at most once, even when
// notify-order is called many times in parallel.
//
// Before sending, the caller atomically claims a per-channel column on the
// order (migration 019):
//   UPDATE orders SET <col> = now() WHERE id = $1 AND <col> IS NULL RETURNING id
// Only the call that gets the row back sends. If the send fails the claim is
// cleared, so a later call can try again. An admin resend forces the claim.
// ============================================================

import type { Mail, MailResult } from './mailer.ts'

export type ClaimColumn = 'store_email_claimed_at' | 'guest_email_claimed_at'

export interface ClaimStore {
  /** true = this caller owns the send. `force` (admin resend) ignores an earlier claim. */
  claim(orderId: string, col: ClaimColumn, force?: boolean): Promise<boolean>
  release(orderId: string, col: ClaimColumn): Promise<void>
}

/** Minimal shape of the supabase-js query builder that we use. */
// deno-lint-ignore no-explicit-any
type Db = { from(table: string): any }

export function supabaseClaims(db: Db): ClaimStore {
  return {
    async claim(orderId, col, force = false) {
      let q = db.from('orders').update({ [col]: new Date().toISOString() }).eq('id', orderId)
      if (!force) q = q.is(col, null)
      const { data, error } = await q.select('id')
      if (error) throw new Error(`claim ${col}: ${error.message}`)
      return Array.isArray(data) && data.length === 1
    },
    async release(orderId, col) {
      const { error } = await db.from('orders').update({ [col]: null }).eq('id', orderId)
      if (error) console.error(`release ${col}:`, error.message)
    },
  }
}

export type ClaimedOutcome =
  | { outcome: 'already_sent' }
  | { outcome: 'claim_failed'; error: string }
  | { outcome: 'sent' | 'failed'; result: MailResult }

/** Claim, send, and release the claim again if the send did not go out. */
export async function sendClaimed(
  claims: ClaimStore,
  orderId: string,
  col: ClaimColumn,
  mail: Mail,
  send: (m: Mail) => Promise<MailResult>,
  force = false,
): Promise<ClaimedOutcome> {
  let mine: boolean
  try {
    mine = await claims.claim(orderId, col, force)
  } catch (err) {
    // Fail closed: without a working claim we do not send (no duplicates).
    return { outcome: 'claim_failed', error: String((err as Error)?.message ?? err).slice(0, 300) }
  }
  if (!mine) return { outcome: 'already_sent' }

  const result = await send(mail)
  if (!result.ok) await claims.release(orderId, col)
  return { outcome: result.ok ? 'sent' : 'failed', result }
}
