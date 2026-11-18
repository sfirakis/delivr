-- ============================================================
-- 019 — Store plans paid by card (Stripe Checkout, subscription mode)
-- ============================================================
-- HQ 18/11/2026. Additive only: new columns / tables / functions. Two
-- existing functions are re-created with the same signature and ONE extra
-- condition each, so a Stripe-managed subscription is not touched twice:
--   * delivr_bill_subscriptions — skips it (Stripe charges it; CentralBilling
--     issues the invoice from the Stripe payment). Without this the admin's
--     monthly «Έκδοση χρεώσεων» would add a second, pending charge.
--   * delivr_store_plan_move — no automatic up/down move for it: the store
--     changes plan through Stripe (checkout / customer portal), otherwise the
--     database plan and the Stripe price would drift apart. (Follow-up if
--     George wants it: move the Stripe price with proration from the run.)
-- Writes come ONLY from the stripe-webhook edge function (service role)
-- through delivr_stripe_apply(). Nothing here is callable by anon/authenticated.
-- NOT applied to the live database by the PR that adds it.
-- ============================================================

-- ── 1. Stripe ids on the subscription row ───────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id        TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end     TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN subscriptions.stripe_subscription_id IS
  'Set = paid by card through Stripe (019): Stripe bills it, delivr_bill_subscriptions skips it, plan moves go through Stripe.';

-- ── 2. One Stripe customer per store (service role only) ─────
-- Not a column on stores: store members may update their store row, and a
-- customer id there would let one store open another store''s billing portal.
CREATE TABLE IF NOT EXISTS store_billing_accounts (
  store_id           UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE store_billing_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON store_billing_accounts FROM anon, authenticated;

-- ── 3. Webhook idempotency (one row per Stripe event we acted on) ──
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id          TEXT PRIMARY KEY,               -- evt_…
  type        TEXT NOT NULL,
  store_id    UUID,
  result      JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stripe_webhook_events_admin ON stripe_webhook_events;
CREATE POLICY stripe_webhook_events_admin ON stripe_webhook_events FOR SELECT TO authenticated
  USING (delivr_is_admin());
REVOKE INSERT, UPDATE, DELETE ON stripe_webhook_events FROM anon, authenticated;

-- ── 4. The one writer: a verified Stripe event → subscription row ──
-- p_action: activate | past_due | cancel. Unknown store → {ignored} (200,
-- never an error: the Stripe account is shared). Same event twice → {duplicate}.
CREATE OR REPLACE FUNCTION delivr_stripe_apply(
  p_event_id     TEXT,
  p_event_type   TEXT,
  p_action       TEXT,
  p_store_id     UUID        DEFAULT NULL,
  p_plan_key     TEXT        DEFAULT NULL,
  p_status       TEXT        DEFAULT NULL,
  p_customer     TEXT        DEFAULT NULL,
  p_subscription TEXT        DEFAULT NULL,
  p_price        TEXT        DEFAULT NULL,
  p_period_end   TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store  UUID;
  v_sub    subscriptions%ROWTYPE;
  v_plan   subscription_plans%ROWTYPE;
  v_status TEXT;
  v_res    JSONB;
BEGIN
  IF p_action NOT IN ('activate', 'past_due', 'cancel') THEN
    RAISE EXCEPTION 'BAD_ACTION' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('trial', 'active', 'past_due', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'BAD_STATUS' USING ERRCODE = '22023';
  END IF;

  IF p_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM stripe_webhook_events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  -- Which store: the subscription we already know → the tagged store id
  -- (must exist) → the store that owns the customer.
  IF p_subscription IS NOT NULL THEN
    SELECT * INTO v_sub FROM subscriptions
     WHERE stripe_subscription_id = p_subscription AND party_type = 'store';
    v_store := v_sub.party_id;
  END IF;
  IF v_store IS NULL AND p_store_id IS NOT NULL THEN
    SELECT id INTO v_store FROM stores WHERE id = p_store_id;
  END IF;
  IF v_store IS NULL AND p_customer IS NOT NULL THEN
    SELECT store_id INTO v_store FROM store_billing_accounts WHERE stripe_customer_id = p_customer;
  END IF;
  IF v_store IS NULL THEN
    RETURN jsonb_build_object('ignored', 'unknown_store');
  END IF;

  IF p_plan_key IS NOT NULL THEN
    SELECT * INTO v_plan FROM subscription_plans
     WHERE audience = 'store' AND lower(name) = lower(p_plan_key)
     ORDER BY is_active DESC, sort_order LIMIT 1;
  END IF;

  IF p_customer IS NOT NULL THEN
    INSERT INTO store_billing_accounts (store_id, stripe_customer_id)
    VALUES (v_store, p_customer)
    ON CONFLICT (store_id) DO NOTHING;
  END IF;

  -- The row to act on: this Stripe subscription, else the store's live row.
  IF v_sub.id IS NULL THEN
    SELECT * INTO v_sub FROM subscriptions
     WHERE party_type = 'store' AND party_id = v_store AND status <> 'cancelled'
     ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF p_action = 'cancel' THEN
    IF v_sub.id IS NOT NULL AND (p_subscription IS NULL OR v_sub.stripe_subscription_id = p_subscription) THEN
      UPDATE subscriptions SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()),
             cancel_reason = coalesce(cancel_reason, 'Stripe: ακύρωση συνδρομής'),
             current_period_end = coalesce(p_period_end, current_period_end), updated_at = now()
       WHERE id = v_sub.id;
      v_res := jsonb_build_object('ok', true, 'store_id', v_store, 'subscription_id', v_sub.id, 'status', 'cancelled');
    ELSE
      v_res := jsonb_build_object('ignored', 'no_subscription', 'store_id', v_store);
    END IF;

  ELSIF p_action = 'past_due' THEN
    IF v_sub.id IS NOT NULL AND v_sub.status <> 'cancelled'
       AND (p_subscription IS NULL OR v_sub.stripe_subscription_id IS NULL OR v_sub.stripe_subscription_id = p_subscription) THEN
      UPDATE subscriptions SET status = 'past_due',
             stripe_subscription_id = coalesce(stripe_subscription_id, p_subscription), updated_at = now()
       WHERE id = v_sub.id;
      v_res := jsonb_build_object('ok', true, 'store_id', v_store, 'subscription_id', v_sub.id, 'status', 'past_due');
    ELSE
      v_res := jsonb_build_object('ignored', 'no_subscription', 'store_id', v_store);
    END IF;

  ELSE -- activate
    v_status := coalesce(p_status, 'active');
    IF v_sub.id IS NOT NULL AND v_sub.status = 'cancelled' THEN
      -- An event for a subscription that is already over (late/out of order).
      v_res := jsonb_build_object('ignored', 'subscription_cancelled', 'store_id', v_store);
    ELSIF v_sub.id IS NOT NULL THEN
      UPDATE subscriptions SET
        plan_id       = coalesce(v_plan.id, plan_id),
        price         = coalesce(v_plan.price, price),
        billing_cycle = coalesce(v_plan.billing_cycle, billing_cycle),
        status        = v_status,
        trial_ends_on = CASE WHEN v_status = 'trial' THEN coalesce(p_period_end::DATE, trial_ends_on) ELSE trial_ends_on END,
        stripe_customer_id     = coalesce(p_customer, stripe_customer_id),
        stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
        stripe_price_id        = coalesce(p_price, stripe_price_id),
        current_period_end     = coalesce(p_period_end, current_period_end),
        notes = CASE WHEN v_plan.id IS NOT NULL AND v_plan.id <> plan_id
                     THEN concat_ws(E'\n', nullif(notes, ''), format('Stripe: πακέτο %s (%s)', v_plan.name, to_char(now(), 'DD/MM/YYYY')))
                     ELSE notes END,
        updated_at = now()
       WHERE id = v_sub.id;
      v_res := jsonb_build_object('ok', true, 'store_id', v_store, 'subscription_id', v_sub.id, 'status', v_status);
    ELSIF v_plan.id IS NOT NULL THEN
      INSERT INTO subscriptions (plan_id, party_type, party_id, status, price, billing_cycle, started_on,
                                 trial_ends_on, stripe_customer_id, stripe_subscription_id, stripe_price_id,
                                 current_period_end, notes)
      VALUES (v_plan.id, 'store', v_store, v_status, v_plan.price, v_plan.billing_cycle, CURRENT_DATE,
              CASE WHEN v_status = 'trial' THEN p_period_end::DATE END,
              p_customer, p_subscription, p_price, p_period_end,
              format('Stripe: πληρωμή με κάρτα (%s)', to_char(now(), 'DD/MM/YYYY')))
      RETURNING * INTO v_sub;
      v_res := jsonb_build_object('ok', true, 'store_id', v_store, 'subscription_id', v_sub.id, 'status', v_status, 'created', true);
    ELSE
      v_res := jsonb_build_object('ignored', 'unknown_plan', 'store_id', v_store);
    END IF;
  END IF;

  IF p_event_id IS NOT NULL THEN
    INSERT INTO stripe_webhook_events (id, type, store_id, result)
    VALUES (p_event_id, coalesce(p_event_type, ''), v_store, v_res)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN v_res;
END $$;

-- ── 5. Monthly ledger run: skip what Stripe bills (009 + one line) ──
CREATE OR REPLACE FUNCTION delivr_bill_subscriptions(p_period DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ps        platform_settings%ROWTYPE;
  s         RECORD;
  v_start   DATE := date_trunc('month', p_period)::DATE;
  v_end     DATE := (date_trunc('month', p_period) + interval '1 month - 1 day')::DATE;
  v_created INT := 0;
  v_total   NUMERIC := 0;
  v_label   TEXT;
BEGIN
  IF NOT delivr_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO ps FROM platform_settings WHERE id = 1;

  FOR s IN
    SELECT sub.*, pl.name AS plan_name
      FROM subscriptions sub
      JOIN subscription_plans pl ON pl.id = sub.plan_id
     WHERE sub.status IN ('active', 'past_due')
       AND sub.price > 0
       AND sub.stripe_subscription_id IS NULL      -- 019: Stripe bills these itself
       AND sub.started_on <= v_end
       AND (sub.trial_ends_on IS NULL OR sub.trial_ends_on <= v_end)
  LOOP
    v_label := s.plan_name || ' — ' || to_char(v_start, 'MM/YYYY');

    INSERT INTO order_charges (
      order_id, party_type, party_id, direction, mode, rate,
      base_amount, amount, currency, status, kind, description, period_start, period_end)
    VALUES (
      NULL, s.party_type, s.party_id, 'charge', 'flat', s.price,
      s.price, s.price, ps.currency, 'pending', 'subscription', v_label, v_start, v_end)
    ON CONFLICT (party_type, party_id, period_start) WHERE kind = 'subscription' DO NOTHING;

    IF FOUND THEN
      v_created := v_created + 1;
      v_total := v_total + s.price;
      UPDATE subscriptions
         SET next_charge_on = (v_end + 1), updated_at = now()
       WHERE id = s.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'period_start', v_start, 'period_end', v_end,
    'created', v_created, 'total', v_total, 'currency', ps.currency);
END $$;

-- ── 6. Automatic plan move: not for Stripe-managed rows (018 + one check) ──
CREATE OR REPLACE FUNCTION delivr_store_plan_move(p_store_id UUID, p_period DATE)
RETURNS TABLE (move_kind TEXT, orders_counted INT, from_plan_id UUID, from_plan_name TEXT,
               to_plan_id UUID, subscription_id UUID)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_eval    DATE := (date_trunc('month', p_period) - interval '1 month')::DATE;
  v_top     INT  := delivr_plan_top_limit();
  pl        RECORD;
  tgt       subscription_plans;
  v_orders  INT;
  v_started DATE;
BEGIN
  SELECT * INTO pl FROM delivr_store_effective_plan(p_store_id);
  IF pl.plan_id IS NULL OR pl.plan_limit IS NULL THEN RETURN; END IF;

  -- 019: the plan of a card-paid subscription changes through Stripe only.
  IF pl.subscription_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM subscriptions sub WHERE sub.id = pl.subscription_id AND sub.stripe_subscription_id IS NOT NULL) THEN
    RETURN;
  END IF;

  v_orders := delivr_store_month_orders(p_store_id, v_eval);

  IF v_orders > pl.plan_limit THEN
    IF v_top IS NULL OR v_orders > v_top THEN
      RETURN QUERY SELECT 'custom'::TEXT, v_orders, pl.plan_id, pl.plan_name, NULL::UUID, pl.subscription_id;
      RETURN;
    END IF;
    tgt := delivr_plan_for_orders(v_orders);
    IF tgt.id IS NOT NULL AND tgt.included_orders > pl.plan_limit THEN
      RETURN QUERY SELECT 'upgrade'::TEXT, v_orders, pl.plan_id, pl.plan_name, tgt.id, pl.subscription_id;
    END IF;
    RETURN;
  END IF;

  IF pl.subscription_id IS NULL THEN RETURN; END IF;
  SELECT sub.started_on INTO v_started FROM subscriptions sub WHERE sub.id = pl.subscription_id;
  IF v_started IS NULL OR v_started > v_eval THEN RETURN; END IF;

  tgt := delivr_plan_for_orders(v_orders);
  IF tgt.id IS NOT NULL AND tgt.included_orders < pl.plan_limit THEN
    RETURN QUERY SELECT 'downgrade'::TEXT, v_orders, pl.plan_id, pl.plan_name, tgt.id, pl.subscription_id;
  END IF;
END $$;

-- ── 7. Grants (revoke first — the 009/010 lesson) ───────────
REVOKE EXECUTE ON FUNCTION delivr_stripe_apply(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_stripe_apply(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
-- Same signatures as before: keep 009 / 018 grants as they were.
REVOKE EXECUTE ON FUNCTION delivr_bill_subscriptions(DATE) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delivr_bill_subscriptions(DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION delivr_store_plan_move(UUID, DATE) FROM PUBLIC, anon, authenticated;
