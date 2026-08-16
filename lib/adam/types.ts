export type AdamWorkspace = {
  id: string;
  owner_user_id: string;
  name: string;
  current_objective: string;
  operating_mode: "approval_first";
  weekly_report_day: number;
  owner_timezone: string;
  daily_report_enabled: boolean;
  daily_report_hour: number;
  retention_days: number;
  created_at: string;
  updated_at: string;
};

export type AdamGoal = {
  id: string;
  adam_workspace_id: string;
  title: string;
  description: string | null;
  horizon: "week" | "month" | "quarter" | "year";
  priority: number;
  status: "draft" | "active" | "paused" | "achieved" | "archived";
  success_measure: string | null;
  target_value: number | null;
  current_value: number | null;
  target_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamTask = {
  id: string;
  adam_workspace_id: string;
  goal_id: string | null;
  correlation_id: string;
  task_type: "internal_improvement" | "support_draft" | "content_draft" | "seo_recommendation" | "lead_research_draft" | "outreach_campaign_draft" | "proposal_draft" | "deployment_proposal" | "weekly_report";
  title: string;
  description: string;
  status: "queued" | "in_progress" | "blocked" | "needs_approval" | "completed" | "failed" | "dead_letter" | "archived";
  priority: number;
  requires_approval: boolean;
  due_at: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  last_error_summary: string | null;
  input_data: Record<string, unknown>;
  result_data: Record<string, unknown>;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamApproval = {
  id: string;
  adam_workspace_id: string;
  task_id: string | null;
  correlation_id: string;
  action_type: "external_communication" | "publishing" | "billing_change" | "pricing_change" | "code_deployment" | "outbound_action" | "internal_change";
  title: string;
  summary: string;
  risk_level: "low" | "medium" | "high" | "critical";
  proposed_payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired" | "executed" | "archived";
  decision_note: string | null;
  decided_at: string | null;
  expires_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamMemoryItem = {
  id: string;
  adam_workspace_id: string;
  category: "company_fact" | "policy" | "decision" | "goal_context" | "operating_rule" | "market_context" | "integration_context";
  title: string;
  status: "draft" | "approved" | "archived";
  current_version: number;
  retention_until: string | null;
  source_url: string | null;
  source_date: string | null;
  approved_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamMemoryVersion = {
  id: string;
  memory_item_id: string;
  adam_workspace_id: string;
  version_number: number;
  title: string;
  content: string;
  change_note: string | null;
  created_at: string;
};

export type AdamKpiSnapshot = {
  id: string;
  adam_workspace_id: string;
  snapshot_key: string;
  metric_key: string;
  metric_label: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string;
  health: "healthy" | "watch" | "attention" | "unknown";
  source_system: string;
  source_detail: string | null;
  measured_at: string;
};

export type AdamWeeklyReport = {
  id: string;
  adam_workspace_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "archived";
  executive_summary: string;
  wins: string[];
  risks: string[];
  decisions_needed: string[];
  next_priorities: string[];
  metrics: Record<string, number | string | null>;
  generated_by: "system_rules" | "owner_edited" | "approved_ai_draft";
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamRecommendation = {
  id: string;
  adam_workspace_id: string;
  fingerprint: string;
  category: "support" | "content" | "billing" | "reliability" | "growth" | "security" | "operations";
  title: string;
  rationale: string;
  recommended_action: string;
  evidence: Record<string, unknown>;
  status: "pending" | "accepted" | "dismissed" | "implemented" | "archived";
  requires_owner_approval: boolean;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamAuditEvent = {
  id: string;
  adam_workspace_id: string;
  actor_kind: "owner" | "adam_system" | "integration";
  correlation_id: string;
  event_type: string;
  subject_type: string;
  subject_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdamIntegrationStatus = {
  key: "openai" | "stripe" | "supabase" | "vercel" | "resend" | "google_mail" | "meta" | "github" | "calendar" | "analytics" | "search_console" | "cloudflare" | "calendly";
  label: string;
  status: "not_configured" | "configured" | "healthy" | "degraded" | "blocked";
  detail: string;
  capabilities: string[];
  lastCheckedAt: string | null;
};

export type AdamCampaignDraft = {
  id: string;
  adam_workspace_id: string;
  correlation_id: string;
  name: string;
  sender_identity: string;
  sender_address: "adam@wovomedia.com";
  sender_signature: string;
  ai_assistance_disclosure: string;
  audience_definition: string;
  subject_template: string;
  message_template: string;
  opt_out_copy: string | null;
  recipient_source: string | null;
  status: "draft" | "owner_review" | "approved_for_setup" | "blocked" | "archived";
  sender_authorized: boolean;
  audience_approved: boolean;
  template_approved: boolean;
  compliance_reviewed: boolean;
  rate_policy_approved: boolean;
  sender_domain_verified_at: string | null;
  webhook_verified_at: string | null;
  unsubscribe_verified_at: string | null;
  test_delivery_verified_at: string | null;
  reply_handling_verified_at: string | null;
  kill_switch: boolean;
  daily_rate_limit: number;
  daily_spend_cap_cents: number;
  sent_count: number;
  delivered_count: number;
  bounced_count: number;
  complained_count: number;
  unsubscribed_count: number;
  replied_count: number;
  launch_enabled: boolean;
  approval_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamDailyReport = {
  id: string;
  adam_workspace_id: string;
  report_date: string;
  timezone: string;
  status: "generating" | "draft" | "delivered" | "failed" | "archived";
  stats: Record<string, number | string | null>;
  accomplishments: string[];
  blockers: string[];
  next_priorities: string[];
  ai_narrative: string | null;
  ai_request_id: string | null;
  delivery_target: "owner_private";
  delivery_provider: string | null;
  delivered_at: string | null;
  attempt_count: number;
  last_error_code: string | null;
  last_error_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamAiPolicy = {
  adam_workspace_id: string;
  enabled: boolean;
  model_id: "gpt-5.6-luna";
  monthly_cost_cap_micros: number;
  monthly_request_cap: number;
  daily_request_cap: number;
  hourly_request_cap: number;
  max_output_tokens: number;
  updated_at: string;
};

export type AdamAiUsage = {
  monthCostMicros: number;
  monthRequests: number;
  dayRequests: number;
  hourRequests: number;
  lastCompletedAt: string | null;
};

export type AdamChatMessage = {
  id: string;
  adam_workspace_id: string;
  owner_user_id: string;
  conversation_id: string;
  request_id: string | null;
  role: "owner" | "adam";
  message_kind: "operations" | "support_draft" | "outreach_draft" | "content_draft";
  content: string;
  external_action_taken: false;
  archived_at: string | null;
  created_at: string;
};

export type AdamFailureAlert = {
  id: string;
  adam_workspace_id: string;
  severity: "warning" | "error" | "critical";
  title: string;
  summary: string;
  error_code: string | null;
  status: "open" | "acknowledged" | "resolved" | "archived";
  created_at: string;
  updated_at: string;
};

export type AdamLead = {
  id: string;
  adam_workspace_id: string;
  correlation_id: string;
  business_name: string;
  website_url: string | null;
  public_business_email: string | null;
  source_url: string;
  research_method?: "owner_supplied_public_source" | "staff_reviewed_public_source" | "adam_public_web_review";
  source_kind: "business_website" | "public_directory" | "manual_referral" | "public_event" | "other_public_source";
  niche: string;
  location: string;
  niche_fit: "low" | "medium" | "high";
  need_signal: "low" | "medium" | "high";
  score: number;
  score_reasons: string[];
  research_notes: string | null;
  status: "researched" | "qualified" | "draft_ready" | "contacted" | "replied" | "converted" | "disqualified" | "suppressed" | "archived";
  suppression_reason: string | null;
  suppressed_at: string | null;
  converted_account_id: string | null;
  converted_at: string | null;
  attribution_source: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamDeliveryDraft = {
  id: string;
  adam_workspace_id: string;
  account_id: string;
  correlation_id: string;
  delivery_type: "website_concept" | "website_page" | "content_calendar" | "social_post" | "caption" | "ugc_ad_concept";
  title: string;
  status: "draft" | "needs_approval" | "approved" | "scheduled" | "published" | "archived";
  current_version: number;
  generation_mode: "manual_structured_draft" | "approved_ai_draft";
  source_note_ids: string[];
  source_asset_ids: string[];
  goal_snapshot: string | null;
  missing_inputs: string[];
  entitlement_source: "paid_subscription" | "owner_test_grant";
  base_subscription_verified: boolean;
  wovo_code_verified: boolean;
  hosting_verified: boolean;
  credits_reserved: number;
  auto_publish_opt_in: boolean;
  official_connection_verified: boolean;
  provider_ready: boolean;
  provider_action_enabled: false;
  scheduled_for: string | null;
  published_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdamDeliveryVersion = {
  id: string;
  adam_workspace_id: string;
  delivery_draft_id: string;
  account_id: string;
  version_number: number;
  brief: string;
  draft_output: Record<string, unknown>;
  source_manifest: Record<string, unknown>;
  created_at: string;
};

export type AdamDeliveryAccount = {
  id: string;
  businessName: string;
  businessType: string;
  billingState: "paid" | "owner_test" | "inactive";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  wovoCodeActive: boolean;
  hostingActive: boolean;
};

export type AdamSnapshot = {
  workspace: AdamWorkspace;
  goals: AdamGoal[];
  tasks: AdamTask[];
  approvals: AdamApproval[];
  memoryItems: AdamMemoryItem[];
  memoryVersions: AdamMemoryVersion[];
  kpis: AdamKpiSnapshot[];
  weeklyReports: AdamWeeklyReport[];
  recommendations: AdamRecommendation[];
  audit: AdamAuditEvent[];
  integrations: AdamIntegrationStatus[];
  campaignDrafts: AdamCampaignDraft[];
  dailyReports: AdamDailyReport[];
  failureAlerts: AdamFailureAlert[];
  leads: AdamLead[];
  deliveryDrafts: AdamDeliveryDraft[];
  deliveryVersions: AdamDeliveryVersion[];
  deliveryAccounts: AdamDeliveryAccount[];
  aiPolicy: AdamAiPolicy | null;
  aiUsage: AdamAiUsage;
  chatMessages: AdamChatMessage[];
  controls: {
    ownerOnly: true;
    approvalFirst: true;
    externalActionsEnabled: false;
    aiDraftingEnabled: boolean;
    backgroundExecutionEnabled: false;
  };
};
