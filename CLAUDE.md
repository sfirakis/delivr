# Delivr — SaaS Takeaway & Delivery Platform

## Project Overview
Multi-role delivery platform (Customer, Merchant, Driver, Admin) built with React 18 + TypeScript + Vite + Tailwind CSS + Supabase. Greek-language UI targeting the Greek market.

## Tech Stack
- **Frontend:** React 18, TypeScript 5.2, Vite 5
- **Styling:** Tailwind CSS 3.4 + custom design tokens (brand: #FF4500)
- **State:** Zustand (auth, cart) + TanStack Query 5 (server state)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Payments:** Stripe (Elements for new cards, server-side for saved cards)
- **Animations:** Framer Motion 11, Lucide React icons

## Architecture
```
src/
├── pages/           # Customer app screens (Splash, Auth, Home, Store, Cart, Checkout, Tracking, Orders, Profile, Favorites)
├── merchant/        # Merchant dashboard (POS, Menu CRUD, Analytics, Settings)
├── driver/          # Driver app (assignments, delivery tracking, earnings, history)
├── admin/           # Admin panel (KPIs, stores, orders, drivers, promos)
├── components/      # Shared UI (ui/, layout/, store/, notifications/)
├── hooks/           # useDelivr.ts (React Query), useStripe.ts (payments), useNotifications.ts
├── store/           # Zustand: authStore.ts, cartStore.ts
├── lib/             # supabase.ts client
├── types/           # index.ts (core types), supabase.ts (DB types)
└── styles/          # globals.css
```

## Key Patterns
- **Auth:** Supabase Auth (email + Google OAuth) via `useAuthStore` Zustand store
- **Data fetching:** React Query hooks in `useDelivr.ts` with query key factory `QK`
- **Cart:** Zustand with localStorage persistence (`delivr-cart`)
- **Realtime:** Supabase channels for order tracking & merchant POS & driver assignments
- **Payments:** Edge function `create-payment-intent` → Stripe Elements confirm → Edge function `confirm-order`
- **Merchant auth:** Store lookup by user email in `stores` table
- **Promo validation:** Server-side via `promo_codes` table through `useValidatePromo` hook

## Database Tables
profiles, stores, menu_categories, menu_items, item_modifier_groups, item_modifiers, orders, order_items, reviews, promo_codes, addresses, payment_methods, favorites, notifications, store_hours

## Edge Functions (Supabase)
- `create-payment-intent` — Stripe PaymentIntent creation
- `confirm-order` — Post-payment order confirmation + loyalty points
- `assign-driver` — Auto-assign nearest available driver (Haversine)
- `send-notification` — Multi-channel (email/SMS/push/in-app)
- `order-status-webhook` — Stripe webhook handler

## Environment Variables
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY,
VITE_GOOGLE_MAPS_KEY, VITE_VAPID_PUBLIC_KEY, VITE_APP_URL
```

## Commands
```bash
npm run dev          # Development server (port 5174)
npm run build        # TypeScript + Vite production build
npm run lint         # ESLint
npx vercel --prod    # Deploy to Vercel
```

## Test Promo Codes
- `WELCOME20` — 20% discount
- `DELIVR10` — 10% discount

## Design System
- **Fonts:** Syne (display), DM Sans (body), JetBrains Mono (code)
- **Colors:** Brand #FF4500, Success #2D9E6B, Warning #E8A020, Danger #DC2626
- **Pattern:** Mobile-first, bottom navigation, rounded-2xl cards, badge system

## Quality Notes (April 2025)
- Stripe Elements integrated (replaced test token)
- Address selection from user's saved addresses (replaced hardcoded)
- Promo codes validated server-side via Supabase
- Merchant app uses auth-based store lookup
- Driver app has real Supabase Realtime integration
- Admin panel fetches real data from DB + orders tab implemented
- No unit tests yet — consider adding Vitest
- No rate limiting on edge functions
- Consider adding DB indexes on foreign keys for performance
