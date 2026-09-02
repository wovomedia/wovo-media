-- V2 pay-as-you-go credits: six fixed live Stripe prices plus server-priced
-- custom amounts. The webhook remains the only finalizer and the checkout row
-- binds workspace, actor, amount, and units before Stripe is opened.

alter table public.wovo_credit_checkout_sessions
  drop constraint if exists wovo_credit_checkout_sessions_pack_key_fkey;

alter table public.wovo_credit_packs
  drop constraint if exists wovo_credit_packs_pack_key_check;

alter table public.wovo_credit_packs
  add constraint wovo_credit_packs_pack_key_check
  check (pack_key ~ '^[a-z0-9_]{2,40}$');

insert into public.wovo_credit_packs(pack_key, display_name, stripe_price_id, units, amount_cents)
values
  ('usd10', '$10 · 110 credits', 'price_1UB3PWFmIvQosWF9xcL50lGK', 110, 1000),
  ('usd20', '$20 · 220 credits', 'price_1UB3PWFmIvQosWF9xouEdvcA', 220, 2000),
  ('usd50', '$50 · 550 credits', 'price_1UB3PWFmIvQosWF96Xk9R2dl', 550, 5000),
  ('usd100', '$100 · 1,100 credits', 'price_1UB3PWFmIvQosWF9QvTlfi8x', 1100, 10000),
  ('usd500', '$500 · 5,500 credits', 'price_1UB3PWFmIvQosWF93AnT2m2c', 5500, 50000),
  ('usd1000', '$1,000 · 11,000 credits', 'price_1UB3PXFmIvQosWF9xi2fjw3C', 11000, 100000)
on conflict (pack_key) do update set
  display_name = excluded.display_name,
  stripe_price_id = excluded.stripe_price_id,
  units = excluded.units,
  amount_cents = excluded.amount_cents,
  active = true,
  updated_at = now();

create or replace function public.wovo_finalize_credit_purchase_v2(
  p_account_id uuid,
  p_initiated_by uuid,
  p_stripe_checkout_session_id text,
  p_stripe_price_id text,
  p_amount_cents integer,
  p_units integer,
  p_stripe_payment_intent_id text default null
) returns public.wovo_portal_credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.wovo_credit_checkout_sessions;
  v_entry public.wovo_portal_credit_ledger;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_stripe_checkout_session_id, 0));
  if p_amount_cents < 1000 or p_amount_cents > 1000000 or p_units <> (p_amount_cents / 100) * 11 or p_amount_cents % 100 <> 0 then
    raise exception 'Credit amount or unit calculation is invalid';
  end if;

  select * into v_checkout from public.wovo_credit_checkout_sessions
  where stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;
  if not found then raise exception 'Credit checkout session is not registered'; end if;
  if v_checkout.account_id <> p_account_id
     or v_checkout.initiated_by <> p_initiated_by
     or v_checkout.units <> p_units
     or v_checkout.amount_cents <> p_amount_cents then
    raise exception 'Credit checkout binding mismatch';
  end if;

  select * into v_entry from public.wovo_portal_credit_ledger
  where idempotency_key = 'stripe-credit:' || p_stripe_checkout_session_id;
  if found then return v_entry; end if;

  select * into v_entry from private.wovo_portal_apply_credit_entry(
    p_account_id,
    p_units,
    'purchase',
    'stripe-credit:' || p_stripe_checkout_session_id,
    p_units::text || ' WOVO credits purchased through Stripe',
    p_initiated_by,
    p_stripe_checkout_session_id,
    null,
    jsonb_build_object('pack_key', v_checkout.pack_key, 'stripe_price_id', p_stripe_price_id, 'amount_cents', p_amount_cents)
  );

  update public.wovo_credit_checkout_sessions set
    status = 'completed',
    stripe_price_id = p_stripe_price_id,
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    completed_at = now(),
    updated_at = now()
  where id = v_checkout.id;
  return v_entry;
end;
$$;

revoke all on function public.wovo_finalize_credit_purchase_v2(uuid, uuid, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.wovo_finalize_credit_purchase_v2(uuid, uuid, text, text, integer, integer, text) to service_role;
