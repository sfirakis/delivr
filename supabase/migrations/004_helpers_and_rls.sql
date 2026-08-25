-- ============================================================
-- Delivr Platform — Migration 004
-- Helper functions + Row Level Security
-- Closes the hole where stores / menus / promos were writable
-- by anyone holding the anon key.
-- ============================================================

-- ── Text normalisation (Greek + Latin accents) ───────────────
CREATE OR REPLACE FUNCTION delivr_norm(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(regexp_replace(
    lower(translate(coalesce(t,''),
      'ΆΈΉΊΌΎΏΪΫάέήίόύώϊϋΐΰςÁÉÍÓÚÀÈÌÒÙÄËÏÖÜáéíóúàèìòùäëïöü',
      'ΑΕΗΙΟΥΩΙΥαεηιουωιυιυσAEIOUAEIOUAEIOUaeiouaeiouaeiou')),
    '\s+', ' ', 'g')), '')
$$;

-- ── Haversine distance in km ─────────────────────────────────
CREATE OR REPLACE FUNCTION delivr_distance_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)))
  END
$$;

-- ── Is the store open right now (store_hours aware) ──────────
CREATE OR REPLACE FUNCTION delivr_store_open_now(p_store_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz TEXT; v_local TIMESTAMP; v_dow INT;
  v_row store_hours%ROWTYPE; v_is_open BOOLEAN; v_t TIME;
BEGIN
  SELECT timezone INTO v_tz FROM platform_settings WHERE id = 1;
  v_tz := coalesce(v_tz, 'Europe/Athens');
  v_local := now() AT TIME ZONE v_tz;
  v_dow := extract(dow FROM v_local)::INT;
  v_t := v_local::TIME;

  SELECT is_open INTO v_is_open FROM stores WHERE id = p_store_id;
  IF NOT coalesce(v_is_open, false) THEN RETURN false; END IF;

  SELECT * INTO v_row FROM store_hours WHERE store_id = p_store_id AND day_of_week = v_dow;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_row.is_closed THEN RETURN false; END IF;
  IF v_row.open_time IS NULL OR v_row.close_time IS NULL THEN RETURN true; END IF;

  IF v_row.close_time > v_row.open_time THEN
    RETURN v_t >= v_row.open_time AND v_t <= v_row.close_time;
  ELSE
    RETURN v_t >= v_row.open_time OR v_t <= v_row.close_time;
  END IF;
END $$;

-- ── Auth helpers (SECURITY DEFINER to avoid RLS recursion) ───
CREATE OR REPLACE FUNCTION delivr_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
$$;

CREATE OR REPLACE FUNCTION delivr_is_store_member(p_store UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM store_users su WHERE su.user_id = auth.uid() AND su.store_id = p_store
  )
$$;

CREATE OR REPLACE FUNCTION delivr_is_property_manager(p_property UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM properties pr WHERE pr.id = p_property AND pr.manager_user_id = auth.uid()
  )
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE stores               ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_hours          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_modifiers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_uses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties           ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_scans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_zones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_dispatch_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_charges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users          ENABLE ROW LEVEL SECURITY;

-- ── Stores: public reads active, staff/admin manage ──────────
DROP POLICY IF EXISTS stores_public_read ON stores;
CREATE POLICY stores_public_read ON stores FOR SELECT
  USING (is_active = true);
CREATE POLICY stores_staff_read ON stores FOR SELECT TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(id));
CREATE POLICY stores_staff_update ON stores FOR UPDATE TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(id))
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(id));
CREATE POLICY stores_admin_insert ON stores FOR INSERT TO authenticated
  WITH CHECK (delivr_is_admin());
CREATE POLICY stores_admin_delete ON stores FOR DELETE TO authenticated
  USING (delivr_is_admin());

-- ── Store hours ──────────────────────────────────────────────
CREATE POLICY store_hours_public_read ON store_hours FOR SELECT USING (true);
CREATE POLICY store_hours_manage ON store_hours FOR ALL TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id))
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(store_id));

-- ── Store zones ──────────────────────────────────────────────
CREATE POLICY store_zones_public_read ON store_zones FOR SELECT
  USING (is_active = true);
CREATE POLICY store_zones_manage ON store_zones FOR ALL TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id))
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(store_id));

-- ── Menu ─────────────────────────────────────────────────────
CREATE POLICY menu_categories_manage ON menu_categories FOR ALL TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id))
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(store_id));
CREATE POLICY menu_items_manage ON menu_items FOR ALL TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id))
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(store_id));
CREATE POLICY modifier_groups_manage ON item_modifier_groups FOR ALL TO authenticated
  USING (delivr_is_admin() OR EXISTS (
    SELECT 1 FROM menu_items mi WHERE mi.id = item_id AND delivr_is_store_member(mi.store_id)))
  WITH CHECK (delivr_is_admin() OR EXISTS (
    SELECT 1 FROM menu_items mi WHERE mi.id = item_id AND delivr_is_store_member(mi.store_id)));
CREATE POLICY modifiers_manage ON item_modifiers FOR ALL TO authenticated
  USING (delivr_is_admin() OR EXISTS (
    SELECT 1 FROM item_modifier_groups g JOIN menu_items mi ON mi.id = g.item_id
    WHERE g.id = group_id AND delivr_is_store_member(mi.store_id)))
  WITH CHECK (delivr_is_admin() OR EXISTS (
    SELECT 1 FROM item_modifier_groups g JOIN menu_items mi ON mi.id = g.item_id
    WHERE g.id = group_id AND delivr_is_store_member(mi.store_id)));

-- ── Promos ───────────────────────────────────────────────────
CREATE POLICY promo_codes_manage ON promo_codes FOR ALL TO authenticated
  USING (delivr_is_admin() OR (store_id IS NOT NULL AND delivr_is_store_member(store_id)))
  WITH CHECK (delivr_is_admin() OR (store_id IS NOT NULL AND delivr_is_store_member(store_id)));
CREATE POLICY promo_uses_own ON promo_uses FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR delivr_is_admin());

-- ── Properties (never public — reached through RPC by code) ──
CREATE POLICY properties_admin ON properties FOR ALL TO authenticated
  USING (delivr_is_admin() OR manager_user_id = auth.uid())
  WITH CHECK (delivr_is_admin() OR manager_user_id = auth.uid());

CREATE POLICY property_scans_read ON property_scans FOR SELECT TO authenticated
  USING (delivr_is_admin() OR delivr_is_property_manager(property_id));

-- ── Orders: add store / driver / admin access ────────────────
CREATE POLICY orders_store_read ON orders FOR SELECT TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id) OR driver_id = auth.uid());
CREATE POLICY orders_store_update ON orders FOR UPDATE TO authenticated
  USING (delivr_is_admin() OR delivr_is_store_member(store_id) OR driver_id = auth.uid())
  WITH CHECK (delivr_is_admin() OR delivr_is_store_member(store_id) OR driver_id = auth.uid());
CREATE POLICY orders_admin_insert ON orders FOR INSERT TO authenticated
  WITH CHECK (delivr_is_admin());

CREATE POLICY order_items_store_read ON order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
      AND (delivr_is_admin() OR delivr_is_store_member(o.store_id) OR o.driver_id = auth.uid())));

-- ── Order events / dispatch / charges ────────────────────────
CREATE POLICY order_events_read ON order_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
      AND (delivr_is_admin() OR delivr_is_store_member(o.store_id)
           OR o.user_id = auth.uid() OR o.driver_id = auth.uid())));

CREATE POLICY dispatch_admin ON order_dispatch_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
      AND (delivr_is_admin() OR delivr_is_store_member(o.store_id))));

CREATE POLICY charges_read ON order_charges FOR SELECT TO authenticated
  USING (
    delivr_is_admin()
    OR (party_type = 'store'    AND delivr_is_store_member(party_id))
    OR (party_type = 'property' AND delivr_is_property_manager(party_id)));
CREATE POLICY charges_admin_write ON order_charges FOR UPDATE TO authenticated
  USING (delivr_is_admin()) WITH CHECK (delivr_is_admin());

-- ── Platform settings: admin only (public copy via RPC) ──────
CREATE POLICY platform_settings_admin ON platform_settings FOR ALL TO authenticated
  USING (delivr_is_admin()) WITH CHECK (delivr_is_admin());

-- ── Store users ──────────────────────────────────────────────
CREATE POLICY store_users_read ON store_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR delivr_is_admin() OR delivr_is_store_member(store_id));
CREATE POLICY store_users_admin_write ON store_users FOR ALL TO authenticated
  USING (delivr_is_admin()) WITH CHECK (delivr_is_admin());

-- ── Profiles: admins can read all (dashboard) ────────────────
CREATE POLICY profiles_admin_read ON profiles FOR SELECT TO authenticated
  USING (delivr_is_admin());
