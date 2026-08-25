-- ============================================================
-- Delivr Platform — Migration 007
-- Guest order tracking + the login-free store actions behind
-- the link that arrives by email.
-- ============================================================

-- ── Public: guest order status by tracking token ─────────────
CREATE OR REPLACE FUNCTION delivr_order_status(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; s stores%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE public_token = btrim(p_token);
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO s FROM stores WHERE id = o.store_id;

  RETURN jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status::TEXT,
    'service', o.delivery_type::TEXT,
    'created_at', o.created_at,
    'confirmed_at', o.confirmed_at,
    'prepared_at', o.prepared_at,
    'picked_up_at', o.picked_up_at,
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'cancel_reason', o.cancel_reason,
    'estimated_ready_at', o.estimated_ready_at,
    'estimated_delivery_at', o.estimated_delivery_at,
    'scheduled_for', o.scheduled_for,
    'prep_minutes', o.prep_minutes,
    'subtotal', o.subtotal,
    'discount_amount', o.discount_amount,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'payment_method', o.payment_method::TEXT,
    'payment_status', o.payment_status::TEXT,
    'guest_name', o.guest_name,
    'delivery_address', o.delivery_address,
    'customer_notes', o.customer_notes,
    'store', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone,
                                'address', s.address, 'logo_url', s.logo_url),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', oi.name, 'quantity', oi.quantity, 'price', oi.price,
        'modifiers', oi.modifiers, 'notes', oi.notes, 'subtotal', oi.subtotal)
        ORDER BY oi.name) FROM order_items oi WHERE oi.order_id = o.id), '[]'::JSONB),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'status', e.status, 'actor', e.actor, 'note', e.note, 'at', e.created_at)
        ORDER BY e.created_at) FROM order_events e WHERE e.order_id = o.id), '[]'::JSONB)
  );
END $$;

-- ── Store: full order by store token (emailed link, no login) ─
CREATE OR REPLACE FUNCTION delivr_store_order(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; s stores%ROWTYPE; pr properties%ROWTYPE; ps platform_settings%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE store_token = btrim(p_token);
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO s  FROM stores     WHERE id = o.store_id;
  SELECT * INTO pr FROM properties WHERE id = o.property_id;
  SELECT * INTO ps FROM platform_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'status', o.status::TEXT,
    'service', o.delivery_type::TEXT,
    'channel', o.channel,
    'created_at', o.created_at,
    'scheduled_for', o.scheduled_for,
    'prep_minutes', o.prep_minutes,
    'estimated_ready_at', o.estimated_ready_at,
    'subtotal', o.subtotal,
    'discount_amount', o.discount_amount,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'platform_fee', o.platform_fee,
    'payment_method', o.payment_method::TEXT,
    'payment_status', o.payment_status::TEXT,
    'promo_code', o.promo_code,
    'customer_notes', o.customer_notes,
    'delivery_notes', o.delivery_notes,
    'cancel_reason', o.cancel_reason,
    'printed_at', o.printed_at,
    'guest', jsonb_build_object('name', o.guest_name, 'phone', o.guest_phone, 'email', o.guest_email),
    'address', o.delivery_address,
    'property', CASE WHEN pr.id IS NULL THEN NULL ELSE jsonb_build_object(
        'name', pr.name, 'code', pr.code, 'address', pr.address, 'area', pr.area,
        'city', pr.city, 'floor', pr.floor, 'doorbell', pr.doorbell,
        'access_notes', pr.access_notes, 'lat', pr.lat, 'lng', pr.lng) END,
    'store', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone,
        'address', s.address, 'logo_url', s.logo_url, 'print_format', s.print_format,
        'prep_time_min', s.prep_time_min),
    'settings', jsonb_build_object('currency', ps.currency, 'platform_name', ps.platform_name,
        'support_phone', ps.support_phone),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', oi.name, 'quantity', oi.quantity, 'price', oi.price,
        'modifiers', oi.modifiers, 'notes', oi.notes, 'subtotal', oi.subtotal)
        ORDER BY oi.name) FROM order_items oi WHERE oi.order_id = o.id), '[]'::JSONB),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'status', e.status, 'actor', e.actor, 'note', e.note, 'at', e.created_at)
        ORDER BY e.created_at) FROM order_events e WHERE e.order_id = o.id), '[]'::JSONB)
  );
END $$;

-- ── Store: accept / reject / advance an order from the link ───
CREATE OR REPLACE FUNCTION delivr_store_action(
  p_token TEXT, p_action TEXT, p_prep_minutes INT DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_new order_status; v_prep INT; v_note TEXT := NULL;
BEGIN
  SELECT * INTO o FROM orders WHERE store_token = btrim(p_token);
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF o.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'ORDER_CLOSED' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'print' THEN
    UPDATE orders SET printed_at = now(), updated_at = now() WHERE id = o.id;
    INSERT INTO order_dispatch_log (order_id, channel, target, status, provider)
    VALUES (o.id, 'print', 'store', 'sent', 'browser');
    RETURN jsonb_build_object('ok', true, 'status', o.status::TEXT, 'printed', true);
  END IF;

  v_new := CASE p_action
    WHEN 'accept'     THEN 'confirmed'::order_status
    WHEN 'preparing'  THEN 'preparing'::order_status
    WHEN 'ready'      THEN 'ready'::order_status
    WHEN 'on_the_way' THEN 'on_the_way'::order_status
    WHEN 'delivered'  THEN 'delivered'::order_status
    WHEN 'reject'     THEN 'cancelled'::order_status
    ELSE NULL END;

  IF v_new IS NULL THEN RAISE EXCEPTION 'BAD_ACTION' USING ERRCODE = '22023'; END IF;

  IF p_action = 'accept' THEN
    v_prep := greatest(1, least(240, coalesce(p_prep_minutes, o.prep_minutes, 20)));
    UPDATE orders SET
      status = v_new, prep_minutes = v_prep, confirmed_at = coalesce(confirmed_at, now()),
      estimated_ready_at = coalesce(scheduled_for, now()) + make_interval(mins => v_prep),
      estimated_delivery_at = coalesce(scheduled_for, now()) + make_interval(
        mins => v_prep + CASE WHEN delivery_type = 'delivery' THEN 15 ELSE 0 END),
      updated_at = now()
    WHERE id = o.id;
    v_note := v_prep || ' min';

  ELSIF p_action = 'reject' THEN
    UPDATE orders SET status = v_new, cancelled_at = now(),
      cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now()
    WHERE id = o.id;
    v_note := nullif(btrim(coalesce(p_reason, '')), '');

  ELSE
    UPDATE orders SET
      status = v_new,
      prepared_at  = CASE WHEN p_action = 'ready'      THEN now() ELSE prepared_at  END,
      picked_up_at = CASE WHEN p_action = 'on_the_way' THEN now() ELSE picked_up_at END,
      delivered_at = CASE WHEN p_action = 'delivered'  THEN now() ELSE delivered_at END,
      payment_status = CASE WHEN p_action = 'delivered' AND payment_method = 'cash'
                            THEN 'paid'::payment_status ELSE payment_status END,
      updated_at = now()
    WHERE id = o.id;
  END IF;

  INSERT INTO order_events (order_id, status, actor, note)
  VALUES (o.id, v_new::TEXT, 'store', v_note);

  RETURN jsonb_build_object('ok', true, 'status', v_new::TEXT, 'prep_minutes', v_prep);
END $$;

GRANT EXECUTE ON FUNCTION delivr_order_status(TEXT)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_store_order(TEXT)                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_store_action(TEXT, TEXT, INT, TEXT)    TO anon, authenticated;
