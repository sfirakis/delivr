-- ============================================================
-- Delivr Platform — Migration 013
-- delivr_place_order() gains an ad-hoc address, so a standalone
-- store can be ordered from without a house QR code. Replaces
-- the 9-argument version from migration 006: two overloads
-- would leave PostgREST unable to pick one.
-- ============================================================

DROP FUNCTION IF EXISTS delivr_place_order(TEXT, UUID, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT);

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

  -- Payment method
  IF p_payment = 'cash' AND NOT ps.allow_cash THEN
    RAISE EXCEPTION 'CASH_DISABLED' USING ERRCODE = '22023';
  END IF;
  IF p_payment <> 'cash' AND NOT ps.allow_online_payment THEN
    RAISE EXCEPTION 'ONLINE_PAYMENT_DISABLED' USING ERRCODE = '22023';
  END IF;
  IF p_payment = 'cash' AND NOT s.accepts_cash THEN
    RAISE EXCEPTION 'STORE_NO_CASH' USING ERRCODE = '22023';
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
    p_payment::payment_method, 'pending', v_promo_code,
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

  v_mode := CASE WHEN s.billing_mode = 'inherit' THEN ps.store_billing_mode ELSE s.billing_mode END;
  v_val  := CASE WHEN s.billing_mode = 'inherit' THEN ps.store_billing_value ELSE s.billing_value END;
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
    'payment_method', p_payment,
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

-- The store token is deliberately NOT returned to the guest: only the
-- notification channels hand it to the store.
REVOKE EXECUTE ON FUNCTION delivr_place_order(TEXT, UUID, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delivr_place_order(TEXT, UUID, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT, TEXT, JSONB)
  TO anon, authenticated;
