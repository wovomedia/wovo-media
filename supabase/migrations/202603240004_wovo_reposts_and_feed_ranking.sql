create table if not exists public.post_reposts (
  post_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reposts_post_idx on public.post_reposts (post_id, created_at desc);
create index if not exists post_reposts_user_idx on public.post_reposts (user_id, created_at desc);

alter table public.post_reposts enable row level security;

drop policy if exists post_reposts_select_all on public.post_reposts;
drop policy if exists post_reposts_insert_own on public.post_reposts;
drop policy if exists post_reposts_delete_own on public.post_reposts;

create policy post_reposts_select_all
on public.post_reposts
for select
to authenticated
using (true);

create policy post_reposts_insert_own
on public.post_reposts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy post_reposts_delete_own
on public.post_reposts
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.post_reposts to authenticated;
