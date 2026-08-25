-- ============================================================
-- Delivr Platform — Migration 003
-- QR properties, delivery zones, billing, guest orders
-- Run AFTER supabase-schema.sql and 002_driver_sessions_notifications.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Roles on profiles ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS email TEXT;

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_chk
    CHECK (role IN ('customer','store','driver','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Platform settings (single row) ───────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                        SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_name             TEXT    NOT NULL DEFAULT 'Delivr',
  currency                  TEXT    NOT NULL DEFAULT 'EUR',
  timezone                  TEXT    NOT NULL DEFAULT 'Europe/Athens',
  order_prefix              TEXT    NOT NULL DEFAULT 'DLV',
  support_phone             TEXT,
  support_email             TEXT,
  support_whatsapp          TEXT,
  brand_color               TEXT    NOT NULL DEFAULT '#FF6B35',
  logo_url                  TEXT,
  terms_url                 TEXT,
  -- Billing defaults (overridable per store / per property)
  store_billing_mode        TEXT    NOT NULL DEFAULT 'commission',  -- none | flat | commission
  store_billing_value       NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  property_billing_mode     TEXT    NOT NULL DEFAULT 'none',
  property_billing_value    NUMERIC(10,2) NOT NULL DEFAULT 0,
  property_billing_direction TEXT   NOT NULL DEFAULT 'payout',      -- charge | payout
  commission_base           TEXT    NOT NULL DEFAULT 'subtotal',    -- subtotal | total
  -- Ordering rules
  default_prep_time         INT     NOT NULL DEFAULT 20,
  guest_requires_phone      BOOLEAN NOT NULL DEFAULT true,
  guest_requires_email      BOOLEAN NOT NULL DEFAULT false,
  allow_cash                BOOLEAN NOT NULL DEFAULT true,
  allow_online_payment      BOOLEAN NOT NULL DEFAULT false,
  allow_scheduled_orders    BOOLEAN NOT NULL DEFAULT true,
  -- Dispatch
  notify_store_email        BOOLEAN NOT NULL DEFAULT true,
  notify_store_whatsapp     BOOLEAN NOT NULL DEFAULT true,
  notify_property_email     BOOLEAN NOT NULL DEFAULT false,
  app_url                   TEXT    NOT NULL DEFAULT 'http://localhost:5173',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  ALTER TABLE platform_settings ADD CONSTRAINT platform_store_mode_chk
    CHECK (store_billing_mode IN ('none','flat','commission'));
  ALTER TABLE platform_settings ADD CONSTRAINT platform_prop_mode_chk
    CHECK (property_billing_mode IN ('none','flat','commission'));
  ALTER TABLE platform_settings ADD CONSTRAINT platform_prop_dir_chk
    CHECK (property_billing_direction IN ('charge','payout'));
  ALTER TABLE platform_settings ADD CONSTRAINT platform_comm_base_chk
    CHECK (commission_base IN ('subtotal','total'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Properties (houses / villas / rooms with a QR code) ──────
CREATE TABLE IF NOT EXISTS properties (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'villa',
  manager_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name        TEXT,
  contact_phone     TEXT,
  contact_email     TEXT,
  whatsapp          TEXT,
  -- Address (drives which stores are shown)
  address           TEXT NOT NULL,
  city              TEXT,
  area              TEXT,
  postal_code       TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  floor             TEXT,
  doorbell          TEXT,
  access_notes      TEXT,
  -- Guest experience
  default_language  TEXT NOT NULL DEFAULT 'el',
  welcome_message   TEXT,
  cover_url         TEXT,
  -- Billing override ('inherit' = use platform_settings)
  billing_mode      TEXT NOT NULL DEFAULT 'inherit',
  billing_value     NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_direction TEXT NOT NULL DEFAULT 'inherit',
  -- Provenance (e.g. imported from StayLink)
  external_source   TEXT,
  external_ref      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  scan_count        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_type_chk
    CHECK (type IN ('villa','apartment','hotel_room','house','office','other'));
  ALTER TABLE properties ADD CONSTRAINT properties_billing_mode_chk
    CHECK (billing_mode IN ('inherit','none','flat','commission'));
  ALTER TABLE properties ADD CONSTRAINT properties_billing_dir_chk
    CHECK (billing_direction IN ('inherit','charge','payout'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_properties_code   ON properties(code);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
CREATE INDEX IF NOT EXISTS idx_properties_area   ON properties(lower(area));

-- ── QR scan analytics ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_scans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT,
  referrer     TEXT,
  language     TEXT
);
CREATE INDEX IF NOT EXISTS idx_property_scans_prop ON property_scans(property_id, scanned_at DESC);

-- ── Store additions ──────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS supports_delivery   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_takeaway   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pickup_radius_km    NUMERIC(6,2) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS pickup_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_email         TEXT,
  ADD COLUMN IF NOT EXISTS order_whatsapp      TEXT,
  ADD COLUMN IF NOT EXISTS notify_email        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_accept         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_time_min       INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS accepts_cash        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_online      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_mode        TEXT NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS billing_value       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_status   TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS print_format        TEXT NOT NULL DEFAULT '80mm',
  ADD COLUMN IF NOT EXISTS notes               TEXT;

DO $$ BEGIN
  ALTER TABLE stores ADD CONSTRAINT stores_billing_mode_chk
    CHECK (billing_mode IN ('inherit','none','flat','commission'));
  ALTER TABLE stores ADD CONSTRAINT stores_onboarding_chk
    CHECK (onboarding_status IN ('pending','active','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Delivery zones per store ─────────────────────────────────
CREATE TABLE IF NOT EXISTS store_zones (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  area           TEXT,
  postal_code    TEXT,
  city           TEXT,
  delivery_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order      NUMERIC(10,2) NOT NULL DEFAULT 0,
  extra_minutes  INT NOT NULL DEFAULT 0,
  free_above     NUMERIC(10,2),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_store_zones_store ON store_zones(store_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_store_zones_area  ON store_zones(lower(area));
CREATE INDEX IF NOT EXISTS idx_store_zones_pc    ON store_zones(postal_code);

-- ── Order additions (guest / QR / tokens) ────────────────────
ALTER TABLE orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_number    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS public_token    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS store_token     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS guest_name      TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone     TEXT,
  ADD COLUMN IF NOT EXISTS guest_email     TEXT,
  ADD COLUMN IF NOT EXISTS channel         TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS store_note      TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_minutes    INT,
  ADD COLUMN IF NOT EXISTS zone_id         UUID REFERENCES store_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS property_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS printed_at      TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_channel_chk
    CHECK (channel IN ('app','qr','phone','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_property   ON orders(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);

-- ── Order status timeline ────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  actor      TEXT NOT NULL DEFAULT 'system',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at);

DO $$ BEGIN
  ALTER TABLE order_events ADD CONSTRAINT order_events_actor_chk
    CHECK (actor IN ('guest','customer','store','driver','admin','system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Dispatch log (email / whatsapp / sms) ────────────────────
CREATE TABLE IF NOT EXISTS order_dispatch_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,
  target      TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  provider    TEXT,
  error       TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_order ON order_dispatch_log(order_id, created_at DESC);

DO $$ BEGIN
  ALTER TABLE order_dispatch_log ADD CONSTRAINT dispatch_channel_chk
    CHECK (channel IN ('email','whatsapp','sms','push','print'));
  ALTER TABLE order_dispatch_log ADD CONSTRAINT dispatch_status_chk
    CHECK (status IN ('queued','sent','failed','manual','skipped'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Billing ledger: one row per charged/paid party per order ─
CREATE TABLE IF NOT EXISTS order_charges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  party_type   TEXT NOT NULL,                 -- store | property
  party_id     UUID NOT NULL,
  direction    TEXT NOT NULL DEFAULT 'charge',-- charge (we invoice them) | payout (we owe them)
  mode         TEXT NOT NULL,                 -- flat | commission
  rate         NUMERIC(10,2) NOT NULL DEFAULT 0,
  base_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  status       TEXT NOT NULL DEFAULT 'pending',
  settled_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_charges_order ON order_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_charges_party ON order_charges(party_type, party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charges_status ON order_charges(status);

DO $$ BEGIN
  ALTER TABLE order_charges ADD CONSTRAINT charges_party_chk
    CHECK (party_type IN ('store','property'));
  ALTER TABLE order_charges ADD CONSTRAINT charges_dir_chk
    CHECK (direction IN ('charge','payout'));
  ALTER TABLE order_charges ADD CONSTRAINT charges_mode_chk
    CHECK (mode IN ('flat','commission'));
  ALTER TABLE order_charges ADD CONSTRAINT charges_status_chk
    CHECK (status IN ('pending','invoiced','paid','void'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── store_users (idempotent — also created by migration 002) ─
CREATE TABLE IF NOT EXISTS store_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  fcm_token   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, user_id)
);

-- ── Human-readable order numbers ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq;
