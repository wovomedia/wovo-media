alter table public.wovo_portal_entitlements
  drop constraint if exists wovo_portal_entitlements_entitlement_key_check;
alter table public.wovo_portal_entitlements
  add constraint wovo_portal_entitlements_entitlement_key_check
  check (entitlement_key in ('ai_dm_manager', 'website_hosting', 'personal_ai_assistant'));

alter table public.wovo_portal_workflow_drafts
  drop constraint if exists wovo_portal_workflow_drafts_workflow_type_check;
alter table public.wovo_portal_workflow_drafts
  add constraint wovo_portal_workflow_drafts_workflow_type_check
  check (workflow_type in ('listing_ad', 'website_site', 'website_page', 'post_plan', 'mascot_series', 'ugc_ad', 'call_agent', 'booking_request', 'job_posting', 'meeting'));

comment on constraint wovo_portal_entitlements_entitlement_key_check on public.wovo_portal_entitlements is
  'Billing entitlements are server-controlled; personal assistant checkout remains disabled until its verified recurring price and provider workflow are tested.';
