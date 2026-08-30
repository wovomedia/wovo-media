-- Grants the promised welcome credits exactly once per authenticated identity.
-- The grant is account-level for spending, but user-level for idempotency so
-- creating or joining another workspace cannot mint a second welcome balance.

create table if not exists public.wovo_signup_credit_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid references public.wovo_portal_accounts(id) on delete set null,
  ledger_entry_id uuid references public.wovo_portal_credit_ledger(id) on delete set null,
  credits_granted integer not null default 10 check (credits_granted = 10),
  created_at timestamptz not null default now()
);

alter table public.wovo_signup_credit_grants enable row level security;
revoke all on public.wovo_signup_credit_grants from public, anon, authenticated;

drop policy if exists wovo_signup_credit_grants_no_direct_access
  on public.wovo_signup_credit_grants;
create policy wovo_signup_credit_grants_no_direct_access
  on public.wovo_signup_credit_grants
  for all to anon, authenticated
  using (false)
  with check (false);

create or replace function public.wovo_grant_signup_credits(
  p_user_id uuid,
  p_account_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_grant public.wovo_signup_credit_grants;
  v_entry public.wovo_portal_credit_ledger;
begin
  if p_user_id is null or p_account_id is null then
    raise exception 'User and account are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wovo-signup-credit:' || p_user_id::text, 0)
  );

  if not exists (
    select 1
    from public.wovo_portal_accounts account
    where account.id = p_account_id
      and account.owner_user_id = p_user_id
  ) and not exists (
    select 1
    from public.wovo_portal_members member
    where member.account_id = p_account_id
      and member.user_id = p_user_id
      and member.active = true
  ) then
    raise exception 'User is not authorized for this account';
  end if;

  select * into v_existing_grant
  from public.wovo_signup_credit_grants
  where user_id = p_user_id;

  if found then
    select * into v_entry
    from public.wovo_portal_credit_ledger
    where id = v_existing_grant.ledger_entry_id;
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'credits', 0,
      'balanceAfter', coalesce(v_entry.balance_after, 0),
      'ledgerEntryId', v_existing_grant.ledger_entry_id,
      'grantedAccountId', v_existing_grant.account_id
    );
  end if;

  select * into v_entry
  from private.wovo_portal_apply_credit_entry(
    p_account_id,
    10,
    'adjustment',
    'signup-credit:' || p_user_id::text,
    'One-time WOVO signup credit grant',
    p_user_id,
    null,
    null,
    pg_catalog.jsonb_build_object(
      'grant_kind', 'signup',
      'grant_version', '2026-08-30.1',
      'credits', 10
    )
  );

  insert into public.wovo_signup_credit_grants(
    user_id,
    account_id,
    ledger_entry_id,
    credits_granted
  ) values (
    p_user_id,
    p_account_id,
    v_entry.id,
    10
  );

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'credits', 10,
    'balanceAfter', v_entry.balance_after,
    'ledgerEntryId', v_entry.id,
    'grantedAccountId', p_account_id
  );
end;
$$;

revoke all on function public.wovo_grant_signup_credits(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.wovo_grant_signup_credits(uuid, uuid)
  to service_role;

comment on table public.wovo_signup_credit_grants is
  'One immutable welcome-credit marker per auth user. Account deletion does not make the same user eligible again.';
comment on function public.wovo_grant_signup_credits(uuid, uuid) is
  'Service-only, transactionally idempotent grant of exactly 10 signup credits to an authorized account.';
