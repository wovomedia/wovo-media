-- Owner generation is credit-exempt but still protected by the application
-- provider-cost ceiling. Keep the database unit ceiling aligned with the
-- 100,000-unit owner test policy written by ensureWorkspaceUsagePolicy.

alter table public.wovo_ai_usage_policies
  drop constraint if exists wovo_ai_usage_policies_weekly_unit_limit_check;

alter table public.wovo_ai_usage_policies
  add constraint wovo_ai_usage_policies_weekly_unit_limit_check
  check (weekly_unit_limit between 1 and 1000000);

comment on column public.wovo_ai_usage_policies.weekly_unit_limit is
  'Seven-day usage ceiling. Owner credit exemption remains subject to server-side provider cost and request-rate limits.';
