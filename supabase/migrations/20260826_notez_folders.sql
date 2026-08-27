-- NoteZ Folders & Trash Cloud Storage
-- Stores each user's entire folder tree as a single JSON blob per user.
-- This mirrors the exact shape already used in localStorage, so no data
-- transformation is needed between the client and the database.

-- ── notez_folders ────────────────────────────────────────────────────
create table if not exists public.notez_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notez_folders_user_id_unique unique (user_id)
);

-- Row Level Security: users can only read/write their own row
alter table public.notez_folders enable row level security;

create policy "Users can select their own folders"
  on public.notez_folders for select
  using (auth.uid() = user_id);

create policy "Users can insert their own folders"
  on public.notez_folders for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own folders"
  on public.notez_folders for update
  using (auth.uid() = user_id);

create policy "Users can delete their own folders"
  on public.notez_folders for delete
  using (auth.uid() = user_id);

-- ── notez_trash ──────────────────────────────────────────────────────
create table if not exists public.notez_trash (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notez_trash_user_id_unique unique (user_id)
);

alter table public.notez_trash enable row level security;

create policy "Users can select their own trash"
  on public.notez_trash for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trash"
  on public.notez_trash for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trash"
  on public.notez_trash for update
  using (auth.uid() = user_id);

create policy "Users can delete their own trash"
  on public.notez_trash for delete
  using (auth.uid() = user_id);

-- ── updated_at auto-touch trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notez_folders_set_updated_at
  before update on public.notez_folders
  for each row execute function public.set_updated_at();

create trigger notez_trash_set_updated_at
  before update on public.notez_trash
  for each row execute function public.set_updated_at();
