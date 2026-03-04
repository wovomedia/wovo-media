create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  business_name text,
  business_type text,
  location text,
  contact text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
  add column if not exists user_id uuid,
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists business_name text,
  add column if not exists business_type text,
  add column if not exists location text,
  add column if not exists contact text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profiles
  drop constraint if exists profiles_pkey;

update public.profiles
set user_id = coalesce(user_id, id)
where user_id is null;

alter table public.profiles
  alter column user_id set not null;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    alter table public.profiles drop column id;
  end if;
end $$;

alter table public.profiles
  add primary key (user_id);

alter table public.profiles
  add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text,
  plan_key text,
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.usage_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits_used_month int default 0,
  credits_limit_month int default 0,
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_credits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "usage_credits_select_own" on public.usage_credits;
create policy "usage_credits_select_own" on public.usage_credits
for select to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  insert into public.subscriptions (user_id, status, updated_at)
  values (new.id, 'incomplete', now())
  on conflict (user_id) do nothing;

  insert into public.usage_credits (user_id, credits_used_month, credits_limit_month, updated_at)
  values (new.id, 0, 0, now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.consume_generation_credit(p_user_id uuid)
returns table (consumed boolean, credits_used_month int, credits_limit_month int)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.usage_credits;
begin
  update public.usage_credits
  set credits_used_month = credits_used_month + 1,
      updated_at = now()
  where user_id = p_user_id
    and credits_used_month < credits_limit_month
  returning * into updated_row;

  if found then
    return query select true, updated_row.credits_used_month, updated_row.credits_limit_month;
  else
    return query
      select false,
             coalesce((select uc.credits_used_month from public.usage_credits uc where uc.user_id = p_user_id), 0),
             coalesce((select uc.credits_limit_month from public.usage_credits uc where uc.user_id = p_user_id), 0);
  end if;
end;
$$;

revoke all on function public.consume_generation_credit(uuid) from public;
grant execute on function public.consume_generation_credit(uuid) to service_role;
