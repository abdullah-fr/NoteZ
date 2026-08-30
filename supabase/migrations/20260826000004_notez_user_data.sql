-- NoteZ User Data Cloud Storage
-- All tables follow the same pattern as notez_folders:
-- one row per user, data stored as a JSON blob, RLS-protected.

-- ── notez_user_credits ───────────────────────────────────────────────
-- Stores the full UserCreditsSummary object per user.
create table if not exists public.notez_user_credits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notez_user_credits_user_id_unique unique (user_id)
);

alter table public.notez_user_credits enable row level security;

create policy "Users can select their own credits"
  on public.notez_user_credits for select using (auth.uid() = user_id);
create policy "Users can insert their own credits"
  on public.notez_user_credits for insert with check (auth.uid() = user_id);
create policy "Users can update their own credits"
  on public.notez_user_credits for update using (auth.uid() = user_id);
create policy "Users can delete their own credits"
  on public.notez_user_credits for delete using (auth.uid() = user_id);

-- ── notez_timer_data ─────────────────────────────────────────────────
-- Stores focus sessions array + custom routines array + daily goal object.
-- Shape: { sessions: FocusSession[], routines: Routine[], dailyGoal: DailyGoalSettings }
create table if not exists public.notez_timer_data (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notez_timer_data_user_id_unique unique (user_id)
);

alter table public.notez_timer_data enable row level security;

create policy "Users can select their own timer data"
  on public.notez_timer_data for select using (auth.uid() = user_id);
create policy "Users can insert their own timer data"
  on public.notez_timer_data for insert with check (auth.uid() = user_id);
create policy "Users can update their own timer data"
  on public.notez_timer_data for update using (auth.uid() = user_id);
create policy "Users can delete their own timer data"
  on public.notez_timer_data for delete using (auth.uid() = user_id);

-- ── notez_calendar_events ────────────────────────────────────────────
-- Stores the full CalendarEvent[] array per user.
create table if not exists public.notez_calendar_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notez_calendar_events_user_id_unique unique (user_id)
);

alter table public.notez_calendar_events enable row level security;

create policy "Users can select their own calendar events"
  on public.notez_calendar_events for select using (auth.uid() = user_id);
create policy "Users can insert their own calendar events"
  on public.notez_calendar_events for insert with check (auth.uid() = user_id);
create policy "Users can update their own calendar events"
  on public.notez_calendar_events for update using (auth.uid() = user_id);
create policy "Users can delete their own calendar events"
  on public.notez_calendar_events for delete using (auth.uid() = user_id);

-- ── updated_at auto-touch triggers ───────────────────────────────────
-- Reuse the function created in the folders migration if it exists.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notez_user_credits_set_updated_at
  before update on public.notez_user_credits
  for each row execute function public.set_updated_at();

create trigger notez_timer_data_set_updated_at
  before update on public.notez_timer_data
  for each row execute function public.set_updated_at();

create trigger notez_calendar_events_set_updated_at
  before update on public.notez_calendar_events
  for each row execute function public.set_updated_at();
