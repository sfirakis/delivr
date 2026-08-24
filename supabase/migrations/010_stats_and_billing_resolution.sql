-- ============================================================
-- Delivr Platform — Migration 010
-- Reporting: platform P&L, per-store reports, and the single
-- place that answers "what does this party actually pay?".
-- ============================================================

-- Precedence: explicit per-party override → subscription plan → platform default.
CREATE OR REPLACE FUNCTION delivr_resolve_billing(p_party_type TEXT, p_party_id UUID)
RETURNS TABLE (mode TEXT, value NUMERIC, direction TEXT, source TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ps        platform_settings%ROWTYPE;
  v_mode    TEXT;
  v_value   NUMERIC;
  v_dir     TEXT := 'charge';
  pl        RECORD;
BEGIN
  SELECT * INTO ps FROM platform_settings WHERE id = 1;

  IF p_party_type = 'store' THEN
    SELECT billing_mode, billing_value INTO v_mode, v_value FROM stores WHERE id = p_party_id;
  ELSE
    SELECT billing_mode, billing_value,
           CASE WHEN billing_direction = 'inherit' THEN ps.property_billing_direction ELSE billing_direction END
      INTO v_mode, v_value, v_dir
      FROM properties WHERE id = p_party_id;
  END IF;

  IF v_mode IS NOT NULL AND v_mode <> 'inherit' THEN
    RETURN QUERY SELECT v_mode, coalesce(v_value, 0), v_dir, 'party'::TEXT;
    RETURN;
  END IF;

  SELECT p.commission_mode, p.commission_value INTO pl
    FROM subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id
   WHERE s.party_type = p_party_type AND s.party_id = p_party_id
     AND s.status IN ('trial', 'active', 'past_due')
     AND p.commission_mode IS NOT NULL
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT pl.commission_mode, coalesce(pl.commission_value, 0), v_dir, 'plan'::TEXT;
    RETURN;
  END IF;

  IF p_party_type = 'store' THEN
    RETURN QUERY SELECT ps.store_billing_mode, ps.store_billing_value, 'charge'::TEXT, 'platform'::TEXT;
  ELSE
    RETURN QUERY SELECT ps.property_billing_mode, ps.property_billing_value,
                        ps.property_billing_direction, 'platform'::TEXT;
  END IF;
END $$;

-- ── Platform-wide P&L ────────────────────────────────────────
CREATE OR REPLACE FUNCTION delivr_platform_stats(
  p_from DATE DEFAULT (CURRENT_DATE - 29), p_to DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from TIMESTAMPTZ := p_from::TIMESTAMPTZ;
  v_to   TIMESTAMPTZ := (p_to + 1)::TIMESTAMPTZ;
  r      JSONB;
BEGIN
  IF NOT delivr_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;

  WITH o AS (
    SELECT * FROM orders WHERE created_at >= v_from AND created_at < v_to
  ), live AS (
    SELECT * FROM o WHERE status <> 'cancelled'
  ), c AS (
    SELECT * FROM order_charges
     WHERE created_at >= v_from AND created_at < v_to AND status <> 'void'
  )
  SELECT jsonb_build_object(
    'from', p_from, 'to', p_to,
    'totals', jsonb_build_object(
      'orders',      (SELECT count(*) FROM o),
      'live_orders', (SELECT count(*) FROM live),
      'gmv',         (SELECT coalesce(sum(total), 0) FROM live),
      'aov',         (SELECT coalesce(round(avg(total), 2), 0) FROM live),
      'delivered',   (SELECT count(*) FROM o WHERE status = 'delivered'),
      'cancelled',   (SELECT count(*) FROM o WHERE status = 'cancelled'),
      'rejection_rate', (SELECT CASE WHEN count(*) = 0 THEN 0
                          ELSE round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 1) END FROM o),
      'qr_orders',       (SELECT count(*) FROM o WHERE channel = 'qr'),
      'delivery_orders', (SELECT count(*) FROM live WHERE delivery_type = 'delivery'),
      'pickup_orders',   (SELECT count(*) FROM live WHERE delivery_type = 'pickup'),
      'scans',           (SELECT coalesce(count(*), 0) FROM property_scans
                           WHERE scanned_at >= v_from AND scanned_at < v_to)
    ),
    'income', jsonb_build_object(
      'commission',    (SELECT coalesce(sum(amount), 0) FROM c WHERE direction = 'charge' AND kind = 'order'),
      'subscriptions', (SELECT coalesce(sum(amount), 0) FROM c WHERE direction = 'charge' AND kind = 'subscription'),
      'adjustments',   (SELECT coalesce(sum(amount), 0) FROM c WHERE direction = 'charge' AND kind = 'adjustment'),
      'total',         (SELECT coalesce(sum(amount), 0) FROM c WHERE direction = 'charge')
    ),
    'payouts',  (SELECT coalesce(sum(amount), 0) FROM c WHERE direction = 'payout'),
    'net',      (SELECT coalesce(sum(amount) FILTER (WHERE direction = 'charge'), 0)
                      - coalesce(sum(amount) FILTER (WHERE direction = 'payout'), 0) FROM c),
    'pending',  (SELECT coalesce(sum(amount), 0) FROM c WHERE status = 'pending'),
    'paid',     (SELECT coalesce(sum(amount), 0) FROM c WHERE status = 'paid'),
    'series', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'day', d::DATE, 'orders', coalesce(x.orders, 0),
        'gmv', coalesce(x.gmv, 0), 'commission', coalesce(y.commission, 0)) ORDER BY d), '[]'::JSONB)
      FROM generate_series(p_from, p_to, interval '1 day') d
      LEFT JOIN (
        SELECT created_at::DATE AS day, count(*) AS orders, sum(total) AS gmv
          FROM live GROUP BY 1
      ) x ON x.day = d::DATE
      LEFT JOIN (
        SELECT created_at::DATE AS day, sum(amount) AS commission
          FROM c WHERE direction = 'charge' GROUP BY 1
      ) y ON y.day = d::DATE
    ),
    'by_store', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'gmv')::NUMERIC DESC), '[]'::JSONB) FROM (
        SELECT jsonb_build_object(
          'id', s.id, 'name', s.name,
          'orders', count(l.id),
          'gmv', coalesce(sum(l.total), 0),
          'aov', coalesce(round(avg(l.total), 2), 0),
          'commission', coalesce((SELECT sum(amount) FROM c
                                   WHERE party_type = 'store' AND party_id = s.id AND direction = 'charge'), 0),
          'cancelled', (SELECT count(*) FROM o WHERE o.store_id = s.id AND o.status = 'cancelled')
        ) AS t
        FROM stores s LEFT JOIN live l ON l.store_id = s.id
        GROUP BY s.id, s.name
        HAVING count(l.id) > 0
           OR EXISTS (SELECT 1 FROM c WHERE party_type = 'store' AND party_id = s.id)
      ) q
    ),
    'by_property', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'gmv')::NUMERIC DESC), '[]'::JSONB) FROM (
        SELECT jsonb_build_object(
          'id', p.id, 'name', p.name, 'code', p.code, 'area', p.area,
          'orders', count(l.id),
          'gmv', coalesce(sum(l.total), 0),
          'payout', coalesce((SELECT sum(amount) FROM c
                               WHERE party_type = 'property' AND party_id = p.id AND direction = 'payout'), 0),
          'scans', p.scan_count
        ) AS t
        FROM properties p LEFT JOIN live l ON l.property_id = p.id
        GROUP BY p.id, p.name, p.code, p.area, p.scan_count
        HAVING count(l.id) > 0
      ) q
    ),
    'top_items', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'revenue')::NUMERIC DESC), '[]'::JSONB) FROM (
        SELECT jsonb_build_object('name', oi.name, 'qty', sum(oi.quantity),
                                  'revenue', sum(oi.subtotal)) AS t
          FROM order_items oi JOIN live l ON l.id = oi.order_id
         GROUP BY oi.name ORDER BY sum(oi.subtotal) DESC LIMIT 10
      ) q
    ),
    'hours', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('hour', h, 'orders', coalesce(cnt, 0)) ORDER BY h), '[]'::JSONB)
      FROM generate_series(0, 23) h
      LEFT JOIN (
        SELECT extract(hour FROM created_at AT TIME ZONE
                 (SELECT timezone FROM platform_settings WHERE id = 1))::INT AS hh, count(*) AS cnt
          FROM live GROUP BY 1
      ) z ON z.hh = h
    ),
    'subscriptions', (
      SELECT jsonb_build_object(
        'active',  count(*) FILTER (WHERE status IN ('active', 'trial')),
        'mrr',     coalesce(sum(CASE WHEN status IN ('active', 'past_due')
                                     THEN CASE WHEN billing_cycle = 'year' THEN price / 12 ELSE price END
                                     ELSE 0 END), 0),
        'past_due', count(*) FILTER (WHERE status = 'past_due'),
        'trials',   count(*) FILTER (WHERE status = 'trial'))
      FROM subscriptions
    )
  ) INTO r;

  RETURN r;
END $$;

-- ── One store's own numbers ──────────────────────────────────
CREATE OR REPLACE FUNCTION delivr_store_stats(
  p_store_id UUID, p_from DATE DEFAULT (CURRENT_DATE - 29), p_to DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from TIMESTAMPTZ := p_from::TIMESTAMPTZ;
  v_to   TIMESTAMPTZ := (p_to + 1)::TIMESTAMPTZ;
  r      JSONB;
BEGIN
  IF NOT (delivr_is_admin() OR delivr_is_store_member(p_store_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  WITH o AS (
    SELECT * FROM orders
     WHERE store_id = p_store_id AND created_at >= v_from AND created_at < v_to
  ), live AS (
    SELECT * FROM o WHERE status <> 'cancelled'
  ), c AS (
    SELECT * FROM order_charges
     WHERE party_type = 'store' AND party_id = p_store_id
       AND created_at >= v_from AND created_at < v_to AND status <> 'void'
  )
  SELECT jsonb_build_object(
    'from', p_from, 'to', p_to,
    'totals', jsonb_build_object(
      'orders',    (SELECT count(*) FROM o),
      'turnover',  (SELECT coalesce(sum(total), 0) FROM live),
      'aov',       (SELECT coalesce(round(avg(total), 2), 0) FROM live),
      'items_sold',(SELECT coalesce(sum(oi.quantity), 0) FROM order_items oi JOIN live l ON l.id = oi.order_id),
      'delivered', (SELECT count(*) FROM o WHERE status = 'delivered'),
      'cancelled', (SELECT count(*) FROM o WHERE status = 'cancelled'),
      'rejection_rate', (SELECT CASE WHEN count(*) = 0 THEN 0
                          ELSE round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 1) END FROM o),
      'avg_prep',  (SELECT coalesce(round(avg(prep_minutes)), 0) FROM live WHERE prep_minutes IS NOT NULL),
      'delivery',  (SELECT count(*) FROM live WHERE delivery_type = 'delivery'),
      'pickup',    (SELECT count(*) FROM live WHERE delivery_type = 'pickup'),
      'delivery_fees', (SELECT coalesce(sum(delivery_fee), 0) FROM live)
    ),
    'fees', jsonb_build_object(
      'commission',   (SELECT coalesce(sum(amount), 0) FROM c WHERE kind = 'order'),
      'subscription', (SELECT coalesce(sum(amount), 0) FROM c WHERE kind = 'subscription'),
      'total',        (SELECT coalesce(sum(amount), 0) FROM c),
      'pending',      (SELECT coalesce(sum(amount), 0) FROM c WHERE status = 'pending'),
      'net',          (SELECT coalesce(sum(total), 0) FROM live)
                      - (SELECT coalesce(sum(amount), 0) FROM c)
    ),
    'series', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'day', d::DATE, 'orders', coalesce(x.orders, 0), 'turnover', coalesce(x.turnover, 0)) ORDER BY d), '[]'::JSONB)
      FROM generate_series(p_from, p_to, interval '1 day') d
      LEFT JOIN (
        SELECT created_at::DATE AS day, count(*) AS orders, sum(total) AS turnover
          FROM live GROUP BY 1
      ) x ON x.day = d::DATE
    ),
    'top_items', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'revenue')::NUMERIC DESC), '[]'::JSONB) FROM (
        SELECT jsonb_build_object('name', oi.name, 'qty', sum(oi.quantity),
                                  'revenue', sum(oi.subtotal)) AS t
          FROM order_items oi JOIN live l ON l.id = oi.order_id
         GROUP BY oi.name ORDER BY sum(oi.subtotal) DESC LIMIT 10
      ) q
    ),
    'hours', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('hour', h, 'orders', coalesce(cnt, 0)) ORDER BY h), '[]'::JSONB)
      FROM generate_series(0, 23) h
      LEFT JOIN (
        SELECT extract(hour FROM created_at AT TIME ZONE
                 (SELECT timezone FROM platform_settings WHERE id = 1))::INT AS hh, count(*) AS cnt
          FROM live GROUP BY 1
      ) z ON z.hh = h
    ),
    'properties', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'turnover')::NUMERIC DESC), '[]'::JSONB) FROM (
        SELECT jsonb_build_object('name', p.name, 'code', p.code, 'area', p.area,
                                  'orders', count(l.id), 'turnover', coalesce(sum(l.total), 0)) AS t
          FROM live l JOIN properties p ON p.id = l.property_id
         GROUP BY p.id, p.name, p.code, p.area
         ORDER BY sum(l.total) DESC LIMIT 10
      ) q
    ),
    'repeat_customers', (
      SELECT count(*) FROM (
        SELECT guest_phone FROM live
         WHERE guest_phone IS NOT NULL GROUP BY guest_phone HAVING count(*) > 1
      ) q
    )
  ) INTO r;

  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION delivr_platform_stats(DATE, DATE)      TO authenticated;
GRANT EXECUTE ON FUNCTION delivr_store_stats(UUID, DATE, DATE)   TO authenticated;
GRANT EXECUTE ON FUNCTION delivr_resolve_billing(TEXT, UUID)     TO authenticated;
