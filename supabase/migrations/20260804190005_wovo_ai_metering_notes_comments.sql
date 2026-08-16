-- WOVO AI remains fail-closed until the server-side policy row and deployment
-- readiness flags are explicitly enabled. All exposed-schema tables deny direct
-- anon/authenticated access; the verified portal API is the only caller.

alter table public.wovo_portal_entitlements
  drop constraint if exists wovo_portal_entitlements_entitlement_key_check;
alter table public.wovo_portal_entitlements
  add constraint wovo_portal_entitlements_entitlement_key_check
  check (entitlement_key in ('ai_dm_manager', 'website_hosting', 'personal_ai_assistant', 'wovo_code'));

create table if not exists public.wovo_ai_usage_policies (
  account_id uuid primary key references public.wovo_portal_accounts(id) on delete cascade,
  enabled boolean not null default false,
  plan_key text not null default 'core' check (plan_key in ('core', 'code_pro', 'owner_test')),
  daily_unit_limit integer not null default 0 check (daily_unit_limit between 0 and 1000000),
  monthly_included_units integer not null default 0 check (monthly_included_units between 0 and 10000000),
  requests_per_minute integer not null default 0 check (requests_per_minute between 0 and 120),
  monthly_provider_cost_cap_micros bigint not null default 0 check (monthly_provider_cost_cap_micros between 0 and 100000000000),
  provider_ready boolean not null default false,
  moderation_ready boolean not null default false,
  telemetry_ready boolean not null default false,
  code_sandbox_ready boolean not null default false,
  advanced_mode_selection boolean not null default false,
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.wovo_ai_usage_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  feature text not null check (feature in ('chat', 'image_visual', 'website_page', 'product_page', 'code')),
  mode text not null check (mode in ('fast', 'balanced', 'premium')),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed', 'released')),
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 240),
  estimated_units integer not null check (estimated_units between 1 and 100000),
  included_units_reserved integer not null default 0 check (included_units_reserved >= 0),
  credit_units_reserved integer not null default 0 check (credit_units_reserved >= 0),
  actual_units integer check (actual_units is null or actual_units between 0 and 100000),
  estimated_provider_cost_micros bigint not null check (estimated_provider_cost_micros between 0 and 10000000000),
  actual_provider_cost_micros bigint check (actual_provider_cost_micros is null or actual_provider_cost_micros between 0 and 10000000000),
  provider_request_id text,
  model_route_key text not null check (model_route_key in ('fast', 'balanced', 'premium')),
  metadata jsonb not null default '{}'::jsonb,
  error_code text,
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key),
  check (included_units_reserved + credit_units_reserved = estimated_units)
);

create index if not exists wovo_ai_usage_requests_account_created_idx
  on public.wovo_ai_usage_requests(account_id, reserved_at desc);
create index if not exists wovo_ai_usage_requests_actor_rate_idx
  on public.wovo_ai_usage_requests(actor_user_id, reserved_at desc);
create index if not exists wovo_ai_usage_requests_period_idx
  on public.wovo_ai_usage_requests(account_id, status, reserved_at desc);

create table if not exists public.wovo_ai_quota_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  units_granted integer not null check (units_granted between 1 and 1000000),
  reason text not null check (char_length(reason) between 8 and 500),
  expires_at timestamptz not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists wovo_ai_quota_grants_account_idx
  on public.wovo_ai_quota_grants(account_id, expires_at desc);

create table if not exists public.wovo_knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  category text not null check (category in ('business_facts', 'programs', 'locations', 'services', 'history', 'events', 'voice_guidance', 'faq', 'other')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  current_version integer not null default 1 check (current_version > 0),
  approved_version_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_knowledge_note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.wovo_knowledge_notes(id) on delete cascade,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null check (char_length(title) between 2 and 180),
  body text not null check (char_length(body) between 3 and 20000),
  source_url text check (source_url is null or char_length(source_url) between 8 and 1000),
  source_date date,
  guidance_kind text not null default 'fact' check (guidance_kind in ('fact', 'do_say', 'dont_say', 'context')),
  change_note text check (change_note is null or char_length(change_note) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (note_id, version_number),
  unique (id, note_id, account_id)
);

alter table public.wovo_knowledge_notes
  drop constraint if exists wovo_knowledge_notes_approved_version_id_fkey;
alter table public.wovo_knowledge_notes
  add constraint wovo_knowledge_notes_approved_version_id_fkey
  foreign key (approved_version_id) references public.wovo_knowledge_note_versions(id) on delete set null;

create index if not exists wovo_knowledge_notes_account_idx
  on public.wovo_knowledge_notes(account_id, status, updated_at desc);
create index if not exists wovo_knowledge_note_versions_note_idx
  on public.wovo_knowledge_note_versions(note_id, version_number desc);

create table if not exists public.wovo_knowledge_note_permissions (
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  granted_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table if not exists public.wovo_comment_content_workflows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_kind text not null default 'manual_public_question' check (source_kind = 'manual_public_question'),
  source_platform text check (source_platform is null or source_platform in ('facebook', 'instagram', 'tiktok', 'youtube', 'website', 'other')),
  source_url text check (source_url is null or char_length(source_url) between 8 and 1000),
  source_date date,
  redacted_question text not null check (char_length(redacted_question) between 5 and 4000),
  category text not null check (category in ('faq', 'program', 'service', 'event', 'education', 'myth', 'other')),
  output_type text not null check (output_type in ('faq_answer', 'social_post', 'caption', 'content_theme')),
  approved_note_ids uuid[] not null default '{}'::uuid[],
  factual_support_status text not null default 'needs_notes' check (factual_support_status in ('needs_notes', 'supported', 'owner_review')),
  draft_output text,
  status text not null default 'draft' check (status in ('draft', 'brief_ready', 'owner_review', 'approved', 'queued', 'archived')),
  privacy_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wovo_comment_content_workflows_account_idx
  on public.wovo_comment_content_workflows(account_id, status, created_at desc);

alter table public.wovo_ai_usage_policies enable row level security;
alter table public.wovo_ai_usage_requests enable row level security;
alter table public.wovo_ai_quota_grants enable row level security;
alter table public.wovo_knowledge_notes enable row level security;
alter table public.wovo_knowledge_note_versions enable row level security;
alter table public.wovo_knowledge_note_permissions enable row level security;
alter table public.wovo_comment_content_workflows enable row level security;

revoke all on public.wovo_ai_usage_policies, public.wovo_ai_usage_requests,
  public.wovo_ai_quota_grants, public.wovo_knowledge_notes,
  public.wovo_knowledge_note_versions, public.wovo_knowledge_note_permissions,
  public.wovo_comment_content_workflows from anon, authenticated;

create policy wovo_ai_usage_policies_no_direct_access on public.wovo_ai_usage_policies
  for all to anon, authenticated using (false) with check (false);
create policy wovo_ai_usage_requests_no_direct_access on public.wovo_ai_usage_requests
  for all to anon, authenticated using (false) with check (false);
create policy wovo_ai_quota_grants_no_direct_access on public.wovo_ai_quota_grants
  for all to anon, authenticated using (false) with check (false);
create policy wovo_knowledge_notes_no_direct_access on public.wovo_knowledge_notes
  for all to anon, authenticated using (false) with check (false);
create policy wovo_knowledge_note_versions_no_direct_access on public.wovo_knowledge_note_versions
  for all to anon, authenticated using (false) with check (false);
create policy wovo_knowledge_note_permissions_no_direct_access on public.wovo_knowledge_note_permissions
  for all to anon, authenticated using (false) with check (false);
create policy wovo_comment_content_workflows_no_direct_access on public.wovo_comment_content_workflows
  for all to anon, authenticated using (false) with check (false);

create or replace function private.wovo_ai_reserve_usage(
  p_account_id uuid,
  p_actor_user_id uuid,
  p_feature text,
  p_mode text,
  p_estimated_units integer,
  p_estimated_provider_cost_micros bigint,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns public.wovo_ai_usage_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.wovo_ai_usage_policies;
  v_existing public.wovo_ai_usage_requests;
  v_request public.wovo_ai_usage_requests;
  v_month_used bigint := 0;
  v_day_used bigint := 0;
  v_minute_requests bigint := 0;
  v_cost_used bigint := 0;
  v_grant_units bigint := 0;
  v_included_available bigint := 0;
  v_included_reserved integer := 0;
  v_credit_reserved integer := 0;
  v_credit_balance integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account_id::text || ':' || p_idempotency_key, 0));
  select * into v_existing
  from public.wovo_ai_usage_requests
  where account_id = p_account_id and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  if p_feature not in ('chat', 'image_visual', 'website_page', 'product_page', 'code') then raise exception 'Invalid AI feature'; end if;
  if p_mode not in ('fast', 'balanced', 'premium') then raise exception 'Invalid AI mode'; end if;
  if p_estimated_units < 1 or p_estimated_units > 100000 then raise exception 'Invalid estimated units'; end if;
  if p_estimated_provider_cost_micros < 0 then raise exception 'Invalid estimated provider cost'; end if;

  select * into v_policy from public.wovo_ai_usage_policies where account_id = p_account_id for update;
  if not found or not v_policy.enabled or not v_policy.provider_ready or not v_policy.moderation_ready or not v_policy.telemetry_ready then
    raise exception 'WOVO AI is not enabled for this workspace';
  end if;
  if p_feature = 'code' then
    if not v_policy.code_sandbox_ready then raise exception 'WOVO Code sandbox is not ready'; end if;
    if not exists (
      select 1 from public.wovo_portal_entitlements e
      where e.account_id = p_account_id and e.entitlement_key = 'wovo_code' and e.status = 'active'
        and (e.current_period_end is null or e.current_period_end > now())
    ) then raise exception 'Active WOVO Code entitlement required'; end if;
  end if;

  select coalesce(sum(coalesce(actual_units, estimated_units)), 0),
         coalesce(sum(coalesce(actual_provider_cost_micros, estimated_provider_cost_micros)), 0)
    into v_month_used, v_cost_used
  from public.wovo_ai_usage_requests
  where account_id = p_account_id and status in ('reserved', 'completed')
    and reserved_at >= v_policy.period_start and reserved_at < v_policy.period_end;

  select coalesce(sum(coalesce(actual_units, estimated_units)), 0) into v_day_used
  from public.wovo_ai_usage_requests
  where account_id = p_account_id and status in ('reserved', 'completed')
    and reserved_at >= date_trunc('day', now());

  select count(*) into v_minute_requests
  from public.wovo_ai_usage_requests
  where actor_user_id = p_actor_user_id and status in ('reserved', 'completed')
    and reserved_at >= now() - interval '1 minute';

  if v_policy.requests_per_minute <= 0 or v_minute_requests >= v_policy.requests_per_minute then raise exception 'AI rate limit reached'; end if;
  if v_policy.daily_unit_limit <= 0 or v_day_used + p_estimated_units > v_policy.daily_unit_limit then raise exception 'Daily AI allowance reached'; end if;
  if v_policy.monthly_provider_cost_cap_micros <= 0 or v_cost_used + p_estimated_provider_cost_micros > v_policy.monthly_provider_cost_cap_micros then raise exception 'Workspace AI spend cap reached'; end if;

  select coalesce(sum(units_granted), 0) into v_grant_units
  from public.wovo_ai_quota_grants
  where account_id = p_account_id and revoked_at is null and expires_at > now();
  v_included_available := greatest(v_policy.monthly_included_units + v_grant_units - v_month_used, 0);
  v_included_reserved := least(p_estimated_units::bigint, v_included_available)::integer;
  v_credit_reserved := p_estimated_units - v_included_reserved;

  if v_credit_reserved > 0 then
    insert into public.wovo_portal_credit_accounts(account_id, balance) values (p_account_id, 0)
      on conflict (account_id) do nothing;
    select balance into v_credit_balance from public.wovo_portal_credit_accounts where account_id = p_account_id for update;
    if v_credit_balance < v_credit_reserved then raise exception 'Insufficient AI credits'; end if;
    perform private.wovo_portal_apply_credit_entry(
      p_account_id, -v_credit_reserved, 'consumption', 'ai-reserve:' || p_idempotency_key,
      'Reserved for ' || p_feature || ' (' || p_mode || ')', p_actor_user_id, null, null,
      jsonb_build_object('feature', p_feature, 'mode', p_mode, 'reservation', true)
    );
  end if;

  insert into public.wovo_ai_usage_requests(
    account_id, actor_user_id, feature, mode, idempotency_key, estimated_units,
    included_units_reserved, credit_units_reserved, estimated_provider_cost_micros,
    model_route_key, metadata
  ) values (
    p_account_id, p_actor_user_id, p_feature, p_mode, p_idempotency_key, p_estimated_units,
    v_included_reserved, v_credit_reserved, p_estimated_provider_cost_micros,
    p_mode, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_request;
  return v_request;
end;
$$;

create or replace function private.wovo_ai_finalize_usage(
  p_request_id uuid,
  p_actual_units integer,
  p_actual_provider_cost_micros bigint,
  p_provider_request_id text default null
) returns public.wovo_ai_usage_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.wovo_ai_usage_requests;
  v_refund integer := 0;
  v_actual_credit integer := 0;
begin
  select * into v_request from public.wovo_ai_usage_requests where id = p_request_id for update;
  if not found then raise exception 'AI usage request not found'; end if;
  if v_request.status = 'completed' then return v_request; end if;
  if v_request.status <> 'reserved' then raise exception 'AI usage request is not reservable'; end if;
  if p_actual_units < 0 or p_actual_units > v_request.estimated_units then raise exception 'Actual AI units exceed reservation'; end if;
  if p_actual_provider_cost_micros < 0 then raise exception 'Invalid provider cost'; end if;

  v_actual_credit := greatest(p_actual_units - v_request.included_units_reserved, 0);
  v_refund := greatest(v_request.credit_units_reserved - v_actual_credit, 0);
  if v_refund > 0 then
    perform private.wovo_portal_apply_credit_entry(
      v_request.account_id, v_refund, 'reversal', 'ai-refund:' || v_request.id::text,
      'Unused AI reservation returned', v_request.actor_user_id, null, null,
      jsonb_build_object('usage_request_id', v_request.id)
    );
  end if;

  update public.wovo_ai_usage_requests set
    status = 'completed', actual_units = p_actual_units,
    actual_provider_cost_micros = p_actual_provider_cost_micros,
    provider_request_id = p_provider_request_id, completed_at = now(), updated_at = now()
  where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

create or replace function private.wovo_ai_release_usage(
  p_request_id uuid,
  p_error_code text default 'provider_failed'
) returns public.wovo_ai_usage_requests
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.wovo_ai_usage_requests;
begin
  select * into v_request from public.wovo_ai_usage_requests where id = p_request_id for update;
  if not found then raise exception 'AI usage request not found'; end if;
  if v_request.status in ('failed', 'released') then return v_request; end if;
  if v_request.status <> 'reserved' then raise exception 'Completed AI usage cannot be released'; end if;
  if v_request.credit_units_reserved > 0 then
    perform private.wovo_portal_apply_credit_entry(
      v_request.account_id, v_request.credit_units_reserved, 'reversal', 'ai-release:' || v_request.id::text,
      'AI reservation returned after failure', v_request.actor_user_id, null, null,
      jsonb_build_object('usage_request_id', v_request.id, 'error_code', left(coalesce(p_error_code, 'provider_failed'), 120))
    );
  end if;
  update public.wovo_ai_usage_requests set status = 'failed', error_code = left(coalesce(p_error_code, 'provider_failed'), 120),
    completed_at = now(), updated_at = now() where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

revoke all on function private.wovo_ai_reserve_usage(uuid, uuid, text, text, integer, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function private.wovo_ai_finalize_usage(uuid, integer, bigint, text) from public, anon, authenticated;
revoke all on function private.wovo_ai_release_usage(uuid, text) from public, anon, authenticated;
grant execute on function private.wovo_ai_reserve_usage(uuid, uuid, text, text, integer, bigint, text, jsonb) to service_role;
grant execute on function private.wovo_ai_finalize_usage(uuid, integer, bigint, text) to service_role;
grant execute on function private.wovo_ai_release_usage(uuid, text) to service_role;

-- PostgREST only exposes functions in exposed schemas. These invoker wrappers
-- are callable by service_role alone and delegate to the locked private schema.
create or replace function public.wovo_ai_reserve_usage(
  p_account_id uuid,
  p_actor_user_id uuid,
  p_feature text,
  p_mode text,
  p_estimated_units integer,
  p_estimated_provider_cost_micros bigint,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns public.wovo_ai_usage_requests
language sql
security invoker
set search_path = ''
as $$
  select private.wovo_ai_reserve_usage(
    p_account_id, p_actor_user_id, p_feature, p_mode, p_estimated_units,
    p_estimated_provider_cost_micros, p_idempotency_key, p_metadata
  );
$$;

create or replace function public.wovo_ai_finalize_usage(
  p_request_id uuid,
  p_actual_units integer,
  p_actual_provider_cost_micros bigint,
  p_provider_request_id text default null
) returns public.wovo_ai_usage_requests
language sql
security invoker
set search_path = ''
as $$
  select private.wovo_ai_finalize_usage(p_request_id, p_actual_units, p_actual_provider_cost_micros, p_provider_request_id);
$$;

create or replace function public.wovo_ai_release_usage(
  p_request_id uuid,
  p_error_code text default 'provider_failed'
) returns public.wovo_ai_usage_requests
language sql
security invoker
set search_path = ''
as $$
  select private.wovo_ai_release_usage(p_request_id, p_error_code);
$$;

revoke all on function public.wovo_ai_reserve_usage(uuid, uuid, text, text, integer, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.wovo_ai_finalize_usage(uuid, integer, bigint, text) from public, anon, authenticated;
revoke all on function public.wovo_ai_release_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.wovo_ai_reserve_usage(uuid, uuid, text, text, integer, bigint, text, jsonb) to service_role;
grant execute on function public.wovo_ai_finalize_usage(uuid, integer, bigint, text) to service_role;
grant execute on function public.wovo_ai_release_usage(uuid, text) to service_role;

comment on table public.wovo_ai_usage_policies is 'Server-controlled workspace AI allowance, rate, readiness, and spend caps. Disabled by default.';
comment on table public.wovo_ai_usage_requests is 'Idempotent reservations and actual usage for WOVO AI and WOVO Code; no unlimited access.';
comment on table public.wovo_ai_quota_grants is 'Audited, expiring owner grants; grants never bypass rate, provider, moderation, telemetry, or sandbox readiness.';
comment on table public.wovo_knowledge_notes is 'Tenant-scoped business knowledge. Only approved_version_id content is eligible for factual AI grounding.';
comment on table public.wovo_knowledge_note_versions is 'Immutable WOVO Notes version history with source URL/date provenance.';
comment on table public.wovo_comment_content_workflows is 'Manual, privacy-minimized public-question intake. Direct social ingestion and auto-replies are not enabled.';
