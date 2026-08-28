-- Preserve the exact tenant draft and authorized private asset behind each
-- client Meta delivery. Browser roles remain unable to read or write jobs.

alter table public.wovo_meta_publish_jobs
  add column if not exists source_content_item_id uuid
    references public.wovo_portal_content_items(id) on delete restrict,
  add column if not exists source_asset_id uuid
    references public.wovo_portal_assets(id) on delete restrict;

create index if not exists wovo_meta_publish_jobs_source_content_idx
  on public.wovo_meta_publish_jobs(source_content_item_id, created_at desc)
  where source_content_item_id is not null;

create index if not exists wovo_meta_publish_jobs_source_asset_idx
  on public.wovo_meta_publish_jobs(source_asset_id)
  where source_asset_id is not null;

alter table public.wovo_meta_publish_jobs
  drop constraint if exists wovo_meta_publish_jobs_client_source_scope_check;
alter table public.wovo_meta_publish_jobs
  add constraint wovo_meta_publish_jobs_client_source_scope_check check (
    (source_content_item_id is null and source_asset_id is null)
    or (owner_scope = false and account_id is not null and source_content_item_id is not null)
  );

comment on column public.wovo_meta_publish_jobs.source_content_item_id is
  'Exact tenant content item approved before this provider job was queued.';
comment on column public.wovo_meta_publish_jobs.source_asset_id is
  'Rights-confirmed tenant asset exposed to Meta only through a signed, short-lived redirect.';
