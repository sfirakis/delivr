-- ============================================================
-- Migration: Add driver sessions, store users, profile extras
-- Run AFTER supabase-schema.sql
-- ============================================================

-- ── Profile extras for notifications ─────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS fcm_token             TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"sms":true,"email":true,"push":true}'::jsonb;

-- ── Store users (merchant staff who can access POS) ───────────
CREATE TABLE IF NOT EXISTS store_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  fcm_token   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, user_id)
);

ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_users_own" ON store_users USING (auth.uid() = user_id);

-- ── Driver sessions (real-time location & availability) ───────
CREATE TABLE IF NOT EXISTS driver_sessions (
  driver_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online          BOOLEAN NOT NULL DEFAULT false,
  is_available       BOOLEAN NOT NULL DEFAULT true,
  current_lat        DOUBLE PRECISION,
  current_lng        DOUBLE PRECISION,
  current_heading    NUMERIC(5,1),
  vehicle_type       TEXT DEFAULT 'motorcycle' CHECK (vehicle_type IN ('bicycle','motorcycle','car')),
  active_orders_count INT NOT NULL DEFAULT 0,
  shift_started_at   TIMESTAMPTZ,
  last_seen          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE driver_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_session_own" ON driver_sessions
  USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

-- Allow reading driver location for active orders (customer tracking)
CREATE POLICY "driver_location_for_tracking" ON driver_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE driver_id = driver_sessions.driver_id
        AND user_id = auth.uid()
        AND status IN ('on_the_way','picked_up')
    )
  );

-- ── Add driver session to realtime ────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE driver_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE store_users;

-- ── Loyalty points helper function ───────────────────────────
CREATE OR REPLACE FUNCTION increment_points(user_id UUID, points INT)
RETURNS INT AS $$
DECLARE
  new_points INT;
BEGIN
  UPDATE profiles
  SET loyalty_points = loyalty_points + points
  WHERE id = user_id
  RETURNING loyalty_points INTO new_points;
  RETURN new_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── DB trigger: notify on order status change ─────────────────
-- This fires the send-notification edge function via pg_net
-- Requires: pg_net extension enabled in Supabase dashboard

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_messages JSONB := '{
    "confirmed":  "✓ Η παραγγελία επιβεβαιώθηκε!",
    "preparing":  "👨‍🍳 Το κατάστημα ετοιμάζει...",
    "on_the_way": "🛵 Ο rider είναι στο δρόμο!",
    "delivered":  "📦 Η παραγγελία παραδόθηκε!"
  }'::jsonb;
  msg TEXT;
BEGIN
  -- Only notify on meaningful status transitions
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT (NEW.status = ANY(ARRAY['confirmed','preparing','on_the_way','delivered','cancelled'])) THEN
    RETURN NEW;
  END IF;

  msg := status_messages->>NEW.status;
  IF msg IS NULL THEN RETURN NEW; END IF;

  -- Call send-notification edge function via pg_net (async, non-blocking)
  PERFORM net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := jsonb_build_object(
      'userId', NEW.user_id::text,
      'title',  msg,
      'body',   CASE NEW.status
                  WHEN 'delivered' THEN 'Καλή σου όρεξη! Αξιολόγησε την παραγγελία σου.'
                  WHEN 'cancelled' THEN 'Η παραγγελία ακυρώθηκε. ' || COALESCE(NEW.cancel_reason, '')
                  ELSE 'Ενημέρωση κατάστασης παραγγελίας'
                END,
      'type',   'order_update',
      'data',   jsonb_build_object(
                  'orderId', NEW.id::text,
                  'status',  NEW.status,
                  'total',   NEW.total
                )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION notify_order_status_change();

-- ── Set app config for pg_net trigger ────────────────────────
-- Run these with your actual values:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
