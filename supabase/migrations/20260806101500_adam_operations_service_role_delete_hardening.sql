-- Adam uses archive/restore workflows. Even the server-side service role does
-- not need direct DELETE on these owner-only operating records.
revoke delete on table
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
from service_role;
