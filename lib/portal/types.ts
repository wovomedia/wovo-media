export const PORTAL_STAFF_ROLES = [
  "owner",
  "admin",
  "manager",
  "video_editor",
  "website_designer",
  "support",
] as const;

export type PortalStaffRole = (typeof PORTAL_STAFF_ROLES)[number];

export type PortalAccount = {
  id: string;
  owner_user_id: string;
  contact_email: string;
  business_name: string;
  business_type: "restaurant" | "realtor" | "contractor" | "local_business" | "other";
  website_url: string | null;
  location: string;
  timezone: string;
  brand_voice: string | null;
  audience: string | null;
  goals: string | null;
  posting_cadence_per_week: number;
  preferred_platforms: string[];
  asset_rights_confirmed: boolean;
  onboarding_completed_at: string | null;
  onboarding_plan: {
    coreModules?: string[];
    recurringAddons?: string[];
    quoteServices?: string[];
    confirmedAt?: string;
  };
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
};

export type PortalContentItem = {
  id: string;
  account_id: string;
  title: string;
  caption: string;
  platform: string;
  content_type: string;
  scheduled_for: string | null;
  status: string;
  creative_brief: string | null;
  hashtags: string[];
  platform_variant: Record<string, unknown>;
  timezone: string;
  series_key: string | null;
  recurrence_rule: string | null;
  approval_version: number;
  approved_snapshot_id: string | null;
  approval_revoked_at: string | null;
  source_rights_confirmed: boolean;
  ai_generated: boolean;
  ai_provider: string | null;
  ai_model: string | null;
  client_feedback: string | null;
  posted_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
};

export type PortalContentApproval = {
  id: string;
  account_id: string;
  content_item_id: string;
  approved_by: string;
  approved_at: string;
  approval_version: number;
  approval_scope: "item" | "date_range";
  range_start: string | null;
  range_end: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  correlation_id: string;
};

export type PortalEvent = {
  id: string;
  account_id: string;
  event_type: "consultation" | "shoot" | "content_deadline";
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
  meeting_provider: string | null;
  meeting_url: string | null;
  participant_count: number;
  extra_participants_paid: boolean;
  travel_estimate_cents: number | null;
  travel_estimate_note: string | null;
};

export type PortalThread = {
  id: string;
  account_id: string;
  case_reference: string;
  subject: string;
  status: string;
  priority: string;
  assigned_role: string | null;
  last_message_at: string;
};

export type PortalThreadAssignment = {
  id: string;
  thread_id: string;
  account_id: string;
  assigned_by: string;
  assigned_staff_user_id: string | null;
  assigned_role: string | null;
  note: string | null;
  created_at: string;
};

export type PortalMessage = {
  id: string;
  thread_id: string;
  account_id: string;
  body: string;
  visibility: "client" | "internal";
  sender_user_id: string;
  sender_label: "Client" | "WOVO team";
  created_at: string;
};

export type PortalOrder = {
  id: string;
  account_id: string;
  order_type: "website" | "ad_video" | "shoot" | "drone" | "extra_participant";
  status: string;
  description: string | null;
  location: string | null;
  amount_cents: number | null;
  related_event_id: string | null;
  created_at: string;
};

export type PortalAsset = {
  id: string;
  account_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  asset_kind: string;
  rights_confirmed: boolean;
  people_consent_confirmed?: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
};

export type PortalSubscription = {
  account_id: string;
  status: string;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type PortalNotification = {
  id: string;
  account_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  target_role: string | null;
  related_table: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type PortalPublicInquiry = {
  id: string;
  case_reference: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  assigned_role: string | null;
  staff_reply: string | null;
  replied_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
};

export type PortalPublicInquiryReply = {
  id: string;
  inquiry_id: string;
  author_user_id: string | null;
  author_role: "owner" | "admin" | "manager" | "support";
  message: string;
  delivery_status: "pending" | "delivered" | "failed";
  created_at: string;
};

export type PortalAdminAudit = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PortalAccessGrant = {
  id: string;
  account_id: string;
  grant_type: "test" | "trial" | "staff_assisted";
  reason: string;
  starts_at: string;
  expires_at: string;
  granted_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
};

export type PortalClientInvite = {
  id: string;
  account_id: string;
  invited_email: string;
  invited_user_id: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  last_sent_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type PortalPostingTask = {
  id: string;
  account_id: string;
  content_item_id: string;
  title: string;
  due_at: string;
  status: "pending" | "in_progress" | "completed" | "canceled";
  assigned_role: string;
  completed_at: string | null;
  created_at: string;
};

export type PortalCreditAccount = {
  account_id: string;
  balance: number;
  updated_at: string;
};

export type PortalCreditEntry = {
  id: string;
  account_id: string;
  delta: number;
  balance_after: number;
  entry_type: "purchase" | "consumption" | "adjustment" | "refund" | "reversal";
  idempotency_key: string;
  description: string;
  workflow_id: string | null;
  created_at: string;
};

export type PortalEntitlement = {
  id: string;
  account_id: string;
  entitlement_key: "ai_dm_manager" | "website_hosting" | "personal_ai_assistant" | "wovo_code" | "ai_operator";
  status: "inactive" | "requested" | "checkout_pending" | "active" | "canceling" | "canceled" | "provisioning" | "blocked";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provisioning_status: "not_started" | "pending" | "ready" | "failed";
  provisioned_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalAiUsagePolicy = {
  account_id: string;
  enabled: boolean;
  plan_key: "core" | "code_pro" | "owner_test";
  daily_unit_limit: number;
  monthly_included_units: number;
  requests_per_minute: number;
  monthly_provider_cost_cap_micros: number;
  provider_ready: boolean;
  moderation_ready: boolean;
  telemetry_ready: boolean;
  code_sandbox_ready: boolean;
  advanced_mode_selection: boolean;
  period_start: string;
  period_end: string;
  updated_at: string;
};

export type PortalAiUsageRequest = {
  id: string;
  account_id: string;
  actor_user_id: string;
  feature: "chat" | "image_visual" | "website_page" | "product_page" | "code";
  mode: "fast" | "balanced" | "premium";
  status: "reserved" | "completed" | "failed" | "released";
  estimated_units: number;
  actual_units: number | null;
  estimated_provider_cost_micros: number;
  actual_provider_cost_micros: number | null;
  reserved_at: string;
  completed_at: string | null;
};

export type PortalKnowledgeNote = {
  id: string;
  account_id: string;
  title: string;
  category: "business_facts" | "programs" | "locations" | "services" | "history" | "events" | "voice_guidance" | "faq" | "other";
  status: "draft" | "approved" | "archived";
  current_version: number;
  approved_version_id: string | null;
  approved_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalKnowledgeNoteVersion = {
  id: string;
  note_id: string;
  account_id: string;
  version_number: number;
  title: string;
  body: string;
  source_url: string | null;
  source_date: string | null;
  guidance_kind: "fact" | "do_say" | "dont_say" | "context";
  change_note: string | null;
  created_by: string;
  created_at: string;
};

export type PortalCommentContentWorkflow = {
  id: string;
  account_id: string;
  source_platform: "facebook" | "instagram" | "tiktok" | "youtube" | "website" | "other" | null;
  source_url: string | null;
  source_date: string | null;
  redacted_question: string;
  category: "faq" | "program" | "service" | "event" | "education" | "myth" | "other";
  output_type: "faq_answer" | "social_post" | "caption" | "content_theme";
  approved_note_ids: string[];
  factual_support_status: "needs_notes" | "supported" | "owner_review";
  draft_output: string | null;
  status: "draft" | "brief_ready" | "owner_review" | "approved" | "queued" | "archived";
  privacy_confirmed: boolean;
  created_at: string;
  updated_at: string;
};

export type PortalWorkflowDraft = {
  id: string;
  account_id: string;
  workflow_type: "listing_ad" | "website_site" | "website_page" | "post_plan" | "mascot_series" | "ugc_ad" | "call_agent" | "booking_request" | "job_posting" | "meeting";
  title: string;
  status: "draft" | "client_review" | "approved" | "queued" | "provisioning" | "published" | "blocked" | "archived";
  brief: string;
  source_url: string | null;
  source_authorized: boolean;
  rights_confirmed: boolean;
  people_consent_confirmed: boolean;
  voice_consent_confirmed: boolean;
  input_data: Record<string, unknown>;
  generated_output: Record<string, unknown>;
  provider_status: "not_started" | "pending" | "completed" | "failed" | "provider_required";
  published_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalSnapshot = {
  user: { id: string; email: string | null };
  mode: "client" | "staff";
  staffRole: PortalStaffRole | null;
  accounts: PortalAccount[];
  content: PortalContentItem[];
  contentApprovals: PortalContentApproval[];
  events: PortalEvent[];
  threads: PortalThread[];
  threadAssignments: PortalThreadAssignment[];
  messages: PortalMessage[];
  orders: PortalOrder[];
  assets: PortalAsset[];
  subscriptions: PortalSubscription[];
  notifications: PortalNotification[];
  publicInquiries: PortalPublicInquiry[];
  publicInquiryReplies: PortalPublicInquiryReply[];
  adminAudit: PortalAdminAudit[];
  accessGrants: PortalAccessGrant[];
  clientInvites: PortalClientInvite[];
  postingTasks: PortalPostingTask[];
  creditAccounts: PortalCreditAccount[];
  creditLedger: PortalCreditEntry[];
  entitlements: PortalEntitlement[];
  workflowDrafts: PortalWorkflowDraft[];
  aiUsagePolicies: PortalAiUsagePolicy[];
  aiUsageRequests: PortalAiUsageRequest[];
  knowledgeNotes: PortalKnowledgeNote[];
  knowledgeNoteVersions: PortalKnowledgeNoteVersion[];
  commentContentWorkflows: PortalCommentContentWorkflow[];
  setup: {
    monthlyCheckoutConfigured: boolean;
    monthlyPrice: { amountCents: number; currency: string; interval: string } | null;
    billingOptions: Array<{
      frequency: "monthly" | "quarterly" | "yearly";
      label: string;
      amountCents: number;
      currency: "usd";
      interval: "month" | "year";
      intervalCount: number;
      monthsCovered: 1 | 3 | 12;
      effectiveMonthlyCents: number;
      savingsCents: number;
      savingsPercent: number;
      renewalLabel: string;
    }>;
    addonsConfigured: Record<PortalOrder["order_type"], boolean>;
    aiConfigured: boolean;
    meetingProviders: string[];
    awardsReviewDate: string;
    awardsRubricRequired: boolean;
    expansion: {
      creditPurchaseReady: boolean;
      dmManagerCheckoutReady: boolean;
      websiteHostingCheckoutReady: boolean;
      personalAssistantCheckoutReady: boolean;
      wovoAiRuntimeReady: boolean;
      wovoCodeRuntimeReady: boolean;
      aiCreditTopupReady: boolean;
      websiteProvisioningReady: boolean;
      metaPublishingReady: boolean;
    };
  };
};
