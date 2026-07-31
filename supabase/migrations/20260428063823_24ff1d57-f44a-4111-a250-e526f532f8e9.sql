-- Roles enum
do $$ begin
  create type public.workspace_role as enum ('owner','admin','editor','viewer');
exception when duplicate_object then null; end $$;

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role public.workspace_role not null default 'viewer',
  invited_email text,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;

-- Security definer helpers (avoid recursive RLS)
create or replace function public.is_workspace_member(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = _workspace and user_id = _user)
$$;

create or replace function public.workspace_role_of(_workspace uuid, _user uuid)
returns public.workspace_role language sql stable security definer set search_path = public as $$
  select role from public.workspace_members where workspace_id = _workspace and user_id = _user
$$;

create or replace function public.can_edit_workspace(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.workspace_role_of(_workspace, _user) in ('owner','admin','editor')
$$;

create or replace function public.can_admin_workspace(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.workspace_role_of(_workspace, _user) in ('owner','admin')
$$;

-- Workspaces policies
create policy "ws_select_member" on public.workspaces for select
  using (public.is_workspace_member(id, auth.uid()) or created_by = auth.uid());
create policy "ws_insert_self" on public.workspaces for insert
  with check (created_by = auth.uid());
create policy "ws_update_admin" on public.workspaces for update
  using (public.can_admin_workspace(id, auth.uid()));
create policy "ws_delete_owner" on public.workspaces for delete
  using (public.workspace_role_of(id, auth.uid()) = 'owner');

-- Members policies
create policy "wm_select_member" on public.workspace_members for select
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "wm_insert_admin_or_self_owner" on public.workspace_members for insert
  with check (
    public.can_admin_workspace(workspace_id, auth.uid())
    or (user_id = auth.uid() and exists (select 1 from public.workspaces w where w.id = workspace_id and w.created_by = auth.uid()))
  );
create policy "wm_update_admin" on public.workspace_members for update
  using (public.can_admin_workspace(workspace_id, auth.uid()));
create policy "wm_delete_admin_or_self" on public.workspace_members for delete
  using (public.can_admin_workspace(workspace_id, auth.uid()) or user_id = auth.uid());

-- Auto-add creator as owner
create or replace function public.add_workspace_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_add_workspace_owner on public.workspaces;
create trigger trg_add_workspace_owner
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

-- Add workspace_id + shared to existing tables
alter table public.notes add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.sources add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.chat_conversations add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- Update RLS to allow workspace member access (additive)
create policy "notes_select_workspace" on public.notes for select
  using (workspace_id is not null and public.is_workspace_member(workspace_id, auth.uid()));
create policy "notes_update_workspace" on public.notes for update
  using (workspace_id is not null and public.can_edit_workspace(workspace_id, auth.uid()));

create policy "sources_select_workspace" on public.sources for select
  using (workspace_id is not null and public.is_workspace_member(workspace_id, auth.uid()));
create policy "sources_update_workspace" on public.sources for update
  using (workspace_id is not null and public.can_edit_workspace(workspace_id, auth.uid()));

create policy "chat_select_workspace" on public.chat_conversations for select
  using (workspace_id is not null and public.is_workspace_member(workspace_id, auth.uid()));
create policy "chat_msg_select_workspace" on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.workspace_id is not null
        and public.is_workspace_member(c.workspace_id, auth.uid())
    )
  );

-- Invite by email helper: pending invites resolved when user signs up / signs in
create or replace function public.resolve_workspace_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_members
    set user_id = new.id, invited_email = null
    where invited_email = new.email and user_id = '00000000-0000-0000-0000-000000000000';
  return new;
end $$;

drop trigger if exists trg_resolve_invites on auth.users;
create trigger trg_resolve_invites
  after insert on auth.users
  for each row execute function public.resolve_workspace_invites();