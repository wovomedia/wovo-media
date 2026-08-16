-- Approval-first, tenant-scoped content calendar.
-- An approval is an immutable snapshot. Changing the approved content or time
-- requires revocation and a new approval before it can be queued/published.

alter table public.wovo_portal_content_items
  add column if not exists creative_brief text,
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists platform_variant jsonb not null default '{}'::jsonb,
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists series_key text,
  add column if not exists recurrence_rule text,
  add column if not exists approval_version integer not null default 0,
  add column if not exists approved_snapshot_id uuid,
  add column if not exists approval_revoked_at timestamptz,
  add column if not exists approval_revoked_by uuid references auth.users(id) on delete set null;

create table if not exists public.wovo_portal_content_approvals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  content_item_id uuid not null references public.wovo_portal_content_items(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  approval_version integer not null check (approval_version > 0),
  approval_scope text not null default 'item' check (approval_scope in ('item', 'date_range')),
  range_start timestamptz,
  range_end timestamptz,
  title_snapshot text not null,
  caption_snapshot text not null,
  platform_snapshot text not null,
  content_type_snapshot text not null,
  scheduled_for_snapshot timestamptz,
  asset_id_snapshot uuid,
  source_rights_confirmed_snapshot boolean not null,
  creative_brief_snapshot text,
  hashtags_snapshot text[] not null default '{}'::text[],
  platform_variant_snapshot jsonb not null default '{}'::jsonb,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (content_item_id, approval_version),
  check ((range_start is null and range_end is null) or (range_start is not null and range_end is not null and range_end >= range_start)),
  check (revocation_reason is null or char_length(revocation_reason) <= 500)
);

alter table public.wovo_portal_content_items
  drop constraint if exists wovo_portal_content_items_approved_snapshot_id_fkey;
alter table public.wovo_portal_content_items
  add constraint wovo_portal_content_items_approved_snapshot_id_fkey
  foreign key (approved_snapshot_id) references public.wovo_portal_content_approvals(id) on delete restrict;

create unique index if not exists wovo_content_approvals_one_active_idx
  on public.wovo_portal_content_approvals(content_item_id)
  where revoked_at is null;
create index if not exists wovo_content_approvals_account_time_idx
  on public.wovo_portal_content_approvals(account_id, approved_at desc);

create or replace function public.wovo_validate_content_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.wovo_portal_content_approvals;
begin
  if new.scheduled_for is not null and new.status not in ('canceled') and exists (
    select 1
    from public.wovo_portal_content_items other
    where other.account_id = new.account_id
      and other.platform = new.platform
      and other.scheduled_for = new.scheduled_for
      and other.id <> new.id
      and other.archived_at is null
      and other.status not in ('canceled')
  ) then
    raise exception 'A post for this platform is already scheduled at that exact time';
  end if;

  if new.status in ('approved', 'queued', 'manual_posted') then
    if new.approved_snapshot_id is null then
      raise exception 'An active approval snapshot is required before queueing or publishing';
    end if;
    select * into v_approval
    from public.wovo_portal_content_approvals
    where id = new.approved_snapshot_id
      and account_id = new.account_id
      and content_item_id = new.id
      and revoked_at is null;
    if not found
       or v_approval.title_snapshot is distinct from new.title
       or v_approval.caption_snapshot is distinct from new.caption
       or v_approval.platform_snapshot is distinct from new.platform
       or v_approval.content_type_snapshot is distinct from new.content_type
       or v_approval.scheduled_for_snapshot is distinct from new.scheduled_for
       or v_approval.asset_id_snapshot is distinct from new.asset_id
       or v_approval.source_rights_confirmed_snapshot is distinct from new.source_rights_confirmed
       or v_approval.creative_brief_snapshot is distinct from new.creative_brief
       or v_approval.hashtags_snapshot is distinct from new.hashtags
       or v_approval.platform_variant_snapshot is distinct from new.platform_variant then
      raise exception 'Content changed after approval; revoke and approve the new version';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wovo_validate_content_approval on public.wovo_portal_content_items;
create trigger wovo_validate_content_approval
before insert or update on public.wovo_portal_content_items
for each row execute function public.wovo_validate_content_approval();

create or replace function public.wovo_protect_content_approval_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Approval snapshots are retained for audit';
  end if;
  if old.account_id is distinct from new.account_id
     or old.content_item_id is distinct from new.content_item_id
     or old.approved_by is distinct from new.approved_by
     or old.approved_at is distinct from new.approved_at
     or old.approval_version is distinct from new.approval_version
     or old.approval_scope is distinct from new.approval_scope
     or old.range_start is distinct from new.range_start
     or old.range_end is distinct from new.range_end
     or old.title_snapshot is distinct from new.title_snapshot
     or old.caption_snapshot is distinct from new.caption_snapshot
     or old.platform_snapshot is distinct from new.platform_snapshot
     or old.content_type_snapshot is distinct from new.content_type_snapshot
     or old.scheduled_for_snapshot is distinct from new.scheduled_for_snapshot
     or old.asset_id_snapshot is distinct from new.asset_id_snapshot
     or old.source_rights_confirmed_snapshot is distinct from new.source_rights_confirmed_snapshot
     or old.creative_brief_snapshot is distinct from new.creative_brief_snapshot
     or old.hashtags_snapshot is distinct from new.hashtags_snapshot
     or old.platform_variant_snapshot is distinct from new.platform_variant_snapshot
     or old.correlation_id is distinct from new.correlation_id
     or old.created_at is distinct from new.created_at then
    raise exception 'Approval snapshot fields are immutable';
  end if;
  if old.revoked_at is not null and (new.revoked_at is distinct from old.revoked_at or new.revoked_by is distinct from old.revoked_by or new.revocation_reason is distinct from old.revocation_reason) then
    raise exception 'A revoked approval cannot be changed';
  end if;
  if old.revoked_at is null and new.revoked_at is null and (new.revoked_by is not null or new.revocation_reason is not null) then
    raise exception 'Revocation metadata requires revoked_at';
  end if;
  return new;
end;
$$;

drop trigger if exists wovo_protect_content_approval_snapshot on public.wovo_portal_content_approvals;
create trigger wovo_protect_content_approval_snapshot
before update or delete on public.wovo_portal_content_approvals
for each row execute function public.wovo_protect_content_approval_snapshot();

create or replace function public.wovo_approve_content_item(
  p_account_id uuid,
  p_content_item_id uuid,
  p_approved_by uuid,
  p_approval_scope text default 'item',
  p_range_start timestamptz default null,
  p_range_end timestamptz default null,
  p_correlation_id uuid default gen_random_uuid()
) returns public.wovo_portal_content_approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wovo_portal_content_items;
  v_existing public.wovo_portal_content_approvals;
  v_approval public.wovo_portal_content_approvals;
  v_version integer;
begin
  if p_approval_scope not in ('item', 'date_range') then raise exception 'Invalid approval scope'; end if;
  if p_approval_scope = 'date_range' and (p_range_start is null or p_range_end is null or p_range_end < p_range_start) then
    raise exception 'A valid approval date range is required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_content_item_id::text, 0));
  select * into v_item
  from public.wovo_portal_content_items
  where id = p_content_item_id and account_id = p_account_id and archived_at is null
  for update;
  if not found then raise exception 'Content item not found'; end if;
  if v_item.status not in ('draft', 'client_review', 'revision_requested', 'approved') then
    raise exception 'Content is not eligible for approval';
  end if;
  if v_item.content_type = 'property_marketing' and not v_item.source_rights_confirmed then
    raise exception 'Property content requires a recorded rights confirmation';
  end if;
  select * into v_existing
  from public.wovo_portal_content_approvals
  where content_item_id = p_content_item_id and revoked_at is null
  limit 1;
  if found then return v_existing; end if;

  select coalesce(max(approval_version), 0) + 1 into v_version
  from public.wovo_portal_content_approvals
  where content_item_id = p_content_item_id;

  insert into public.wovo_portal_content_approvals (
    account_id, content_item_id, approved_by, approval_version, approval_scope,
    range_start, range_end, title_snapshot, caption_snapshot, platform_snapshot,
    content_type_snapshot, scheduled_for_snapshot, asset_id_snapshot,
    source_rights_confirmed_snapshot, creative_brief_snapshot, hashtags_snapshot,
    platform_variant_snapshot, correlation_id
  ) values (
    v_item.account_id, v_item.id, p_approved_by, v_version, p_approval_scope,
    p_range_start, p_range_end, v_item.title, v_item.caption, v_item.platform,
    v_item.content_type, v_item.scheduled_for, v_item.asset_id,
    v_item.source_rights_confirmed, v_item.creative_brief, v_item.hashtags,
    v_item.platform_variant, p_correlation_id
  ) returning * into v_approval;

  update public.wovo_portal_content_items
  set status = 'approved',
      approved_snapshot_id = v_approval.id,
      approval_version = v_version,
      approval_revoked_at = null,
      approval_revoked_by = null,
      updated_at = now()
  where id = v_item.id;
  return v_approval;
end;
$$;

create or replace function public.wovo_revoke_content_approval(
  p_account_id uuid,
  p_content_item_id uuid,
  p_revoked_by uuid,
  p_reason text
) returns public.wovo_portal_content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wovo_portal_content_items;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_content_item_id::text, 0));
  select * into v_item
  from public.wovo_portal_content_items
  where id = p_content_item_id and account_id = p_account_id and archived_at is null
  for update;
  if not found then raise exception 'Content item not found'; end if;
  if v_item.approved_snapshot_id is null then raise exception 'Content has no active approval'; end if;

  update public.wovo_portal_content_approvals
  set revoked_at = now(), revoked_by = p_revoked_by, revocation_reason = left(coalesce(nullif(trim(p_reason), ''), 'Approval revoked for revision'), 500)
  where id = v_item.approved_snapshot_id and revoked_at is null;

  update public.wovo_portal_content_items
  set status = 'client_review',
      approved_snapshot_id = null,
      approval_revoked_at = now(),
      approval_revoked_by = p_revoked_by,
      updated_at = now()
  where id = v_item.id
  returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.wovo_approve_content_item(uuid, uuid, uuid, text, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.wovo_approve_content_item(uuid, uuid, uuid, text, timestamptz, timestamptz, uuid) to service_role;
revoke all on function public.wovo_revoke_content_approval(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.wovo_revoke_content_approval(uuid, uuid, uuid, text) to service_role;

-- Preserve already-approved launch data by recording its exact current state as
-- a legacy-import snapshot; do not silently demote or discard client decisions.
insert into public.wovo_portal_content_approvals (
  account_id, content_item_id, approved_by, approval_version, approval_scope,
  title_snapshot, caption_snapshot, platform_snapshot, content_type_snapshot,
  scheduled_for_snapshot, asset_id_snapshot, source_rights_confirmed_snapshot,
  creative_brief_snapshot, hashtags_snapshot, platform_variant_snapshot
)
select
  item.account_id, item.id, item.created_by, greatest(item.approval_version, 1), 'item',
  item.title, item.caption, item.platform, item.content_type, item.scheduled_for,
  item.asset_id, item.source_rights_confirmed, item.creative_brief, item.hashtags,
  item.platform_variant
from public.wovo_portal_content_items item
where item.status in ('approved', 'queued', 'manual_posted')
  and item.approved_snapshot_id is null
on conflict (content_item_id, approval_version) do nothing;

update public.wovo_portal_content_items item
set approved_snapshot_id = approval.id,
    approval_version = approval.approval_version,
    updated_at = item.updated_at
from public.wovo_portal_content_approvals approval
where approval.content_item_id = item.id
  and approval.revoked_at is null
  and item.status in ('approved', 'queued', 'manual_posted')
  and item.approved_snapshot_id is null;

alter table public.wovo_portal_content_approvals enable row level security;
revoke all on public.wovo_portal_content_approvals from anon, authenticated;
drop policy if exists wovo_content_approvals_no_direct_access on public.wovo_portal_content_approvals;
create policy wovo_content_approvals_no_direct_access on public.wovo_portal_content_approvals
  for all to anon, authenticated using (false) with check (false);

comment on table public.wovo_portal_content_approvals is
  'Append-only tenant content approval snapshots. Revocation is retained; approved content must exactly match its active snapshot.';
