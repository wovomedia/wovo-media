alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_item_id text,
  add column if not exists plan text default 'starter',
  add column if not exists monthly_limit integer not null default 25,
  add column if not exists monthly_used integer not null default 0,
  add column if not exists extra_credits integer not null default 0;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_id_created_at_idx on public.chats(user_id, created_at desc);
create index if not exists messages_chat_id_created_at_idx on public.messages(chat_id, created_at asc);

alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "chats_select_own" on public.chats;
drop policy if exists "chats_insert_own" on public.chats;
drop policy if exists "chats_update_own" on public.chats;
drop policy if exists "chats_delete_own" on public.chats;

create policy "chats_select_own" on public.chats
for select to authenticated
using (auth.uid() = user_id);

create policy "chats_insert_own" on public.chats
for insert to authenticated
with check (auth.uid() = user_id);

create policy "chats_update_own" on public.chats
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chats_delete_own" on public.chats
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_update_own" on public.messages;
drop policy if exists "messages_delete_own" on public.messages;

create policy "messages_select_own" on public.messages
for select to authenticated
using (auth.uid() = user_id);

create policy "messages_insert_own" on public.messages
for insert to authenticated
with check (auth.uid() = user_id);

create policy "messages_update_own" on public.messages
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "messages_delete_own" on public.messages
for delete to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
