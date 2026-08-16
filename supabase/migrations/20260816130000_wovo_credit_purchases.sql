-- Tenant-scoped Stripe credit packs and idempotent purchase finalization.

create table if not exists public.wovo_credit_packs (
  pack_key text primary key check (pack_key in ('small', 'growth', 'studio')),
  display_name text not null check (char_length(display_name) between 2 and 80),
  stripe_price_id text not null unique,
  units integer not null check (units between 1 and 100000),
  amount_cents integer not null check (amount_cents between 50 and 1000000),
  currency text not null default 'usd' check (currency = 'usd'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.wovo_credit_packs(pack_key, display_name, stripe_price_id, units, amount_cents)
values
  ('small', '50 credits', 'price_1Ta7xPFmIvQosWF9Uz8mWJvS', 50, 500),
  ('growth', '110 credits', 'price_1Ta7xZFmIvQosWF9e8Pdbgor', 110, 1000),
  ('studio', '300 credits', 'price_1Ta7xiFmIvQosWF9VFsQSkhp', 300, 2500)
on conflict (pack_key) do update set
  display_name = excluded.display_name,
  stripe_price_id = excluded.stripe_price_id,
  units = excluded.units,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  active = true,
  updated_at = now();

create table if not exists public.wovo_credit_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  pack_key text not null references public.wovo_credit_packs(pack_key) on delete restrict,
  units integer not null check (units > 0),
  amount_cents integer not null check (amount_cents > 0),
  stripe_price_id text not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired', 'failed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed' and completed_at is not null) or status <> 'completed')
);

create index if not exists wovo_credit_checkout_account_idx
  on public.wovo_credit_checkout_sessions(account_id, created_at desc);

alter table public.wovo_credit_packs enable row level security;
alter table public.wovo_credit_checkout_sessions enable row level security;
revoke all on public.wovo_credit_packs, public.wovo_credit_checkout_sessions from anon, authenticated;
grant select on public.wovo_credit_packs to service_role;
grant select, insert, update on public.wovo_credit_checkout_sessions to service_role;
revoke delete, truncate on public.wovo_credit_packs, public.wovo_credit_checkout_sessions from service_role;

drop policy if exists wovo_credit_packs_no_direct_access on public.wovo_credit_packs;
create policy wovo_credit_packs_no_direct_access on public.wovo_credit_packs
  for all to anon, authenticated using (false) with check (false);
drop policy if exists wovo_credit_checkout_no_direct_access on public.wovo_credit_checkout_sessions;
create policy wovo_credit_checkout_no_direct_access on public.wovo_credit_checkout_sessions
  for all to anon, authenticated using (false) with check (false);

create or replace function public.wovo_finalize_credit_purchase(
  p_account_id uuid,
  p_initiated_by uuid,
  p_stripe_checkout_session_id text,
  p_stripe_price_id text,
  p_stripe_payment_intent_id text default null
) returns public.wovo_portal_credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack public.wovo_credit_packs;
  v_checkout public.wovo_credit_checkout_sessions;
  v_entry public.wovo_portal_credit_ledger;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_stripe_checkout_session_id, 0));
  select * into v_pack from public.wovo_credit_packs
  where stripe_price_id = p_stripe_price_id and active = true;
  if not found then raise exception 'Credit price is not allowlisted'; end if;

  select * into v_checkout from public.wovo_credit_checkout_sessions
  where stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;
  if not found then raise exception 'Credit checkout session is not registered'; end if;
  if v_checkout.account_id <> p_account_id
     or v_checkout.initiated_by <> p_initiated_by
     or v_checkout.pack_key <> v_pack.pack_key
     or v_checkout.stripe_price_id <> p_stripe_price_id
     or v_checkout.units <> v_pack.units
     or v_checkout.amount_cents <> v_pack.amount_cents then
    raise exception 'Credit checkout binding mismatch';
  end if;

  select * into v_entry from public.wovo_portal_credit_ledger
  where idempotency_key = 'stripe-credit:' || p_stripe_checkout_session_id;
  if found then return v_entry; end if;

  select * into v_entry from private.wovo_portal_apply_credit_entry(
    p_account_id,
    v_pack.units,
    'purchase',
    'stripe-credit:' || p_stripe_checkout_session_id,
    v_pack.display_name || ' purchased through Stripe',
    p_initiated_by,
    p_stripe_checkout_session_id,
    null,
    jsonb_build_object('pack_key', v_pack.pack_key, 'stripe_price_id', p_stripe_price_id, 'amount_cents', v_pack.amount_cents)
  );

  update public.wovo_credit_checkout_sessions set
    status = 'completed',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    completed_at = now(),
    updated_at = now()
  where id = v_checkout.id;
  return v_entry;
end;
$$;

revoke all on function public.wovo_finalize_credit_purchase(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.wovo_finalize_credit_purchase(uuid, uuid, text, text, text) to service_role;

comment on table public.wovo_credit_packs is 'Server-only allowlist binding exact Stripe prices to tenant credit units.';
comment on table public.wovo_credit_checkout_sessions is 'Tenant-bound credit Checkout attempt history. Only a paid, verified webhook may finalize a purchase.';
