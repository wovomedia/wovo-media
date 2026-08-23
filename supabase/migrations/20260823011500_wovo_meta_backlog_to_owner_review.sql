-- The previous scheduler created provider-unattempted jobs directly in the
-- queue. Move only those unproven automation rows back to owner verification.
-- Provider-confirmed, attempted, manually-created, and canceled rows are left
-- unchanged so audit history is preserved and no delivery is duplicated.
update public.wovo_meta_publish_jobs
set
  status = 'draft',
  scheduled_for = null,
  approved_at = null,
  approved_by = null,
  last_error_code = null,
  last_error_summary = null,
  updated_at = now()
where source = 'scheduled_automation'
  and status in ('approved', 'queued')
  and attempt_count = 0
  and provider_post_id is null
  and published_at is null;
