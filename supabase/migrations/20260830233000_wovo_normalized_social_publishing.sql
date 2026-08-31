-- Provider-neutral social authorization and publishing state. Existing Meta
-- tables remain as a compatibility ledger while Facebook/Instagram are moved
-- behind the same adapter contract used by TikTok and YouTube.

create table if not exists public.wovo_social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique check (char_length(state_hash) = 64),
  workspace_id uuid references public.wovo_portal_accounts(id) on delete cascade,
  owner_scope boolean not null default false,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('facebook','instagram','tiktok','youtube')),
  redirect_uri text not null check (char_length(redirect_uri) between 12 and 500),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((owner_scope and workspace_id is null) or (not owner_scope and workspace_id is not null))
);

create table if not exists public.wovo_social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  provider text not null check (provider in ('facebook','instagram','tiktok','youtube')),
  provider_user_id text,
  provider_account_id text not null check (char_length(provider_account_id) between 1 and 240),
  provider_account_name text not null check (char_length(provider_account_name) between 1 and 240),
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  refresh_token_tag text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  status text not null default 'connected' check (status in (
    'connected','publishing_ready','action_required','expired','disconnected',
    'under_review','test_mode','error'
  )),
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_scope and workspace_id is null) or (not owner_scope and workspace_id is not null)),
  check (
    (refresh_token_ciphertext is null and refresh_token_iv is null and refresh_token_tag is null)
    or
    (refresh_token_ciphertext is not null and refresh_token_iv is not null and refresh_token_tag is not null)
  )
);

create unique index if not exists wovo_social_connections_destination_key
  on public.wovo_social_connections (workspace_id, owner_scope, provider, provider_account_id)
  nulls not distinct;

create index if not exists wovo_social_connections_workspace_idx
  on public.wovo_social_connections (workspace_id, owner_scope, status, updated_at desc);

create table if not exists public.wovo_social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  connection_id uuid not null references public.wovo_social_connections(id) on delete restrict,
  provider text not null check (provider in ('facebook','instagram','tiktok','youtube')),
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 220),
  publish_type text not null check (publish_type in ('text','image','video')),
  title text,
  caption text not null default '' check (char_length(caption) <= 5000),
  media_url text,
  media_mime_type text,
  privacy_status text,
  publish_options jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in (
    'draft','approved','queued','uploading','processing','published','failed','canceled'
  )),
  scheduled_for timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  provider_publish_id text,
  provider_post_id text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  last_error_code text,
  last_error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, owner_scope, provider, idempotency_key),
  check ((owner_scope and workspace_id is null) or (not owner_scope and workspace_id is not null)),
  check (publish_type = 'text' or media_url is not null),
  check (status <> 'published' or (published_at is not null and provider_post_id is not null))
);

create index if not exists wovo_social_publish_jobs_due_idx
  on public.wovo_social_publish_jobs (status, scheduled_for)
  where status in ('approved','queued','processing');

create index if not exists wovo_social_publish_jobs_connection_idx
  on public.wovo_social_publish_jobs (connection_id, created_at desc);

create or replace function public.wovo_social_consume_oauth_state(
  p_state_hash text,
  p_provider text
)
returns public.wovo_social_oauth_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.wovo_social_oauth_states;
begin
  select * into v_state
  from public.wovo_social_oauth_states
  where state_hash = p_state_hash
    and provider = p_provider
    and used_at is null
    and expires_at > pg_catalog.now()
  for update;

  if not found then
    raise exception 'OAUTH_STATE_INVALID_OR_EXPIRED';
  end if;

  update public.wovo_social_oauth_states
  set used_at = pg_catalog.now()
  where id = v_state.id
  returning * into v_state;

  return v_state;
end;
$$;

alter table public.wovo_social_oauth_states enable row level security;
alter table public.wovo_social_connections enable row level security;
alter table public.wovo_social_publish_jobs enable row level security;

drop policy if exists wovo_social_oauth_states_no_direct_access on public.wovo_social_oauth_states;
create policy wovo_social_oauth_states_no_direct_access on public.wovo_social_oauth_states
  for all to anon, authenticated using (false) with check (false);
drop policy if exists wovo_social_connections_no_direct_access on public.wovo_social_connections;
create policy wovo_social_connections_no_direct_access on public.wovo_social_connections
  for all to anon, authenticated using (false) with check (false);
drop policy if exists wovo_social_publish_jobs_no_direct_access on public.wovo_social_publish_jobs;
create policy wovo_social_publish_jobs_no_direct_access on public.wovo_social_publish_jobs
  for all to anon, authenticated using (false) with check (false);

revoke all on public.wovo_social_oauth_states, public.wovo_social_connections, public.wovo_social_publish_jobs
  from public, anon, authenticated;
grant select, insert, update, delete on public.wovo_social_oauth_states to service_role;
grant select, insert, update on public.wovo_social_connections, public.wovo_social_publish_jobs to service_role;
revoke delete, truncate on public.wovo_social_connections, public.wovo_social_publish_jobs from service_role;
revoke all on function public.wovo_social_consume_oauth_state(text, text) from public, anon, authenticated;
grant execute on function public.wovo_social_consume_oauth_state(text, text) to service_role;

-- Shadow existing Meta destinations into the normalized connection catalog.
-- The legacy Meta connection id remains the source of truth until its publish
-- jobs have been migrated; no provider call or publishing state changes here.
insert into public.wovo_social_connections (
  workspace_id, owner_scope, provider, provider_user_id, provider_account_id,
  provider_account_name, access_token_ciphertext, access_token_iv, access_token_tag,
  token_expires_at, scopes, status, last_verified_at, last_error_code,
  metadata_json, created_by, disconnected_at, created_at, updated_at
)
select
  account_id, owner_scope, 'facebook', page_id, page_id, page_name,
  token_ciphertext, token_iv, token_tag, token_expires_at, granted_scopes,
  case
    when status = 'healthy' and e2e_verified_at is not null then 'publishing_ready'
    when status = 'healthy' then 'connected'
    when status = 'expired' then 'expired'
    when status = 'revoked' then 'disconnected'
    else 'error'
  end,
  last_checked_at, last_error_code,
  jsonb_build_object('legacy_meta_connection_id', id, 'page_id', page_id),
  connected_by, revoked_at, created_at, updated_at
from public.wovo_meta_connections
on conflict (workspace_id, owner_scope, provider, provider_account_id) do nothing;

insert into public.wovo_social_connections (
  workspace_id, owner_scope, provider, provider_user_id, provider_account_id,
  provider_account_name, access_token_ciphertext, access_token_iv, access_token_tag,
  token_expires_at, scopes, status, last_verified_at, last_error_code,
  metadata_json, created_by, disconnected_at, created_at, updated_at
)
select
  account_id, owner_scope, 'instagram', instagram_user_id, instagram_user_id,
  coalesce(nullif(instagram_username, ''), instagram_user_id),
  token_ciphertext, token_iv, token_tag, token_expires_at, granted_scopes,
  case
    when status = 'healthy' and e2e_verified_at is not null then 'publishing_ready'
    when status = 'healthy' then 'connected'
    when status = 'expired' then 'expired'
    when status = 'revoked' then 'disconnected'
    else 'error'
  end,
  last_checked_at, last_error_code,
  jsonb_build_object(
    'legacy_meta_connection_id', id,
    'facebook_page_id', page_id,
    'instagram_username', instagram_username
  ),
  connected_by, revoked_at, created_at, updated_at
from public.wovo_meta_connections
where instagram_user_id is not null
on conflict (workspace_id, owner_scope, provider, provider_account_id) do nothing;

comment on table public.wovo_social_connections is
  'Server-only normalized social destinations. Provider tokens are AES-GCM encrypted by the application and never returned to clients.';
comment on table public.wovo_social_publish_jobs is
  'Provider-neutral approval and async publishing ledger. Published requires durable provider proof.';
