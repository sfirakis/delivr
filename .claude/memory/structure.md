# Delivr — Structure

Verified from `package.json`, `vite.config.ts`, `.env.example`, `src/App.tsx`, `src/lib/supabase.ts`, and the `src/` + `supabase/` directories.

## Entry points
- `index.html` → `src/main.tsx` → `src/App.tsx` (Vite SPA).
- `src/App.tsx` — react-router routes; `AuthGuard` gates protected pages; mounts sub-apps `MerchantApp` (`/merchant/*`), `DriverApp` (`/driver/*`), `AdminApp` (`/admin/*`).

## Key folders (under `src/`)
- `pages/` — customer screens (Splash, Auth, Home, Store, Cart, Checkout, Tracking, Orders, Profile, Favorites).
- `components/` — `ui/`, `store/`, `layout/` (AppShell, BottomNav), `notifications/`.
- `merchant/` (with `pages/`), `driver/`, `admin/` — role-specific sub-apps.
- `hooks/` — React Query hooks (e.g. `useDelivr.ts`).
- `store/` — Zustand stores: `authStore.ts`, `cartStore.ts`.
- `lib/` — `supabase.ts` (Supabase client + helpers).
- `types/` — TypeScript types (incl. `supabase` Database type).
- `styles/` — `globals.css` (Tailwind + custom).

## Env / config
- Templated in `.env.example`; copy to `.env.local` for local dev. Vite vars are `VITE_`-prefixed.
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Optional: `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_MAPS_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_APP_URL`.
- Edge Function secrets (set in Supabase dashboard, not the client): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Twilio, `RESEND_API_KEY`, `FCM_SERVER_KEY`.
- Build config: `vite.config.ts` (`@` alias → `./src`), `tailwind.config.ts`, `tsconfig.json`.

## How it connects to Supabase
- Supabase is **cloud-hosted Postgres** — no local DB needed; works from any machine with the keys.
- `src/lib/supabase.ts` creates the typed client from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (throws if missing), with `autoRefreshToken`, `persistSession`, `detectSessionInUrl`, and Realtime enabled. Exports a `getPublicUrl` storage helper.
- Schema: `supabase-schema.sql` (root) + `supabase/migrations/002_driver_sessions_notifications.sql`.
- Edge Functions in `supabase/functions/`: `create-payment-intent`, `confirm-order`, `send-notification`, `order-status-webhook`, `assign-driver`. Local Supabase config in `supabase/config.toml`.
