-- Adam is WOVO Media's owner-only operating system. These records are never
-- exposed directly to client roles; all access flows through an owner-checked
-- server route using the service role.

create table if not exists public.wovo_adam_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null default 'WOVO Media',
  current_objective text not null default 'Build a reliable, secure operating rhythm for WOVO Media.',
  operating_mode text not null default 'approval_first' check (operating_mode in ('approval_first')),
  weekly_report_day smallint not null default 1 check (weekly_report_day between 0 and 6),
  owner_timezone text not null default 'America/Chicago',
  daily_report_enabled boolean not null default true,
  daily_report_hour smallint not null default 8 check (daily_report_hour between 0 and 23),
  retention_days integer not null default 730 check (retention_days between 30 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.wovo_adam_goals (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  horizon text not null default 'quarter' check (horizon in ('week', 'month', 'quarter', 'year')),
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'achieved', 'archived')),
  success_measure text,
  target_value numeric,
  current_value numeric,
  target_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_tasks (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  goal_id uuid references public.wovo_adam_goals(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text,
  task_type text not null default 'internal_improvement' check (task_type in (
    'internal_improvement', 'support_draft', 'content_draft', 'seo_recommendation',
    'lead_research_draft', 'outreach_campaign_draft', 'proposal_draft', 'deployment_proposal', 'weekly_report'
  )),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '',
  status text not null default 'queued' check (status in (
    'queued', 'in_progress', 'blocked', 'needs_approval', 'completed', 'failed', 'dead_letter', 'archived'
  )),
  priority smallint not null default 3 check (priority between 1 and 5),
  requires_approval boolean not null default true,
  due_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_summary text,
  input_data jsonb not null default '{}'::jsonb check (jsonb_typeof(input_data) = 'object'),
  result_data jsonb not null default '{}'::jsonb check (jsonb_typeof(result_data) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_at timestamptz,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, idempotency_key)
);

create table if not exists public.wovo_adam_approvals (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  task_id uuid references public.wovo_adam_tasks(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  action_type text not null check (action_type in (
    'external_communication', 'publishing', 'billing_change', 'pricing_change',
    'code_deployment', 'outbound_action', 'internal_change'
  )),
  title text not null check (char_length(title) between 3 and 180),
  summary text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  proposed_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'executed', 'archived')),
  requested_by uuid references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict,
  decision_note text,
  decided_at timestamptz,
  expires_at timestamptz,
  executed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_memory_items (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  category text not null check (category in ('company_fact', 'policy', 'decision', 'goal_context', 'operating_rule', 'market_context', 'integration_context')),
  title text not null check (char_length(title) between 3 and 180),
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  current_version integer not null default 1 check (current_version > 0),
  retention_until date,
  source_url text,
  source_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_memory_versions (
  id uuid primary key default gen_random_uuid(),
  memory_item_id uuid not null references public.wovo_adam_memory_items(id) on delete restrict,
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null,
  content text not null check (char_length(content) between 1 and 20000),
  change_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (memory_item_id, version_number)
);

create table if not exists public.wovo_adam_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  snapshot_key text not null,
  metric_key text not null,
  metric_label text not null,
  value_numeric numeric,
  value_text text,
  unit text not null default 'count',
  health text not null default 'unknown' check (health in ('healthy', 'watch', 'attention', 'unknown')),
  source_system text not null,
  source_detail text,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (adam_workspace_id, snapshot_key, metric_key)
);

create table if not exists public.wovo_adam_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  executive_summary text not null,
  wins jsonb not null default '[]'::jsonb check (jsonb_typeof(wins) = 'array'),
  risks jsonb not null default '[]'::jsonb check (jsonb_typeof(risks) = 'array'),
  decisions_needed jsonb not null default '[]'::jsonb check (jsonb_typeof(decisions_needed) = 'array'),
  next_priorities jsonb not null default '[]'::jsonb check (jsonb_typeof(next_priorities) = 'array'),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  generated_by text not null default 'system_rules' check (generated_by in ('system_rules', 'owner_edited', 'approved_ai_draft')),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (adam_workspace_id, period_start, period_end)
);

create table if not exists public.wovo_adam_recommendations (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  fingerprint text not null,
  category text not null check (category in ('support', 'content', 'billing', 'reliability', 'growth', 'security', 'operations')),
  title text not null check (char_length(title) between 3 and 180),
  rationale text not null,
  recommended_action text not null,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'implemented', 'archived')),
  requires_owner_approval boolean not null default true,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, fingerprint)
);

create table if not exists public.wovo_adam_integrations (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  integration_key text not null check (integration_key in ('openai', 'stripe', 'supabase', 'vercel', 'resend', 'meta', 'github', 'calendar', 'analytics', 'search_console')),
  display_name text not null,
  status text not null default 'not_configured' check (status in ('not_configured', 'configured', 'healthy', 'degraded', 'blocked')),
  connection_mode text not null default 'server_environment' check (connection_mode in ('server_environment', 'oauth', 'managed_service')),
  capabilities jsonb not null default '[]'::jsonb check (jsonb_typeof(capabilities) = 'array'),
  last_checked_at timestamptz,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, integration_key)
);

create table if not exists public.wovo_adam_campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  correlation_id uuid not null default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 180),
  sender_identity text not null default 'Adam at WOVO Media',
  sender_address text not null default 'support@wovomedia.com' check (sender_address = 'support@wovomedia.com'),
  sender_signature text not null default E'Adam | AI Operations Assistant, WOVO Media\nhttps://wovomedia.com\nhttps://wovomedia.com/contact',
  ai_assistance_disclosure text not null default 'Prepared with Adam, WOVO Media''s AI Operations Assistant. Reviewed by WOVO Media before sending.',
  audience_definition text not null,
  subject_template text not null,
  message_template text not null,
  opt_out_copy text,
  recipient_source text,
  status text not null default 'draft' check (status in ('draft', 'owner_review', 'approved_for_setup', 'blocked', 'archived')),
  sender_authorized boolean not null default false,
  audience_approved boolean not null default false,
  template_approved boolean not null default false,
  compliance_reviewed boolean not null default false,
  rate_policy_approved boolean not null default false,
  launch_enabled boolean not null default false check (launch_enabled = false),
  approval_id uuid references public.wovo_adam_approvals(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_daily_reports (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  report_date date not null,
  timezone text not null,
  status text not null default 'generating' check (status in ('generating', 'draft', 'delivered', 'failed', 'archived')),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  accomplishments jsonb not null default '[]'::jsonb check (jsonb_typeof(accomplishments) = 'array'),
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  next_priorities jsonb not null default '[]'::jsonb check (jsonb_typeof(next_priorities) = 'array'),
  delivery_target text not null default 'owner_private' check (delivery_target = 'owner_private'),
  delivery_provider text,
  provider_message_id text,
  delivered_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, report_date)
);

create table if not exists public.wovo_adam_job_runs (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  job_type text not null check (job_type in ('daily_owner_report', 'weekly_owner_report', 'kpi_refresh', 'campaign_review')),
  idempotency_key text not null,
  correlation_id uuid not null default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'dead_letter', 'disabled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, idempotency_key)
);

create table if not exists public.wovo_adam_failure_alerts (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  job_run_id uuid references public.wovo_adam_job_runs(id) on delete set null,
  severity text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  title text not null,
  summary text not null,
  error_code text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'archived')),
  acknowledged_by uuid references auth.users(id) on delete restrict,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_leads (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  correlation_id uuid not null default gen_random_uuid(),
  dedupe_key text not null,
  business_name text not null check (char_length(business_name) between 2 and 180),
  website_url text,
  public_business_email text,
  source_url text not null,
  source_kind text not null check (source_kind in ('business_website', 'public_directory', 'manual_referral', 'public_event', 'other_public_source')),
  research_method text not null default 'owner_supplied_public_source' check (research_method in ('owner_supplied_public_source', 'staff_reviewed_public_source')),
  niche text not null,
  location text not null,
  niche_fit text not null default 'medium' check (niche_fit in ('low', 'medium', 'high')),
  need_signal text not null default 'medium' check (need_signal in ('low', 'medium', 'high')),
  score integer not null check (score between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(score_reasons) = 'array'),
  research_notes text,
  status text not null default 'researched' check (status in ('researched', 'qualified', 'draft_ready', 'contacted', 'replied', 'converted', 'disqualified', 'suppressed', 'archived')),
  suppression_reason text,
  suppressed_at timestamptz,
  converted_account_id uuid references public.wovo_portal_accounts(id) on delete set null,
  converted_at timestamptz,
  attribution_source text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adam_workspace_id, dedupe_key)
);

create table if not exists public.wovo_adam_lead_events (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  lead_id uuid not null references public.wovo_adam_leads(id) on delete restrict,
  correlation_id uuid not null,
  event_type text not null check (event_type in ('researched', 'scored', 'qualified', 'draft_created', 'contacted', 'replied', 'converted', 'suppressed', 'restored', 'archived')),
  actor_user_id uuid references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_suppressions (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  lead_id uuid references public.wovo_adam_leads(id) on delete restrict,
  suppression_key text not null,
  reason text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  released_by uuid references auth.users(id) on delete restrict,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (adam_workspace_id, suppression_key)
);

create table if not exists public.wovo_adam_delivery_drafts (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  correlation_id uuid not null default gen_random_uuid(),
  delivery_type text not null check (delivery_type in ('website_concept', 'website_page', 'content_calendar', 'social_post', 'caption', 'ugc_ad_concept')),
  title text not null check (char_length(title) between 3 and 180),
  status text not null default 'draft' check (status in ('draft', 'needs_approval', 'approved', 'scheduled', 'published', 'archived')),
  current_version integer not null default 1 check (current_version > 0),
  generation_mode text not null default 'manual_structured_draft' check (generation_mode in ('manual_structured_draft', 'approved_ai_draft')),
  source_note_ids uuid[] not null default '{}',
  source_asset_ids uuid[] not null default '{}',
  goal_snapshot text,
  missing_inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_inputs) = 'array'),
  entitlement_source text not null check (entitlement_source in ('paid_subscription', 'owner_test_grant')),
  base_subscription_verified boolean not null,
  wovo_code_verified boolean not null default false,
  hosting_verified boolean not null default false,
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  auto_publish_opt_in boolean not null default false,
  official_connection_verified boolean not null default false,
  provider_ready boolean not null default false,
  provider_action_enabled boolean not null default false check (provider_action_enabled = false),
  scheduled_for timestamptz,
  published_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wovo_adam_delivery_versions (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  delivery_draft_id uuid not null references public.wovo_adam_delivery_drafts(id) on delete restrict,
  account_id uuid not null references public.wovo_portal_accounts(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  brief text not null check (char_length(brief) between 10 and 10000),
  draft_output jsonb not null default '{}'::jsonb check (jsonb_typeof(draft_output) = 'object'),
  source_manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(source_manifest) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (delivery_draft_id, version_number)
);

create table if not exists public.wovo_adam_audit_events (
  id uuid primary key default gen_random_uuid(),
  adam_workspace_id uuid not null references public.wovo_adam_workspaces(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_kind text not null default 'owner' check (actor_kind in ('owner', 'adam_system', 'integration')),
  correlation_id uuid not null default gen_random_uuid(),
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists wovo_adam_tasks_queue_idx on public.wovo_adam_tasks (adam_workspace_id, status, priority, due_at);
create index if not exists wovo_adam_tasks_correlation_idx on public.wovo_adam_tasks (correlation_id);
create index if not exists wovo_adam_approvals_pending_idx on public.wovo_adam_approvals (adam_workspace_id, status, created_at desc);
create index if not exists wovo_adam_memory_active_idx on public.wovo_adam_memory_items (adam_workspace_id, status, updated_at desc);
create index if not exists wovo_adam_kpi_latest_idx on public.wovo_adam_kpi_snapshots (adam_workspace_id, metric_key, measured_at desc);
create index if not exists wovo_adam_audit_recent_idx on public.wovo_adam_audit_events (adam_workspace_id, created_at desc);
create index if not exists wovo_adam_campaigns_review_idx on public.wovo_adam_campaign_drafts (adam_workspace_id, status, created_at desc);
create index if not exists wovo_adam_daily_reports_idx on public.wovo_adam_daily_reports (adam_workspace_id, report_date desc);
create index if not exists wovo_adam_job_runs_retry_idx on public.wovo_adam_job_runs (status, next_attempt_at);
create index if not exists wovo_adam_failure_alerts_open_idx on public.wovo_adam_failure_alerts (adam_workspace_id, status, created_at desc);
create index if not exists wovo_adam_leads_pipeline_idx on public.wovo_adam_leads (adam_workspace_id, status, score desc);
create index if not exists wovo_adam_lead_events_idx on public.wovo_adam_lead_events (lead_id, created_at desc);
create index if not exists wovo_adam_delivery_pipeline_idx on public.wovo_adam_delivery_drafts (adam_workspace_id, account_id, status, updated_at desc);

alter table public.wovo_adam_workspaces enable row level security;
alter table public.wovo_adam_goals enable row level security;
alter table public.wovo_adam_tasks enable row level security;
alter table public.wovo_adam_approvals enable row level security;
alter table public.wovo_adam_memory_items enable row level security;
alter table public.wovo_adam_memory_versions enable row level security;
alter table public.wovo_adam_kpi_snapshots enable row level security;
alter table public.wovo_adam_weekly_reports enable row level security;
alter table public.wovo_adam_recommendations enable row level security;
alter table public.wovo_adam_integrations enable row level security;
alter table public.wovo_adam_campaign_drafts enable row level security;
alter table public.wovo_adam_daily_reports enable row level security;
alter table public.wovo_adam_job_runs enable row level security;
alter table public.wovo_adam_failure_alerts enable row level security;
alter table public.wovo_adam_leads enable row level security;
alter table public.wovo_adam_lead_events enable row level security;
alter table public.wovo_adam_suppressions enable row level security;
alter table public.wovo_adam_delivery_drafts enable row level security;
alter table public.wovo_adam_delivery_versions enable row level security;
alter table public.wovo_adam_audit_events enable row level security;

-- Explicitly deny all direct browser roles. Owner authorization is enforced by
-- the server before it uses the service-role REST client.
create policy wovo_adam_workspaces_no_direct_access on public.wovo_adam_workspaces for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_goals_no_direct_access on public.wovo_adam_goals for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_tasks_no_direct_access on public.wovo_adam_tasks for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_approvals_no_direct_access on public.wovo_adam_approvals for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_memory_items_no_direct_access on public.wovo_adam_memory_items for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_memory_versions_no_direct_access on public.wovo_adam_memory_versions for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_kpi_snapshots_no_direct_access on public.wovo_adam_kpi_snapshots for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_weekly_reports_no_direct_access on public.wovo_adam_weekly_reports for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_recommendations_no_direct_access on public.wovo_adam_recommendations for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_integrations_no_direct_access on public.wovo_adam_integrations for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_campaign_drafts_no_direct_access on public.wovo_adam_campaign_drafts for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_daily_reports_no_direct_access on public.wovo_adam_daily_reports for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_job_runs_no_direct_access on public.wovo_adam_job_runs for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_failure_alerts_no_direct_access on public.wovo_adam_failure_alerts for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_leads_no_direct_access on public.wovo_adam_leads for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_lead_events_no_direct_access on public.wovo_adam_lead_events for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_suppressions_no_direct_access on public.wovo_adam_suppressions for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_delivery_drafts_no_direct_access on public.wovo_adam_delivery_drafts for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_delivery_versions_no_direct_access on public.wovo_adam_delivery_versions for all to anon, authenticated using (false) with check (false);
create policy wovo_adam_audit_events_no_direct_access on public.wovo_adam_audit_events for all to anon, authenticated using (false) with check (false);

revoke all on table
  public.wovo_adam_workspaces,
  public.wovo_adam_goals,
  public.wovo_adam_tasks,
  public.wovo_adam_approvals,
  public.wovo_adam_memory_items,
  public.wovo_adam_memory_versions,
  public.wovo_adam_kpi_snapshots,
  public.wovo_adam_weekly_reports,
  public.wovo_adam_recommendations,
  public.wovo_adam_integrations,
  public.wovo_adam_campaign_drafts,
  public.wovo_adam_daily_reports,
  public.wovo_adam_job_runs,
  public.wovo_adam_failure_alerts,
  public.wovo_adam_leads,
  public.wovo_adam_lead_events,
  public.wovo_adam_suppressions,
  public.wovo_adam_delivery_drafts,
  public.wovo_adam_delivery_versions,
  public.wovo_adam_audit_events
from anon, authenticated;

grant select, insert, update on table
  public.wovo_adam_workspaces,
  public.wovo_adam_goals,
  public.wovo_adam_tasks,
  public.wovo_adam_approvals,
  public.wovo_adam_memory_items,
  public.wovo_adam_memory_versions,
  public.wovo_adam_kpi_snapshots,
  public.wovo_adam_weekly_reports,
  public.wovo_adam_recommendations,
  public.wovo_adam_integrations,
  public.wovo_adam_campaign_drafts,
  public.wovo_adam_daily_reports,
  public.wovo_adam_job_runs,
  public.wovo_adam_failure_alerts,
  public.wovo_adam_leads,
  public.wovo_adam_lead_events,
  public.wovo_adam_suppressions,
  public.wovo_adam_delivery_drafts,
  public.wovo_adam_delivery_versions,
  public.wovo_adam_audit_events
to service_role;

create or replace function public.wovo_adam_reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Adam audit and version records are append-only';
end;
$$;

revoke all on function public.wovo_adam_reject_immutable_change() from public, anon, authenticated;

drop trigger if exists wovo_adam_audit_events_immutable on public.wovo_adam_audit_events;
create trigger wovo_adam_audit_events_immutable
before update or delete on public.wovo_adam_audit_events
for each row execute function public.wovo_adam_reject_immutable_change();

drop trigger if exists wovo_adam_memory_versions_immutable on public.wovo_adam_memory_versions;
create trigger wovo_adam_memory_versions_immutable
before update or delete on public.wovo_adam_memory_versions
for each row execute function public.wovo_adam_reject_immutable_change();

drop trigger if exists wovo_adam_lead_events_immutable on public.wovo_adam_lead_events;
create trigger wovo_adam_lead_events_immutable
before update or delete on public.wovo_adam_lead_events
for each row execute function public.wovo_adam_reject_immutable_change();

drop trigger if exists wovo_adam_delivery_versions_immutable on public.wovo_adam_delivery_versions;
create trigger wovo_adam_delivery_versions_immutable
before update or delete on public.wovo_adam_delivery_versions
for each row execute function public.wovo_adam_reject_immutable_change();

comment on table public.wovo_adam_workspaces is 'Owner-only WOVO Operations workspace. No client-facing access.';
comment on table public.wovo_adam_audit_events is 'Append-only, human-readable Adam activity history. Secrets and prompt bodies must never be stored here.';
comment on table public.wovo_adam_memory_items is 'Structured WOVO business memory with explicit approval, retention, archive, and version controls. Never stores provider secrets.';
comment on table public.wovo_adam_integrations is 'Connection health metadata only. Tokens and secrets remain in secure provider-managed environment storage.';
comment on table public.wovo_adam_campaign_drafts is 'Owner-reviewed outreach drafts only. The database constraint keeps launch disabled until a separately reviewed sending policy is shipped.';
comment on table public.wovo_adam_daily_reports is 'Idempotent factual daily owner briefing delivered only to the configured private owner recipient.';
comment on table public.wovo_adam_leads is 'Public-business research pipeline. No restricted-site scraping, private/personal email acquisition, or automatic outreach.';
comment on table public.wovo_adam_delivery_drafts is 'Tenant-scoped client delivery drafts. External provider actions remain database-blocked until a later verified migration.';
