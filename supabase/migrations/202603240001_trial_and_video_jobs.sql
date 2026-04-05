alter table public.profiles
  add column if not exists trial_uses_total integer not null default 5,
  add column if not exists trial_uses_used integer not null default 0;

update public.profiles
set
  trial_uses_total = coalesce(trial_uses_total, 5),
  trial_uses_used = coalesce(trial_uses_used, 0)
where trial_uses_total is null or trial_uses_used is null;

create table if not exists public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'sora',
  provider_job_id text,
  prompt text not null,
  status text not null default 'queued',
  result_url text,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_user_idx on public.video_jobs (user_id, created_at desc);
create index if not exists video_jobs_provider_idx on public.video_jobs (provider, provider_job_id);

alter table public.video_jobs enable row level security;

drop policy if exists video_jobs_select_own on public.video_jobs;
drop policy if exists video_jobs_insert_own on public.video_jobs;
drop policy if exists video_jobs_update_own on public.video_jobs;

create policy video_jobs_select_own on public.video_jobs
for select to authenticated
using (auth.uid() = user_id);

create policy video_jobs_insert_own on public.video_jobs
for insert to authenticated
with check (auth.uid() = user_id);

create policy video_jobs_update_own on public.video_jobs
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
