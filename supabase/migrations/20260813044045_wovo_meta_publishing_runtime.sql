-- Official Meta OAuth and publishing runtime. Provider credentials and tokens
-- remain server-only; browser roles cannot query these tables directly.

create table public.wovo_meta_oauth_states (
  state_hash text primary key check (char_length(state_hash) = 64),
  account_id uuid references public.wovo_portal_accounts(id) on delete cascade,
  owner_scope boolean not null default false,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null))
);

create table public.wovo_meta_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  connected_by uuid not null references auth.users(id) on delete restrict,
  app_id text not null check (char_length(app_id) between 8 and 40),
  status text not null default 'healthy' check (status in ('healthy','degraded','expired','revoked')),
  action_policy text not null default 'approve_each' check (action_policy in ('draft_only','approve_each','scheduled_auto_publish')),
  page_id text not null check (char_length(page_id) between 3 and 80),
  page_name text not null check (char_length(page_name) between 1 and 180),
  instagram_user_id text,
  instagram_username text,
  granted_scopes text[] not null default '{}'::text[],
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  token_expires_at timestamptz,
  kill_switch boolean not null default true,
  last_checked_at timestamptz not null default now(),
  last_action_at timestamptz,
  last_error_code text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (account_id, owner_scope),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null))
);

create table public.wovo_meta_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  connection_id uuid not null references public.wovo_meta_connections(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 220),
  destination text not null check (destination in ('facebook_page','instagram')),
  status text not null default 'draft' check (status in ('draft','approved','queued','publishing','published','failed','canceled')),
  caption text not null check (char_length(caption) between 1 and 5000),
  media_url text,
  scheduled_for timestamptz,
  approved_at timestamptz,
  provider_post_id text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  last_error_code text,
  last_error_summary text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (account_id, owner_scope, idempotency_key),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null)),
  check (destination <> 'instagram' or media_url is not null),
  check (status <> 'published' or published_at is not null)
);

create index wovo_meta_oauth_states_expiry_idx on public.wovo_meta_oauth_states(expires_at) where used_at is null;
create index wovo_meta_publish_jobs_due_idx on public.wovo_meta_publish_jobs(status, scheduled_for) where status in ('approved','queued','failed');
create index wovo_meta_publish_jobs_account_idx on public.wovo_meta_publish_jobs(account_id, created_at desc);

alter table public.wovo_meta_oauth_states enable row level security;
alter table public.wovo_meta_connections enable row level security;
alter table public.wovo_meta_publish_jobs enable row level security;

create policy wovo_meta_oauth_states_no_direct_access on public.wovo_meta_oauth_states for all to anon, authenticated using (false) with check (false);
create policy wovo_meta_connections_no_direct_access on public.wovo_meta_connections for all to anon, authenticated using (false) with check (false);
create policy wovo_meta_publish_jobs_no_direct_access on public.wovo_meta_publish_jobs for all to anon, authenticated using (false) with check (false);

revoke all on public.wovo_meta_oauth_states, public.wovo_meta_connections, public.wovo_meta_publish_jobs from anon, authenticated;
grant select, insert, update, delete on public.wovo_meta_oauth_states to service_role;
grant select, insert, update on public.wovo_meta_connections, public.wovo_meta_publish_jobs to service_role;
revoke delete, truncate on public.wovo_meta_connections, public.wovo_meta_publish_jobs from service_role;

comment on table public.wovo_meta_connections is 'Tenant-scoped official Meta connection. Page tokens are encrypted in the application layer and never returned to browser clients.';
comment on table public.wovo_meta_publish_jobs is 'Idempotent approval-aware Meta publishing state. A published state requires a real provider post ID.';
