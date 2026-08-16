-- Persists the client's explicit, non-preselected onboarding choices.
-- Checkout remains server-authoritative; this record is a plan summary, not an entitlement.
alter table public.wovo_portal_accounts
  add column if not exists onboarding_plan jsonb not null default '{}'::jsonb;

comment on column public.wovo_portal_accounts.onboarding_plan is
  'Client-confirmed onboarding module/add-on/service interests. Never grants billing entitlement.';
