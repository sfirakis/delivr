-- ============================================================
-- Delivr Platform — Migration 009
-- Subscriptions. The ledger now carries recurring plans next to
-- per-order commission, so one screen shows all the money.
-- ============================================================

ALTER TABLE order_charges ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE order_charges
  ADD COLUMN IF NOT EXISTS kind         TEXT NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end   DATE;

DO $$ BEGIN
  ALTER TABLE order_charges ADD CONSTRAINT charges_kind_chk
    CHECK (kind IN ('order', 'subscription', 'adjustment'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE order_charges ADD CONSTRAINT charges_order_required_chk
    CHECK (kind <> 'order' OR order_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One subscription charge per party per period, so re-running billing is safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_charges_subscription_period
  ON order_charges (party_type, party_id, period_start)
  WHERE kind = 'subscription';

CREATE INDEX IF NOT EXISTS idx_charges_kind ON order_charges (kind, created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  audience      TEXT NOT NULL DEFAULT 'store',
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'month',
  trial_days    INT NOT NULL DEFAULT 0,
  -- A plan may change the per-order commission
  -- (e.g. pay more monthly, keep more of every order).
  commission_mode  TEXT,
  commission_value NUMERIC(10,2),
  included_orders  INT,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE subscription_plans ADD CONSTRAINT plans_audience_chk
    CHECK (audience IN ('store', 'property'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE subscription_plans ADD CONSTRAINT plans_cycle_chk
    CHECK (billing_cycle IN ('month', 'year'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE subscription_plans ADD CONSTRAINT plans_commission_chk
    CHECK (commission_mode IS NULL OR commission_mode IN ('none', 'flat', 'commission'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id        UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  party_type     TEXT NOT NULL,
  party_id       UUID NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle  TEXT NOT NULL DEFAULT 'month',
  started_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  trial_ends_on  DATE,
  next_charge_on DATE,
  cancelled_at   TIMESTAMPTZ,
  cancel_reason  TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subs_party_chk
    CHECK (party_type IN ('store', 'property'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subs_status_chk
    CHECK (status IN ('trial', 'active', 'past_due', 'paused', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A party can hold only one live subscription at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_live
  ON subscriptions (party_type, party_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status, next_charge_on);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_admin ON subscription_plans FOR ALL TO authenticated
  USING (delivr_is_admin()) WITH CHECK (delivr_is_admin());
CREATE POLICY plans_read ON subscription_plans FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY subs_admin ON subscriptions FOR ALL TO authenticated
  USING (delivr_is_admin()) WITH CHECK (delivr_is_admin());
CREATE POLICY subs_own_read ON subscriptions FOR SELECT TO authenticated
  USING (
    (party_type = 'store'    AND delivr_is_store_member(party_id))
    OR (party_type = 'property' AND delivr_is_property_manager(party_id)));

-- ── Monthly billing run (idempotent) ─────────────────────────
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

GRANT EXECUTE ON FUNCTION delivr_bill_subscriptions(DATE) TO authenticated;
