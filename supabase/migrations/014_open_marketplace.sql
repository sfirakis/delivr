-- ============================================================
-- Delivr Platform — Migration 014
-- Delivr Stores: the open marketplace comes back.
--
-- Two product lines on one database:
--   (A) Delivr Stores — any shop signs up, customers pick their
--       area and see every participating store that delivers there
--       or offers take away (like efood).
--   (B) Delivr QR     — the QR-per-property flow. UNCHANGED.
--
-- ADDITIVE ONLY: new columns with safe defaults, new functions.
-- No existing column, constraint, policy or function is dropped,
-- renamed or replaced. Every existing store starts NOT listed, so
-- nothing about today's QR flow or /store/<slug> links changes
-- until a store (or the admin) opts in.
--
-- Orders from the marketplace reuse delivr_place_order() exactly as
-- the store link does (ad-hoc address, standalone_enabled), with
-- channel = 'app' — the value the original customer app used, which
-- orders_channel_chk already allows. 'store' stays the shop's own link,
-- 'qr' stays the property flow.
-- ============================================================

-- ── Columns ──────────────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS marketplace_listed  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_registered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requested_plan_id   UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;

COMMENT ON COLUMN stores.marketplace_listed IS
  'Store appears in the public Delivr Stores marketplace (needs standalone_enabled + onboarding_status=active).';
COMMENT ON COLUMN stores.self_registered_at IS
  'Set when the shop signed itself up from /join (NULL = created by the platform team).';
COMMENT ON COLUMN stores.requested_plan_id IS
  'Plan the shop picked at sign-up. The admin turns it into a subscription on approval — nothing is billed from here.';

CREATE INDEX IF NOT EXISTS idx_stores_marketplace
  ON stores (marketplace_listed) WHERE marketplace_listed;

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS marketplace_auto_approve BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN platform_settings.marketplace_auto_approve IS
  'false = a self-registered shop waits as onboarding_status=pending until the admin approves it.';

-- ── Greek → Latin slug ───────────────────────────────────────
CREATE OR REPLACE FUNCTION delivr_slugify(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(nullif(btrim(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(
        coalesce(delivr_norm(t), ''),
        'ου', 'ou'), 'θ', 'th'), 'χ', 'ch'), 'ψ', 'ps'), 'ξ', 'x'), 'μπ', 'b'), 'ντ', 'd'), 'γκ', 'g'),
      'αβγδεζηικλμνοπρστυφω',
      'avgdeziiklmnoprstyfo'),
    '[^a-z0-9]+', '-', 'g'), '-'), ''), 'store')
$$;

-- ── Which stores are in the marketplace ──────────────────────
-- One definition, used by every function below.
CREATE OR REPLACE FUNCTION delivr_is_marketplace_store(s stores)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT s.is_active AND s.onboarding_status = 'active'
     AND s.standalone_enabled AND s.marketplace_listed
$$;

-- ── Areas customers can pick ─────────────────────────────────
-- Every named area (or city) covered by an active zone of a listed
-- store, plus the own city of listed stores that have no zones yet.
CREATE OR REPLACE FUNCTION delivr_marketplace_areas()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH listed AS (
    SELECT s.id, s.city FROM stores s WHERE delivr_is_marketplace_store(s)
  ), raw AS (
    SELECT coalesce(nullif(btrim(z.area), ''), nullif(btrim(z.city), '')) AS area,
           nullif(btrim(z.city), '') AS city, z.store_id
      FROM store_zones z JOIN listed l ON l.id = z.store_id
     WHERE z.is_active
    UNION ALL
    SELECT nullif(btrim(l.city), ''), nullif(btrim(l.city), ''), l.id
      FROM listed l
     WHERE NOT EXISTS (SELECT 1 FROM store_zones z WHERE z.store_id = l.id AND z.is_active)
  ), grouped AS (
    SELECT min(area) AS area, min(city) AS city, count(DISTINCT store_id) AS n
      FROM raw WHERE area IS NOT NULL
     GROUP BY delivr_norm(area)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('area', area, 'city', city, 'stores', n)
                            ORDER BY n DESC, area), '[]'::JSONB)
    FROM grouped
$$;

-- ── Stores for an area ───────────────────────────────────────
-- With no area: every listed store (browse mode, nothing priced).
-- With an area: each store says whether it delivers there (and at
-- what fee/minimum, from the same delivr_match_address the order RPC
-- uses) and whether it is near enough for take away (same area/city).
-- A store with no zones only counts for its own city here — otherwise
-- a shop in one town would show up as "delivers" everywhere.
CREATE OR REPLACE FUNCTION delivr_marketplace_stores(
  p_area   TEXT DEFAULT NULL,
  p_postal TEXT DEFAULT NULL,
  p_city   TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s stores%ROWTYPE; m RECORD; v_out JSONB := '[]'::JSONB; v_zones INT;
  v_has_area BOOLEAN := nullif(btrim(coalesce(p_area, '')), '') IS NOT NULL
                     OR nullif(btrim(coalesce(p_postal, '')), '') IS NOT NULL
                     OR nullif(btrim(coalesce(p_city, '')), '') IS NOT NULL;
  v_same_city BOOLEAN; v_zone_hit BOOLEAN; v_delivers BOOLEAN; v_pickup BOOLEAN;
  v_zone_name TEXT;
  v_fee NUMERIC; v_min NUMERIC; v_free NUMERIC; v_extra INT;
BEGIN
  FOR s IN SELECT * FROM stores st WHERE delivr_is_marketplace_store(st)
           ORDER BY st.is_promoted DESC, st.rating DESC, st.name LOOP
    v_delivers := NULL; v_pickup := NULL; v_zone_name := NULL;
    v_fee := s.delivery_fee; v_min := coalesce(s.min_order_amount, 0);
    v_free := s.free_delivery_above; v_extra := 0;

    IF v_has_area THEN
      SELECT count(*) INTO v_zones FROM store_zones z WHERE z.store_id = s.id AND z.is_active;
      SELECT * INTO m FROM delivr_match_address(s.id, p_area, p_postal, p_city, 'delivery');
      v_same_city := coalesce(delivr_norm(s.city) = delivr_norm(p_city), false)
                  OR coalesce(delivr_norm(s.city) = delivr_norm(p_area), false);
      v_zone_hit := coalesce(m.match_type = 'zone', false);
      v_delivers := s.supports_delivery AND coalesce(m.is_match, false)
                    AND (v_zone_hit OR (v_zones = 0 AND v_same_city));
      v_pickup   := s.supports_takeaway AND (v_zone_hit OR v_same_city);
      IF NOT (v_delivers OR v_pickup) THEN CONTINUE; END IF;
      IF v_zone_hit THEN SELECT z.name INTO v_zone_name FROM store_zones z WHERE z.id = m.zone_id; END IF;
      IF v_delivers THEN
        v_fee := m.fee; v_min := m.min_amount; v_free := m.free_above; v_extra := coalesce(m.extra_min, 0);
      END IF;
    END IF;

    v_out := v_out || jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'name', s.name, 'description', s.description,
      'category', s.category::TEXT, 'cuisine_tags', coalesce(to_jsonb(s.cuisine_tags), '[]'::JSONB),
      'logo_url', s.logo_url, 'cover_url', s.cover_url,
      'address', s.address, 'city', s.city,
      'rating', s.rating, 'review_count', s.review_count,
      'is_promoted', s.is_promoted,
      'discount_pct', s.discount_pct, 'pickup_discount_pct', s.pickup_discount_pct,
      'is_open_now', delivr_store_open_now(s.id),
      'supports_delivery', s.supports_delivery, 'supports_takeaway', s.supports_takeaway,
      'delivers', v_delivers, 'pickup', v_pickup, 'zone_name', v_zone_name,
      'delivery_fee', v_fee, 'min_order', v_min, 'free_above', v_free,
      -- Same ETA the store page and the QR list show: delivery time + zone extra.
      'eta_min', coalesce(s.avg_delivery_time, 30) + v_extra,
      'prep_min', coalesce(s.prep_time_min, 20)
    );
  END LOOP;
  RETURN v_out;
END $$;

-- ── Plans a shop can pick at sign-up ─────────────────────────
CREATE OR REPLACE FUNCTION delivr_public_plans()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'default', (SELECT jsonb_build_object('mode', ps.store_billing_mode, 'value', ps.store_billing_value,
                                          'auto_approve', ps.marketplace_auto_approve)
                  FROM platform_settings ps WHERE ps.id = 1),
    'plans', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name, 'description', p.description,
               'price', p.price, 'billing_cycle', p.billing_cycle, 'trial_days', p.trial_days,
               'commission_mode', p.commission_mode, 'commission_value', p.commission_value,
               'features', p.features) ORDER BY p.sort_order, p.price)
        FROM subscription_plans p
       WHERE p.is_active AND p.audience = 'store'), '[]'::JSONB))
$$;

-- ── Self sign-up for a shop ──────────────────────────────────
-- The signed-in user becomes the owner of a new store. The store is
-- created pending (unless the admin turned auto-approve on), already
-- opted into its own link and the marketplace, with default hours and
-- — if the shop named its area — a first delivery zone. It cannot take
-- orders until it is active: delivr_place_order() requires that.
CREATE OR REPLACE FUNCTION delivr_register_store(p_store JSONB, p_plan_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  ps      platform_settings%ROWTYPE;
  v_name  TEXT; v_phone TEXT; v_street TEXT; v_city TEXT; v_area TEXT; v_postal TEXT;
  v_cat   store_category;
  v_del   BOOLEAN; v_take BOOLEAN;
  v_fee   NUMERIC; v_min NUMERIC;
  v_base  TEXT; v_slug TEXT; v_n INT := 1;
  v_id    UUID; v_status TEXT; v_email TEXT; v_plan UUID := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;

  -- One self-registered shop per account. A chain with more branches
  -- goes through the platform team.
  IF EXISTS (SELECT 1 FROM store_users su JOIN stores st ON st.id = su.store_id
              WHERE su.user_id = v_uid AND st.self_registered_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ALREADY_REGISTERED' USING ERRCODE = '23505';
  END IF;

  -- Flood guard for the whole platform.
  IF (SELECT count(*) FROM stores WHERE self_registered_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMIT' USING ERRCODE = '53400';
  END IF;

  SELECT * INTO ps FROM platform_settings WHERE id = 1;

  v_name   := btrim(coalesce(p_store->>'name', ''));
  v_phone  := btrim(coalesce(p_store->>'phone', ''));
  v_street := btrim(coalesce(p_store->>'address', ''));
  v_city   := btrim(coalesce(p_store->>'city', ''));
  v_area   := nullif(btrim(coalesce(p_store->>'area', '')), '');
  v_postal := nullif(btrim(coalesce(p_store->>'postal_code', '')), '');

  IF length(v_name) < 2 OR length(v_name) > 80 THEN RAISE EXCEPTION 'NAME_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF length(regexp_replace(v_phone, '\D', '', 'g')) < 8 THEN RAISE EXCEPTION 'PHONE_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_street = '' THEN RAISE EXCEPTION 'ADDRESS_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF v_city = '' THEN RAISE EXCEPTION 'CITY_REQUIRED' USING ERRCODE = '22023'; END IF;

  v_cat := CASE WHEN p_store->>'category' IN
                  (SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'store_category')
                THEN (p_store->>'category')::store_category ELSE 'other'::store_category END;

  v_del  := coalesce((p_store->>'supports_delivery')::BOOLEAN, true);
  v_take := coalesce((p_store->>'supports_takeaway')::BOOLEAN, true);
  IF NOT (v_del OR v_take) THEN RAISE EXCEPTION 'SERVICE_REQUIRED' USING ERRCODE = '22023'; END IF;

  v_fee := greatest(0, least(20,  coalesce(nullif(p_store->>'delivery_fee', '')::NUMERIC, 0)));
  v_min := greatest(0, least(100, coalesce(nullif(p_store->>'min_order', '')::NUMERIC, 0)));

  v_base := left(delivr_slugify(coalesce(nullif(p_store->>'slug', ''), v_name)), 50);
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM stores WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  v_status := CASE WHEN coalesce(ps.marketplace_auto_approve, false) THEN 'active' ELSE 'pending' END;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  IF p_plan_id IS NOT NULL THEN
    SELECT id INTO v_plan FROM subscription_plans
     WHERE id = p_plan_id AND is_active AND audience = 'store';
  END IF;

  INSERT INTO stores (
    name, slug, category, description, address, city, lat, lng, phone, email, order_email,
    supports_delivery, supports_takeaway, delivery_fee, min_order_amount,
    is_open, is_active, onboarding_status,
    standalone_enabled, marketplace_listed, self_registered_at, requested_plan_id
  ) VALUES (
    v_name, v_slug, v_cat, nullif(btrim(coalesce(p_store->>'description', '')), ''),
    v_street, v_city,
    -- No geocoding without a paid service. 0/0 keeps the store out of the
    -- property (QR) radius match until the admin enters real coordinates.
    0, 0,
    v_phone, v_email, v_email,
    v_del, v_take, v_fee, v_min,
    true, true, v_status,
    true, true, now(), v_plan
  ) RETURNING id INTO v_id;

  INSERT INTO store_users (store_id, user_id, role) VALUES (v_id, v_uid, 'owner')
  ON CONFLICT (store_id, user_id) DO NOTHING;

  INSERT INTO store_hours (store_id, day_of_week, open_time, close_time, is_closed)
  SELECT v_id, d, '09:00'::TIME, '23:00'::TIME, false FROM generate_series(0, 6) d;

  -- The area the shop named becomes its first delivery zone, so it does
  -- not deliver "anywhere" by accident.
  IF v_del AND (v_area IS NOT NULL OR v_postal IS NOT NULL) THEN
    INSERT INTO store_zones (store_id, name, area, postal_code, city, delivery_fee, min_order)
    VALUES (v_id, coalesce(v_area, v_postal), v_area, v_postal, v_city, v_fee, v_min);
  END IF;

  -- The account becomes a store account (011a: only definer code moves roles).
  UPDATE profiles SET role = 'store', email = coalesce(email, v_email)
   WHERE id = v_uid AND role = 'customer';

  RETURN jsonb_build_object('id', v_id, 'slug', v_slug, 'onboarding_status', v_status);
END $$;

-- ── Grants (revoke first — the 009/010 lesson) ───────────────
REVOKE EXECUTE ON FUNCTION delivr_slugify(TEXT)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_is_marketplace_store(stores)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_marketplace_areas()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_marketplace_stores(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_public_plans()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION delivr_register_store(JSONB, UUID)         FROM PUBLIC, anon;

-- The marketplace pages are public.
GRANT EXECUTE ON FUNCTION delivr_marketplace_areas()                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_marketplace_stores(TEXT, TEXT, TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delivr_public_plans()                       TO anon, authenticated;
-- Signing a shop up needs an account.
GRANT EXECUTE ON FUNCTION delivr_register_store(JSONB, UUID)          TO authenticated;
-- Helpers used inside RLS-free definer code; authenticated only.
GRANT EXECUTE ON FUNCTION delivr_slugify(TEXT)                        TO authenticated;
GRANT EXECUTE ON FUNCTION delivr_is_marketplace_store(stores)         TO authenticated;
