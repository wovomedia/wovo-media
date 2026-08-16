-- Owner composer and unified publishing audit foundation.
-- Draft creation does not require a provider connection. Provider delivery
-- remains fail-closed until an approved job is bound to a healthy connection.

alter table public.wovo_meta_publish_jobs
  alter column connection_id drop not null,
  add column if not exists title text,
  add column if not exists topic text,
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists source text not null default 'adam'
    check (source in ('adam', 'manual', 'scheduled_automation')),
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists canceled_by uuid references auth.users(id) on delete set null,
  add column if not exists canceled_at timestamptz,
  add column if not exists rights_confirmed boolean not null default false;

alter table public.wovo_meta_publish_jobs
  drop constraint if exists wovo_meta_publish_jobs_connection_required_check;
alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_publish_jobs_connection_required_check check (
    status in ('draft', 'approved', 'canceled') or connection_id is not null
  );

update public.wovo_meta_publish_jobs
set approved_by = coalesce(approved_by, created_by),
    approved_at = coalesce(approved_at, created_at)
where status not in ('draft', 'canceled');

update public.wovo_meta_publish_jobs
set canceled_by = coalesce(canceled_by, created_by),
    canceled_at = coalesce(canceled_at, updated_at, created_at)
where status = 'canceled';

alter table public.wovo_meta_publish_jobs
  drop constraint if exists wovo_meta_publish_jobs_approval_actor_check;
alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_publish_jobs_approval_actor_check check (
    status in ('draft', 'canceled') or (approved_at is not null and approved_by is not null)
  );

alter table public.wovo_meta_publish_jobs
  drop constraint if exists wovo_meta_publish_jobs_cancel_metadata_check;
alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_publish_jobs_cancel_metadata_check check (
    (status = 'canceled' and canceled_at is not null and canceled_by is not null)
    or (status <> 'canceled' and canceled_at is null)
  );

create table if not exists public.wovo_publishing_revisions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('meta_job', 'content_item')),
  source_id uuid not null,
  account_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('created', 'edited', 'approved', 'scheduled', 'canceled', 'published', 'failed')),
  version integer not null check (version > 0),
  snapshot jsonb not null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, version),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null))
);

create index if not exists wovo_publishing_revisions_source_idx
  on public.wovo_publishing_revisions(source_type, source_id, version desc);
create index if not exists wovo_publishing_revisions_account_idx
  on public.wovo_publishing_revisions(account_id, created_at desc);

alter table public.wovo_publishing_revisions enable row level security;
revoke all on public.wovo_publishing_revisions from anon, authenticated;
grant select, insert on public.wovo_publishing_revisions to service_role;
revoke update, delete, truncate on public.wovo_publishing_revisions from service_role;

drop policy if exists wovo_publishing_revisions_no_direct_access on public.wovo_publishing_revisions;
create policy wovo_publishing_revisions_no_direct_access
  on public.wovo_publishing_revisions for all to anon, authenticated
  using (false) with check (false);

comment on table public.wovo_publishing_revisions is
  'Append-only owner publishing history. Browser roles have no direct access; server policy enforces tenant and owner scope.';
comment on column public.wovo_meta_publish_jobs.connection_id is
  'May be null for a local draft/approval/canceled item. Queueing or delivery requires a real tenant-scoped Meta connection.';
