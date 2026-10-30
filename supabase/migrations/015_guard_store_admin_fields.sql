-- ============================================================
-- Delivr Platform — Migration 015
-- Self-registered shops must not be able to approve themselves.
--
-- stores_staff_update (004) lets a store member UPDATE any column of
-- their own store. With shops now signing themselves up (014), that
-- would let a pending shop set onboarding_status = 'active', or set its
-- own commission to zero. This trigger keeps the platform-owned columns
-- for the admin and for definer code (RPCs), and leaves every column
-- the merchant UI edits today untouched.
--
-- ADDITIVE ONLY: one new function + one new trigger. Nothing dropped.
-- ============================================================

CREATE OR REPLACE FUNCTION delivr_guard_store_admin_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Deliberately SECURITY INVOKER: current_user is then the API role for a
  -- direct client write, and the definer for anything an RPC does.
  IF current_user NOT IN ('anon', 'authenticated') OR delivr_is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status
     OR NEW.is_active      IS DISTINCT FROM OLD.is_active
     OR NEW.billing_mode   IS DISTINCT FROM OLD.billing_mode
     OR NEW.billing_value  IS DISTINCT FROM OLD.billing_value
     OR NEW.is_promoted    IS DISTINCT FROM OLD.is_promoted
     OR NEW.rating         IS DISTINCT FROM OLD.rating
     OR NEW.review_count   IS DISTINCT FROM OLD.review_count
     OR NEW.slug           IS DISTINCT FROM OLD.slug
     OR NEW.self_registered_at IS DISTINCT FROM OLD.self_registered_at THEN
    RAISE EXCEPTION 'ADMIN_ONLY_FIELD' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_store_admin_fields') THEN
    CREATE TRIGGER trg_guard_store_admin_fields
      BEFORE UPDATE ON stores
      FOR EACH ROW EXECUTE FUNCTION delivr_guard_store_admin_fields();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION delivr_guard_store_admin_fields() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delivr_guard_store_admin_fields() TO authenticated;
