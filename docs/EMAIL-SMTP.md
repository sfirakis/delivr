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

- No SMTP and no Resend: the order still goes through. `notify-order` returns
  `results.email = "skipped_no_key"` and writes a `skipped` row (provider `none`)
  to `order_dispatch_log`.
- Each send writes a row to `order_dispatch_log` with `provider` = `smtp` or `resend`,
  `status` = `sent` / `failed`, and the server error text when it fails.

## How to test

1. **Local, no email leaves the machine:** `npx deno check --node-modules-dir=none --no-lock supabase/functions/notify-order/index.ts supabase/functions/send-notification/index.ts`.
   The mailer was also tested against a fake SMTP server on `127.0.0.1` (headers
   From/To/Reply-To, error on a closed port).
2. **Live (after the secrets are set and the functions redeployed):** place one test
   order on a test store whose `order_email` is an internal mailbox, then check:
   - the email arrived (and was not marked as spam);
   - the newest `order_dispatch_log` rows show `provider = smtp`, `status = sent`;
   - if `failed`, the `error` column has the SMTP server reply (wrong password,
     blocked port, etc.).
   Real messages to stores or customers need George's OK as usual.
