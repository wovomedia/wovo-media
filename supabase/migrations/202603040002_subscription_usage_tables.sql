create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text,
  plan_key text,
  price_id text,
  period_start timestamptz,
  period_end timestamptz,
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

alter table public.subscriptions
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table public.usage_credits
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz,
  add column if not exists updated_at timestamptz default now();

update public.subscriptions
set period_start = coalesce(period_start, current_period_start),
    period_end = coalesce(period_end, current_period_end)
where (period_start is null and current_period_start is not null)
   or (period_end is null and current_period_end is not null);

alter table public.subscriptions enable row level security;
alter table public.usage_credits enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "usage_credits_select_own" on public.usage_credits;
create policy "usage_credits_select_own" on public.usage_credits
for select to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke insert, update, delete on public.usage_credits from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.usage_credits to authenticated;
