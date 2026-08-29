create table if not exists public.wovo_pricing_deal_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  source text not null default 'pricing_popup' check (source in ('pricing_popup', 'pricing_inline')),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed', 'suppressed')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email_normalized)
);

alter table public.wovo_pricing_deal_subscribers enable row level security;

create policy wovo_pricing_deal_subscribers_no_direct_access
on public.wovo_pricing_deal_subscribers for all to anon, authenticated
using (false) with check (false);

revoke all on table public.wovo_pricing_deal_subscribers from anon, authenticated;
grant select, insert, update on table public.wovo_pricing_deal_subscribers to service_role;
revoke delete, truncate on table public.wovo_pricing_deal_subscribers from service_role;

comment on table public.wovo_pricing_deal_subscribers is
  'Server-only, consented WOVO pricing-deal interest list. Sending remains subject to suppression and unsubscribe controls.';
