create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint dm_threads_no_self check (user_a <> user_b)
);

create unique index if not exists dm_threads_pair_unique_idx on public.dm_threads (user_a, user_b);
create index if not exists dm_threads_user_a_idx on public.dm_threads (user_a, last_message_at desc, updated_at desc);
create index if not exists dm_threads_user_b_idx on public.dm_threads (user_b, last_message_at desc, updated_at desc);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm_messages_content_length check (char_length(content) between 1 and 1000)
);

create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at asc);
create index if not exists dm_messages_sender_idx on public.dm_messages (sender_user_id, created_at desc);

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists dm_threads_select_participant on public.dm_threads;
drop policy if exists dm_threads_insert_participant on public.dm_threads;
drop policy if exists dm_threads_update_participant on public.dm_threads;

create policy dm_threads_select_participant
on public.dm_threads
for select
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

create policy dm_threads_insert_participant
on public.dm_threads
for insert
to authenticated
with check (auth.uid() = user_a or auth.uid() = user_b);

create policy dm_threads_update_participant
on public.dm_threads
for update
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b)
with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists dm_messages_select_participant on public.dm_messages;
drop policy if exists dm_messages_insert_participant on public.dm_messages;

create policy dm_messages_select_participant
on public.dm_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.dm_threads t
    where t.id = dm_messages.thread_id
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
  )
);

create policy dm_messages_insert_participant
on public.dm_messages
for insert
to authenticated
with check (
  auth.uid() = sender_user_id
  and exists (
    select 1
    from public.dm_threads t
    where t.id = dm_messages.thread_id
      and (auth.uid() = t.user_a or auth.uid() = t.user_b)
  )
);

grant select, insert, update on public.dm_threads to authenticated;
grant select, insert on public.dm_messages to authenticated;
