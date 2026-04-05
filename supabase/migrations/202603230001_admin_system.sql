create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.roles (name)
values ('admin'), ('user')
on conflict (name) do nothing;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user',
  name text,
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists email text,
  add column if not exists role text not null default 'user',
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists users_email_unique_idx on public.users (lower(email));
create index if not exists users_role_idx on public.users (role);

insert into public.users (id, email, role, name, created_at)
select
  au.id,
  coalesce(au.email, ''),
  case when lower(coalesce(au.email, '')) = 'payton@wovomedia.com' then 'admin' else 'user' end,
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', null),
  coalesce(au.created_at, now())
from auth.users au
on conflict (id) do update
set
  email = excluded.email,
  name = coalesce(excluded.name, public.users.name),
  role = case
    when lower(excluded.email) = 'payton@wovomedia.com' then 'admin'
    else coalesce(public.users.role, excluded.role, 'user')
  end;

update public.users
set role = 'admin'
where lower(email) = 'payton@wovomedia.com';

create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists credits_user_id_idx on public.credits (user_id);

insert into public.credits (user_id, balance, updated_at)
select
  p.user_id,
  greatest(coalesce(p.extra_credits, 0), 0),
  now()
from public.profiles p
on conflict (user_id) do update
set
  balance = greatest(excluded.balance, 0),
  updated_at = now();

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10, 2) not null default 0,
  features_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans (name, price, features_json)
values
  ('Starter', 49, '["AI caption and hook generator", "Idea calendar", "Basic ad visuals"]'::jsonb),
  ('Pro', 229, '["AI spokesperson workflows", "Campaign optimization", "Priority support"]'::jsonb),
  ('Wovo Media Agency', 600, '["Weekly production", "Posting + optimization", "Monthly reporting"]'::jsonb)
on conflict (name) do update
set
  price = excluded.price,
  features_json = excluded.features_json;

alter table public.subscriptions
  add column if not exists id uuid,
  add column if not exists plan_id uuid references public.plans(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

update public.subscriptions
set id = coalesce(id, gen_random_uuid())
where id is null;

alter table public.subscriptions
  alter column id set default gen_random_uuid();

create unique index if not exists subscriptions_id_unique_idx on public.subscriptions (id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_user_idx on public.admin_actions (target_user_id);

create or replace function public.is_admin_user(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.users u
      where u.id = p_user_id
        and lower(coalesce(u.role, 'user')) = 'admin'
    )
    or exists (
      select 1
      from auth.users au
      where au.id = p_user_id
        and lower(coalesce(au.email, '')) = 'payton@wovomedia.com'
    );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated, service_role;

create or replace function public.sync_public_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role text;
begin
  resolved_role := case
    when lower(coalesce(new.email, '')) = 'payton@wovomedia.com' then 'admin'
    else 'user'
  end;

  insert into public.users (id, email, role, name, created_at)
  values (
    new.id,
    coalesce(new.email, ''),
    resolved_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', null),
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, public.users.name),
    role = case
      when lower(excluded.email) = 'payton@wovomedia.com' then 'admin'
      else coalesce(public.users.role, excluded.role, 'user')
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_sync_public_user on auth.users;
create trigger on_auth_user_sync_public_user
after insert or update on auth.users
for each row execute function public.sync_public_user_from_auth();

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.credits enable row level security;
alter table public.plans enable row level security;
alter table public.admin_actions enable row level security;

drop policy if exists users_select_own_or_admin on public.users;
drop policy if exists users_insert_admin_only on public.users;
drop policy if exists users_update_own_or_admin on public.users;

create policy users_select_own_or_admin on public.users
for select to authenticated
using (auth.uid() = id or public.is_admin_user(auth.uid()));

create policy users_insert_admin_only on public.users
for insert to authenticated
with check (public.is_admin_user(auth.uid()));

create policy users_update_own_or_admin on public.users
for update to authenticated
using (auth.uid() = id or public.is_admin_user(auth.uid()))
with check (auth.uid() = id or public.is_admin_user(auth.uid()));

drop policy if exists roles_select_authenticated on public.roles;
drop policy if exists roles_manage_admin on public.roles;

create policy roles_select_authenticated on public.roles
for select to authenticated
using (true);

create policy roles_manage_admin on public.roles
for all to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists credits_select_own_or_admin on public.credits;
drop policy if exists credits_insert_admin_only on public.credits;
drop policy if exists credits_update_admin_only on public.credits;
drop policy if exists credits_delete_admin_only on public.credits;

create policy credits_select_own_or_admin on public.credits
for select to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

create policy credits_insert_admin_only on public.credits
for insert to authenticated
with check (public.is_admin_user(auth.uid()));

create policy credits_update_admin_only on public.credits
for update to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create policy credits_delete_admin_only on public.credits
for delete to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists plans_select_all on public.plans;
drop policy if exists plans_manage_admin on public.plans;

create policy plans_select_all on public.plans
for select to authenticated
using (true);

create policy plans_manage_admin on public.plans
for all to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists subscriptions_admin_select on public.subscriptions;
drop policy if exists subscriptions_admin_insert on public.subscriptions;
drop policy if exists subscriptions_admin_update on public.subscriptions;

create policy subscriptions_admin_select on public.subscriptions
for select to authenticated
using (public.is_admin_user(auth.uid()));

create policy subscriptions_admin_insert on public.subscriptions
for insert to authenticated
with check (public.is_admin_user(auth.uid()));

create policy subscriptions_admin_update on public.subscriptions
for update to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists admin_actions_select_admin on public.admin_actions;
drop policy if exists admin_actions_insert_admin on public.admin_actions;

create policy admin_actions_select_admin on public.admin_actions
for select to authenticated
using (public.is_admin_user(auth.uid()));

create policy admin_actions_insert_admin on public.admin_actions
for insert to authenticated
with check (public.is_admin_user(auth.uid()));

grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.credits to authenticated;
grant select, insert, update on public.plans to authenticated;
grant select, insert on public.admin_actions to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
