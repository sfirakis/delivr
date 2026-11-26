-- ============================================================
-- 020 — per-channel email claims on orders
--
-- notify-order claims a channel atomically before it sends:
--   UPDATE orders SET store_email_claimed_at = now()
--    WHERE id = $1 AND store_email_claimed_at IS NULL RETURNING id;
-- Only the call that gets the row back sends, so parallel or replayed calls
-- send at most one store email and one guest copy per order. The claim is
-- cleared again (set to NULL) when the send fails, so a retry can work.
-- An admin resend of the store email overwrites the claim on purpose.
--
-- Both columns are nullable and only written by the service role inside
-- notify-order. Required BEFORE deploying the notify-order version that uses
-- them: without the columns the claim fails and notify-order does not send
-- (fail closed, logged as failed in order_dispatch_log).
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS store_email_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guest_email_claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.store_email_claimed_at IS
  'Set by notify-order when the store email is claimed/sent; NULL = not sent yet.';
COMMENT ON COLUMN orders.guest_email_claimed_at IS
  'Set by notify-order when the guest confirmation is claimed/sent; NULL = not sent yet.';
