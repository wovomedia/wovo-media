-- Owner operations controls remain server-mediated. No authenticated role receives
-- direct mutation grants for cross-tenant administration.

alter table public.wovo_portal_accounts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.wovo_portal_content_items
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.wovo_portal_assets
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.wovo_public_inquiries
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create table if not exists public.wovo_portal_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'archive',
      'restore',
      'assign_case',
      'change_case_status',
      'grant_access',
      'revoke_access',
      'create_client_invite',
      'resend_client_invite',
      'revoke_client_invite'
    )
  ),
  target_type text not null check (
    target_type in ('workspace', 'content', 'asset', 'inquiry', 'thread', 'access_grant', 'client_invite')
  ),
  target_id uuid not null,
  target_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_access_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  grant_type text not null check (grant_type in ('test', 'trial', 'staff_assisted')),
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wovo_portal_access_grants_valid_window check (expires_at > starts_at)
);

create table if not exists public.wovo_portal_client_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wovo_portal_client_invites_pending_email_idx
  on public.wovo_portal_client_invites (lower(invited_email))
  where status = 'pending';

create table if not exists public.wovo_portal_posting_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  content_item_id uuid not null unique references public.wovo_portal_content_items(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'canceled')),
  assigned_role text not null default 'support' check (
    assigned_role in ('owner', 'admin', 'manager', 'video_editor', 'website_designer', 'support')
  ),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.wovo_queue_manual_posting_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is null
     and new.scheduled_for is not null
     and new.status in ('approved', 'queued') then
    insert into public.wovo_portal_posting_tasks (
      account_id,
      content_item_id,
      title,
      due_at
    )
    values (
      new.account_id,
      new.id,
      new.title,
      new.scheduled_for
    )
    on conflict (content_item_id) do update
      set title = excluded.title,
          due_at = excluded.due_at,
          status = case
            when wovo_portal_posting_tasks.status = 'completed' then 'completed'
            else 'pending'
          end,
          updated_at = now();
  elsif tg_op = 'UPDATE' and (
    new.archived_at is not null
    or new.scheduled_for is null
    or new.status not in ('approved', 'queued')
  ) then
    update public.wovo_portal_posting_tasks
      set status = case when status = 'completed' then status else 'canceled' end,
          updated_at = now()
      where content_item_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists wovo_queue_manual_posting_task on public.wovo_portal_content_items;
create trigger wovo_queue_manual_posting_task
after insert or update of status, scheduled_for, archived_at, title
on public.wovo_portal_content_items
for each row execute function public.wovo_queue_manual_posting_task();

insert into public.wovo_portal_posting_tasks (account_id, content_item_id, title, due_at)
select account_id, id, title, scheduled_for
from public.wovo_portal_content_items
where archived_at is null
  and scheduled_for is not null
  and status in ('approved', 'queued')
on conflict (content_item_id) do nothing;

create index if not exists wovo_portal_accounts_archived_created_idx
  on public.wovo_portal_accounts (archived_at, created_at desc);
create index if not exists wovo_portal_admin_audit_target_idx
  on public.wovo_portal_admin_audit (target_type, target_id, created_at desc);
create index if not exists wovo_portal_access_grants_account_active_idx
  on public.wovo_portal_access_grants (account_id, expires_at desc)
  where revoked_at is null;
create index if not exists wovo_portal_posting_tasks_status_due_idx
  on public.wovo_portal_posting_tasks (status, due_at);

alter table public.wovo_portal_admin_audit enable row level security;
alter table public.wovo_portal_access_grants enable row level security;
alter table public.wovo_portal_client_invites enable row level security;
alter table public.wovo_portal_posting_tasks enable row level security;

revoke all on table public.wovo_portal_admin_audit from anon, authenticated;
revoke all on table public.wovo_portal_access_grants from anon, authenticated;
revoke all on table public.wovo_portal_client_invites from anon, authenticated;
revoke all on table public.wovo_portal_posting_tasks from anon, authenticated;
revoke execute on function public.wovo_queue_manual_posting_task() from public, anon, authenticated;
