-- Durable, tenant-scoped fal music jobs with the same reserve/finalize/refund
-- guarantees as paid image and video creation.

alter table public.wovo_ai_usage_requests
  drop constraint if exists wovo_ai_usage_requests_feature_check;
alter table public.wovo_ai_usage_requests
  add constraint wovo_ai_usage_requests_feature_check
  check (feature in ('chat', 'image_visual', 'video', 'music', 'website_page', 'product_page', 'code'));

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

  if p_feature not in ('chat', 'image_visual', 'video', 'music', 'website_page', 'product_page', 'code') then raise exception 'Invalid AI feature'; end if;
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
        and (e.current_period_end is null or e.current_period_end > pg_catalog.now())
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
    and reserved_at >= pg_catalog.date_trunc('day', pg_catalog.now());

  select count(*) into v_minute_requests
  from public.wovo_ai_usage_requests
  where actor_user_id = p_actor_user_id and status in ('reserved', 'completed')
    and reserved_at >= pg_catalog.now() - interval '1 minute';

  if v_policy.requests_per_minute <= 0 or v_minute_requests >= v_policy.requests_per_minute then raise exception 'AI rate limit reached'; end if;
  if v_policy.daily_unit_limit <= 0 or v_day_used + p_estimated_units > v_policy.daily_unit_limit then raise exception 'Daily AI allowance reached'; end if;
  if v_policy.monthly_provider_cost_cap_micros <= 0 or v_cost_used + p_estimated_provider_cost_micros > v_policy.monthly_provider_cost_cap_micros then raise exception 'Workspace AI spend cap reached'; end if;

  select coalesce(sum(units_granted), 0) into v_grant_units
  from public.wovo_ai_quota_grants
  where account_id = p_account_id and revoked_at is null and expires_at > pg_catalog.now();
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
      pg_catalog.jsonb_build_object('feature', p_feature, 'mode', p_mode, 'reservation', true)
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

create table if not exists public.wovo_music_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  usage_request_id uuid references public.wovo_ai_usage_requests(id) on delete set null,
  provider text not null default 'fal' check (provider = 'fal'),
  provider_job_id text,
  model text not null,
  quality text not null check (quality in ('economy', 'premium')),
  prompt text not null check (char_length(prompt) between 3 and 3000),
  duration_seconds integer not null check (duration_seconds between 30 and 190),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  result_url text,
  storage_path text,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wovo_music_jobs_account_created_idx
  on public.wovo_music_jobs(account_id, created_at desc);
create unique index if not exists wovo_music_jobs_usage_request_unique_idx
  on public.wovo_music_jobs(usage_request_id) where usage_request_id is not null;
create unique index if not exists wovo_music_jobs_provider_job_unique_idx
  on public.wovo_music_jobs(provider, provider_job_id) where provider_job_id is not null;

alter table public.wovo_music_jobs enable row level security;
revoke all on table public.wovo_music_jobs from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.wovo_music_jobs from service_role;
grant select, insert, update on table public.wovo_music_jobs to service_role;

create or replace function public.wovo_music_create_reserved_job(
  p_job_id uuid,
  p_account_id uuid,
  p_actor_user_id uuid,
  p_prompt text,
  p_model text,
  p_quality text,
  p_duration_seconds integer,
  p_estimated_units integer,
  p_estimated_provider_cost_micros bigint,
  p_payload jsonb default '{}'::jsonb
) returns public.wovo_music_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.wovo_music_jobs;
  v_usage public.wovo_ai_usage_requests;
  v_job public.wovo_music_jobs;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wovo-music-job:' || p_job_id::text, 0));
  select * into v_existing from public.wovo_music_jobs where id = p_job_id;
  if found then
    if v_existing.user_id <> p_actor_user_id or v_existing.account_id <> p_account_id then raise exception 'Music job identity mismatch'; end if;
    return v_existing;
  end if;
  if p_quality not in ('economy', 'premium') then raise exception 'Invalid music quality'; end if;
  if p_duration_seconds < 30 or p_duration_seconds > 190 then raise exception 'Invalid music duration'; end if;
  if not exists (select 1 from public.wovo_portal_accounts a where a.id = p_account_id and a.archived_at is null) then raise exception 'Music workspace is unavailable'; end if;
  if not exists (select 1 from public.wovo_portal_accounts a where a.id = p_account_id and a.owner_user_id = p_actor_user_id)
     and not exists (select 1 from public.wovo_portal_members m where m.account_id = p_account_id and m.user_id = p_actor_user_id and m.active = true)
     and not exists (select 1 from public.wovo_portal_staff s where s.user_id = p_actor_user_id and s.active = true) then
    raise exception 'User is not authorized for this account';
  end if;

  select * into v_usage from private.wovo_ai_reserve_usage(
    p_account_id, p_actor_user_id, 'music', case when p_quality = 'premium' then 'premium' else 'fast' end,
    p_estimated_units, p_estimated_provider_cost_micros, 'music-job:' || p_job_id::text,
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object('job_id', p_job_id)
  );

  insert into public.wovo_music_jobs(
    id, user_id, account_id, usage_request_id, provider, model, quality, prompt,
    duration_seconds, status, result_payload
  ) values (
    p_job_id, p_actor_user_id, p_account_id, v_usage.id, 'fal', p_model, p_quality,
    pg_catalog.btrim(p_prompt), p_duration_seconds, 'queued',
    coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object(
      'usageRequestId', v_usage.id,
      'quotedCredits', p_estimated_units,
      'estimatedProviderCostMicros', p_estimated_provider_cost_micros,
      'ownerExempt', false
    )
  ) returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.wovo_music_fail_job(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_error_code text default 'music_provider_failed'
) returns public.wovo_music_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.wovo_music_jobs;
begin
  select * into v_job from public.wovo_music_jobs where id = p_job_id for update;
  if not found then raise exception 'Music job not found'; end if;
  if v_job.user_id <> p_actor_user_id then raise exception 'Music job identity mismatch'; end if;
  if v_job.status = 'completed' then return v_job; end if;
  if v_job.usage_request_id is not null then
    perform private.wovo_ai_release_usage(v_job.usage_request_id, pg_catalog.left(coalesce(p_error_code, 'music_provider_failed'), 120));
  end if;
  update public.wovo_music_jobs
  set status = 'failed', error = pg_catalog.left(coalesce(p_error_code, 'music_provider_failed'), 120),
      result_payload = result_payload || pg_catalog.jsonb_build_object('meteringStatus', 'released'), updated_at = pg_catalog.now()
  where id = p_job_id returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.wovo_music_complete_job(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_result_url text,
  p_storage_path text,
  p_payload jsonb default '{}'::jsonb
) returns public.wovo_music_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.wovo_music_jobs;
  v_usage public.wovo_ai_usage_requests;
begin
  select * into v_job from public.wovo_music_jobs where id = p_job_id for update;
  if not found then raise exception 'Music job not found'; end if;
  if v_job.user_id <> p_actor_user_id then raise exception 'Music job identity mismatch'; end if;
  if v_job.status = 'completed' then return v_job; end if;
  if v_job.status = 'failed' then raise exception 'Failed music job cannot be completed'; end if;
  if v_job.usage_request_id is null or v_job.provider_job_id is null then raise exception 'Music job is missing metering or provider proof'; end if;
  select * into v_usage from public.wovo_ai_usage_requests where id = v_job.usage_request_id;
  if not found then raise exception 'Music usage reservation not found'; end if;
  perform private.wovo_ai_finalize_usage(v_job.usage_request_id, v_usage.estimated_units, v_usage.estimated_provider_cost_micros, v_job.provider_job_id);
  update public.wovo_music_jobs
  set status = 'completed', result_url = p_result_url, storage_path = p_storage_path, error = null,
      result_payload = result_payload || coalesce(p_payload, '{}'::jsonb) || pg_catalog.jsonb_build_object('providerCompleted', true, 'meteringStatus', 'completed'),
      updated_at = pg_catalog.now()
  where id = p_job_id returning * into v_job;
  return v_job;
end;
$$;

revoke all on function public.wovo_music_create_reserved_job(uuid, uuid, uuid, text, text, text, integer, integer, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.wovo_music_fail_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.wovo_music_complete_job(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.wovo_music_create_reserved_job(uuid, uuid, uuid, text, text, text, integer, integer, bigint, jsonb) to service_role;
grant execute on function public.wovo_music_fail_job(uuid, uuid, text) to service_role;
grant execute on function public.wovo_music_complete_job(uuid, uuid, text, text, jsonb) to service_role;

comment on table public.wovo_music_jobs is 'Server-managed fal music generation ledger with private storage and credit reservation proof.';
