create table if not exists public.wovo_portal_credit_accounts (
  account_id uuid primary key references public.wovo_portal_accounts(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  entry_type text not null check (entry_type in ('purchase', 'consumption', 'adjustment', 'refund', 'reversal')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 240),
  description text not null check (char_length(description) between 1 and 500),
  stripe_checkout_session_id text unique,
  workflow_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wovo_portal_credit_ledger_account_created_idx
  on public.wovo_portal_credit_ledger(account_id, created_at desc);

create table if not exists public.wovo_portal_entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  entitlement_key text not null check (entitlement_key in ('ai_dm_manager', 'website_hosting')),
  status text not null default 'inactive' check (status in ('inactive', 'requested', 'checkout_pending', 'active', 'canceling', 'canceled', 'provisioning', 'blocked')),
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provisioning_status text not null default 'not_started' check (provisioning_status in ('not_started', 'pending', 'ready', 'failed')),
  provisioned_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, entitlement_key)
);

create table if not exists public.wovo_portal_workflow_drafts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  workflow_type text not null check (workflow_type in ('listing_ad', 'website_site', 'website_page', 'post_plan', 'mascot_series', 'ugc_ad', 'call_agent', 'job_posting', 'meeting')),
  title text not null check (char_length(title) between 3 and 180),
  status text not null default 'draft' check (status in ('draft', 'client_review', 'approved', 'queued', 'provisioning', 'published', 'blocked', 'archived')),
  brief text not null check (char_length(brief) between 10 and 5000),
  source_url text,
  source_authorized boolean not null default false,
  rights_confirmed boolean not null default false,
  people_consent_confirmed boolean not null default false,
  voice_consent_confirmed boolean not null default false,
  input_data jsonb not null default '{}'::jsonb,
  generated_output jsonb not null default '{}'::jsonb,
  provider_status text not null default 'not_started' check (provider_status in ('not_started', 'pending', 'completed', 'failed', 'provider_required')),
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wovo_portal_credit_ledger
  drop constraint if exists wovo_portal_credit_ledger_workflow_id_fkey;
alter table public.wovo_portal_credit_ledger
  add constraint wovo_portal_credit_ledger_workflow_id_fkey
  foreign key (workflow_id) references public.wovo_portal_workflow_drafts(id) on delete set null;

create index if not exists wovo_portal_entitlements_account_idx
  on public.wovo_portal_entitlements(account_id, entitlement_key);
create index if not exists wovo_portal_workflow_drafts_account_idx
  on public.wovo_portal_workflow_drafts(account_id, created_at desc);

alter table public.wovo_portal_credit_accounts enable row level security;
alter table public.wovo_portal_credit_ledger enable row level security;
alter table public.wovo_portal_entitlements enable row level security;
alter table public.wovo_portal_workflow_drafts enable row level security;

revoke all on public.wovo_portal_credit_accounts, public.wovo_portal_credit_ledger,
  public.wovo_portal_entitlements, public.wovo_portal_workflow_drafts from anon, authenticated;

create policy wovo_portal_credit_accounts_no_direct_access on public.wovo_portal_credit_accounts
  for all to anon, authenticated using (false) with check (false);
create policy wovo_portal_credit_ledger_no_direct_access on public.wovo_portal_credit_ledger
  for all to anon, authenticated using (false) with check (false);
create policy wovo_portal_entitlements_no_direct_access on public.wovo_portal_entitlements
  for all to anon, authenticated using (false) with check (false);
create policy wovo_portal_workflow_drafts_no_direct_access on public.wovo_portal_workflow_drafts
  for all to anon, authenticated using (false) with check (false);

create or replace function private.wovo_portal_apply_credit_entry(
  p_account_id uuid,
  p_delta integer,
  p_entry_type text,
  p_idempotency_key text,
  p_description text,
  p_created_by uuid default null,
  p_stripe_checkout_session_id text default null,
  p_workflow_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.wovo_portal_credit_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.wovo_portal_credit_ledger;
  v_balance integer;
  v_entry public.wovo_portal_credit_ledger;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.wovo_portal_credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.account_id <> p_account_id then raise exception 'Idempotency key belongs to another account'; end if;
    return v_existing;
  end if;
  if p_delta = 0 then raise exception 'Credit delta cannot be zero'; end if;
  if p_entry_type not in ('purchase', 'consumption', 'adjustment', 'refund', 'reversal') then raise exception 'Invalid credit entry type'; end if;

  insert into public.wovo_portal_credit_accounts(account_id, balance)
  values (p_account_id, 0)
  on conflict (account_id) do nothing;

  select balance into v_balance
  from public.wovo_portal_credit_accounts
  where account_id = p_account_id
  for update;

  v_balance := v_balance + p_delta;
  if v_balance < 0 then raise exception 'Insufficient credits'; end if;

  update public.wovo_portal_credit_accounts
  set balance = v_balance, updated_at = now()
  where account_id = p_account_id;

  insert into public.wovo_portal_credit_ledger(
    account_id, delta, balance_after, entry_type, idempotency_key, description,
    stripe_checkout_session_id, workflow_id, created_by, metadata
  ) values (
    p_account_id, p_delta, v_balance, p_entry_type, p_idempotency_key, p_description,
    p_stripe_checkout_session_id, p_workflow_id, p_created_by, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_entry;
  return v_entry;
end;
$$;

revoke all on function private.wovo_portal_apply_credit_entry(uuid, integer, text, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.wovo_portal_apply_credit_entry(uuid, integer, text, text, text, uuid, text, uuid, jsonb) to service_role;

comment on table public.wovo_portal_credit_ledger is 'Immutable tenant credit history; mutations use the private transactional idempotent function.';
comment on table public.wovo_portal_entitlements is 'Server-authoritative add-on subscription and provisioning state.';
comment on table public.wovo_portal_workflow_drafts is 'Tenant-private editable workflow briefs; published is never set before provisioning succeeds.';
