-- WOVO Cartoon Episodes is a separately billed, tenant-scoped production
-- subscription. It creates three short episode drafts per week for client
-- review. Publishing is a separate provider-authorized action.

alter table public.wovo_portal_entitlements
  drop constraint if exists wovo_portal_entitlements_entitlement_key_check;
alter table public.wovo_portal_entitlements
  add constraint wovo_portal_entitlements_entitlement_key_check
  check (entitlement_key in (
    'ai_dm_manager', 'website_hosting', 'personal_ai_assistant',
    'wovo_code', 'ai_operator', 'cartoon_series'
  ));

create table if not exists public.wovo_cartoon_series (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.wovo_portal_accounts(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null default 'My WOVO Cartoon' check (char_length(title) between 2 and 120),
  character_name text not null default '' check (char_length(character_name) <= 100),
  character_description text not null default '' check (char_length(character_description) <= 3000),
  audience text not null default '' check (char_length(audience) <= 1000),
  series_goal text not null default '' check (char_length(series_goal) <= 1500),
  style_direction text not null default '' check (char_length(style_direction) <= 1500),
  do_not_include text not null default '' check (char_length(do_not_include) <= 1500),
  timezone text not null default 'America/Chicago' check (char_length(timezone) between 3 and 80),
  episode_days smallint[] not null default array[1,3,5]::smallint[],
  local_generation_hour smallint not null default 8 check (local_generation_hour between 0 and 23),
  episodes_per_week smallint not null default 3 check (episodes_per_week = 3),
  delivery_format text not null default 'short_video_8s' check (delivery_format = 'short_video_8s'),
  review_policy text not null default 'review_before_publish' check (review_policy = 'review_before_publish'),
  source_rights_confirmed boolean not null default false,
  likeness_consent_confirmed boolean not null default false,
  voice_consent_confirmed boolean not null default false,
  identifiable_person_included boolean not null default false,
  auto_generate_enabled boolean not null default false,
  kill_switch boolean not null default false,
  status text not null default 'setup' check (status in ('setup','active','paused','billing_required','archived')),
  last_generated_slot date,
  next_generation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(episode_days) = 3),
  check (episode_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (not identifiable_person_included or likeness_consent_confirmed),
  check (not auto_generate_enabled or (source_rights_confirmed and status = 'active' and not kill_switch))
);

create table if not exists public.wovo_cartoon_episode_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  series_id uuid not null references public.wovo_cartoon_series(id) on delete restrict,
  slot_date date not null,
  correlation_id uuid not null default gen_random_uuid(),
  status text not null default 'queued' check (status in (
    'queued','writing','video_queued','video_rendering','draft_ready',
    'needs_approval','approved','scheduled','published','failed','blocked','archived'
  )),
  episode_number integer not null check (episode_number > 0),
  title text,
  premise text,
  script text,
  storyboard jsonb not null default '[]'::jsonb check (jsonb_typeof(storyboard) = 'array'),
  caption text,
  image_prompt text,
  video_prompt text,
  provider text,
  provider_model text,
  provider_video_id text,
  provider_request_id text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 104857600),
  estimated_cost_micros bigint not null default 850000 check (estimated_cost_micros between 0 and 5000000),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros between 0 and 5000000),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_summary text,
  generated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, slot_date),
  unique (series_id, episode_number),
  check (status <> 'published' or published_at is not null)
);

create index if not exists wovo_cartoon_series_due_idx
  on public.wovo_cartoon_series(status, next_generation_at)
  where status = 'active' and auto_generate_enabled and not kill_switch;
create index if not exists wovo_cartoon_episode_jobs_account_created_idx
  on public.wovo_cartoon_episode_jobs(account_id, created_at desc);
create index if not exists wovo_cartoon_episode_jobs_provider_idx
  on public.wovo_cartoon_episode_jobs(status, next_attempt_at)
  where status in ('queued','writing','video_queued','video_rendering','failed');

alter table public.wovo_cartoon_series enable row level security;
alter table public.wovo_cartoon_episode_jobs enable row level security;

create policy wovo_cartoon_series_no_direct_access
  on public.wovo_cartoon_series for all to anon, authenticated
  using (false) with check (false);
create policy wovo_cartoon_episode_jobs_no_direct_access
  on public.wovo_cartoon_episode_jobs for all to anon, authenticated
  using (false) with check (false);

revoke all on table public.wovo_cartoon_series, public.wovo_cartoon_episode_jobs from anon, authenticated;
grant select, insert, update on table public.wovo_cartoon_series, public.wovo_cartoon_episode_jobs to service_role;
revoke delete, truncate on table public.wovo_cartoon_series, public.wovo_cartoon_episode_jobs from service_role;

comment on table public.wovo_cartoon_series is
  'Tenant-scoped three-times-weekly short cartoon production policy. External publishing remains separately authorized.';
comment on table public.wovo_cartoon_episode_jobs is
  'Idempotent episode production records with provider status, private asset location, review state, and cost telemetry.';
