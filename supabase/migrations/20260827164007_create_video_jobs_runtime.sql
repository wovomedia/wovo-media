create table if not exists public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_job_id text,
  prompt text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  result_url text,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_user_idx
  on public.video_jobs (user_id, created_at desc);

create unique index if not exists video_jobs_provider_job_unique_idx
  on public.video_jobs (provider, provider_job_id)
  where provider_job_id is not null;

create unique index if not exists video_jobs_workspace_preview_unique_idx
  on public.video_jobs ((result_payload ->> 'previewAccountId'))
  where result_payload ->> 'workspacePreview' = 'true'
    and result_payload ->> 'previewAccountId' is not null;

alter table public.video_jobs enable row level security;

revoke all on table public.video_jobs from public, anon, authenticated;
revoke delete, truncate, references, trigger on table public.video_jobs from service_role;
grant select, insert, update on table public.video_jobs to service_role;

comment on table public.video_jobs is
  'Server-managed, tenant-scoped AI video render ledger. Browser roles have no direct table access.';
