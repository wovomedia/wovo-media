-- Client-owned AI operators and request-driven creative generation.
-- Browser roles receive no direct table privileges; verified server routes are
-- the only entry point and must re-check account membership/entitlement.

alter table public.wovo_portal_entitlements
  drop constraint if exists wovo_portal_entitlements_entitlement_key_check;
alter table public.wovo_portal_entitlements
  add constraint wovo_portal_entitlements_entitlement_key_check
  check (entitlement_key in ('ai_dm_manager', 'website_hosting', 'personal_ai_assistant', 'wovo_code', 'ai_operator'));

alter table public.wovo_ai_usage_policies drop constraint if exists wovo_ai_usage_policies_plan_key_check;
alter table public.wovo_ai_usage_policies add constraint wovo_ai_usage_policies_plan_key_check
  check (plan_key in ('core', 'code_pro', 'owner_test', 'ai_operator'));
alter table public.wovo_ai_usage_policies add column if not exists weekly_unit_limit integer not null default 20
  check (weekly_unit_limit between 1 and 10000);

alter table public.wovo_adam_integrations drop constraint if exists wovo_adam_integrations_integration_key_check;
alter table public.wovo_adam_integrations add constraint wovo_adam_integrations_integration_key_check
  check (integration_key in ('openai', 'stripe', 'supabase', 'vercel', 'resend', 'meta', 'github', 'calendar', 'analytics', 'search_console', 'cloudflare', 'calendly'));

create table if not exists public.wovo_ai_operators (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.wovo_portal_accounts(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  display_name text not null default 'My WOVO Operator' check (char_length(display_name) between 2 and 80),
  business_role text not null default 'Marketing operations assistant' check (char_length(business_role) between 3 and 180),
  business_context text not null default '' check (char_length(business_context) <= 6000),
  permitted_scopes text[] not null default array['content_drafts']::text[],
  action_policy text not null default 'draft_only' check (action_policy in ('draft_only', 'approved_integrations_only')),
  external_actions_enabled boolean not null default false,
  hourly_request_cap integer not null default 6 check (hourly_request_cap between 1 and 20),
  daily_request_cap integer not null default 20 check (daily_request_cap between 1 and 60),
  monthly_credit_allowance integer not null default 300 check (monthly_credit_allowance between 1 and 5000),
  monthly_cost_cap_micros bigint not null default 3000000 check (monthly_cost_cap_micros between 100000 and 25000000),
  kill_switch boolean not null default false,
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'billing_required', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not external_actions_enabled or action_policy = 'approved_integrations_only')
);

create table if not exists public.wovo_creative_profiles (
  account_id uuid primary key references public.wovo_portal_accounts(id) on delete restrict,
  project_kind text not null default 'business_campaign' check (project_kind in ('personal_creator', 'business_campaign', 'real_estate', 'character_series')),
  visual_identity jsonb not null default '{}'::jsonb,
  style_preferences text[] not null default '{}'::text[],
  exclusions text[] not null default '{}'::text[],
  variation_level integer not null default 2 check (variation_level between 1 and 4),
  character_bible jsonb not null default '{}'::jsonb,
  listing_reference_url text,
  listing_facts jsonb not null default '{}'::jsonb,
  source_rights_confirmed boolean not null default false,
  likeness_consent_confirmed boolean not null default false,
  voice_consent_confirmed boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_ai_creation_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  operator_id uuid references public.wovo_ai_operators(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 220),
  correlation_id uuid not null default gen_random_uuid(),
  capability text not null check (capability in ('caption_variants', 'content_calendar', 'website_concept', 'website_page', 'listing_storyboard', 'character_bible', 'episode_outline', 'image_generation', 'image_edit', 'video_generation')),
  status text not null default 'awaiting_confirmation' check (status in ('awaiting_confirmation', 'queued', 'running', 'completed', 'failed', 'blocked', 'canceled')),
  prompt text not null check (char_length(prompt) between 3 and 8000),
  input_manifest jsonb not null default '{}'::jsonb,
  approved_note_ids uuid[] not null default '{}'::uuid[],
  approved_asset_ids uuid[] not null default '{}'::uuid[],
  source_rights_confirmed boolean not null default false,
  likeness_consent_confirmed boolean not null default false,
  voice_consent_confirmed boolean not null default false,
  estimated_credits integer not null check (estimated_credits between 1 and 1000),
  reserved_credits integer not null default 0 check (reserved_credits between 0 and 1000),
  estimated_cost_micros bigint not null check (estimated_cost_micros between 0 and 25000000),
  actual_cost_micros bigint,
  provider text,
  model_id text,
  provider_request_id text,
  usage_request_id uuid references public.wovo_ai_usage_requests(id) on delete restrict,
  result_text text,
  result_manifest jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 2 check (max_attempts between 1 and 3),
  next_attempt_at timestamptz,
  error_code text,
  error_summary text,
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create table if not exists public.wovo_ai_creation_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  job_id uuid not null references public.wovo_ai_creation_jobs(id) on delete restrict,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  sha256 text check (sha256 is null or char_length(sha256) = 64),
  provider_asset_id text,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.wovo_ai_operator_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  operator_id uuid references public.wovo_ai_operators(id) on delete restrict,
  job_id uuid references public.wovo_ai_creation_jobs(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('client', 'wovo_staff', 'operator_system', 'provider')),
  event_type text not null check (char_length(event_type) between 3 and 100),
  summary text not null check (char_length(summary) between 3 and 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_integration_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  provider text not null check (provider in ('cloudflare_r2', 'calendly')),
  status text not null default 'not_connected' check (status in ('not_connected', 'authorization_required', 'configured', 'healthy', 'degraded', 'revoked')),
  permissions text[] not null default '{}'::text[],
  secret_reference text,
  token_expires_at timestamptz,
  kill_switch boolean not null default true,
  last_checked_at timestamptz,
  last_error_code text,
  connected_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (account_id, owner_scope, provider),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null))
);

create table if not exists public.wovo_schedule_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  operator_id uuid references public.wovo_ai_operators(id) on delete restrict,
  purpose text not null check (char_length(purpose) between 5 and 2000),
  preferred_windows jsonb not null default '[]'::jsonb,
  attendee_count integer not null default 1 check (attendee_count between 1 and 10),
  status text not null default 'draft' check (status in ('draft', 'client_confirmed', 'staff_review', 'scheduled', 'canceled')),
  provider text,
  provider_event_id text,
  meeting_url text,
  ai_disclosure text not null default 'Adam is WOVO Media''s AI Operations Assistant. A WOVO person can take over when needed.',
  human_escalation_requested boolean not null default false,
  external_action_taken boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not external_action_taken or status = 'scheduled')
);

create index if not exists wovo_ai_creation_jobs_account_created_idx on public.wovo_ai_creation_jobs(account_id, created_at desc);
create index if not exists wovo_ai_creation_jobs_due_idx on public.wovo_ai_creation_jobs(status, next_attempt_at) where status in ('queued', 'failed');
create index if not exists wovo_ai_operator_events_account_idx on public.wovo_ai_operator_events(account_id, created_at desc);
create index if not exists wovo_schedule_requests_account_idx on public.wovo_schedule_requests(account_id, created_at desc);

alter table public.wovo_ai_operators enable row level security;
alter table public.wovo_creative_profiles enable row level security;
alter table public.wovo_ai_creation_jobs enable row level security;
alter table public.wovo_ai_creation_assets enable row level security;
alter table public.wovo_ai_operator_events enable row level security;
alter table public.wovo_integration_connections enable row level security;
alter table public.wovo_schedule_requests enable row level security;

create policy wovo_ai_operators_no_direct_access on public.wovo_ai_operators for all to anon, authenticated using (false) with check (false);
create policy wovo_creative_profiles_no_direct_access on public.wovo_creative_profiles for all to anon, authenticated using (false) with check (false);
create policy wovo_ai_creation_jobs_no_direct_access on public.wovo_ai_creation_jobs for all to anon, authenticated using (false) with check (false);
create policy wovo_ai_creation_assets_no_direct_access on public.wovo_ai_creation_assets for all to anon, authenticated using (false) with check (false);
create policy wovo_ai_operator_events_no_direct_access on public.wovo_ai_operator_events for all to anon, authenticated using (false) with check (false);
create policy wovo_integration_connections_no_direct_access on public.wovo_integration_connections for all to anon, authenticated using (false) with check (false);
create policy wovo_schedule_requests_no_direct_access on public.wovo_schedule_requests for all to anon, authenticated using (false) with check (false);

revoke all on table public.wovo_ai_operators, public.wovo_creative_profiles, public.wovo_ai_creation_jobs,
  public.wovo_ai_creation_assets, public.wovo_ai_operator_events, public.wovo_integration_connections,
  public.wovo_schedule_requests from anon, authenticated;
grant select, insert, update on table public.wovo_ai_operators, public.wovo_creative_profiles, public.wovo_ai_creation_jobs,
  public.wovo_ai_creation_assets, public.wovo_integration_connections, public.wovo_schedule_requests to service_role;
grant select, insert on table public.wovo_ai_operator_events to service_role;
grant usage, select on sequence public.wovo_ai_operator_events_id_seq to service_role;
revoke delete, truncate on table public.wovo_ai_operators, public.wovo_creative_profiles, public.wovo_ai_creation_jobs,
  public.wovo_ai_creation_assets, public.wovo_ai_operator_events, public.wovo_integration_connections,
  public.wovo_schedule_requests from service_role;

comment on table public.wovo_ai_creation_jobs is 'Confirmed, metered tenant creation requests. Provider actions are request-driven and fully audited.';
comment on table public.wovo_integration_connections is 'Connection metadata only. Secret values remain in an external encrypted secret store and are referenced, never stored here.';

create or replace function public.wovo_operator_reserve_creation_job(
  p_job_id uuid,
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
  v_week_used bigint := 0;
  v_job public.wovo_ai_creation_jobs;
  v_usage public.wovo_ai_usage_requests;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operator-credit:' || p_account_id::text, 0));
  select * into v_job from public.wovo_ai_creation_jobs
    where id = p_job_id and account_id = p_account_id and actor_user_id = p_actor_user_id
    for update;
  if not found then raise exception 'Creation job not found'; end if;
  if v_job.status <> 'awaiting_confirmation' then
    if v_job.usage_request_id is not null then
      select * into v_usage from public.wovo_ai_usage_requests where id = v_job.usage_request_id;
      if found then return v_usage; end if;
    end if;
    raise exception 'Creation job is not reservable';
  end if;
  if p_estimated_units < 1 or p_estimated_units > 200 then raise exception 'Per-job credit maximum exceeded'; end if;
  if v_job.estimated_credits <> p_estimated_units then raise exception 'Creation job estimate mismatch'; end if;

  select * into v_policy from public.wovo_ai_usage_policies where account_id = p_account_id for update;
  if not found then raise exception 'Workspace AI policy not configured'; end if;
  select coalesce(sum(coalesce(actual_units, estimated_units)), 0) into v_week_used
    from public.wovo_ai_usage_requests
    where account_id = p_account_id and status in ('reserved', 'completed')
      and reserved_at >= date_trunc('week', now());
  if v_week_used + p_estimated_units > v_policy.weekly_unit_limit then raise exception 'Weekly AI allowance reached'; end if;

  select * into v_usage from private.wovo_ai_reserve_usage(
    p_account_id, p_actor_user_id, p_feature, p_mode, p_estimated_units,
    p_estimated_provider_cost_micros, p_idempotency_key, p_metadata
  );
  update public.wovo_ai_creation_jobs set
    usage_request_id = v_usage.id,
    reserved_credits = v_usage.estimated_units,
    status = 'running', confirmed_at = coalesce(confirmed_at, now()),
    started_at = coalesce(started_at, now()), attempt_count = attempt_count + 1,
    updated_at = now()
  where id = p_job_id;
  return v_usage;
end;
$$;

revoke all on function public.wovo_operator_reserve_creation_job(uuid, uuid, uuid, text, text, integer, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.wovo_operator_reserve_creation_job(uuid, uuid, uuid, text, text, integer, bigint, text, jsonb) to service_role;
