-- ============================================================
-- 016 — Merchant POS: change an order's status through an RPC
-- ============================================================
-- Since 011a, clients can only SELECT orders; every write goes through a
-- SECURITY DEFINER function. The POS on /merchant used to advance orders with
-- the order's store_token (the same call as the tokenised /s/<token> page).
-- This adds the signed-in equivalent:
--   * the caller must be staff of the order's store (store_users) or admin,
--   * only the next step of the store's state machine is allowed,
--   * the side effects are the same as delivr_store_action (timestamps,
--     ETA on accept, cash marked paid on delivery, order_events row).
--
-- Additive only: no existing object is changed or dropped.
-- ============================================================

CREATE OR REPLACE FUNCTION delivr_merchant_set_order_status(
  p_order_id UUID, p_action TEXT, p_prep_minutes INT DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o        orders%ROWTYPE;
  v_new    order_status;
  v_prep   INT := NULL;
  v_note   TEXT := NULL;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_ok     BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF NOT (delivr_is_admin() OR delivr_is_store_member(o.store_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

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

  -- The store's state machine (same buttons as /s/<token> and the POS).
  v_ok := CASE p_action
    WHEN 'accept'     THEN o.status = 'pending'
    WHEN 'reject'     THEN o.status IN ('pending', 'confirmed', 'preparing')
    WHEN 'preparing'  THEN o.status = 'confirmed'
    WHEN 'ready'      THEN o.status IN ('confirmed', 'preparing')
    WHEN 'on_the_way' THEN o.status IN ('ready', 'picked_up') AND o.delivery_type = 'delivery'
    WHEN 'delivered'  THEN (o.status = 'on_the_way')
                        OR (o.status IN ('ready', 'picked_up') AND o.delivery_type <> 'delivery')
    ELSE false END;
  IF NOT coalesce(v_ok, false) THEN
    RAISE EXCEPTION 'BAD_TRANSITION' USING ERRCODE = '22023',
      DETAIL = format('%s → %s', o.status, p_action);
  END IF;

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
    UPDATE orders SET status = v_new, cancelled_at = now(), cancel_reason = v_reason,
      updated_at = now()
    WHERE id = o.id;
    v_note := v_reason;

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
  VALUES (o.id, v_new::TEXT,
          CASE WHEN delivr_is_store_member(o.store_id) THEN 'store' ELSE 'admin' END,
          v_note);

  RETURN jsonb_build_object('ok', true, 'status', v_new::TEXT, 'prep_minutes', v_prep);
END $$;

REVOKE EXECUTE ON FUNCTION delivr_merchant_set_order_status(UUID, TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delivr_merchant_set_order_status(UUID, TEXT, INT, TEXT) TO authenticated;
