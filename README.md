# 🛵 Delivr — SaaS Takeaway & Delivery App

**Customer App** | React + TypeScript + Vite + Tailwind CSS + Supabase

---

## 🚀 Quick Start (5 λεπτά)

### 1. Κλωνοποίηση & εγκατάσταση
```bash
git clone <your-repo>
cd delivr-app
npm install
```

### 2. Supabase setup
1. Πήγαινε στο [supabase.com](https://supabase.com) → **New Project**
2. Αντίγραψε το `supabase-schema.sql` και τρέξε το στο **SQL Editor**
3. Αντίγραψε το **Project URL** και το **anon key** από **Settings → API**

### 3. Environment variables
```bash
cp .env.example .env.local
# Άνοιξε .env.local και συμπλήρωσε τα keys
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4. Εκκίνηση
```bash
npm run dev
# → http://localhost:5173
```

---

## 📁 Δομή project

```
delivr/
├── src/
│   ├── components/
│   │   ├── ui/          # Reusable UI (Button, Skeleton, Toggle, κλπ)
│   │   ├── store/       # StoreCard, MenuItemCard
│   │   └── layout/      # AppShell, BottomNav
│   ├── pages/           # Screens (Home, Store, Cart, Checkout, Tracking, Orders, Profile)
│   ├── hooks/           # React Query hooks (useDelivr.ts)
│   ├── store/           # Zustand (cartStore, authStore)
│   ├── lib/             # Supabase client
│   ├── types/           # TypeScript types
│   └── styles/          # globals.css (Tailwind + custom)
├── supabase-schema.sql  # Full DB schema — τρέξε αυτό πρώτα
└── .env.example
```

---

## 🔧 Tech Stack

| Layer         | Technology                    |
|--------------|-------------------------------|
| Frontend     | React 18 + TypeScript + Vite  |
| Styling      | Tailwind CSS 3 (custom tokens) |
| State        | Zustand (cart, auth)          |
| Server state | TanStack Query v5              |
| Backend      | Supabase (PostgreSQL)         |
| Auth         | Supabase Auth (email + Google)|
| Realtime     | Supabase Realtime             |
| Payments     | Stripe (ready, needs key)     |

---

## 📱 Pages / Screens

| Route              | Screen           | Auth |
|--------------------|-----------------|------|
| `/`                | Splash           | –    |
| `/auth`            | Login / Register | –    |
| `/home`            | Home + Search    | ✓    |
| `/store/:id`       | Store + Menu     | ✓    |
| `/cart`            | Καλάθι          | ✓    |
| `/checkout`        | Πληρωμή         | ✓    |
| `/track/:orderId`  | Live Tracking    | ✓    |
| `/orders`          | Ιστορικό        | ✓    |
| `/profile`         | Προφίλ          | ✓    |
| `/favorites`       | Αγαπημένα       | ✓    |

---

## 🗄️ Database Tables

- `profiles` — Users (extends Supabase auth)
- `stores` — Καταστήματα (εστιατόρια, καφέ, supermarket)
- `menu_categories` + `menu_items` — Μενού
- `item_modifier_groups` + `item_modifiers` — Extras/options
- `orders` + `order_items` — Παραγγελίες
- `reviews` — Αξιολογήσεις
- `promo_codes` + `promo_uses` — Κουπόνια
- `addresses` — Αποθηκευμένες διευθύνσεις
- `payment_methods` — Αποθηκευμένες κάρτες (Stripe)
- `favorites` — Αγαπημένα καταστήματα
- `notifications` — Push notifications

---

## 🧪 Test promo codes
- `WELCOME20` → -20% στο σύνολο
- `DELIVR10`  → -10% στο σύνολο

---

## 📋 Next steps

### Module 2 — Merchant Dashboard
- POS για αποδοχή παραγγελιών
- Διαχείριση μενού (CRUD)
- Analytics & reports

### Module 3 — Driver App
- Route optimization
- Proof of delivery
- Earnings dashboard

### Module 4 — Admin Panel
- Multi-tenant management
- Commission settings
- Platform analytics

---

## 🚢 Deploy

```bash
# Build
npm run build

# Deploy στο Vercel (recommended)
npx vercel --prod
```

Πρόσθεσε τα env vars στο Vercel dashboard πριν το deploy.

---

Φτιαγμένο με ❤️ για το Delivr SaaS Platform
