-- WOVO-owned image-first daily publishing. Creative metadata contains only
-- approved public WOVO marketing copy; encrypted provider tokens remain in the
-- existing connection table and are never exposed to browser roles.

alter table public.wovo_meta_connections
  add column auto_publish_timezone text not null default 'America/Chicago'
    check (char_length(auto_publish_timezone) between 3 and 80),
  add column auto_publish_hour smallint not null default 9
    check (auto_publish_hour between 0 and 23),
  add column auto_publish_last_slot date;

alter table public.wovo_meta_publish_jobs
  add column campaign_key text,
  add column creative_kicker text,
  add column creative_headline text,
  add column creative_cta text;

alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_publish_jobs_campaign_key_check
    check (campaign_key is null or char_length(campaign_key) between 2 and 80),
  add constraint wovo_meta_publish_jobs_creative_kicker_check
    check (creative_kicker is null or char_length(creative_kicker) between 2 and 140),
  add constraint wovo_meta_publish_jobs_creative_headline_check
    check (creative_headline is null or char_length(creative_headline) between 2 and 180),
  add constraint wovo_meta_publish_jobs_creative_cta_check
    check (creative_cta is null or char_length(creative_cta) between 2 and 160),
  add constraint wovo_meta_publish_jobs_creative_complete_check
    check (
      media_url is null
      or (creative_kicker is not null and creative_headline is not null and creative_cta is not null)
    );

comment on column public.wovo_meta_connections.auto_publish_last_slot is
  'Last local calendar day for which the server created the WOVO-owned daily image jobs. Unique job keys remain the final duplicate guard.';
comment on column public.wovo_meta_publish_jobs.creative_headline is
  'Approved public WOVO headline rendered by the signed image endpoint; never tenant-private content.';
