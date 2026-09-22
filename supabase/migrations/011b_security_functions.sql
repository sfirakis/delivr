-- ============================================================
-- Delivr Platform — Migration 011b (applied live 2026-09-12)
-- Function EXECUTE hardening, the zone-matching specificity fix,
-- default store hours and the real support contact. Recorded
-- here after the fact, like 011a.
-- ============================================================

-- Internal helpers must not be reachable with the anon key.
revoke execute on function public.delivr_bill_subscriptions(date)      from public, anon;
revoke execute on function public.delivr_platform_stats(date, date)    from public, anon;
revoke execute on function public.delivr_store_stats(uuid, date, date) from public, anon;
revoke execute on function public.delivr_resolve_billing(text, uuid)   from public, anon;
revoke execute on function public.delivr_match_zone(uuid, uuid, text)  from public, anon;
revoke execute on function public.delivr_is_admin()                    from public, anon;
revoke execute on function public.delivr_is_store_member(uuid)         from public, anon;
revoke execute on function public.delivr_is_property_manager(uuid)     from public, anon;
revoke execute on function public.handle_new_user()                    from public, anon;

CREATE OR REPLACE FUNCTION public.delivr_match_zone(p_store_id uuid, p_property_id uuid, p_service text DEFAULT 'delivery'::text)
 RETURNS TABLE(zone_id uuid, is_match boolean, fee numeric, min_amount numeric, extra_min integer, dist_km double precision, free_above numeric, match_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Specificity: named area beats postal code beats city — and the store's
  -- delivery radius stays a hard limit even when a zone matches.
  SELECT * INTO z FROM store_zones sz
   WHERE sz.store_id = s.id AND sz.is_active
     AND (
          (sz.postal_code IS NOT NULL AND pr.postal_code IS NOT NULL
            AND replace(sz.postal_code, ' ', '') = replace(pr.postal_code, ' ', ''))
       OR (sz.area IS NOT NULL AND delivr_norm(sz.area) = delivr_norm(pr.area))
       OR (sz.area IS NULL AND sz.postal_code IS NULL AND sz.city IS NOT NULL
            AND delivr_norm(sz.city) = delivr_norm(pr.city))
     )
   ORDER BY
     CASE
       WHEN sz.area IS NOT NULL AND delivr_norm(sz.area) = delivr_norm(pr.area) THEN 1
       WHEN sz.postal_code IS NOT NULL AND pr.postal_code IS NOT NULL
            AND replace(sz.postal_code, ' ', '') = replace(pr.postal_code, ' ', '') THEN 2
       ELSE 3
     END ASC,
     sz.sort_order ASC
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT z.id,
      (s.supports_delivery AND (d IS NULL OR d <= s.delivery_radius_km)),
      z.delivery_fee,
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
END $function$;

-- A store with no hours row counts as closed, which silently blocked
-- every order: give the active ones a default 09:00-23:00.
insert into public.store_hours (store_id, day_of_week, open_time, close_time, is_closed)
select s.id, d.dow, '09:00'::time, '23:00'::time, false
from public.stores s cross join generate_series(0,6) as d(dow)
where s.is_active
  and not exists (select 1 from public.store_hours h where h.store_id = s.id and h.day_of_week = d.dow);

update public.platform_settings set support_email = 'hello@auditbnb.com' where id = 1;
