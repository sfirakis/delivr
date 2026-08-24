-- ============================================================
-- Delivr Platform — Migration 008
-- Tighten what the anon key can reach. Only the eight public
-- endpoints of the QR flow stay callable without signing in.
-- ============================================================

-- Pin the search_path on the two pure helpers.
ALTER FUNCTION delivr_norm(TEXT) SET search_path = public;
ALTER FUNCTION delivr_distance_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  SET search_path = public;

-- Internal helpers: RLS policies need them for signed-in users only.
-- Nothing anonymous should be able to call them directly.
REVOKE EXECUTE ON FUNCTION delivr_is_admin()                    FROM anon;
REVOKE EXECUTE ON FUNCTION delivr_is_store_member(UUID)         FROM anon;
REVOKE EXECUTE ON FUNCTION delivr_is_property_manager(UUID)     FROM anon;

-- Zone matching is reached through delivr_stores_for_property / delivr_place_order,
-- which are SECURITY DEFINER and therefore do not need the caller to hold this grant.
REVOKE EXECUTE ON FUNCTION delivr_match_zone(UUID, UUID, TEXT)  FROM anon, authenticated;

-- Trigger function — never meant to be an RPC endpoint.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;

-- Note: public.spatial_ref_sys still reports "RLS disabled". It is the PostGIS
-- reference table, owned by the extension and read-only lookup data — it cannot
-- be altered from a normal migration and carries no application data.
