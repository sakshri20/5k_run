-- =====================================================================
-- Dawn Run 5K — database schema
-- One JSONB row per user holds the entire tracker state (workouts,
-- food log, sleep log, weight). Row Level Security ensures each user
-- can only read and write their own row.
--
-- Run this in: Supabase dashboard → SQL Editor → New query → Run.
-- Re-running is safe (idempotent).
-- =====================================================================

create table if not exists public.tracker_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

-- Policies (drop-then-create so this file can be re-run cleanly)
drop policy if exists "own row - select" on public.tracker_state;
drop policy if exists "own row - insert" on public.tracker_state;
drop policy if exists "own row - update" on public.tracker_state;

create policy "own row - select"
  on public.tracker_state for select
  using (auth.uid() = user_id);

create policy "own row - insert"
  on public.tracker_state for insert
  with check (auth.uid() = user_id);

create policy "own row - update"
  on public.tracker_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
