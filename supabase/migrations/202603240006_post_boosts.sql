create table if not exists public.post_boosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  post_id uuid not null references public.generations(id) on delete cascade,
  boost_multiplier numeric not null default 1.5,
  boosted_at timestamptz not null default now(),
  active_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_boosts_post_idx
  on public.post_boosts (post_id, active_until desc);

create index if not exists post_boosts_active_idx
  on public.post_boosts (active_until desc, boosted_at desc);

alter table public.post_boosts enable row level security;

drop policy if exists post_boosts_select_all on public.post_boosts;
drop policy if exists post_boosts_insert_own on public.post_boosts;
drop policy if exists post_boosts_update_own on public.post_boosts;
drop policy if exists post_boosts_delete_own on public.post_boosts;

create policy post_boosts_select_all
on public.post_boosts
for select
to authenticated
using (true);

create policy post_boosts_insert_own
on public.post_boosts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy post_boosts_update_own
on public.post_boosts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy post_boosts_delete_own
on public.post_boosts
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.post_boosts to authenticated;

