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
  add column if not exists topic text,
  add column if not exists goal text,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_credits_total int default 0,
  monthly_credits_remaining int default 0,
  weekly_limit int default 0,
  weekly_used int default 0,
  weekly_window_start timestamptz,
  updated_at timestamptz default now()
);

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan text,
  add column if not exists status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists monthly_credits_total int default 0,
  add column if not exists monthly_credits_remaining int default 0,
  add column if not exists weekly_limit int default 0,
  add column if not exists weekly_used int default 0,
  add column if not exists weekly_window_start timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.subscriptions
set
  plan = coalesce(plan, plan_key),
  current_period_start = coalesce(current_period_start, period_start),
  current_period_end = coalesce(current_period_end, period_end),
  monthly_credits_total = coalesce(monthly_credits_total, 0),
  monthly_credits_remaining = coalesce(monthly_credits_remaining, greatest(coalesce(credits_limit_month, 0) - coalesce(credits_used_month, 0), 0)),
  weekly_limit = coalesce(weekly_limit,
    case coalesce(plan, plan_key)
      when 'starter' then 3
      when 'pro' then 6
      when 'agency' then 14
      else 0
    end
  ),
  weekly_used = coalesce(weekly_used, 0),
  weekly_window_start = coalesce(weekly_window_start, current_period_start, period_start)
from public.usage_credits uc
where uc.user_id = subscriptions.user_id;

create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_stripe_subscription_id_idx on public.subscriptions (stripe_subscription_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

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

revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.consume_generation_credit(p_user_id uuid)
returns table (consumed boolean, credits_used_month int, credits_limit_month int)
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_row public.subscriptions;
  weekly_start_val timestamptz;
begin
  select * into sub_row from public.subscriptions where user_id = p_user_id for update;

  if sub_row.user_id is null then
    return query select false, 0, 0;
    return;
  end if;


  if sub_row.weekly_window_start is null or sub_row.weekly_window_start < now() - interval '7 days' then
    weekly_start_val := now();
    sub_row.weekly_used := 0;
  else
    weekly_start_val := sub_row.weekly_window_start;
  end if;

  if sub_row.monthly_credits_remaining <= 0 then
    return query select false, greatest(sub_row.monthly_credits_total - sub_row.monthly_credits_remaining, 0), sub_row.monthly_credits_total;
    return;
  end if;

  if sub_row.weekly_limit > 0 and sub_row.weekly_used >= sub_row.weekly_limit then
    return query select false, greatest(sub_row.monthly_credits_total - sub_row.monthly_credits_remaining, 0), sub_row.monthly_credits_total;
    return;
  end if;

  update public.subscriptions
  set
    monthly_credits_remaining = greatest(monthly_credits_remaining - 1, 0),
    weekly_used = sub_row.weekly_used + 1,
    weekly_window_start = weekly_start_val,
    updated_at = now()
  where user_id = p_user_id
  returning * into sub_row;

  return query select true, greatest(sub_row.monthly_credits_total - sub_row.monthly_credits_remaining, 0), sub_row.monthly_credits_total;
end;
$$;

revoke all on function public.consume_generation_credit(uuid) from public;
grant execute on function public.consume_generation_credit(uuid) to service_role;
