create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  credits_total int not null default 0,
  credits_remaining int not null default 0,
  weekly_limit int not null default 0,
  weekly_used int not null default 0,
  week_start date,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan text,
  add column if not exists status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists credits_total int not null default 0,
  add column if not exists credits_remaining int not null default 0,
  add column if not exists weekly_limit int not null default 0,
  add column if not exists weekly_used int not null default 0,
  add column if not exists week_start date,
  add column if not exists updated_at timestamptz not null default now();

update public.subscriptions
set
  credits_total = coalesce(credits_total, monthly_credits_total, 0),
  credits_remaining = coalesce(credits_remaining, monthly_credits_remaining, 0),
  week_start = coalesce(week_start, weekly_window_start::date, current_date)
where true;

create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_stripe_subscription_id_idx on public.subscriptions (stripe_subscription_id);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;

create policy "subscriptions_select_own" on public.subscriptions
for select to authenticated
using (auth.uid() = user_id);

create policy "subscriptions_insert_own" on public.subscriptions
for insert to authenticated
with check (auth.uid() = user_id);

create policy "subscriptions_update_own" on public.subscriptions
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.subscriptions to authenticated;

create or replace function public.consume_generation_credit(p_user_id uuid)
returns table (
  consumed boolean,
  credits_remaining int,
  credits_total int,
  weekly_used int,
  weekly_limit int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_row public.subscriptions;
  resolved_week_start date;
begin
  select * into sub_row from public.subscriptions where user_id = p_user_id for update;

  if sub_row.user_id is null then
    return query select false, 0, 0, 0, 0;
    return;
  end if;

  resolved_week_start := coalesce(sub_row.week_start, current_date);

  if resolved_week_start <= (current_date - interval '7 days')::date then
    sub_row.weekly_used := 0;
    resolved_week_start := current_date;
  end if;

  if sub_row.credits_remaining <= 0 then
    return query select false, sub_row.credits_remaining, sub_row.credits_total, sub_row.weekly_used, sub_row.weekly_limit;
    return;
  end if;

  if sub_row.weekly_limit > 0 and sub_row.weekly_used >= sub_row.weekly_limit then
    return query select false, sub_row.credits_remaining, sub_row.credits_total, sub_row.weekly_used, sub_row.weekly_limit;
    return;
  end if;

  update public.subscriptions
  set
    credits_remaining = greatest(credits_remaining - 1, 0),
    weekly_used = coalesce(sub_row.weekly_used, 0) + 1,
    week_start = resolved_week_start,
    updated_at = now()
  where user_id = p_user_id
  returning * into sub_row;

  return query select true, sub_row.credits_remaining, sub_row.credits_total, sub_row.weekly_used, sub_row.weekly_limit;
end;
$$;

revoke all on function public.consume_generation_credit(uuid) from public;
grant execute on function public.consume_generation_credit(uuid) to service_role;
