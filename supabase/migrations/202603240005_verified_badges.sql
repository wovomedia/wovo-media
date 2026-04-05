create table if not exists public.verified_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  badge_active boolean not null default false,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists verified_subscriptions_stripe_subscription_id_idx
  on public.verified_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists verified_subscriptions_status_idx
  on public.verified_subscriptions (status, badge_active);

alter table public.verified_subscriptions enable row level security;

drop policy if exists verified_subscriptions_select_all on public.verified_subscriptions;
drop policy if exists verified_subscriptions_insert_none on public.verified_subscriptions;
drop policy if exists verified_subscriptions_update_none on public.verified_subscriptions;
drop policy if exists verified_subscriptions_delete_none on public.verified_subscriptions;

create policy verified_subscriptions_select_all
on public.verified_subscriptions
for select
to authenticated
using (true);

create policy verified_subscriptions_insert_none
on public.verified_subscriptions
for insert
to authenticated
with check (false);

create policy verified_subscriptions_update_none
on public.verified_subscriptions
for update
to authenticated
using (false)
with check (false);

create policy verified_subscriptions_delete_none
on public.verified_subscriptions
for delete
to authenticated
using (false);

grant select on public.verified_subscriptions to authenticated;
