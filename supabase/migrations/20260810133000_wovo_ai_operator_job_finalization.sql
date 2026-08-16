-- Atomically reconcile creation-job state with the authoritative usage ledger.
-- These service-only functions make provider retries durable: provider failures
-- release reservations exactly once, while persistence failures leave a running
-- job resumable under the same provider idempotency key.

create or replace function public.wovo_operator_complete_creation_job(
  p_job_id uuid,
  p_account_id uuid,
  p_actual_units integer,
  p_actual_provider_cost_micros bigint,
  p_provider_request_id text,
  p_result_text text,
  p_result_manifest jsonb default '{}'::jsonb
) returns public.wovo_ai_creation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.wovo_ai_creation_jobs;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operator-complete:' || p_job_id::text, 0));
  select * into v_job from public.wovo_ai_creation_jobs
    where id = p_job_id and account_id = p_account_id for update;
  if not found then raise exception 'Creation job not found'; end if;
  if v_job.status = 'completed' then return v_job; end if;
  if v_job.status <> 'running' or v_job.usage_request_id is null then
    raise exception 'Creation job is not ready to complete';
  end if;
  if p_actual_units < 0 or p_actual_units > v_job.estimated_credits then
    raise exception 'Actual units exceed the job reservation';
  end if;
  if p_actual_provider_cost_micros < 0 then raise exception 'Invalid provider cost'; end if;
  if coalesce(char_length(p_provider_request_id), 0) < 3 then raise exception 'Provider request reference required'; end if;
  if coalesce(char_length(p_result_text), 0) < 1 then raise exception 'Draft output required'; end if;

  perform private.wovo_ai_finalize_usage(
    v_job.usage_request_id,
    p_actual_units,
    p_actual_provider_cost_micros,
    p_provider_request_id
  );

  update public.wovo_ai_creation_jobs set
    status = 'completed',
    result_text = p_result_text,
    result_manifest = coalesce(p_result_manifest, '{}'::jsonb),
    actual_cost_micros = p_actual_provider_cost_micros,
    provider_request_id = p_provider_request_id,
    error_code = null,
    error_summary = null,
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = p_job_id
  returning * into v_job;
  return v_job;
end;
$$;

create or replace function public.wovo_operator_fail_creation_job(
  p_job_id uuid,
  p_account_id uuid,
  p_error_code text default 'PROVIDER_REQUEST_FAILED'
) returns public.wovo_ai_creation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.wovo_ai_creation_jobs;
  v_code text := left(coalesce(nullif(p_error_code, ''), 'PROVIDER_REQUEST_FAILED'), 120);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('operator-fail:' || p_job_id::text, 0));
  select * into v_job from public.wovo_ai_creation_jobs
    where id = p_job_id and account_id = p_account_id for update;
  if not found then raise exception 'Creation job not found'; end if;
  if v_job.status in ('completed', 'failed', 'canceled') then return v_job; end if;
  if v_job.usage_request_id is not null then
    perform private.wovo_ai_release_usage(v_job.usage_request_id, v_code);
  end if;
  update public.wovo_ai_creation_jobs set
    status = 'failed',
    reserved_credits = 0,
    error_code = v_code,
    error_summary = 'Generation failed safely; no external action occurred and reserved credits were returned.',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = p_job_id
  returning * into v_job;
  return v_job;
end;
$$;

revoke all on function public.wovo_operator_complete_creation_job(uuid, uuid, integer, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.wovo_operator_fail_creation_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.wovo_operator_complete_creation_job(uuid, uuid, integer, bigint, text, text, jsonb) to service_role;
grant execute on function public.wovo_operator_fail_creation_job(uuid, uuid, text) to service_role;
