alter table public.profiles
  add column if not exists credits integer not null default 0,
  add column if not exists weekly_usage integer not null default 0,
  add column if not exists weekly_limit integer not null default 0;

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

create or replace function public.consume_profile_generation_credit(p_user_id uuid)
returns table (
  consumed boolean,
  credits integer,
  weekly_usage integer,
  weekly_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_credits integer;
  current_weekly_usage integer;
  current_weekly_limit integer;
begin
  update public.profiles
    set credits = credits - 1,
        weekly_usage = weekly_usage + 1,
        updated_at = now()
  where user_id = p_user_id
    and credits > 0
    and (weekly_limit <= 0 or weekly_usage < weekly_limit)
  returning profiles.credits, profiles.weekly_usage, profiles.weekly_limit
    into current_credits, current_weekly_usage, current_weekly_limit;

  if found then
    return query select true, current_credits, current_weekly_usage, current_weekly_limit;
  else
    select p.credits, p.weekly_usage, p.weekly_limit
      into current_credits, current_weekly_usage, current_weekly_limit
    from public.profiles p
    where p.user_id = p_user_id;

    return query select false,
      coalesce(current_credits, 0),
      coalesce(current_weekly_usage, 0),
      coalesce(current_weekly_limit, 0);
  end if;
end;
$$;

grant execute on function public.consume_profile_generation_credit(uuid) to authenticated;
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
