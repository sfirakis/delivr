-- ============================================================
-- Delivr Platform — Migration 012
-- Standalone stores: a shop that is not tied to our properties
-- can take orders from its own public link, with the customer
-- typing their own address instead of scanning a house QR.
-- ============================================================

-- ── Store opt-in ─────────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS standalone_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS standalone_intro   TEXT;

COMMENT ON COLUMN stores.standalone_enabled IS
  'Store accepts orders from its own /store/<slug> link, outside the property QR flow.';

-- Orders placed from a store link carry their own channel, so platform
-- reporting can separate "came from one of our houses" from "came from
-- the shop''s own link".
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_chk;
  ALTER TABLE orders ADD CONSTRAINT orders_channel_chk
    CHECK (channel IN ('app','qr','phone','admin','store'));
END $$;

-- ── Zone match from a typed address ──────────────────────────
-- delivr_match_zone() needs a property row. A walk-up customer has no
-- property, only what they typed, so this matches on area / postal code
-- / city. There are no coordinates, so there is no radius fallback:
-- either a zone covers what they typed, or we say no. A store that has
-- not drawn any zone yet still works — it falls back to its own default
-- delivery fee, so onboarding a shop does not require zone setup first.
CREATE OR REPLACE FUNCTION delivr_match_address(
  p_store_id UUID,
  p_area     TEXT,
  p_postal   TEXT DEFAULT NULL,
  p_city     TEXT DEFAULT NULL,
  p_service  TEXT DEFAULT 'delivery'
) RETURNS TABLE (
  zone_id UUID, is_match BOOLEAN, fee NUMERIC, min_amount NUMERIC,
  extra_min INT, dist_km DOUBLE PRECISION, free_above NUMERIC, match_type TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s stores%ROWTYPE; z store_zones%ROWTYPE; v_zones INT;
BEGIN
  SELECT * INTO s FROM stores WHERE id = p_store_id;
  IF s.id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, 0::NUMERIC, 0::NUMERIC, 0,
                        NULL::DOUBLE PRECISION, NULL::NUMERIC, 'none'::TEXT;
    RETURN;
  END IF;

  IF p_service = 'pickup' THEN
    RETURN QUERY SELECT NULL::UUID, s.supports_takeaway, 0::NUMERIC,
      coalesce(s.min_order_amount, 0), 0, NULL::DOUBLE PRECISION,
      NULL::NUMERIC, 'pickup'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO z FROM store_zones sz
   WHERE sz.store_id = s.id AND sz.is_active
     AND (
          (sz.postal_code IS NOT NULL AND nullif(btrim(coalesce(p_postal, '')), '') IS NOT NULL
            AND replace(sz.postal_code, ' ', '') = replace(btrim(p_postal), ' ', ''))
       OR (sz.area IS NOT NULL AND p_area IS NOT NULL
            AND delivr_norm(sz.area) = delivr_norm(p_area))
       OR (sz.area IS NULL AND sz.postal_code IS NULL AND sz.city IS NOT NULL
            AND p_city IS NOT NULL AND delivr_norm(sz.city) = delivr_norm(p_city))
     )
   -- Same specificity as delivr_match_zone (011b): a named area beats a
   -- postal code, which beats a city-wide zone. Cheapest-first would let a
   -- broad city zone undercut the area the customer actually picked.
   ORDER BY
     CASE
       WHEN sz.area IS NOT NULL AND p_area IS NOT NULL
            AND delivr_norm(sz.area) = delivr_norm(p_area) THEN 1
       WHEN sz.postal_code IS NOT NULL AND nullif(btrim(coalesce(p_postal, '')), '') IS NOT NULL
            AND replace(sz.postal_code, ' ', '') = replace(btrim(p_postal), ' ', '') THEN 2
       ELSE 3
     END ASC,
     sz.sort_order ASC
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT z.id, s.supports_delivery, z.delivery_fee,
      CASE WHEN z.min_order > 0 THEN z.min_order ELSE coalesce(s.min_order_amount, 0) END,
      z.extra_minutes, NULL::DOUBLE PRECISION,
      coalesce(z.free_above, s.free_delivery_above), 'zone'::TEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO v_zones FROM store_zones sz
   WHERE sz.store_id = s.id AND sz.is_active;

  IF v_zones = 0 AND s.supports_delivery THEN
    RETURN QUERY SELECT NULL::UUID, true, s.delivery_fee, coalesce(s.min_order_amount, 0),
      0, NULL::DOUBLE PRECISION, s.free_delivery_above, 'store'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::UUID, false, s.delivery_fee, coalesce(s.min_order_amount, 0),
    0, NULL::DOUBLE PRECISION, s.free_delivery_above, 'none'::TEXT;
END $$;

-- ── Public: a store by its own slug ──────────────────────────
-- Feeds /store/<slug>. Returns the areas the store delivers to so the
-- customer picks one instead of typing it and hoping it matches.
CREATE OR REPLACE FUNCTION delivr_store_by_slug(p_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s stores%ROWTYPE; v_zones JSONB; v_zone_count INT;
BEGIN
  SELECT * INTO s FROM stores
   WHERE delivr_norm(slug) = delivr_norm(p_slug)
     AND is_active AND onboarding_status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT s.standalone_enabled THEN
    RAISE EXCEPTION 'STANDALONE_DISABLED' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', z.id, 'name', z.name, 'area', z.area, 'city', z.city,
           'postal_code', z.postal_code, 'fee', z.delivery_fee,
           'min_order', CASE WHEN z.min_order > 0 THEN z.min_order
                             ELSE coalesce(s.min_order_amount, 0) END,
           'free_above', coalesce(z.free_above, s.free_delivery_above),
           'extra_min', z.extra_minutes
         ) ORDER BY z.sort_order, z.name), '[]'::JSONB), count(*)
    INTO v_zones, v_zone_count
    FROM store_zones z
   WHERE z.store_id = s.id AND z.is_active;

  RETURN jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
    'intro', s.standalone_intro,
    'category', s.category::TEXT, 'cuisine_tags', s.cuisine_tags,
    'logo_url', s.logo_url, 'cover_url', s.cover_url,
    'address', s.address, 'city', s.city, 'phone', s.phone,
    'rating', s.rating, 'review_count', s.review_count,
    'discount_pct', s.discount_pct, 'pickup_discount_pct', s.pickup_discount_pct,
    'delivery_fee', s.delivery_fee, 'min_order', coalesce(s.min_order_amount, 0),
    'free_above', s.free_delivery_above,
    'eta_min', coalesce(s.avg_delivery_time, 30),
    'prep_min', s.prep_time_min,
    'supports_delivery', s.supports_delivery,
    'supports_takeaway', s.supports_takeaway,
    'accepts_cash', s.accepts_cash,
    'is_open_now', delivr_store_open_now(s.id),
    -- No zones drawn yet: the store still delivers, at its own flat fee,
    -- and the customer types their area freely.
    'zones_required', v_zone_count > 0,
    'zones', v_zones
  );
END $$;

-- Grants, per the rule the 009/010 migrations broke: revoke first, then hand
-- out exactly what each role needs.
REVOKE EXECUTE ON FUNCTION delivr_store_by_slug(TEXT)                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_match_address(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

-- The store page is the one public surface here, so anon needs it.
GRANT EXECUTE ON FUNCTION delivr_store_by_slug(TEXT) TO anon, authenticated;

-- delivr_match_address stays internal: delivr_place_order calls it as the
-- definer, and the store page already gets its fees from the slug payload.
-- Exposing it would let anyone probe a store's zones one guess at a time.
GRANT EXECUTE ON FUNCTION delivr_match_address(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
