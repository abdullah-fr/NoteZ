create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  mode text not null default 'tutor',
  source_id uuid references public.sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chat_conversations enable row level security;
create policy "conv_select" on public.chat_conversations for select using (auth.uid() = user_id);
create policy "conv_insert" on public.chat_conversations for insert with check (auth.uid() = user_id);
create policy "conv_update" on public.chat_conversations for update using (auth.uid() = user_id);
create policy "conv_delete" on public.chat_conversations for delete using (auth.uid() = user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "msg_select" on public.chat_messages for select using (auth.uid() = user_id);
create policy "msg_insert" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "msg_delete" on public.chat_messages for delete using (auth.uid() = user_id);

create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id, created_at);
create index if not exists chat_conversations_user_idx on public.chat_conversations(user_id, updated_at desc);

create trigger update_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.update_updated_at_column();