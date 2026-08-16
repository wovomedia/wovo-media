-- Adam sender controls, compliant outreach event ledger, and per-tenant Meta
-- publication verification. Every table is server-only and fail-closed.

alter table public.wovo_adam_integrations
  drop constraint if exists wovo_adam_integrations_integration_key_check;
alter table public.wovo_adam_integrations
  add constraint wovo_adam_integrations_integration_key_check
  check (integration_key in (
    'openai', 'stripe', 'supabase', 'vercel', 'resend', 'google_mail',
    'meta', 'github', 'calendar', 'analytics', 'search_console', 'cloudflare', 'calendly'
  ));

alter table public.wovo_adam_campaign_drafts
  drop constraint if exists wovo_adam_campaign_drafts_sender_address_check;
alter table public.wovo_adam_campaign_drafts
  drop constraint if exists wovo_adam_campaign_drafts_launch_enabled_check;

update public.wovo_adam_campaign_drafts
set
  sender_identity = 'Adam at WOVO Media',
  sender_address = 'adam@wovomedia.com',
  sender_signature = E'Adam Carter | AI COO / Operations Assistant, WOVO Media\nAI-assisted representative\nhttps://wovomedia.com\nhttps://wovomedia.com/contact',
  ai_assistance_disclosure = 'Sent by Adam Carter, WOVO Media''s AI COO / Operations Assistant. Adam is an AI-generated representative, not a human employee.',
  launch_enabled = false,
  updated_at = now();

alter table public.wovo_adam_campaign_drafts
  alter column sender_identity set default 'Adam at WOVO Media',
  alter column sender_address set default 'adam@wovomedia.com',
  alter column sender_signature set default E'Adam Carter | AI COO / Operations Assistant, WOVO Media\nAI-assisted representative\nhttps://wovomedia.com\nhttps://wovomedia.com/contact',
  alter column ai_assistance_disclosure set default 'Sent by Adam Carter, WOVO Media''s AI COO / Operations Assistant. Adam is an AI-generated representative, not a human employee.',
  add constraint wovo_adam_campaign_drafts_sender_address_check
    check (sender_address = 'adam@wovomedia.com');

alter table public.wovo_adam_campaign_drafts
  add column if not exists sender_domain_verified_at timestamptz,
  add column if not exists webhook_verified_at timestamptz,
  add column if not exists unsubscribe_verified_at timestamptz,
  add column if not exists test_delivery_verified_at timestamptz,
  add column if not exists reply_handling_verified_at timestamptz,
  add column if not exists kill_switch boolean not null default true,
  add column if not exists daily_rate_limit integer not null default 5 check (daily_rate_limit between 1 and 25),
  add column if not exists daily_spend_cap_cents integer not null default 100 check (daily_spend_cap_cents between 1 and 2500),
  add column if not exists sent_count integer not null default 0 check (sent_count >= 0),
  add column if not exists delivered_count integer not null default 0 check (delivered_count >= 0),
  add column if not exists bounced_count integer not null default 0 check (bounced_count >= 0),
  add column if not exists complained_count integer not null default 0 check (complained_count >= 0),
  add column if not exists unsubscribed_count integer not null default 0 check (unsubscribed_count >= 0),
  add column if not exists replied_count integer not null default 0 check (replied_count >= 0);

alter table public.wovo_adam_campaign_drafts
  add constraint wovo_adam_campaign_launch_gate_check check (
    launch_enabled = false or (
      sender_authorized and audience_approved and template_approved and
      compliance_reviewed and rate_policy_approved and
      sender_domain_verified_at is not null and webhook_verified_at is not null and
      unsubscribe_verified_at is not null and test_delivery_verified_at is not null and
      reply_handling_verified_at is not null and kill_switch = false
    )
  );

create table if not exists public.wovo_adam_mail_connections (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  provider text not null check (provider in ('google_oauth', 'resend')),
  sender_address text not null check (sender_address = 'adam@wovomedia.com'),
  status text not null default 'pending' check (status in ('pending','healthy','degraded','revoked')),
  granted_scopes text[] not null default '{}'::text[],
  token_ciphertext text,
  token_iv text,
  token_tag text,
  token_expires_at timestamptz,
  domain_verified_at timestamptz,
  spf_verified_at timestamptz,
  dkim_verified_at timestamptz,
  dmarc_verified_at timestamptz,
  last_checked_at timestamptz,
  last_sent_at timestamptz,
  last_error_code text,
  revoked_at timestamptz,
  connected_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, provider),
  check (
    provider <> 'google_oauth' or
    status <> 'healthy' or
    (token_ciphertext is not null and token_iv is not null and token_tag is not null and
     granted_scopes @> array['https://www.googleapis.com/auth/gmail.send']::text[])
  )
);

create table if not exists public.wovo_adam_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  campaign_id uuid not null references public.wovo_adam_campaign_drafts(id) on delete restrict,
  lead_id uuid not null references public.wovo_adam_leads(id) on delete restrict,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null check (char_length(idempotency_key) between 12 and 220),
  recipient_email text not null,
  recipient_hash text not null check (char_length(recipient_hash) = 64),
  source_url text not null,
  source_retrieved_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','delayed','bounced','complained','unsubscribed','replied','failed','canceled')),
  provider text not null default 'resend' check (provider in ('resend','google_oauth')),
  provider_message_id text,
  unsubscribe_token_hash text not null check (char_length(unsubscribe_token_hash) = 64),
  estimated_cost_micros integer not null default 0 check (estimated_cost_micros >= 0),
  actual_cost_micros integer check (actual_cost_micros is null or actual_cost_micros >= 0),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  replied_at timestamptz,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, idempotency_key),
  unique (provider, provider_message_id),
  unique (unsubscribe_token_hash),
  check (status not in ('sent','delivered','delayed','bounced','complained','replied') or provider_message_id is not null),
  check (status <> 'delivered' or delivered_at is not null),
  check (status <> 'unsubscribed' or unsubscribed_at is not null),
  check (status <> 'replied' or replied_at is not null)
);

create table if not exists public.wovo_adam_outreach_webhook_events (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  message_id uuid references public.wovo_adam_outreach_messages(id) on delete restrict,
  provider text not null check (provider in ('resend','google_oauth')),
  provider_event_id text not null,
  event_type text not null,
  provider_message_id text,
  event_created_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists wovo_adam_outreach_due_idx
  on public.wovo_adam_outreach_messages (status, created_at)
  where status in ('queued','delayed');
create index if not exists wovo_adam_outreach_campaign_idx
  on public.wovo_adam_outreach_messages (campaign_id, created_at desc);
create index if not exists wovo_adam_outreach_recipient_idx
  on public.wovo_adam_outreach_messages (adam_workspace_id, recipient_hash);

alter table public.wovo_adam_mail_connections enable row level security;
alter table public.wovo_adam_outreach_messages enable row level security;
alter table public.wovo_adam_outreach_webhook_events enable row level security;

create policy wovo_adam_mail_connections_no_direct_access
  on public.wovo_adam_mail_connections for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_outreach_messages_no_direct_access
  on public.wovo_adam_outreach_messages for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_outreach_webhooks_no_direct_access
  on public.wovo_adam_outreach_webhook_events for all to anon, authenticated using (false) with check (false);

revoke all on public.wovo_adam_mail_connections, public.wovo_adam_outreach_messages, public.wovo_adam_outreach_webhook_events from anon, authenticated;
grant select, insert, update on public.wovo_adam_mail_connections, public.wovo_adam_outreach_messages to service_role;
grant select, insert on public.wovo_adam_outreach_webhook_events to service_role;
revoke delete, truncate on public.wovo_adam_mail_connections, public.wovo_adam_outreach_messages, public.wovo_adam_outreach_webhook_events from service_role;

drop trigger if exists wovo_adam_outreach_webhooks_immutable on public.wovo_adam_outreach_webhook_events;
create trigger wovo_adam_outreach_webhooks_immutable
before update or delete on public.wovo_adam_outreach_webhook_events
for each row execute function public.wovo_adam_reject_immutable_change();

alter table public.wovo_meta_connections
  add column if not exists e2e_verified_at timestamptz,
  add column if not exists e2e_verified_provider_post_id text,
  add column if not exists auto_publish_opted_in_at timestamptz;

alter table public.wovo_meta_connections
  add constraint wovo_meta_client_auto_publish_verification_check check (
    owner_scope or action_policy <> 'scheduled_auto_publish' or
    (e2e_verified_at is not null and e2e_verified_provider_post_id is not null and auto_publish_opted_in_at is not null)
  );

alter table public.wovo_meta_publish_jobs
  add column if not exists normalized_caption_hash text,
  add column if not exists topic_hash text,
  add column if not exists creative_hash text,
  add column if not exists content_format text not null default 'single_image'
    check (content_format in ('text','single_image','carousel','reel','story'));

alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_caption_hash_format_check
    check (normalized_caption_hash is null or char_length(normalized_caption_hash) = 64),
  add constraint wovo_meta_topic_hash_format_check
    check (topic_hash is null or char_length(topic_hash) = 64),
  add constraint wovo_meta_creative_hash_format_check
    check (creative_hash is null or char_length(creative_hash) = 64);

create unique index if not exists wovo_meta_publish_unique_caption_idx
  on public.wovo_meta_publish_jobs (
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    owner_scope,
    destination,
    normalized_caption_hash
  ) where normalized_caption_hash is not null and status <> 'canceled';

create index if not exists wovo_meta_publish_content_ledger_idx
  on public.wovo_meta_publish_jobs (account_id, owner_scope, scheduled_for desc, created_at desc);

comment on column public.wovo_meta_publish_jobs.normalized_caption_hash is 'Server-calculated duplicate guard over normalized caption text.';
comment on column public.wovo_meta_publish_jobs.topic_hash is 'Server-calculated topic/pillar fingerprint used to surface repeat collisions for rewrite.';

comment on table public.wovo_adam_mail_connections is 'Owner-only sender authorization metadata. OAuth refresh tokens are application-encrypted; raw passwords are forbidden.';
comment on table public.wovo_adam_outreach_messages is 'Private, idempotent outreach delivery ledger. Sending remains fail-closed until every campaign launch gate is verified.';
comment on table public.wovo_adam_outreach_webhook_events is 'Append-only verified provider event ledger used for delivery, bounce, complaint, unsubscribe, and reply accounting.';
comment on column public.wovo_meta_connections.e2e_verified_at is 'Set only after this tenant connection returns a real provider post identifier.';
