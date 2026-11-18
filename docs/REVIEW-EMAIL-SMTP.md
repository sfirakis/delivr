# Review: email via SMTP (commit ba64c21)

Reviewer: independent (did not write the code). Date: 18/11/2026.
Scope: `git diff origin/master...HEAD` on `fix/email-smtp`: `notify-order`, `send-notification`,
`.env.example`, `docs/EMAIL-SMTP.md`. Local checks only: no live endpoint, no secrets, no email sent.

## Verdict: FIX NEEDED

The SMTP code itself is correct and safe to run. But setting `SMTP_*` turns on real sending from
`delivr@actionweb.gr` for two paths that anyone on the internet can trigger, and one of them lets a
caller choose many recipients. Fix items 1 and 2 before the HQ sets the secrets. Both are small.

## What I checked and what I found

| Check | Result |
|---|---|
| `npx deno check --node-modules-dir=none --no-lock` on both functions | Passes (exit 0, no errors). |
| nodemailer 6.9.16 on the Deno runtime | Works. I ran a script under Deno 2.9.6 against a fake SMTP server on `127.0.0.1`: AUTH, RCPT, DATA, QUIT all fine. A closed port gives `ECONNREFUSED` in the catch block. Supabase Edge allows `npm:` imports and outbound 465, so this should work there too. It is still unproven on the live mail server: TLS on `mail.actionweb.gr:465` and the certificate name are tested only by the first live test order. |
| SMTP failure breaks the order? | No. `sendMail` catches everything and returns `{ok:false,error}`. The order already exists before `notify-order` runs. Guest and shop checkout call it fire-and-forget (`void notifyOrder(...)`). Timeouts are 10s/10s/20s, so the worst case is about 40s per send, two sends in a row. That is under the Edge limit and does not block the guest. |
| Nothing configured (`skipped_no_key`) | Kept. `provider === 'none'` → `results.email = 'skipped_no_key'`, a `skipped` row, no guest copy. The e2e mocks (`e2e/guest-flow.mjs`, `e2e/shop-flow.mjs`) still match. The `provider` column has no CHECK, so `'none'` / `'smtp'` insert fine. |
| Header injection in Subject / Reply-To | Safe. nodemailer replaces CR/LF with a space in every header (`mime-node/index.js` `_encodeHeaderValue`). I confirmed it: subject `Hi\r\nBcc: evil` came out as `Subject: Hi Bcc: evil` and there was no extra RCPT. |
| Recipient injection in To | **Not safe.** See issue 1. |
| Secrets in code/docs | None. Only names, host `mail.actionweb.gr`, user `delivr@actionweb.gr` and the public project ref. `SMTP_PASS=` is empty in `.env.example`. |

## Issues (what to change)

1. **`guest_email` can be a list of addresses (high).** `place_order` (migration 018) stores
   `guest_email` after a trim only, with no format check. `sendMail` does `to.join(', ')` and
   nodemailer parses commas, so `a@x, b@y, c@z` becomes 3 RCPTs (I confirmed this on the fake
   server). An anonymous guest can make our mailbox send the confirmation to any number of
   addresses. That hurts the actionweb.gr mail reputation (blacklists) and can spill over to
   every product that sends from that server. With Resend the string was one array element and
   Resend rejected it, so this is new risk.
   **Change:** in `sendMail` (or before calling it), accept only addresses that match one
   address, for example `/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/`, and drop or fail the
   others. Ideally also check the format in `place_order`.

2. **`send-notification` is open to the internet and now really sends (high).**
   `supabase/config.toml` has `verify_jwt = false` for it, and the handler checks no auth. Anyone
   can POST `{userId, title, data:{orderId,status,storeName,eta}}`. `title` goes into the Subject
   and `storeName` / `eta` / `full_name` go into the HTML without escaping. Today nothing goes out
   because there is no key. Once `SMTP_*` is set (secrets are shared by all functions in the
   project), this becomes a phishing sender from `delivr@actionweb.gr` to any registered user
   whose UUID is known. All real callers (`confirm-order`, `assign-driver`,
   `order-status-webhook`, the pg_net trigger in migration 002) already send
   `Authorization: Bearer <service role key>`.
   **Change:** at the top of the handler, reject (401) any request whose Bearer is not
   `SUPABASE_SERVICE_ROLE_KEY`, and escape the template values (an `esc()` like the one in
   notify-order). The other option is to leave SMTP out of `send-notification` for now. It is
   not in George's "orders arrive by email" path.

3. **`notify-order` can be replayed (medium; older bug, now it costs mail).** Anyone with
   `order_id` + `public_token` (the guest has both in the tracking URL) can call it again and
   again. Each call emails the store, support, the owner and the guest. Together with issue 1
   that is a spam engine. **Change:** if `order_dispatch_log` already has a `sent` email row for
   the order, skip it (return `already_sent`). For the admin "resend" button in `OrdersPage`, keep
   a separate path that requires the admin JWT, or allow a resend only after N minutes.

Smaller points (do them if cheap, they do not block):

4. `sendMail` is copy-pasted into both functions. Move it to `supabase/functions/_shared/mailer.ts`
   so a fix (such as issue 1) lands in one place.
5. When `SMTP_HOST` is set but `SMTP_PASS` is missing, mail quietly drops to Resend/none with the
   generic `NO_TRANSPORT` text. Log which variable is missing, for example `SMTP_PASS not set`. A
   non-numeric `SMTP_PORT` gives `NaN`, so fall back to 465.
6. `results.email` on failure changed from `failed_<status>` to `failed`. No caller in `src/`
   reads it, so this is fine, but note it in the changelog.
7. The Resend wording is stale in `README.md` (lines ~138, ~178), `ROADMAP.md:148` ("only
   RESEND_API_KEY left") and `.claude/memory/structure.md:24`. Point them to `docs/EMAIL-SMTP.md`.
8. Live test: also check SPF/DKIM for `actionweb.gr` on that server (Gmail "show original"), and
   not only whether the message arrived. Store emails that land in spam are the same problem as
   emails that never arrive.

## What is good

- It follows the 17/11 decision: SMTP first, Resend only as a fallback, port 465, secrets only in
  Supabase.
- `skipped_no_key` is kept, so the e2e tests and callers do not break.
- The order flow cannot fail because of email: errors are caught, there are timeouts, the
  transport is closed in `finally`, and the checkout call is fire-and-forget.
- `order_dispatch_log` now stores the real provider and the server error text, which is good for
  the live test.
- The guest copy now has a Reply-To to support.
- The docs are clear and hold no values.

## Re-review condition

READY once issues 1 and 2 are fixed (3 is strongly recommended in the same round). Then re-run
`deno check` and the fake-SMTP test with a `guest_email` that contains a comma: it must produce
0 or 1 RCPT.

---

## Re-review (commit 1ef0e28, 18/11/2026)

Scope: `git diff 107dbdd..1ef0e28` (`_shared/mailer.ts`, `_shared/guards.ts`, `_shared/mail.test.ts`,
both functions, README, docs). Local checks only.

### Verdict: FIX NEEDED (one small item; issues 1 and 2 are fixed)

| Check | Result |
|---|---|
| `deno test ... supabase/functions/_shared/` | 10 passed, 0 failed (fake SMTP on 127.0.0.1 only). |
| `deno check` on notify-order, send-notification, `_shared/*.ts` | Passes, exit 0. |
| Issue 1: one address per recipient | **Fixed.** `isSingleEmail` rejects lists, `;`, spaces, display names, quotes and CR/LF. `to` goes to nodemailer as an array of validated addresses, so nothing is re-parsed. A comma `guest_email` gives 0 RCPT (tested). A bad Reply-To is dropped. The subject goes through `oneLine`. |
| Issue 2: send-notification | **Fixed.** It returns 401 unless the request has `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (constant-time compare). It fails closed when the key is not set. All template values are escaped, the title is one line, and the status lookup uses `Object.hasOwn`. |
| Admin resend (`delivr_is_admin`) | **No bypass found.** The RPC runs with the caller's own JWT and the anon key. `delivr_is_admin()` checks `auth.uid()` against `profiles.role = 'admin'`, so the anon key or a guest token gives `null`, which means false. An RPC error gives `undefined`, which also means false. EXECUTE is revoked from `anon` (migration 008). Resend only re-sends the store email to the fixed store/support/owner addresses, never the guest copy. Not checked: whether a normal user can set their own `profiles.role`. The base schema with the profiles UPDATE policies is not in this repo. That is a wider question, not part of this change. |
| Issue 3: replay | **Fixed for calls in sequence only.** See below. |

### What is still wrong

1. **Check-then-send race in notify-order (medium, blocks READY).** The function reads the
   `sent` rows first. It writes the log rows only at the end, after the SMTP sends, which take
   1-2s or more. N parallel calls with the same `order_id` + `public_token` all see "nothing
   sent", and they send N store emails and N guest copies. The guest copy still goes to the
   one address the guest typed, which can be any third party's address. So one order plus a
   burst of parallel requests is still a way to send many emails from `delivr@actionweb.gr`.
   **Change (small):** claim the send atomically before sending. Example: add
   `store_email_sent_at` / `guest_email_sent_at` to `orders`, run
   `UPDATE orders SET guest_email_sent_at = now() WHERE id = $1 AND guest_email_sent_at IS NULL RETURNING id`
   (via an RPC or the service client), and send only when a row comes back. Clear the column
   again if the send fails, so a retry is possible. The admin resend can skip the claim for the
   store email only. Another option: a partial unique index on `order_dispatch_log` with a
   `queued` claim row inserted before the send.

### Minor (do not block)

- The pg_net trigger (migration 002) authenticates with `current_setting('app.service_role_key')`.
  If that setting is not exactly the same as the function's `SUPABASE_SERVICE_ROLE_KEY` (for
  example after a key rotation or the move to the new `sb_secret_` keys), the status
  notifications from the trigger now get 401. After deploy, check that one status change still
  writes a notification.
- A replay with an invalid `guest_email` still writes a `failed` row on every call. No mail goes
  out, but the log grows. The atomic claim above fixes this too.
- The test file is under `supabase/functions/_shared/`, which is not deployed as a function, so
  this is fine.

### Re-review condition

READY once the atomic claim is in place. Then re-run `deno test` and `deno check`, plus a test
that fires 5 parallel calls on the same order and expects 1 store email and 1 guest copy.
