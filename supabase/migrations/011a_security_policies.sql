-- ============================================================
-- Delivr Platform — Migration 011a (applied live 2026-09-12)
-- Closes the privilege-escalation and direct-write holes found
-- by the QA pass. Recorded here after the fact: it was applied
-- straight to the live project and the repo never got a copy.
-- ============================================================

-- A user may read and edit their own profile, but not hand
-- themselves a role: role and loyalty_points move only from the
-- service role.
drop policy if exists "profiles_own" on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- Orders and their lines are SELECT-only for clients. The only
-- writer is delivr_place_order(), which prices everything itself.
drop policy if exists "orders_own" on public.orders;
drop policy if exists "order_items_own" on public.order_items;
create policy orders_select_own on public.orders for select using (auth.uid() = user_id);
create policy order_items_select_own on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);
revoke insert, update, delete on public.orders from authenticated, anon;
revoke insert, update, delete on public.order_items from authenticated, anon;
