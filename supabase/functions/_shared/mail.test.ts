// Local tests for the mail path. No email leaves the machine: SMTP goes to a
// fake server on 127.0.0.1, and the run is limited to --allow-net=127.0.0.1.
//
//   npx deno test --node-modules-dir=none --no-lock --allow-env \
//     --allow-net=127.0.0.1 --allow-read --allow-sys supabase/functions/_shared/

import { esc, isSingleEmail, mailProvider, oneLine, sendMail } from './mailer.ts'
import { isServiceRoleRequest, sentEmails } from './guards.ts'
import { sendClaimed, supabaseClaims, type ClaimColumn, type ClaimStore } from './order-mail.ts'
import type { Mail, MailResult } from './mailer.ts'

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg) }

const VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_SECURE', 'RESEND_API_KEY', 'RESEND_FROM']
function setEnv(o: Record<string, string>) {
  for (const k of VARS) Deno.env.delete(k)
  for (const [k, v] of Object.entries(o)) Deno.env.set(k, v)
}

// ── Fake SMTP server: records RCPT TO lines and the DATA ─────
interface Capture { rcpt: string[]; data: string }
async function withFakeSmtp(port: number, fn: (cap: Capture) => Promise<void>, refuse: string[] = []) {
  const cap: Capture = { rcpt: [], data: '' }
  const listener = Deno.listen({ hostname: '127.0.0.1', port })
  const conns: Deno.Conn[] = []
  const serving = (async () => {
    for await (const conn of listener) {
      conns.push(conn)
      ;(async () => {
        const enc = new TextEncoder(), dec = new TextDecoder()
        const w = (s: string) => conn.write(enc.encode(s + '\r\n')).catch(() => 0)
        await w('220 fake ESMTP')
        let inData = false, buf = ''
        const b = new Uint8Array(65536)
        try {
          while (true) {
            const n = await conn.read(b); if (n === null) break
            buf += dec.decode(b.subarray(0, n))
            let i
            while ((i = buf.indexOf('\r\n')) >= 0) {
              const line = buf.slice(0, i); buf = buf.slice(i + 2)
              if (inData) {
                if (line === '.') { inData = false; await w('250 queued') } else cap.data += line + '\n'
                continue
              }
              const c = line.slice(0, 4).toUpperCase()
              if (c === 'EHLO') await w('250-fake\r\n250 AUTH PLAIN LOGIN')
              else if (c === 'AUTH') await w('235 ok')
              else if (c === 'RCPT') {
                if (refuse.some(a => line.includes(a))) await w('550 no such user')
                else { cap.rcpt.push(line); await w('250 ok') }
              }
              else if (c === 'DATA') { inData = true; await w('354 go') }
              else if (c === 'QUIT') { await w('221 bye'); conn.close(); return }
              else await w('250 ok')
            }
          }
        } catch { /* connection closed */ }
      })()
    }
  })()
  try { await fn(cap) } finally {
    listener.close()
    for (const c of conns) { try { c.close() } catch { /* already closed */ } }
    await serving.catch(() => {})
  }
}

const smtpEnv = (port: number) => ({
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false',
  SMTP_USER: 'delivr@test.invalid', SMTP_PASS: 'dummy', SMTP_FROM: 'Delivr <delivr@test.invalid>',
})

const opts = { sanitizeOps: false, sanitizeResources: false }

// ── Transport selection ──────────────────────────────────────
Deno.test('provider: none / resend / smtp wins', () => {
  setEnv({}); assert(mailProvider() === 'none', 'none')
  setEnv({ RESEND_API_KEY: 'x' }); assert(mailProvider() === 'resend', 'resend')
  setEnv({ RESEND_API_KEY: 'x', SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }); assert(mailProvider() === 'smtp', 'smtp')
})

Deno.test('no transport: nothing sent, missing var is named', async () => {
  setEnv({ SMTP_HOST: 'h', SMTP_USER: 'u' })
  const r = await sendMail({ to: ['a@test.invalid'], subject: 's', html: 'h' })
  assert(!r.ok && r.provider === 'none' && /SMTP_PASS not set/.test(r.error ?? ''), JSON.stringify(r))
})

Deno.test('smtp: send to local fake server, headers right', opts, async () => {
  await withFakeSmtp(2531, async (cap) => {
    setEnv(smtpEnv(2531))
    const r = await sendMail({ to: ['store@test.invalid', 'ops@test.invalid'], subject: 'Νέα παραγγελία', html: '<b>hi</b>', replyTo: 'support@test.invalid' })
    assert(r.ok && r.provider === 'smtp', JSON.stringify(r))
    assert(cap.rcpt.length === 2, 'two RCPT: ' + cap.rcpt.join(' / '))
    assert(/From: Delivr <delivr@test\.invalid>/.test(cap.data), 'From header')
    assert(/Reply-To: support@test\.invalid/.test(cap.data), 'Reply-To header')
  })
})

Deno.test('smtp: closed port returns an error, no throw', async () => {
  setEnv(smtpEnv(2599))
  const r = await sendMail({ to: ['x@test.invalid'], subject: 's', html: 'h' })
  assert(!r.ok && !!r.error, JSON.stringify(r))
})

// ── 1) One address per recipient field ───────────────────────
Deno.test('fix 1: isSingleEmail accepts one address only', () => {
  for (const ok of ['a@b.gr', 'guest.name+tag@mail.example.com']) assert(isSingleEmail(ok), ok)
  for (const bad of ['a@x.gr, b@y.gr', 'a@x.gr;b@y.gr', 'a@x.gr b@y.gr', 'Evil <a@x.gr>', '"a"@x.gr',
                     'a@x.gr\r\nBcc: c@z.gr', 'no-at-sign', '', 'a@b', null, 42]) {
    assert(!isSingleEmail(bad), 'should reject: ' + JSON.stringify(bad))
  }
})

Deno.test('fix 1: a guest_email list is rejected, not split (0 RCPT)', opts, async () => {
  await withFakeSmtp(2532, async (cap) => {
    setEnv(smtpEnv(2532))
    const r = await sendMail({ to: ['a@test.invalid, b@test.invalid, c@test.invalid'], subject: 's', html: 'h' })
    assert(!r.ok && r.error === 'invalid recipient address', JSON.stringify(r))
    assert(r.rejected?.length === 1, 'reported as rejected')
    assert(cap.rcpt.length === 0, 'no RCPT at all: ' + cap.rcpt.join(' / '))
  })
})

Deno.test('fix 1: bad entries dropped, good ones still sent; bad Reply-To dropped', opts, async () => {
  await withFakeSmtp(2533, async (cap) => {
    setEnv(smtpEnv(2533))
    const r = await sendMail({
      to: ['store@test.invalid', 'x@test.invalid, y@test.invalid'],
      subject: 'Hi\r\nBcc: evil@test.invalid', html: 'h', replyTo: 'a@test.invalid, b@test.invalid',
    })
    assert(r.ok && r.rejected?.length === 1, JSON.stringify(r))
    assert(cap.rcpt.length === 1 && /store@test\.invalid/.test(cap.rcpt[0]), 'only the store: ' + cap.rcpt.join(' / '))
    assert(!/^Bcc:/mi.test(cap.data) && /Subject: Hi Bcc: evil/.test(cap.data), 'subject on one line')
    assert(!/Reply-To:/i.test(cap.data), 'list Reply-To dropped')
  })
})

// ── REVIEW-SMTP-3: Bcc for the platform copy, server refusals logged ──
Deno.test('bcc: platform copy is a hidden recipient, not in To', opts, async () => {
  await withFakeSmtp(2534, async (cap) => {
    setEnv(smtpEnv(2534))
    const r = await sendMail({ to: ['store@test.invalid'], bcc: ['platform@test.invalid', 'STORE@test.invalid', 'bad, list@test.invalid'],
                               subject: 's', html: 'h', replyTo: 'guest@test.invalid' })
    assert(r.ok && r.rejected?.length === 1, JSON.stringify(r))
    assert(cap.rcpt.length === 2 && cap.rcpt.some(l => /platform@test\.invalid/.test(l)), 'store + platform RCPT: ' + cap.rcpt.join(' / '))
    assert(/^To: store@test\.invalid$/m.test(cap.data), 'To is the store only')
    assert(!/platform@test\.invalid/.test(cap.data) && !/^Bcc:/mi.test(cap.data), 'platform address not visible in the message')
    assert(/Reply-To: guest@test\.invalid/.test(cap.data), 'Reply-To the customer')
  })
})

Deno.test('smtp: a recipient refused by the server is reported, others still get it', opts, async () => {
  await withFakeSmtp(2535, async (cap) => {
    setEnv(smtpEnv(2535))
    const r = await sendMail({ to: ['store@test.invalid', 'owner@test.invalid'], subject: 's', html: 'h' })
    assert(r.ok, JSON.stringify(r))
    assert(r.rejected?.length === 1 && /owner@test\.invalid/.test(r.rejected[0]), 'refusal reported: ' + JSON.stringify(r))
    assert(cap.rcpt.length === 1 && /store@test\.invalid/.test(cap.rcpt[0]), 'store still got it')
  }, ['owner@test.invalid'])
})

// ── 2) send-notification: service-role only, escaped values ──
Deno.test('fix 2: only the service-role Bearer is accepted', () => {
  const key = 'service-role-test-value'
  const req = (h?: string) => new Request('http://localhost/x', { method: 'POST', headers: h ? { Authorization: h } : {} })
  assert(isServiceRoleRequest(req(`Bearer ${key}`), key), 'service role ok')
  assert(isServiceRoleRequest(req(`bearer  ${key} `), key), 'case/space tolerant')
  assert(!isServiceRoleRequest(req(), key), 'no header')
  assert(!isServiceRoleRequest(req('Bearer anon-key'), key), 'anon key')
  assert(!isServiceRoleRequest(req(`Bearer ${key}x`), key), 'longer key')
  assert(!isServiceRoleRequest(req(key), key), 'no Bearer prefix')
  assert(!isServiceRoleRequest(req(`Bearer ${key}`), undefined), 'server key not configured')
  assert(!isServiceRoleRequest(req('Bearer '), ''), 'empty key')
})

Deno.test('fix 2: request values are escaped and kept on one line', () => {
  assert(esc('<script>"x" & \'y\'</script>') === '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;', 'esc')
  assert(oneLine('Order\r\nBcc: a@b.gr\tok') === 'Order Bcc: a@b.gr ok', 'oneLine')
  assert(oneLine('x'.repeat(500), 150).length === 150, 'length cap')
  assert(!/[<>]/.test(esc(oneLine('<a href="https://phish">click</a>'))), 'no raw tags')
})

// ── 3) notify-order idempotency ──────────────────────────────
Deno.test('fix 3: sent rows block a second send per channel', () => {
  const guest = 'Guest@Test.invalid'
  assert(JSON.stringify(sentEmails([], guest)) === '{"store":false,"guest":false}', 'nothing yet')
  const storeOnly = [{ channel: 'email', target: 'store@test.invalid, ops@test.invalid', status: 'sent' }]
  assert(sentEmails(storeOnly, guest).store && !sentEmails(storeOnly, guest).guest, 'store sent only')
  const both = [...storeOnly, { channel: 'email', target: 'guest@test.invalid', status: 'sent' }]
  const s = sentEmails(both, guest)
  assert(s.store && s.guest, 'both sent (guest match is case-insensitive)')
  const notSent = [
    { channel: 'email', target: 'store@test.invalid', status: 'failed' },
    { channel: 'email', target: 'store@test.invalid', status: 'skipped' },
    { channel: 'whatsapp', target: '3069', status: 'sent' },
  ]
  const n = sentEmails(notSent, guest)
  assert(!n.store && !n.guest, 'failed/skipped/whatsapp rows do not count')
})

// ── 4) Parallel calls: atomic claim per channel ──────────────
/** In-memory "orders" table. Each claim yields first (like a DB round-trip),
 *  then does the UPDATE ... WHERE col IS NULL check-and-set in one step,
 *  which is what Postgres guarantees for a single UPDATE. */
function mockClaims() {
  const rows = new Map<string, Partial<Record<ClaimColumn, string | null>>>()
  const store: ClaimStore = {
    async claim(id, col, force = false) {
      await new Promise(r => setTimeout(r, Math.random() * 5))
      const row = rows.get(id) ?? {}
      if (!force && row[col] != null) return false
      rows.set(id, { ...row, [col]: new Date().toISOString() })
      return true
    },
    async release(id, col) {
      await new Promise(r => setTimeout(r, 1))
      rows.set(id, { ...(rows.get(id) ?? {}), [col]: null })
    },
  }
  return { store, rows }
}

function countingSender(ok = true) {
  const sent: Mail[] = []
  const send = async (m: Mail): Promise<MailResult> => {
    await new Promise(r => setTimeout(r, 10)) // slow SMTP: calls overlap
    if (ok) sent.push(m)
    return ok ? { ok: true, provider: 'smtp' } : { ok: false, provider: 'smtp', error: 'boom' }
  }
  return { sent, send }
}

/** What one notify-order call does: store email, then guest copy. */
async function oneCall(claims: ClaimStore, send: (m: Mail) => Promise<MailResult>, admin = false) {
  const store = await sendClaimed(claims, 'order-1', 'store_email_claimed_at',
    { to: ['store@test.invalid'], subject: 'store', html: 'h' }, send, admin)
  const guest = await sendClaimed(claims, 'order-1', 'guest_email_claimed_at',
    { to: ['guest@test.invalid'], subject: 'guest', html: 'h' }, send)
  return [store.outcome, guest.outcome]
}

Deno.test('fix 4: 5 parallel calls send exactly 1 store + 1 guest email', async () => {
  const { store } = mockClaims()
  const { sent, send } = countingSender()
  const outcomes = await Promise.all(Array.from({ length: 5 }, () => oneCall(store, send)))
  assert(sent.filter(m => m.subject === 'store').length === 1, 'store sent ' + sent.length)
  assert(sent.filter(m => m.subject === 'guest').length === 1, 'guest sent ' + sent.length)
  assert(outcomes.flat().filter(o => o === 'already_sent').length === 8, JSON.stringify(outcomes))
})

Deno.test('fix 4: a failed send clears the claim, a later call retries', async () => {
  const { store, rows } = mockClaims()
  const bad = countingSender(false)
  const r1 = await oneCall(store, bad.send)
  assert(r1.join() === 'failed,failed', r1.join())
  assert(rows.get('order-1')?.store_email_claimed_at === null, 'store claim cleared')
  const good = countingSender()
  const r2 = await oneCall(store, good.send)
  assert(r2.join() === 'sent,sent' && good.sent.length === 2, r2.join())
})

Deno.test('fix 4: admin resend forces the store email only, guest stays at one', async () => {
  const { store } = mockClaims()
  const { sent, send } = countingSender()
  await Promise.all(Array.from({ length: 5 }, () => oneCall(store, send)))
  const r = await oneCall(store, send, true)
  assert(r.join() === 'sent,already_sent', r.join())
  assert(sent.filter(m => m.subject === 'store').length === 2, 'store sent twice (admin resend)')
  assert(sent.filter(m => m.subject === 'guest').length === 1, 'guest still once')
})

Deno.test('fix 4: claim error fails closed (nothing sent)', async () => {
  const broken: ClaimStore = {
    claim: () => Promise.reject(new Error('column "store_email_claimed_at" does not exist')),
    release: () => Promise.resolve(),
  }
  const { sent, send } = countingSender()
  const r = await sendClaimed(broken, 'order-1', 'store_email_claimed_at', { to: ['s@test.invalid'], subject: 's', html: 'h' }, send)
  assert(r.outcome === 'claim_failed' && sent.length === 0, JSON.stringify(r))
})

Deno.test('fix 4: supabaseClaims builds UPDATE ... WHERE id AND col IS NULL RETURNING id', async () => {
  const calls: string[] = []
  const builder = (data: unknown) => {
    const b = {
      update: (v: Record<string, unknown>) => { calls.push('update ' + Object.keys(v).join() + '=' + (v[Object.keys(v)[0]] === null ? 'null' : 'now')); return b },
      eq: (c: string, v: string) => { calls.push(`eq ${c}=${v}`); return b },
      is: (c: string, v: null) => { calls.push(`is ${c} ${v}`); return b },
      select: (c: string) => { calls.push('select ' + c); return Promise.resolve({ data, error: null }) },
      then: (f: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(f),
    }
    return b
  }
  let data: unknown = [{ id: 'o1' }]
  const claims = supabaseClaims({ from: (t: string) => { calls.push('from ' + t); return builder(data) } })
  assert(await claims.claim('o1', 'guest_email_claimed_at') === true, 'claimed')
  assert(calls.join(' | ') === 'from orders | update guest_email_claimed_at=now | eq id=o1 | is guest_email_claimed_at null | select id', calls.join(' | '))
  data = []
  assert(await claims.claim('o1', 'guest_email_claimed_at') === false, 'not claimed when 0 rows')
  calls.length = 0
  await claims.claim('o1', 'store_email_claimed_at', true)
  assert(!calls.some(c => c.startsWith('is ')), 'force has no IS NULL')
  calls.length = 0
  await claims.release('o1', 'store_email_claimed_at')
  assert(calls.join(' | ') === 'from orders | update store_email_claimed_at=null | eq id=o1', calls.join(' | '))
})
