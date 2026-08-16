-- WOVO Media client portal MVP.
-- All portal objects are deliberately namespaced so this release does not touch
-- legacy WOVO AI tables or unrelated products in the same Supabase project.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.wovo_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  contact_email text not null check (char_length(contact_email) between 3 and 320),
  business_name text not null check (char_length(business_name) between 2 and 120),
  business_type text not null check (business_type in ('restaurant', 'realtor', 'contractor', 'local_business', 'other')),
  website_url text,
  location text not null check (char_length(location) between 2 and 240),
  timezone text not null default 'America/Chicago',
  brand_voice text,
  audience text,
  goals text,
  posting_cadence_per_week integer not null default 3 check (posting_cadence_per_week between 1 and 7),
  preferred_platforms text[] not null default '{}'::text[],
  asset_rights_confirmed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.wovo_portal_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'video_editor', 'website_designer', 'support')),
  active boolean not null default true,
  display_label text not null default 'WOVO team',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'client_owner')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create or replace function private.wovo_portal_is_staff()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.wovo_portal_staff staff
      where staff.user_id = auth.uid()
        and staff.active = true
    );
$$;

create or replace function private.wovo_portal_has_account_access(account_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.wovo_portal_members member
        where member.account_id = account_uuid
          and member.user_id = auth.uid()
          and member.active = true
      )
      or exists (
        select 1
        from public.wovo_portal_staff staff
        where staff.user_id = auth.uid()
          and staff.active = true
      )
    );
$$;

revoke all on function private.wovo_portal_is_staff() from public, anon;
revoke all on function private.wovo_portal_has_account_access(uuid) from public, anon;
grant execute on function private.wovo_portal_is_staff() to authenticated;
grant execute on function private.wovo_portal_has_account_access(uuid) to authenticated;

create table if not exists public.wovo_portal_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  consent_type text not null check (consent_type in ('asset_rights', 'property_marketing_rights', 'likeness', 'voice')),
  subject_name text,
  confirmation text not null check (char_length(confirmation) between 10 and 1000),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.wovo_portal_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime')),
  size_bytes integer not null check (size_bytes between 1 and 104857600),
  asset_kind text not null default 'brand' check (asset_kind in ('brand', 'property', 'menu', 'project', 'reference')),
  rights_confirmed boolean not null default false,
  people_consent_confirmed boolean not null default false,
  consent_id uuid references public.wovo_portal_consents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_content_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  caption text not null check (char_length(caption) between 1 and 5000),
  platform text not null check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'google_business', 'other')),
  content_type text not null default 'social_post' check (content_type in ('social_post', 'special', 'property_marketing', 'project_update')),
  scheduled_for timestamptz,
  status text not null default 'client_review' check (status in ('idea', 'draft', 'client_review', 'revision_requested', 'approved', 'queued', 'manual_posted', 'canceled')),
  asset_id uuid references public.wovo_portal_assets(id) on delete set null,
  source_rights_confirmed boolean not null default false,
  ai_generated boolean not null default false,
  ai_provider text,
  ai_model text,
  client_feedback text,
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  external_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('consultation', 'shoot', 'content_deadline')),
  title text not null check (char_length(title) between 2 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  status text not null default 'requested' check (status in ('requested', 'pending_addon', 'confirmed', 'completed', 'canceled')),
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  meeting_provider text check (meeting_provider is null or meeting_provider in ('google_meet', 'zoom', 'microsoft_teams', 'other')),
  meeting_url text,
  participant_count integer not null default 1 check (participant_count between 1 and 10),
  extra_participants_paid boolean not null default false,
  travel_distance_miles numeric(8,2),
  travel_rate_cents_per_mile integer,
  travel_estimate_cents integer,
  travel_estimate_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    travel_estimate_cents is null
    or (travel_distance_miles is not null and travel_rate_cents_per_mile is not null)
  )
);

create table if not exists public.wovo_portal_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  case_reference text not null unique default ('WOVO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  subject text not null default 'WOVO team inbox',
  status text not null default 'open' check (status in ('open', 'waiting_on_client', 'in_progress', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  assigned_role text check (assigned_role is null or assigned_role in ('owner', 'admin', 'manager', 'video_editor', 'website_designer', 'support')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id)
);

create table if not exists public.wovo_portal_thread_assignments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.wovo_portal_threads(id) on delete cascade,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_staff_user_id uuid references auth.users(id) on delete set null,
  assigned_role text check (assigned_role is null or assigned_role in ('owner', 'admin', 'manager', 'video_editor', 'website_designer', 'support')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.wovo_portal_threads(id) on delete cascade,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'client' check (visibility in ('client', 'internal')),
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  order_type text not null check (order_type in ('website', 'ad_video', 'shoot', 'drone', 'extra_participant')),
  status text not null default 'requested' check (status in ('requested', 'quote_required', 'checkout_pending', 'paid', 'in_progress', 'fulfilled', 'canceled', 'refunded')),
  description text,
  location text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  related_event_id uuid references public.wovo_portal_events(id) on delete set null,
  requested_for timestamptz,
  staff_approved_at timestamptz,
  compliance_checked_at timestamptz,
  compliance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_subscriptions (
  account_id uuid primary key references public.wovo_portal_accounts(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wovo_portal_accounts(id) on delete cascade,
  notification_type text not null check (notification_type in ('new_client', 'content_ready', 'content_approved', 'support_message', 'consultation_requested', 'addon_requested', 'payment_received')),
  title text not null,
  body text,
  target_role text check (target_role is null or target_role in ('admin', 'manager', 'video_editor', 'website_designer', 'support')),
  related_table text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_portal_stripe_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists wovo_portal_members_user_idx on public.wovo_portal_members(user_id, account_id);
create index if not exists wovo_portal_content_account_schedule_idx on public.wovo_portal_content_items(account_id, scheduled_for);
create index if not exists wovo_portal_content_status_idx on public.wovo_portal_content_items(status, scheduled_for);
create index if not exists wovo_portal_events_account_start_idx on public.wovo_portal_events(account_id, starts_at);
create index if not exists wovo_portal_messages_thread_created_idx on public.wovo_portal_messages(thread_id, created_at);
create index if not exists wovo_portal_thread_assignments_thread_created_idx on public.wovo_portal_thread_assignments(thread_id, created_at desc);
create index if not exists wovo_portal_orders_account_status_idx on public.wovo_portal_orders(account_id, status);
create index if not exists wovo_portal_notifications_created_idx on public.wovo_portal_notifications(created_at desc);

alter table public.wovo_portal_accounts enable row level security;
alter table public.wovo_portal_staff enable row level security;
alter table public.wovo_portal_members enable row level security;
alter table public.wovo_portal_consents enable row level security;
alter table public.wovo_portal_assets enable row level security;
alter table public.wovo_portal_content_items enable row level security;
alter table public.wovo_portal_events enable row level security;
alter table public.wovo_portal_threads enable row level security;
alter table public.wovo_portal_messages enable row level security;
alter table public.wovo_portal_thread_assignments enable row level security;
alter table public.wovo_portal_orders enable row level security;
alter table public.wovo_portal_subscriptions enable row level security;
alter table public.wovo_portal_notifications enable row level security;
alter table public.wovo_portal_stripe_events enable row level security;

create policy wovo_portal_accounts_select
on public.wovo_portal_accounts for select to authenticated
using ((select private.wovo_portal_has_account_access(id)));

create policy wovo_portal_staff_select_own
on public.wovo_portal_staff for select to authenticated
using (user_id = (select auth.uid()));

create policy wovo_portal_members_select
on public.wovo_portal_members for select to authenticated
using (user_id = (select auth.uid()) or (select private.wovo_portal_is_staff()));

create policy wovo_portal_consents_select
on public.wovo_portal_consents for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_assets_select
on public.wovo_portal_assets for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_content_select
on public.wovo_portal_content_items for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_events_select
on public.wovo_portal_events for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_threads_select
on public.wovo_portal_threads for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_messages_select
on public.wovo_portal_messages for select to authenticated
using (
  (select private.wovo_portal_has_account_access(account_id))
  and (visibility = 'client' or (select private.wovo_portal_is_staff()))
);

create policy wovo_portal_thread_assignments_staff_select
on public.wovo_portal_thread_assignments for select to authenticated
using ((select private.wovo_portal_is_staff()));

create policy wovo_portal_orders_select
on public.wovo_portal_orders for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_subscriptions_select
on public.wovo_portal_subscriptions for select to authenticated
using ((select private.wovo_portal_has_account_access(account_id)));

create policy wovo_portal_notifications_staff_select
on public.wovo_portal_notifications for select to authenticated
using ((select private.wovo_portal_is_staff()));

revoke all on
  public.wovo_portal_accounts,
  public.wovo_portal_staff,
  public.wovo_portal_members,
  public.wovo_portal_consents,
  public.wovo_portal_assets,
  public.wovo_portal_content_items,
  public.wovo_portal_events,
  public.wovo_portal_threads,
  public.wovo_portal_messages,
  public.wovo_portal_thread_assignments,
  public.wovo_portal_orders,
  public.wovo_portal_subscriptions,
  public.wovo_portal_notifications,
  public.wovo_portal_stripe_events
from anon, authenticated;

grant select on
  public.wovo_portal_accounts,
  public.wovo_portal_staff,
  public.wovo_portal_members,
  public.wovo_portal_consents,
  public.wovo_portal_assets,
  public.wovo_portal_content_items,
  public.wovo_portal_events,
  public.wovo_portal_threads,
  public.wovo_portal_messages,
  public.wovo_portal_thread_assignments,
  public.wovo_portal_orders,
  public.wovo_portal_subscriptions,
  public.wovo_portal_notifications
to authenticated;

revoke all on public.wovo_portal_stripe_events from anon, authenticated;

create policy wovo_portal_stripe_events_no_client_access
on public.wovo_portal_stripe_events for all to anon, authenticated
using (false)
with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wovo-portal-assets',
  'wovo-portal-assets',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy wovo_portal_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'wovo-portal-assets'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and (select private.wovo_portal_has_account_access(((storage.foldername(name))[1])::uuid))
);

create policy wovo_portal_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wovo-portal-assets'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and (select private.wovo_portal_has_account_access(((storage.foldername(name))[1])::uuid))
);

create policy wovo_portal_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'wovo-portal-assets'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and (select private.wovo_portal_has_account_access(((storage.foldername(name))[1])::uuid))
)
with check (
  bucket_id = 'wovo-portal-assets'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and (select private.wovo_portal_has_account_access(((storage.foldername(name))[1])::uuid))
);

create policy wovo_portal_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'wovo-portal-assets'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and (select private.wovo_portal_has_account_access(((storage.foldername(name))[1])::uuid))
);
