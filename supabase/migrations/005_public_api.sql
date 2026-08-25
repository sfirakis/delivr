-- ============================================================
-- Delivr Platform — Migration 005
-- The public API used by the QR guest flow and the store link.
-- Every function is SECURITY DEFINER so the anon key can reach
-- exactly these operations and nothing else.
-- ============================================================

-- ── Zone / radius matching between a store and a property ────
CREATE OR REPLACE FUNCTION delivr_match_zone(
  p_store_id UUID, p_property_id UUID, p_service TEXT DEFAULT 'delivery'
) RETURNS TABLE (
  zone_id UUID, is_match BOOLEAN, fee NUMERIC, min_amount NUMERIC,
  extra_min INT, dist_km DOUBLE PRECISION, free_above NUMERIC, match_type TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s stores%ROWTYPE; pr properties%ROWTYPE; z store_zones%ROWTYPE; d DOUBLE PRECISION;
BEGIN
  SELECT * INTO s  FROM stores     WHERE id = p_store_id;
  SELECT * INTO pr FROM properties WHERE id = p_property_id;

  IF s.id IS NULL OR pr.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 0::NUMERIC, 0::NUMERIC, 0,
                        NULL::DOUBLE PRECISION, NULL::NUMERIC, 'none'::TEXT;
    RETURN;
  END IF;

  d := delivr_distance_km(s.lat, s.lng, pr.lat, pr.lng);

  IF p_service = 'pickup' THEN
    RETURN QUERY SELECT NULL::UUID,
      (s.supports_takeaway AND (d IS NULL OR d <= s.pickup_radius_km)),
      0::NUMERIC, coalesce(s.min_order_amount, 0), 0, d, NULL::NUMERIC, 'pickup'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO z FROM store_zones sz
   WHERE sz.store_id = s.id AND sz.is_active
     AND (
          (sz.postal_code IS NOT NULL AND pr.postal_code IS NOT NULL
            AND replace(sz.postal_code, ' ', '') = replace(pr.postal_code, ' ', ''))
       OR (sz.area IS NOT NULL AND delivr_norm(sz.area) = delivr_norm(pr.area))
       OR (sz.area IS NULL AND sz.postal_code IS NULL AND sz.city IS NOT NULL
            AND delivr_norm(sz.city) = delivr_norm(pr.city))
     )
   ORDER BY sz.delivery_fee ASC, sz.sort_order ASC
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT z.id, s.supports_delivery, z.delivery_fee,
      CASE WHEN z.min_order > 0 THEN z.min_order ELSE coalesce(s.min_order_amount, 0) END,
      z.extra_minutes, d, coalesce(z.free_above, s.free_delivery_above), 'zone'::TEXT;
    RETURN;
  END IF;

  IF s.supports_delivery AND d IS NOT NULL AND d <= s.delivery_radius_km THEN
    RETURN QUERY SELECT NULL::UUID, true, s.delivery_fee, coalesce(s.min_order_amount, 0),
      0, d, s.free_delivery_above, 'radius'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::UUID, false, s.delivery_fee, coalesce(s.min_order_amount, 0),
    0, d, s.free_delivery_above, 'none'::TEXT;
END $$;

-- ── Public: safe platform settings ───────────────────────────
CREATE OR REPLACE FUNCTION delivr_public_settings()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'platform_name', ps.platform_name,
    'currency', ps.currency,
    'timezone', ps.timezone,
    'brand_color', ps.brand_color,
    'logo_url', ps.logo_url,
    'support_phone', ps.support_phone,
    'support_email', ps.support_email,
    'support_whatsapp', ps.support_whatsapp,
    'terms_url', ps.terms_url,
    'allow_cash', ps.allow_cash,
    'allow_online_payment', ps.allow_online_payment,
    'allow_scheduled_orders', ps.allow_scheduled_orders,
    'guest_requires_phone', ps.guest_requires_phone,
    'guest_requires_email', ps.guest_requires_email,
    'default_prep_time', ps.default_prep_time
  ) FROM platform_settings ps WHERE ps.id = 1
$$;

-- ── Public: property by QR code ──────────────────────────────
CREATE OR REPLACE FUNCTION delivr_property_by_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr properties%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM properties
   WHERE delivr_norm(code) = delivr_norm(p_code) AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object(
    'id', pr.id, 'code', pr.code, 'name', pr.name, 'type', pr.type,
    'address', pr.address, 'city', pr.city, 'area', pr.area,
    'postal_code', pr.postal_code, 'lat', pr.lat, 'lng', pr.lng,
    'floor', pr.floor, 'doorbell', pr.doorbell, 'access_notes', pr.access_notes,
    'welcome_message', pr.welcome_message, 'cover_url', pr.cover_url,
    'default_language', pr.default_language
  );
END $$;

-- ── Public: log a QR scan ────────────────────────────────────
CREATE OR REPLACE FUNCTION delivr_log_scan(
  p_code TEXT, p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL, p_language TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM properties
   WHERE delivr_norm(code) = delivr_norm(p_code) AND is_active;
  IF v_id IS NULL THEN RETURN; END IF;

  INSERT INTO property_scans (property_id, user_agent, referrer, language)
  VALUES (v_id, left(coalesce(p_user_agent, ''), 400), left(coalesce(p_referrer, ''), 400), p_language);

  UPDATE properties SET scan_count = scan_count + 1 WHERE id = v_id;
END $$;

-- ── Public: stores serving this property ─────────────────────
CREATE OR REPLACE FUNCTION delivr_stores_for_property(
  p_code TEXT, p_service TEXT DEFAULT 'delivery'
) RETURNS TABLE (
  store_id UUID, store_name TEXT, slug TEXT, description TEXT, category TEXT,
  cuisine_tags TEXT[], logo_url TEXT, cover_url TEXT, store_address TEXT, store_city TEXT,
  store_phone TEXT, rating NUMERIC, review_count INT, is_promoted BOOLEAN,
  discount_pct NUMERIC, pickup_discount_pct NUMERIC,
  delivery_fee NUMERIC, min_order NUMERIC, free_above NUMERIC, eta_min INT,
  dist_km DOUBLE PRECISION, match_type TEXT, is_open_now BOOLEAN,
  supports_delivery BOOLEAN, supports_takeaway BOOLEAN, accepts_cash BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pr properties%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM properties
   WHERE delivr_norm(code) = delivr_norm(p_code) AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.slug, s.description, s.category::TEXT,
         s.cuisine_tags, s.logo_url, s.cover_url, s.address, s.city, s.phone,
         s.rating, s.review_count, s.is_promoted, s.discount_pct, s.pickup_discount_pct,
         m.fee, m.min_amount, m.free_above,
         (coalesce(s.avg_delivery_time, 30) + coalesce(m.extra_min, 0))::INT,
         m.dist_km, m.match_type, delivr_store_open_now(s.id),
         s.supports_delivery, s.supports_takeaway, s.accepts_cash
    FROM stores s
    CROSS JOIN LATERAL delivr_match_zone(s.id, pr.id, p_service) m
   WHERE s.is_active AND s.onboarding_status = 'active' AND m.is_match
   ORDER BY delivr_store_open_now(s.id) DESC, s.is_promoted DESC,
            m.dist_km ASC NULLS LAST, s.rating DESC;
END $$;

GRANT EXECUTE ON FUNCTION delivr_public_settings()                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_property_by_code(TEXT)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_log_scan(TEXT, TEXT, TEXT, TEXT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_stores_for_property(TEXT, TEXT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_match_zone(UUID, UUID, TEXT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_store_open_now(UUID)                  TO anon, authenticated;
