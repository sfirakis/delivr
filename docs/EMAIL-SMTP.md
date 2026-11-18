# Email: SMTP (delivr@actionweb.gr)

The two Edge Functions that send email, `notify-order` (new order to the store, copy to
support/owner, confirmation to the guest) and `send-notification` (order status to the
customer), send through **SMTP from the product mailbox `delivr@actionweb.gr`**, as the
HQ decided on 17/11/2026. Resend is only a fallback, used when SMTP is not set and
`RESEND_API_KEY` is. Nobody needs to ask George for Resend keys.

## Supabase secrets the HQ sets

Supabase → project `ifgzciraogohycuvujip` → Edge Functions → Secrets (or
`supabase secrets set NAME=...`). Names only; the values come from the mailbox the HQ
already holds.

| Secret | Value |
|---|---|
| `SMTP_HOST` | the actionweb.gr mail server (`mail.actionweb.gr`) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `delivr@actionweb.gr` |
| `SMTP_PASS` | the mailbox password |
| `SMTP_FROM` | `Delivr <delivr@actionweb.gr>` |
| `SMTP_SECURE` | optional; when empty it is `true` for port 465 |

Use port **465 (TLS)**. Supabase Edge blocks outbound ports 25 and 587.
Secrets apply to new function invocations, so after setting them redeploy
`notify-order` and `send-notification` with this code.

`RESEND_API_KEY` / `RESEND_FROM` can stay empty. If both SMTP and Resend are set, SMTP wins.

## How it behaves

The mailer lives in one place: `supabase/functions/_shared/mailer.ts` (checks in
`_shared/guards.ts`). Both functions import it.

- No SMTP and no Resend: the order still goes through. `notify-order` returns
  `results.email = "skipped_no_key"` and writes a `skipped` row (provider `none`)
  to `order_dispatch_log`.
- Each send writes a row to `order_dispatch_log` with `provider` = `smtp` or `resend`,
  `status` = `sent` / `failed`, and the server error text when it fails.
- **One address per recipient field.** A value like `a@x.gr, b@y.gr` (or with `;`, spaces,
  `<…>`, quotes) is refused, never split into several recipients. Refused addresses are noted
  in the log row.
- **No replays.** `notify-order` checks `order_dispatch_log`: if the store email or the guest
  copy is already `sent` for that order, it is not sent again (`results.email =
  "already_sent"`). A logged-in platform admin (`delivr_is_admin()`) can still resend the store
  email from the admin button; the guest copy is never resent.
- **`send-notification` is internal.** It answers 401 unless the request has
  `Authorization: Bearer <service role key>`, which all its callers already send
  (`confirm-order`, `assign-driver`, `order-status-webhook`, the pg_net trigger). Every request
  value in the subject or body is HTML-escaped and kept on one line.
- On failure `results.email` is now `failed` (it used to be `failed_<HTTP status>`); the detail
  is in the log row. Nothing in `src/` reads it.

## How to test

1. **Local, no email leaves the machine:**
   ```bash
   npx deno check --node-modules-dir=none --no-lock supabase/functions/notify-order/index.ts supabase/functions/send-notification/index.ts
   npx deno test --node-modules-dir=none --no-lock --allow-env --allow-net=127.0.0.1 --allow-read --allow-sys supabase/functions/_shared/
   ```
   The tests run a fake SMTP server on `127.0.0.1`, and network access is limited to
   `127.0.0.1`. They cover provider choice, headers, a closed port, address lists being refused,
   the service-role check, escaping, and the "already sent" check.
2. **Live (after the secrets are set and the functions redeployed):** place one test
   order on a test store whose `order_email` is an internal mailbox, then check:
   - the email arrived and was not marked as spam (in Gmail, "Show original" should show
     SPF and DKIM `PASS` for actionweb.gr);
   - the newest `order_dispatch_log` rows show `provider = smtp`, `status = sent`;
   - if `failed`, the `error` column has the SMTP server reply (wrong password,
     blocked port, etc.).
   Real messages to stores or customers need George's OK as usual.
