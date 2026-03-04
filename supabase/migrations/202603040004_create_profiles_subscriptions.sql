create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  business_name text,
  business_type text,
  location text,
  contact text,
  topic text,
  goal text,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_credits_total integer not null default 0,
  monthly_credits_remaining integer not null default 0,
  weekly_limit integer not null default 0,
  weekly_used integer not null default 0,
  weekly_window_start timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;

create policy "subscriptions_select_own" on public.subscriptions
for select to authenticated
using (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
