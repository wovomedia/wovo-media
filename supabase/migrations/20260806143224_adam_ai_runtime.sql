-- Metered, owner-only OpenAI runtime for Adam. Direct browser access is denied;
-- all requests pass through the owner-authorized server route.

create table if not exists public.wovo_adam_ai_policies (
  adam_workspace_id uuid primary key references public.wovo_adam_workspaces(id) on delete restrict,
  enabled boolean not null default true,
  model_id text not null default 'gpt-5.6-luna' check (model_id in ('gpt-5.6-luna')),
  monthly_cost_cap_micros bigint not null default 5000000 check (monthly_cost_cap_micros between 1000000 and 9000000),
  monthly_request_cap integer not null default 300 check (monthly_request_cap between 1 and 1000),
  daily_request_cap integer not null default 40 check (daily_request_cap between 1 and 100),
  hourly_request_cap integer not null default 12 check (hourly_request_cap between 1 and 30),
  max_output_tokens integer not null default 600 check (max_output_tokens between 200 and 800),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_ai_requests (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 180),
  request_kind text not null check (request_kind in ('owner_chat', 'daily_report_draft', 'support_draft', 'outreach_draft', 'content_draft')),
  model_id text not null,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed', 'blocked')),
  estimated_cost_micros bigint not null check (estimated_cost_micros between 0 and 9000000),
  actual_cost_micros bigint,
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  prompt_sha256 text check (prompt_sha256 is null or char_length(prompt_sha256) = 64),
  output_sha256 text check (output_sha256 is null or char_length(output_sha256) = 64),
  provider_request_id text,
  error_code text,
  correlation_id uuid not null default gen_random_uuid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (adam_workspace_id, idempotency_key)
);

create table if not exists public.wovo_adam_chat_messages (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  conversation_id uuid not null,
  request_id uuid references public.wovo_adam_ai_requests(id) on delete restrict,
  role text not null check (role in ('owner', 'adam')),
  message_kind text not null default 'operations' check (message_kind in ('operations', 'support_draft', 'outreach_draft', 'content_draft')),
  content text not null check (char_length(content) between 1 and 12000),
  external_action_taken boolean not null default false check (external_action_taken = false),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wovo_adam_daily_reports
  add column if not exists ai_narrative text,
  add column if not exists ai_request_id uuid references public.wovo_adam_ai_requests(id) on delete restrict;

create index if not exists wovo_adam_ai_requests_budget_idx
  on public.wovo_adam_ai_requests (adam_workspace_id, created_at desc, status);
create index if not exists wovo_adam_chat_conversation_idx
  on public.wovo_adam_chat_messages (adam_workspace_id, conversation_id, created_at);

alter table public.wovo_adam_ai_policies enable row level security;
alter table public.wovo_adam_ai_requests enable row level security;
alter table public.wovo_adam_chat_messages enable row level security;

create policy wovo_adam_ai_policies_no_direct_access on public.wovo_adam_ai_policies
  for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_ai_requests_no_direct_access on public.wovo_adam_ai_requests
  for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_chat_messages_no_direct_access on public.wovo_adam_chat_messages
  for all to anon, authenticated using (false) with check (false);

revoke all on table public.wovo_adam_ai_policies, public.wovo_adam_ai_requests, public.wovo_adam_chat_messages from anon, authenticated;
grant select, insert, update on table public.wovo_adam_ai_policies, public.wovo_adam_ai_requests, public.wovo_adam_chat_messages to service_role;
revoke delete, truncate on table public.wovo_adam_ai_policies, public.wovo_adam_ai_requests, public.wovo_adam_chat_messages from service_role;

create or replace function public.wovo_adam_reserve_ai_request(
  p_workspace_id uuid,
  p_owner_user_id uuid,
  p_idempotency_key text,
  p_request_kind text,
  p_model_id text,
  p_estimated_cost_micros bigint,
  p_prompt_sha256 text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.wovo_adam_ai_policies%rowtype;
  v_existing uuid;
  v_month_start timestamptz := date_trunc('month', now());
  v_spend bigint;
  v_requests integer;
  v_request_id uuid;
begin
  if not exists (
    select 1 from public.wovo_adam_workspaces
    where id = p_workspace_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'ADAM_OWNER_SCOPE_DENIED';
  end if;

  select id into v_existing from public.wovo_adam_ai_requests
  where adam_workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select * into v_policy from public.wovo_adam_ai_policies
  where adam_workspace_id = p_workspace_id for update;
  if not found or not v_policy.enabled then raise exception 'ADAM_AI_DISABLED'; end if;
  if p_model_id <> v_policy.model_id then raise exception 'ADAM_MODEL_NOT_ALLOWED'; end if;

  select count(*) into v_requests from public.wovo_adam_ai_requests
  where adam_workspace_id = p_workspace_id and created_at >= now() - interval '1 hour' and status in ('reserved', 'completed');
  if v_requests >= v_policy.hourly_request_cap then raise exception 'ADAM_HOURLY_LIMIT'; end if;
  select count(*) into v_requests from public.wovo_adam_ai_requests
  where adam_workspace_id = p_workspace_id and created_at >= date_trunc('day', now()) and status in ('reserved', 'completed');
  if v_requests >= v_policy.daily_request_cap then raise exception 'ADAM_DAILY_LIMIT'; end if;
  select count(*) into v_requests from public.wovo_adam_ai_requests
  where adam_workspace_id = p_workspace_id and created_at >= v_month_start and status in ('reserved', 'completed');
  if v_requests >= v_policy.monthly_request_cap then raise exception 'ADAM_MONTHLY_REQUEST_LIMIT'; end if;

  select coalesce(sum(case when status = 'completed' then actual_cost_micros else estimated_cost_micros end), 0)
  into v_spend from public.wovo_adam_ai_requests
  where adam_workspace_id = p_workspace_id and created_at >= v_month_start and status in ('reserved', 'completed');
  if v_spend + p_estimated_cost_micros > v_policy.monthly_cost_cap_micros then raise exception 'ADAM_MONTHLY_SPEND_LIMIT'; end if;

  insert into public.wovo_adam_ai_requests (
    adam_workspace_id, owner_user_id, idempotency_key, request_kind, model_id,
    estimated_cost_micros, prompt_sha256
  ) values (
    p_workspace_id, p_owner_user_id, p_idempotency_key, p_request_kind, p_model_id,
    p_estimated_cost_micros, p_prompt_sha256
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.wovo_adam_complete_ai_request(
  p_request_id uuid,
  p_owner_user_id uuid,
  p_actual_cost_micros bigint,
  p_input_tokens integer,
  p_cached_input_tokens integer,
  p_output_tokens integer,
  p_reasoning_tokens integer,
  p_output_sha256 text,
  p_provider_request_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wovo_adam_ai_requests r
  set status = 'completed', actual_cost_micros = p_actual_cost_micros,
      input_tokens = p_input_tokens, cached_input_tokens = p_cached_input_tokens,
      output_tokens = p_output_tokens, reasoning_tokens = p_reasoning_tokens,
      output_sha256 = p_output_sha256, provider_request_id = left(p_provider_request_id, 200),
      completed_at = now()
  where r.id = p_request_id and r.owner_user_id = p_owner_user_id and r.status = 'reserved';
  if not found then raise exception 'ADAM_REQUEST_COMPLETE_DENIED'; end if;
end;
$$;

create or replace function public.wovo_adam_fail_ai_request(
  p_request_id uuid,
  p_owner_user_id uuid,
  p_error_code text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wovo_adam_ai_requests r
  set status = 'failed', error_code = left(p_error_code, 120), completed_at = now()
  where r.id = p_request_id and r.owner_user_id = p_owner_user_id and r.status = 'reserved';
end;
$$;

revoke all on function public.wovo_adam_reserve_ai_request(uuid, uuid, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.wovo_adam_complete_ai_request(uuid, uuid, bigint, integer, integer, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.wovo_adam_fail_ai_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.wovo_adam_reserve_ai_request(uuid, uuid, text, text, text, bigint, text) to service_role;
grant execute on function public.wovo_adam_complete_ai_request(uuid, uuid, bigint, integer, integer, integer, integer, text, text) to service_role;
grant execute on function public.wovo_adam_fail_ai_request(uuid, uuid, text) to service_role;

insert into public.wovo_adam_ai_policies (adam_workspace_id, updated_by)
select id, owner_user_id from public.wovo_adam_workspaces
on conflict (adam_workspace_id) do nothing;

comment on table public.wovo_adam_ai_policies is 'Owner-controlled Adam AI limits. The database hard-caps monthly spend below USD 10.';
comment on table public.wovo_adam_ai_requests is 'Content-free OpenAI usage telemetry. Stores token/cost totals and hashes, never prompt or response bodies.';
comment on table public.wovo_adam_chat_messages is 'Owner-only Adam conversation history. External action is database-constrained false.';
