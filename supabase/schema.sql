-- =====================================================================
-- Dawn Run 5K — database schema (single-user, no login)
-- One shared row holds the entire tracker state (workouts, food log,
-- sleep log, weight). No accounts: the public anon key may read/write.
--
-- Run this in: Supabase dashboard → SQL Editor → New query → Run.
--
-- NOTE: if you previously ran the older login-based schema, this file
-- drops that table first (there is no real data to lose yet).
-- =====================================================================

drop table if exists public.tracker_state cascade;

create table public.tracker_state (
  id         text primary key,          -- always 'singleton' for this app
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

-- Single-user app with no login: allow the public anon key full access.
drop policy if exists "anon full access" on public.tracker_state;
create policy "anon full access"
  on public.tracker_state for all
  to anon
  using (true)
  with check (true);
