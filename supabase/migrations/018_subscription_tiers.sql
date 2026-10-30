-- ============================================================
-- 018 — Subscription tiers, monthly order limits, card in person
-- ============================================================
-- Owner decision (George, 30/10/2026): stores pay a subscription ONLY,
-- no commission per order.
--
--   Basic    0 €/μήνα   έως  15 παραγγελίες
--   Pro     39 €/μήνα   έως 100
--   Plus    79 €/μήνα   έως 250   (new)
--   Premium 150 €/μήνα  έως 500
--   > 500 → «Κατόπιν συμφωνίας» (no automatic plan; flagged for the admin)
--
-- Orders are NEVER blocked or rejected because of the limit. A store that
-- went over its plan's limit in a calendar month (Europe/Athens) moves to
-- the smallest plan that fits from the next month, via
-- delivr_apply_plan_upgrades() — admin button or pg_cron (see the end).
--
-- Payment stays in person, no money passes through the platform: the
-- customer picks «Μετρητά» or «Κάρτα». Take away: card always (pay at the
-- counter). Delivery: card only if the store turned on
-- stores.accepts_card_on_delivery (its courier carries a terminal).
--
-- What changes for existing objects:
--   * store plan rows: prices, limits, texts, commission → none (ids kept,
--     nothing deleted — subscriptions reference them);
--   * platform default store billing → none (stores without a plan);
--   * delivr_place_order: same signature (old clients keep working), card
--     validation, and the store fee now comes from delivr_resolve_billing
--     (per-store override → plan → platform). The property side (Host
--     Partner, QR) is NOT touched.
--   * delivr_public_plans: also returns included_orders.
-- Everything else is new. Safe to run twice.
-- ============================================================

-- ── 1. Plans (store audience only — «Host Partner» keeps its 8%) ──
UPDATE subscription_plans SET
  price = 0, billing_cycle = 'month', trial_days = 0,
  commission_mode = 'none', commission_value = 0, included_orders = 15,
  description = 'Δωρεάν, για να ξεκινήσεις',
  features    = '["Έως 15 παραγγελίες τον μήνα","Μενού, ζώνες & ωράριο","Ειδοποίηση με email & WhatsApp","Εκτύπωση παραγγελίας"]'::JSONB,
  sort_order = 1, is_active = true, updated_at = now()
WHERE audience = 'store' AND name = 'Basic';

UPDATE subscription_plans SET
  price = 39, billing_cycle = 'month', trial_days = 14,
  commission_mode = 'none', commission_value = 0, included_orders = 100,
  description = 'Για μαγαζιά με σταθερή κίνηση',
  features    = '["Έως 100 παραγγελίες τον μήνα","Όλα του Basic","Στατιστικά πωλήσεων"]'::JSONB,
  sort_order = 2, is_active = true, updated_at = now()
WHERE audience = 'store' AND name = 'Pro';

-- 017 renamed «Zero Commission» to «Premium»; accept either name.
UPDATE subscription_plans SET
  name = 'Premium', price = 150, billing_cycle = 'month', trial_days = 14,
  commission_mode = 'none', commission_value = 0, included_orders = 500,
  description = 'Για τα πιο πολυσύχναστα μαγαζιά',
  features    = '["Έως 500 παραγγελίες τον μήνα","Όλα του Plus","Προτεραιότητα υποστήριξης"]'::JSONB,
  sort_order = 4, is_active = true, updated_at = now()
WHERE audience = 'store' AND name IN ('Premium', 'Zero Commission');

INSERT INTO subscription_plans (name, description, audience, price, billing_cycle, trial_days,
  commission_mode, commission_value, included_orders, features, is_active, sort_order)
SELECT 'Plus', 'Για μαγαζιά με πολλή κίνηση', 'store', 79, 'month', 14,
       'none', 0, 250,
       '["Έως 250 παραγγελίες τον μήνα","Όλα του Pro","Προβολή στην κορυφή"]'::JSONB, true, 3
 WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE audience = 'store' AND name = 'Plus');

UPDATE subscription_plans SET
  price = 79, trial_days = 14, commission_mode = 'none', commission_value = 0, included_orders = 250,
  sort_order = 3, updated_at = now()
WHERE audience = 'store' AND name = 'Plus';

-- Any other store plan an admin may have added: no commission either.
UPDATE subscription_plans SET commission_mode = 'none', commission_value = 0, updated_at = now()
 WHERE audience = 'store' AND commission_mode IS DISTINCT FROM 'none';

-- ── 2. Stores without a plan pay no commission either ────────
-- (Explicit per-store overrides set by the admin still win, by design.)
UPDATE platform_settings SET store_billing_mode = 'none', store_billing_value = 0 WHERE id = 1;

-- ── 3. Card on delivery (per store, off by default) ──────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS accepts_card_on_delivery BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN stores.accepts_card_on_delivery IS
  'The courier carries a card terminal: delivery customers may choose «Κάρτα». Take away always allows card at the counter.';

-- ── 4. Plan moves, one row per store per month (audit + idempotency) ──
CREATE TABLE IF NOT EXISTS store_plan_changes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start   DATE NOT NULL,              -- first day of the month the new plan starts
  orders_counted INT  NOT NULL,              -- orders in the month before
  from_plan_id   UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  to_plan_id     UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL,              -- upgrade | custom (over the top plan: agree a price)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE store_plan_changes ADD CONSTRAINT store_plan_changes_kind_chk
    CHECK (kind IN ('upgrade', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_plan_changes_period
  ON store_plan_changes (store_id, period_start);

ALTER TABLE store_plan_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_plan_changes_admin ON store_plan_changes;
CREATE POLICY store_plan_changes_admin ON store_plan_changes FOR SELECT TO authenticated
  USING (delivr_is_admin());
-- Written only by delivr_apply_plan_upgrades() (definer).
REVOKE INSERT, UPDATE, DELETE ON store_plan_changes FROM anon, authenticated;

-- ── 5. delivr_place_order: card in person + plan-aware store fee ──
-- Same 10 arguments as 013 (CREATE OR REPLACE keeps grants and every
-- client working: p_payment still defaults to 'cash').
CREATE OR REPLACE FUNCTION delivr_place_order(
  p_code       TEXT,
  p_store_id   UUID,
  p_service    TEXT,
  p_items      JSONB,
  p_guest      JSONB,
  p_promo      TEXT        DEFAULT NULL,
  p_scheduled  TIMESTAMPTZ DEFAULT NULL,
  p_payment    TEXT        DEFAULT 'cash',
  p_channel    TEXT        DEFAULT 'qr',
  p_address    JSONB       DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  ps  platform_settings%ROWTYPE;
  s   stores%ROWTYPE;
  pr  properties%ROWTYPE;
  pc  promo_codes%ROWTYPE;
  mi  menu_items%ROWTYPE;
  mz  RECORD;
  it  JSONB;
  md  RECORD;
  v_lines      JSONB := '[]'::JSONB;
  v_mods       JSONB;
  v_mod_total  NUMERIC := 0;
  v_qty        INT;
  v_line       NUMERIC;
  v_subtotal   NUMERIC := 0;
  v_discount   NUMERIC := 0;
  v_fee        NUMERIC := 0;
  v_total      NUMERIC := 0;
  v_recent     INT;
  v_order_id   UUID;
  v_number     TEXT;
  v_ptoken     TEXT;
  v_stoken     TEXT;
  v_status     order_status := 'pending';
  v_prep       INT;
  v_eta        INT;
  v_promo_code TEXT := NULL;
  v_addr       JSONB := NULL;
  v_name       TEXT;
  v_phone      TEXT;
  v_email      TEXT;
  v_mode       TEXT;
  v_val        NUMERIC;
  v_base       NUMERIC;
  v_amount     NUMERIC;
  v_dir        TEXT;
  v_platform_fee NUMERIC := 0;
  v_property_fee NUMERIC := 0;
  v_adhoc      BOOLEAN := false;
  v_street     TEXT;
  v_area       TEXT;
  v_postal     TEXT;
  v_city       TEXT;
  v_pay        TEXT := lower(coalesce(nullif(btrim(p_payment), ''), 'cash'));
BEGIN
  SELECT * INTO ps FROM platform_settings WHERE id = 1;

  IF p_service NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'BAD_SERVICE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s FROM stores WHERE id = p_store_id AND is_active AND onboarding_status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF p_code IS NOT NULL AND btrim(p_code) <> '' THEN
    SELECT * INTO pr FROM properties WHERE delivr_norm(code) = delivr_norm(p_code) AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

    SELECT count(*) INTO v_recent FROM orders o
     WHERE o.property_id = pr.id AND o.created_at > now() - interval '2 minutes';
    IF v_recent >= 5 THEN RAISE EXCEPTION 'RATE_LIMIT' USING ERRCODE = '53400'; END IF;
  ELSE
    -- No house QR. Only a store that has opted into its own public link may
    -- be ordered from this way; everything else still needs a property.
    IF NOT s.standalone_enabled THEN
      RAISE EXCEPTION 'PROPERTY_REQUIRED' USING ERRCODE = '22023';
    END IF;
    v_adhoc := true;

    IF p_service = 'delivery' THEN
      v_street := nullif(btrim(coalesce(p_address->>'street', '')), '');
      v_area   := nullif(btrim(coalesce(p_address->>'area', '')), '');
      v_postal := nullif(btrim(coalesce(p_address->>'postal_code', '')), '');
      v_city   := nullif(btrim(coalesce(p_address->>'city', '')), '');
      IF v_street IS NULL THEN
        RAISE EXCEPTION 'ADDRESS_REQUIRED' USING ERRCODE = '22023';
      END IF;
      IF v_area IS NULL AND v_postal IS NULL AND v_city IS NULL THEN
        RAISE EXCEPTION 'AREA_REQUIRED' USING ERRCODE = '22023';
      END IF;
    END IF;

    -- Same flood guard as the property flow, keyed on the phone number
    -- instead, which is all a walk-up customer gives us.
    SELECT count(*) INTO v_recent FROM orders o
     WHERE o.store_id = s.id
       AND o.guest_phone IS NOT NULL
       AND o.guest_phone = nullif(btrim(coalesce(p_guest->>'phone', '')), '')
       AND o.created_at > now() - interval '2 minutes';
    IF v_recent >= 5 THEN RAISE EXCEPTION 'RATE_LIMIT' USING ERRCODE = '53400'; END IF;
  END IF;

  -- Guest details
  v_name  := btrim(coalesce(p_guest->>'name', ''));
  v_phone := btrim(coalesce(p_guest->>'phone', ''));
  v_email := nullif(btrim(coalesce(p_guest->>'email', '')), '');
  IF v_name = '' THEN RAISE EXCEPTION 'NAME_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF ps.guest_requires_phone AND length(regexp_replace(v_phone, '\D', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'PHONE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF ps.guest_requires_email AND v_email IS NULL THEN
    RAISE EXCEPTION 'EMAIL_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Payment method (018). Paid to the store in person — no money passes
  -- through the platform:
  --   'cash' — cash on delivery / at the counter (as before);
  --   'card' — card on the store's own terminal: take away always (pay at
  --            the counter), delivery only if the store says its courier
  --            carries a card terminal (stores.accepts_card_on_delivery).
  -- Any other method is an online payment and still needs the platform
  -- switch, which stays off.
  IF v_pay = 'cash' THEN
    IF NOT ps.allow_cash THEN
      RAISE EXCEPTION 'CASH_DISABLED' USING ERRCODE = '22023';
    END IF;
    IF NOT s.accepts_cash THEN
      RAISE EXCEPTION 'STORE_NO_CASH' USING ERRCODE = '22023';
    END IF;
  ELSIF v_pay = 'card' THEN
    IF p_service = 'delivery' AND NOT coalesce(s.accepts_card_on_delivery, false) THEN
      RAISE EXCEPTION 'CARD_NOT_ACCEPTED' USING ERRCODE = '22023';
    END IF;
  ELSIF v_pay IN (SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                   WHERE t.typname = 'payment_method') THEN
    IF NOT ps.allow_online_payment THEN
      RAISE EXCEPTION 'ONLINE_PAYMENT_DISABLED' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'BAD_PAYMENT' USING ERRCODE = '22023';
  END IF;

  -- Open / scheduling
  IF p_scheduled IS NULL AND NOT delivr_store_open_now(s.id) THEN
    RAISE EXCEPTION 'STORE_CLOSED' USING ERRCODE = '22023';
  END IF;
  IF p_scheduled IS NOT NULL AND NOT ps.allow_scheduled_orders THEN
    RAISE EXCEPTION 'SCHEDULING_DISABLED' USING ERRCODE = '22023';
  END IF;

  -- Zone / radius match
  IF pr.id IS NOT NULL THEN
    SELECT * INTO mz FROM delivr_match_zone(s.id, pr.id, p_service);
    IF NOT mz.is_match THEN RAISE EXCEPTION 'OUT_OF_RANGE' USING ERRCODE = '22023'; END IF;
  ELSE
    -- Walk-up customer: match on what they typed, not on coordinates.
    SELECT * INTO mz FROM delivr_match_address(s.id, v_area, v_postal, v_city, p_service);
    IF NOT mz.is_match THEN RAISE EXCEPTION 'OUT_OF_RANGE' USING ERRCODE = '22023'; END IF;
  END IF;

  -- Price every line from the database, never from the client
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO mi FROM menu_items
     WHERE id = (it->>'menu_item_id')::UUID AND store_id = s.id AND is_available;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ITEM_UNAVAILABLE:%', coalesce(it->>'menu_item_id', '?') USING ERRCODE = '22023';
    END IF;

    v_qty := greatest(1, least(99, coalesce((it->>'quantity')::INT, 1)));
    v_mod_total := 0;
    v_mods := '[]'::JSONB;

    IF it ? 'modifier_ids' AND jsonb_typeof(it->'modifier_ids') = 'array' THEN
      FOR md IN
        SELECT im.name, im.price FROM item_modifiers im
          JOIN item_modifier_groups g ON g.id = im.group_id
         WHERE g.item_id = mi.id
           AND im.id::TEXT IN (SELECT jsonb_array_elements_text(it->'modifier_ids'))
      LOOP
        v_mod_total := v_mod_total + md.price;
        v_mods := v_mods || jsonb_build_object('name', md.name, 'price', md.price);
      END LOOP;
    END IF;

    v_line := round((mi.price + v_mod_total) * v_qty, 2);
    v_subtotal := v_subtotal + v_line;

    v_lines := v_lines || jsonb_build_object(
      'menu_item_id', mi.id, 'name', mi.name, 'price', mi.price,
      'quantity', v_qty, 'modifiers', v_mods,
      'notes', nullif(btrim(coalesce(it->>'notes', '')), ''), 'subtotal', v_line);
  END LOOP;

  IF v_subtotal < mz.min_amount THEN
    RAISE EXCEPTION 'MIN_ORDER:%', mz.min_amount USING ERRCODE = '22023';
  END IF;

  -- Promo code
  IF p_promo IS NOT NULL AND btrim(p_promo) <> '' THEN
    SELECT * INTO pc FROM promo_codes
     WHERE upper(code) = upper(btrim(p_promo)) AND is_active
       AND (valid_until IS NULL OR valid_until > now())
       AND (store_id IS NULL OR store_id = s.id);
    IF FOUND AND v_subtotal >= coalesce(pc.min_order, 0) THEN
      IF pc.discount_type = 'percentage' THEN
        v_discount := round(v_subtotal * pc.discount_value / 100, 2);
        IF pc.max_discount IS NOT NULL THEN v_discount := least(v_discount, pc.max_discount); END IF;
      ELSE
        v_discount := least(pc.discount_value, v_subtotal);
      END IF;
      v_promo_code := pc.code;
    END IF;
  END IF;

  -- Takeaway discount
  IF p_service = 'pickup' AND coalesce(s.pickup_discount_pct, 0) > 0 THEN
    v_discount := v_discount + round(v_subtotal * s.pickup_discount_pct / 100, 2);
  END IF;
  v_discount := least(v_discount, v_subtotal);

  -- Delivery fee
  IF p_service = 'delivery' THEN
    v_fee := coalesce(mz.fee, 0);
    IF mz.free_above IS NOT NULL AND v_subtotal >= mz.free_above THEN v_fee := 0; END IF;
  END IF;

  v_total := round(v_subtotal - v_discount + v_fee, 2);
  v_prep  := coalesce(s.prep_time_min, ps.default_prep_time);
  v_eta   := v_prep + CASE WHEN p_service = 'delivery'
                           THEN coalesce(s.avg_delivery_time, 30) + coalesce(mz.extra_min, 0)
                           ELSE 0 END;

  IF pr.id IS NOT NULL THEN
    v_addr := jsonb_build_object(
      'label', pr.name, 'street', pr.address, 'city', pr.city, 'area', pr.area,
      'postal_code', pr.postal_code, 'floor', pr.floor, 'doorbell', pr.doorbell,
      'notes', pr.access_notes, 'lat', pr.lat, 'lng', pr.lng, 'property_code', pr.code);
  ELSIF v_adhoc AND p_service = 'delivery' THEN
    -- Whatever the customer typed, kept in the same shape the ticket, the
    -- store screen and the driver card already read.
    v_addr := jsonb_build_object(
      'label', NULL, 'street', v_street, 'city', v_city, 'area', v_area,
      'postal_code', v_postal,
      'floor', nullif(btrim(coalesce(p_address->>'floor', '')), ''),
      'doorbell', nullif(btrim(coalesce(p_address->>'doorbell', '')), ''),
      'notes', nullif(btrim(coalesce(p_address->>'notes', '')), ''),
      'lat', NULL, 'lng', NULL, 'source', 'customer');
  END IF;

  v_number := ps.order_prefix || '-' || to_char(now() AT TIME ZONE ps.timezone, 'YYMMDD')
              || '-' || lpad(nextval('order_number_seq')::TEXT, 4, '0');
  v_ptoken := encode(gen_random_bytes(12), 'hex');
  v_stoken := encode(gen_random_bytes(16), 'hex');

  IF s.auto_accept THEN v_status := 'confirmed'; END IF;

  INSERT INTO orders (
    user_id, store_id, property_id, delivery_type, delivery_address, delivery_notes,
    status, subtotal, delivery_fee, discount_amount, total,
    payment_method, payment_status, promo_code, customer_notes,
    order_number, public_token, store_token, guest_name, guest_phone, guest_email,
    channel, scheduled_for, prep_minutes, zone_id,
    estimated_ready_at, estimated_delivery_at, confirmed_at
  ) VALUES (
    NULL, s.id, pr.id, p_service::delivery_type, v_addr,
    nullif(btrim(coalesce(p_guest->>'delivery_notes', '')), ''),
    v_status, v_subtotal, v_fee, v_discount, v_total,
    v_pay::payment_method, 'pending', v_promo_code,
    nullif(btrim(coalesce(p_guest->>'notes', '')), ''),
    v_number, v_ptoken, v_stoken, v_name, nullif(v_phone, ''), v_email,
    p_channel, p_scheduled, v_prep, mz.zone_id,
    coalesce(p_scheduled, now()) + make_interval(mins => v_prep),
    coalesce(p_scheduled, now()) + make_interval(mins => v_eta),
    CASE WHEN v_status = 'confirmed' THEN now() ELSE NULL END
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, modifiers, notes, subtotal)
  SELECT v_order_id, (l->>'menu_item_id')::UUID, l->>'name', (l->>'price')::NUMERIC,
         (l->>'quantity')::INT, l->'modifiers', l->>'notes', (l->>'subtotal')::NUMERIC
    FROM jsonb_array_elements(v_lines) l;

  -- ── Billing ledger ────────────────────────────────────────
  v_base := CASE WHEN ps.commission_base = 'total' THEN v_total ELSE v_subtotal END;

  -- Store side (018): the one resolver — per-store override → subscription
  -- plan → platform default. Every store plan is 'none' and so is the
  -- platform default, so a store pays its plan only, nothing per order.
  SELECT rb.mode, rb.value INTO v_mode, v_val FROM delivr_resolve_billing('store', s.id) rb;
  v_amount := CASE v_mode WHEN 'commission' THEN round(v_base * v_val / 100, 2)
                          WHEN 'flat' THEN v_val ELSE 0 END;
  IF v_amount > 0 THEN
    INSERT INTO order_charges (order_id, party_type, party_id, direction, mode, rate, base_amount, amount, currency)
    VALUES (v_order_id, 'store', s.id, 'charge', v_mode, v_val, v_base, v_amount, ps.currency);
    v_platform_fee := v_amount;
  END IF;

  IF pr.id IS NOT NULL THEN
    v_mode := CASE WHEN pr.billing_mode = 'inherit' THEN ps.property_billing_mode ELSE pr.billing_mode END;
    v_val  := CASE WHEN pr.billing_mode = 'inherit' THEN ps.property_billing_value ELSE pr.billing_value END;
    v_dir  := CASE WHEN pr.billing_direction = 'inherit' THEN ps.property_billing_direction ELSE pr.billing_direction END;
    v_amount := CASE v_mode WHEN 'commission' THEN round(v_base * v_val / 100, 2)
                            WHEN 'flat' THEN v_val ELSE 0 END;
    IF v_amount > 0 THEN
      INSERT INTO order_charges (order_id, party_type, party_id, direction, mode, rate, base_amount, amount, currency)
      VALUES (v_order_id, 'property', pr.id, v_dir, v_mode, v_val, v_base, v_amount, ps.currency);
      v_property_fee := v_amount;
    END IF;
  END IF;

  UPDATE orders SET platform_fee = v_platform_fee, property_fee = v_property_fee
   WHERE id = v_order_id;

  INSERT INTO order_events (order_id, status, actor, note)
  VALUES (v_order_id, v_status::TEXT, 'guest',
          CASE WHEN v_status = 'confirmed' THEN 'Auto-accepted by store settings' ELSE NULL END);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'order_number', v_number,
    'public_token', v_ptoken,
    'status', v_status::TEXT,
    'service', p_service,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_fee', v_fee,
    'total', v_total,
    'eta_min', v_eta,
    'currency', ps.currency,
    'payment_method', v_pay,
    'items', v_lines,
    'store', jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'address', s.address,
      'whatsapp', coalesce(s.order_whatsapp, s.phone),
      'notify_whatsapp', s.notify_whatsapp, 'notify_email', s.notify_email),
    'address', v_addr,
    'property', CASE WHEN pr.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pr.id, 'code', pr.code, 'name', pr.name, 'address', pr.address,
      'area', pr.area, 'city', pr.city, 'floor', pr.floor, 'doorbell', pr.doorbell) END
  );
END $$;

REVOKE EXECUTE ON FUNCTION delivr_place_order(TEXT, UUID, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delivr_place_order(TEXT, UUID, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  TO anon, authenticated;

-- ── 6. A card order handed over is a paid order ──────────────
-- Same rule the status RPCs already apply to cash (007/016), without
-- touching them: a trigger covers /s/<token>, the POS and the driver.
CREATE OR REPLACE FUNCTION delivr_card_paid_on_delivery()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND NEW.payment_method = 'card'
     AND NEW.payment_status = 'pending' THEN
    NEW.payment_status := 'paid';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_card_paid_on_delivery ON orders;
CREATE TRIGGER trg_card_paid_on_delivery
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION delivr_card_paid_on_delivery();

-- ── 7. What a customer may pay with at this store ────────────
CREATE OR REPLACE FUNCTION delivr_store_payment_options(p_store_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'cash',          s.accepts_cash AND ps.allow_cash,
    'card_pickup',   true,                          -- pay at the counter
    'card_delivery', s.accepts_card_on_delivery)    -- courier carries a terminal
    FROM stores s CROSS JOIN platform_settings ps
   WHERE s.id = p_store_id AND s.is_active AND ps.id = 1
$$;

-- ── 8. Monthly usage (calendar month, Europe/Athens) ─────────
-- First day of the local month that contains p_at.
CREATE OR REPLACE FUNCTION delivr_local_month(p_at TIMESTAMPTZ DEFAULT now())
RETURNS DATE LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT date_trunc('month', p_at AT TIME ZONE 'Europe/Athens')::DATE
$$;

-- Orders a store received in that local month. Rejected/cancelled orders
-- do not count — the store did not serve them.
CREATE OR REPLACE FUNCTION delivr_store_month_orders(p_store_id UUID, p_month DATE)
RETURNS INT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::INT FROM orders o
   WHERE o.store_id = p_store_id
     AND o.status <> 'cancelled'
     AND o.created_at >= (date_trunc('month', p_month)::TIMESTAMP AT TIME ZONE 'Europe/Athens')
     AND o.created_at <  ((date_trunc('month', p_month) + interval '1 month')::TIMESTAMP AT TIME ZONE 'Europe/Athens')
$$;

-- The plan a store is on: its live subscription, otherwise the free plan
-- (a store without a subscription is a Basic store).
CREATE OR REPLACE FUNCTION delivr_store_effective_plan(p_store_id UUID)
RETURNS TABLE (plan_id UUID, plan_name TEXT, plan_price NUMERIC, plan_limit INT, plan_sort INT,
               subscription_id UUID, subscription_status TEXT)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
    SELECT p.id, p.name, p.price, p.included_orders, p.sort_order, s.id, s.status
      FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.party_type = 'store' AND s.party_id = p_store_id AND s.status <> 'cancelled'
     ORDER BY s.created_at DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id, p.name, p.price, p.included_orders, p.sort_order, NULL::UUID, NULL::TEXT
      FROM subscription_plans p
     WHERE p.audience = 'store' AND p.is_active AND p.price = 0
     ORDER BY p.sort_order, p.created_at LIMIT 1;
END $$;

-- Smallest active store plan whose limit covers p_orders (NULL if none).
CREATE OR REPLACE FUNCTION delivr_plan_for_orders(p_orders INT)
RETURNS subscription_plans LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.* FROM subscription_plans p
   WHERE p.audience = 'store' AND p.is_active
     AND p.included_orders IS NOT NULL AND p.included_orders >= p_orders
   ORDER BY p.included_orders, p.sort_order LIMIT 1
$$;

-- Next tier up from a limit (NULL if already on the top plan).
CREATE OR REPLACE FUNCTION delivr_plan_above(p_limit INT)
RETURNS subscription_plans LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.* FROM subscription_plans p
   WHERE p.audience = 'store' AND p.is_active
     AND p.included_orders IS NOT NULL AND p.included_orders > p_limit
   ORDER BY p.included_orders, p.sort_order LIMIT 1
$$;

-- The highest limit of any plan; above it the price is agreed per store.
CREATE OR REPLACE FUNCTION delivr_plan_top_limit()
RETURNS INT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT max(included_orders) FROM subscription_plans
   WHERE audience = 'store' AND is_active AND included_orders IS NOT NULL
$$;

-- ok | near (≥ 80 %) | over (> limit) | custom (> top plan: «Κατόπιν συμφωνίας»)
CREATE OR REPLACE FUNCTION delivr_usage_state(p_orders INT, p_limit INT, p_top INT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_limit IS NULL OR p_limit <= 0 THEN 'ok'
    WHEN p_orders > p_limit AND p_top IS NOT NULL AND p_orders > p_top THEN 'custom'
    WHEN p_orders > p_limit THEN 'over'
    WHEN p_orders * 100 >= p_limit * 80 THEN 'near'
    ELSE 'ok' END
$$;

CREATE OR REPLACE FUNCTION delivr_plan_json(p subscription_plans)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', p.id, 'name', p.name, 'price', p.price, 'billing_cycle', p.billing_cycle,
    'included_orders', p.included_orders) END
$$;

-- ── 8a. The store's own meter (merchant app) ─────────────────
CREATE OR REPLACE FUNCTION delivr_store_plan_usage(p_store_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pl       RECORD;
  v_month  DATE := delivr_local_month();
  v_orders INT;
  v_top    INT  := delivr_plan_top_limit();
  v_state  TEXT;
  v_next   subscription_plans;
BEGIN
  IF NOT (delivr_is_admin() OR delivr_is_store_member(p_store_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO pl FROM delivr_store_effective_plan(p_store_id);
  v_orders := delivr_store_month_orders(p_store_id, v_month);
  v_state  := delivr_usage_state(v_orders, pl.plan_limit, v_top);

  IF v_state = 'over' THEN
    v_next := delivr_plan_for_orders(v_orders);
  ELSIF v_state = 'near' THEN
    v_next := delivr_plan_above(pl.plan_limit);
  END IF;

  RETURN jsonb_build_object(
    'month', v_month,
    'next_month', (v_month + interval '1 month')::DATE,
    'orders', v_orders,
    'limit', pl.plan_limit,
    'pct', CASE WHEN coalesce(pl.plan_limit, 0) > 0 THEN round(100.0 * v_orders / pl.plan_limit) ELSE NULL END,
    'state', v_state,
    'top_limit', v_top,
    'plan', CASE WHEN pl.plan_id IS NULL THEN NULL ELSE
              jsonb_build_object('id', pl.plan_id, 'name', pl.plan_name, 'price', pl.plan_price) END,
    'next_plan', delivr_plan_json(v_next));
END $$;

-- ── 8b. Admin: every store's meter, and what the next run would do ──
CREATE OR REPLACE FUNCTION delivr_admin_plan_usage(p_month DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month DATE := date_trunc('month', coalesce(p_month, delivr_local_month()))::DATE;
  v_prev  DATE := (date_trunc('month', coalesce(p_month, delivr_local_month())) - interval '1 month')::DATE;
  v_top   INT  := delivr_plan_top_limit();
  st      RECORD;
  pl      RECORD;
  ch      RECORD;
  v_orders INT; v_prev_orders INT; v_state TEXT; v_prev_state TEXT;
  v_sugg  subscription_plans;
  v_pend  JSONB;
  v_out   JSONB := '[]'::JSONB;
BEGIN
  IF NOT delivr_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  FOR st IN SELECT s.id, s.name, s.slug, s.onboarding_status FROM stores s
             WHERE s.is_active ORDER BY s.name LOOP
    SELECT * INTO pl FROM delivr_store_effective_plan(st.id);
    v_orders      := delivr_store_month_orders(st.id, v_month);
    v_prev_orders := delivr_store_month_orders(st.id, v_prev);
    v_state       := delivr_usage_state(v_orders, pl.plan_limit, v_top);
    v_prev_state  := delivr_usage_state(v_prev_orders, pl.plan_limit, v_top);

    v_sugg := NULL;
    IF v_state = 'over' THEN v_sugg := delivr_plan_for_orders(v_orders);
    ELSIF v_state = 'near' THEN v_sugg := delivr_plan_above(pl.plan_limit);
    END IF;

    -- Last month's overrun not acted on yet = what the next run will do.
    SELECT c.kind, c.created_at, tp.name AS to_name INTO ch
      FROM store_plan_changes c LEFT JOIN subscription_plans tp ON tp.id = c.to_plan_id
     WHERE c.store_id = st.id AND c.period_start = v_month;
    v_pend := NULL;
    IF ch.kind IS NULL AND v_prev_state IN ('over', 'custom') THEN
      v_pend := jsonb_build_object('kind', CASE WHEN v_prev_state = 'custom' THEN 'custom' ELSE 'upgrade' END,
                                   'to_plan', delivr_plan_json(CASE WHEN v_prev_state = 'over'
                                                THEN delivr_plan_for_orders(v_prev_orders) END));
    END IF;

    v_out := v_out || jsonb_build_object(
      'store_id', st.id, 'name', st.name, 'slug', st.slug, 'onboarding_status', st.onboarding_status,
      'plan', CASE WHEN pl.plan_id IS NULL THEN NULL ELSE
                jsonb_build_object('id', pl.plan_id, 'name', pl.plan_name, 'price', pl.plan_price) END,
      'subscribed', pl.subscription_id IS NOT NULL,
      'limit', pl.plan_limit,
      'orders', v_orders,
      'pct', CASE WHEN coalesce(pl.plan_limit, 0) > 0 THEN round(100.0 * v_orders / pl.plan_limit) ELSE NULL END,
      'state', v_state,
      'suggested_plan', delivr_plan_json(v_sugg),
      'prev_orders', v_prev_orders,
      'prev_state', v_prev_state,
      'pending', v_pend,
      'applied', CASE WHEN ch.kind IS NULL THEN NULL ELSE
                   jsonb_build_object('kind', ch.kind, 'to_plan_name', ch.to_name, 'at', ch.created_at) END);
  END LOOP;

  RETURN jsonb_build_object('month', v_month, 'prev_month', v_prev, 'top_limit', v_top, 'stores', v_out);
END $$;

-- ── 8c. The month-start move (admin button / pg_cron) ────────
-- Looks at the month BEFORE p_period. A store over its limit moves to the
-- smallest plan that fits, from p_period on; over the top plan it is only
-- flagged («Κατόπιν συμφωνίας»). Never downgrades, never touches orders.
-- One store_plan_changes row per store per month makes re-runs harmless.
-- Callable by the admin, the service role and pg_cron — not by a store.
CREATE OR REPLACE FUNCTION delivr_apply_plan_upgrades(p_period DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role   TEXT := coalesce(nullif(current_setting('role', true), ''), 'none');
  v_period DATE := date_trunc('month', coalesce(p_period, delivr_local_month()))::DATE;
  v_eval   DATE := (date_trunc('month', coalesce(p_period, delivr_local_month())) - interval '1 month')::DATE;
  v_top    INT  := delivr_plan_top_limit();
  st       RECORD;
  pl       RECORD;
  tgt      subscription_plans;
  v_orders INT;
  v_note   TEXT;
  v_up     JSONB := '[]'::JSONB;
  v_custom JSONB := '[]'::JSONB;
BEGIN
  -- SECURITY DEFINER changes current_user, not the session's API role.
  IF v_role IN ('anon', 'authenticated') AND NOT delivr_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  FOR st IN SELECT s.id, s.name FROM stores s WHERE s.is_active ORDER BY s.name LOOP
    SELECT * INTO pl FROM delivr_store_effective_plan(st.id);
    IF pl.plan_id IS NULL OR pl.plan_limit IS NULL THEN CONTINUE; END IF;

    v_orders := delivr_store_month_orders(st.id, v_eval);
    IF v_orders <= pl.plan_limit THEN CONTINUE; END IF;

    IF v_top IS NULL OR v_orders > v_top THEN
      INSERT INTO store_plan_changes (store_id, period_start, orders_counted, from_plan_id, to_plan_id, kind)
      VALUES (st.id, v_period, v_orders, pl.plan_id, NULL, 'custom')
      ON CONFLICT (store_id, period_start) DO NOTHING;
      IF FOUND THEN
        v_custom := v_custom || jsonb_build_object('store_id', st.id, 'name', st.name,
                                                   'orders', v_orders, 'plan', pl.plan_name);
      END IF;
      CONTINUE;
    END IF;

    tgt := delivr_plan_for_orders(v_orders);
    IF tgt.id IS NULL OR tgt.included_orders <= pl.plan_limit THEN CONTINUE; END IF;

    INSERT INTO store_plan_changes (store_id, period_start, orders_counted, from_plan_id, to_plan_id, kind)
    VALUES (st.id, v_period, v_orders, pl.plan_id, tgt.id, 'upgrade')
    ON CONFLICT (store_id, period_start) DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_note := format('Αυτόματη αλλαγή %s → %s από %s (%s παραγγελίες τον %s)',
                     pl.plan_name, tgt.name, to_char(v_period, 'MM/YYYY'), v_orders, to_char(v_eval, 'MM/YYYY'));

    IF pl.subscription_id IS NOT NULL THEN
      -- Status (incl. a running trial) stays as it is; only plan and price move.
      UPDATE subscriptions
         SET plan_id = tgt.id, price = tgt.price, billing_cycle = tgt.billing_cycle,
             notes = concat_ws(E'\n', nullif(notes, ''), v_note), updated_at = now()
       WHERE id = pl.subscription_id;
    ELSE
      INSERT INTO subscriptions (plan_id, party_type, party_id, status, price, billing_cycle,
                                 started_on, next_charge_on, notes)
      VALUES (tgt.id, 'store', st.id, 'active', tgt.price, tgt.billing_cycle,
              v_period, v_period, v_note);
    END IF;

    v_up := v_up || jsonb_build_object('store_id', st.id, 'name', st.name, 'orders', v_orders,
                                       'from', pl.plan_name, 'to', tgt.name, 'price', tgt.price);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'period', v_period, 'evaluated_month', v_eval,
                            'upgraded', v_up, 'custom', v_custom);
END $$;

-- ── 9. /join: plans with their monthly order limit ───────────
CREATE OR REPLACE FUNCTION delivr_public_plans()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    -- Plan prices and order limits only; nothing about commission.
    'default', (SELECT jsonb_build_object('auto_approve', ps.marketplace_auto_approve)
                  FROM platform_settings ps WHERE ps.id = 1),
    'custom_above', delivr_plan_top_limit(),
    'plans', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'description', p.description,
               'price', p.price, 'billing_cycle', p.billing_cycle, 'trial_days', p.trial_days,
               'included_orders', p.included_orders,
               'features', p.features) ORDER BY p.sort_order, p.price)
        FROM subscription_plans p
       WHERE p.is_active AND p.audience = 'store'), '[]'::JSONB))
$$;

-- ── 10. Grants (revoke first — the 009/010 lesson) ───────────
REVOKE EXECUTE ON FUNCTION delivr_card_paid_on_delivery()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_store_payment_options(UUID)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_local_month(TIMESTAMPTZ)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_store_month_orders(UUID, DATE)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_store_effective_plan(UUID)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_plan_for_orders(INT)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_plan_above(INT)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_plan_top_limit()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_usage_state(INT, INT, INT)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_plan_json(subscription_plans)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delivr_store_plan_usage(UUID)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_admin_plan_usage(DATE)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_apply_plan_upgrades(DATE)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_public_plans()                   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION delivr_card_paid_on_delivery()           TO authenticated;
-- Checkout asks which methods a store takes: public.
GRANT EXECUTE ON FUNCTION delivr_store_payment_options(UUID)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_public_plans()                    TO anon, authenticated;
-- Store member or admin (checked inside).
GRANT EXECUTE ON FUNCTION delivr_store_plan_usage(UUID)            TO authenticated;
-- Admin only (checked inside).
GRANT EXECUTE ON FUNCTION delivr_admin_plan_usage(DATE)            TO authenticated;
GRANT EXECUTE ON FUNCTION delivr_apply_plan_upgrades(DATE)         TO authenticated, service_role;

-- ── 11. Monthly schedule (pg_cron) — READ THIS ───────────────
-- pg_cron is AVAILABLE on the live project but NOT installed (checked
-- 30/10/2026). This block schedules the move only if pg_cron is already
-- installed when the migration runs; otherwise it does nothing and the
-- admin runs it from Διαχείριση → Συνδρομές → «Εφαρμογή αλλαγών πακέτων».
-- To automate later: Supabase → Integrations → Cron (installs pg_cron),
-- then run this block again. 03:15 UTC on the 1st = early morning of the
-- 1st in Athens, so the month that just ended is complete.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('delivr-plan-upgrades', '15 3 1 * *',
                          'SELECT public.delivr_apply_plan_upgrades()');
  ELSE
    RAISE NOTICE 'pg_cron not installed: delivr_apply_plan_upgrades() is not scheduled (run it from the admin).';
  END IF;
END
$cron$;
