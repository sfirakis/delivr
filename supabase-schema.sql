-- ============================================================
-- DELIVR — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- for geolocation queries

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE store_category AS ENUM (
  'restaurant', 'cafe', 'burger', 'pizza', 'sushi',
  'healthy', 'supermarket', 'pharmacy', 'other'
);

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready',
  'picked_up', 'on_the_way', 'delivered', 'cancelled'
);

CREATE TYPE delivery_type AS ENUM ('delivery', 'pickup');

CREATE TYPE payment_method AS ENUM (
  'card', 'cash', 'apple_pay', 'google_pay', 'wallet'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'refunded', 'failed'
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  avatar_url    TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Σπίτι',  -- Σπίτι, Εργασία, Άλλο
  street      TEXT NOT NULL,
  city        TEXT NOT NULL DEFAULT 'Αθήνα',
  postal_code TEXT,
  floor       TEXT,
  doorbell    TEXT,
  notes       TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one default address per user
CREATE UNIQUE INDEX one_default_address
  ON addresses (user_id) WHERE is_default = true;

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  category      store_category NOT NULL,
  cuisine_tags  TEXT[] DEFAULT '{}',
  logo_url      TEXT,
  cover_url     TEXT,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL DEFAULT 'Αθήνα',
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  phone         TEXT,
  email         TEXT,
  -- Delivery settings
  delivery_fee        NUMERIC(6,2) NOT NULL DEFAULT 1.50,
  free_delivery_above NUMERIC(8,2),
  min_order_amount    NUMERIC(8,2) NOT NULL DEFAULT 5.00,
  avg_delivery_time   INT NOT NULL DEFAULT 30,  -- minutes
  delivery_radius_km  NUMERIC(4,1) NOT NULL DEFAULT 5.0,
  -- Status
  is_open       BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_promoted   BOOLEAN NOT NULL DEFAULT false,
  discount_pct  NUMERIC(4,1),   -- e.g. 20.0 for 20%
  -- Ratings (denormalized for performance)
  rating        NUMERIC(2,1) NOT NULL DEFAULT 0,
  review_count  INT NOT NULL DEFAULT 0,
  -- Metadata
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stores_category_idx ON stores(category);
CREATE INDEX stores_location_idx ON stores(lat, lng);
CREATE INDEX stores_active_idx   ON stores(is_active, is_open);

-- ============================================================
-- STORE HOURS
-- ============================================================
CREATE TABLE store_hours (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  open_time  TIME,
  close_time TIME,
  is_closed  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (store_id, day_of_week)
);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
CREATE TABLE menu_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX menu_categories_store_idx ON menu_categories(store_id, sort_order);

-- ============================================================
-- MENU ITEMS
-- ============================================================
CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(8,2) NOT NULL,
  image_url     TEXT,
  emoji         TEXT,
  -- Flags
  is_available  BOOLEAN NOT NULL DEFAULT true,
  is_popular    BOOLEAN NOT NULL DEFAULT false,
  is_new        BOOLEAN NOT NULL DEFAULT false,
  is_vegan      BOOLEAN NOT NULL DEFAULT false,
  is_vegetarian BOOLEAN NOT NULL DEFAULT false,
  is_gluten_free BOOLEAN NOT NULL DEFAULT false,
  -- For supermarket (weight-based)
  is_weight_based BOOLEAN NOT NULL DEFAULT false,
  unit          TEXT DEFAULT 'τεμ.',   -- τεμ., kg, gr, L
  -- Nutrition & allergens
  allergens     TEXT[] DEFAULT '{}',
  calories      INT,
  -- Sort
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX menu_items_store_idx    ON menu_items(store_id, is_available);
CREATE INDEX menu_items_category_idx ON menu_items(category_id);

-- ============================================================
-- ITEM MODIFIERS (extras, options)
-- ============================================================
CREATE TABLE item_modifier_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- π.χ. "Μέγεθος", "Extras"
  is_required BOOLEAN NOT NULL DEFAULT false,
  min_select  INT NOT NULL DEFAULT 0,
  max_select  INT NOT NULL DEFAULT 1,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE item_modifiers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES item_modifier_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  store_id         UUID NOT NULL REFERENCES stores(id),
  -- Delivery info
  delivery_type    delivery_type NOT NULL DEFAULT 'delivery',
  delivery_address JSONB,   -- snapshot of address at order time
  delivery_notes   TEXT,
  -- Status & timing
  status           order_status NOT NULL DEFAULT 'pending',
  estimated_ready_at    TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  confirmed_at     TIMESTAMPTZ,
  prepared_at      TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT,
  -- Financials
  subtotal         NUMERIC(10,2) NOT NULL,
  delivery_fee     NUMERIC(6,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(8,2) NOT NULL DEFAULT 0,
  tip_amount       NUMERIC(6,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL,
  -- Payment
  payment_method   payment_method NOT NULL DEFAULT 'card',
  payment_status   payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  -- Promo
  promo_code       TEXT,
  -- Driver (denormalized for speed)
  driver_id        UUID REFERENCES profiles(id),
  driver_location  JSONB,   -- {lat, lng, updated_at}
  -- Loyalty
  points_earned    INT NOT NULL DEFAULT 0,
  points_used      INT NOT NULL DEFAULT 0,
  -- Notes
  customer_notes   TEXT,
  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_user_idx   ON orders(user_id, created_at DESC);
CREATE INDEX orders_store_idx  ON orders(store_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(status, created_at DESC);
CREATE INDEX orders_driver_idx ON orders(driver_id) WHERE driver_id IS NOT NULL;

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id),
  -- Snapshot at time of order
  name            TEXT NOT NULL,
  price           NUMERIC(8,2) NOT NULL,
  quantity        INT NOT NULL DEFAULT 1,
  modifiers       JSONB DEFAULT '[]',  -- [{name, price}]
  notes           TEXT,
  subtotal        NUMERIC(10,2) NOT NULL
);

CREATE INDEX order_items_order_idx ON order_items(order_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  store_id    UUID NOT NULL REFERENCES stores(id),
  driver_id   UUID REFERENCES profiles(id),
  food_rating    INT CHECK (food_rating BETWEEN 1 AND 5),
  delivery_rating INT CHECK (delivery_rating BETWEEN 1 AND 5),
  comment     TEXT,
  photos      TEXT[] DEFAULT '{}',
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update store rating on review insert/update
CREATE OR REPLACE FUNCTION update_store_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stores SET
    rating = (
      SELECT ROUND(AVG(food_rating)::NUMERIC, 1)
      FROM reviews WHERE store_id = NEW.store_id AND is_visible = true
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews WHERE store_id = NEW.store_id AND is_visible = true
    )
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_store_rating();

-- ============================================================
-- PROMO CODES
-- ============================================================
CREATE TABLE promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  description     TEXT,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  NUMERIC(8,2) NOT NULL,
  min_order       NUMERIC(8,2) DEFAULT 0,
  max_discount    NUMERIC(8,2),
  max_uses        INT,
  used_count      INT NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  store_id        UUID REFERENCES stores(id),  -- NULL = platform-wide
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track per-user promo usage
CREATE TABLE promo_uses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_id    UUID NOT NULL REFERENCES promo_codes(id),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  order_id    UUID REFERENCES orders(id),
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_id, user_id)  -- one use per user (remove for multi-use promos)
);

-- ============================================================
-- PAYMENT METHODS (saved cards)
-- ============================================================
CREATE TABLE payment_methods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_pm_id    TEXT NOT NULL UNIQUE,
  brand           TEXT NOT NULL,   -- visa, mastercard
  last4           TEXT NOT NULL,
  exp_month       INT NOT NULL,
  exp_year        INT NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FAVORITES
-- ============================================================
CREATE TABLE favorites (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, store_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,  -- order_update, promo, loyalty, system
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit only their own
CREATE POLICY "profiles_own" ON profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Addresses: own only
CREATE POLICY "addresses_own" ON addresses
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stores: everyone can read active stores
CREATE POLICY "stores_public_read" ON stores
  FOR SELECT USING (is_active = true);

-- Menu items: public read
CREATE POLICY "menu_items_public_read" ON menu_items
  FOR SELECT USING (true);

CREATE POLICY "menu_categories_public_read" ON menu_categories
  FOR SELECT USING (true);

CREATE POLICY "modifiers_public_read" ON item_modifier_groups
  FOR SELECT USING (true);

CREATE POLICY "modifiers_options_public_read" ON item_modifiers
  FOR SELECT USING (true);

-- Orders: own only
CREATE POLICY "orders_own" ON orders
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "order_items_own" ON order_items
  USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()));

-- Reviews: public read, own write
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "reviews_own_write"   ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payment methods: own only
CREATE POLICY "payment_methods_own" ON payment_methods
  USING (auth.uid() = user_id);

-- Favorites: own only
CREATE POLICY "favorites_own" ON favorites
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications
  USING (auth.uid() = user_id);

-- Promo codes: public read for active ones
CREATE POLICY "promo_codes_read" ON promo_codes
  FOR SELECT USING (is_active = true);

-- ============================================================
-- REALTIME (enable for live order tracking)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- SEED DATA — Sample stores
-- ============================================================
INSERT INTO stores (name, slug, category, cuisine_tags, address, city, lat, lng,
  delivery_fee, min_order_amount, avg_delivery_time, is_open, is_promoted, rating, review_count, emoji)
VALUES
  ('Avra Souvlaki',        'avra-souvlaki',    'restaurant', ARRAY['Ελληνική','Street Food'], 'Ερμού 45',            'Αθήνα', 37.9755, 23.7348, 1.50, 5,  25, true, true,  4.8, 342),
  ('Brew & Co',            'brew-and-co',      'cafe',       ARRAY['Καφές','Γλυκά'],           'Σταδίου 12',          'Αθήνα', 37.9771, 23.7331, 0.00, 3,  20, true, false, 4.6, 218),
  ('Burger House',         'burger-house',     'burger',     ARRAY['American','Burgers'],      'Πανεπιστημίου 22',    'Αθήνα', 37.9801, 23.7326, 2.00, 8,  35, true, false, 4.5, 567),
  ('Tokyo Ramen & Sushi',  'tokyo-ramen',      'sushi',      ARRAY['Ιαπωνική','Ramen'],        'Βουλής 8',            'Αθήνα', 37.9745, 23.7358, 2.50, 12, 40, true, true,  4.9, 189),
  ('Green & Fresh',        'green-fresh',      'healthy',    ARRAY['Vegan','Organic','Bowls'], 'Σκουφά 34',           'Αθήνα', 37.9782, 23.7371, 1.00, 7,  25, true, false, 4.7, 134),
  ('AB Βασιλόπουλος',      'ab-vasilopoulos',  'supermarket',ARRAY['Grocery','Είδη σπιτιού'], 'Λ. Αλεξάνδρας 78',   'Αθήνα', 37.9812, 23.7403, 2.00, 15, 55, true, false, 4.4, 890)
ON CONFLICT (slug) DO NOTHING;
