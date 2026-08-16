-- Server-only Meta inbox event storage. Public and authenticated browser roles
-- cannot read sender identifiers, messages, comments, or provider payloads.

create table public.wovo_meta_inbox_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.wovo_meta_connections(id) on delete restrict,
  account_id uuid references public.wovo_portal_accounts(id) on delete restrict,
  owner_scope boolean not null default false,
  provider text not null check (provider in ('facebook','instagram')),
  event_kind text not null check (event_kind in ('comment','message','mention','unknown')),
  provider_event_id text not null check (char_length(provider_event_id) between 3 and 300),
  provider_sender_id text,
  sender_label text,
  body text check (body is null or char_length(body) <= 20000),
  parent_provider_id text,
  status text not null default 'new' check (status in ('new','triaged','needs_human','draft_ready','replied','ignored')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check ((owner_scope and account_id is null) or (not owner_scope and account_id is not null))
);

create index wovo_meta_inbox_events_queue_idx
  on public.wovo_meta_inbox_events(status, received_at desc)
  where status in ('new','triaged','needs_human','draft_ready');
create index wovo_meta_inbox_events_tenant_idx
  on public.wovo_meta_inbox_events(account_id, received_at desc);

alter table public.wovo_meta_inbox_events enable row level security;
create policy wovo_meta_inbox_events_no_direct_access
  on public.wovo_meta_inbox_events for all to anon, authenticated
  using (false) with check (false);

revoke all on public.wovo_meta_inbox_events from anon, authenticated;
grant select, insert, update on public.wovo_meta_inbox_events to service_role;
revoke delete, truncate on public.wovo_meta_inbox_events from service_role;

comment on table public.wovo_meta_inbox_events is
  'Tenant-scoped Facebook and Instagram comment/message events received through signature-verified Meta webhooks. Server-only; no raw provider secrets.';
