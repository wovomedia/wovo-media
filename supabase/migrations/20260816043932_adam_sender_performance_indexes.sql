create index if not exists wovo_adam_mail_connections_connected_by_idx
  on public.wovo_adam_mail_connections (connected_by)
  where connected_by is not null;

create index if not exists wovo_adam_outreach_lead_idx
  on public.wovo_adam_outreach_messages (lead_id);

create index if not exists wovo_adam_outreach_webhooks_workspace_idx
  on public.wovo_adam_outreach_webhook_events (adam_workspace_id, created_at desc);

create index if not exists wovo_adam_outreach_webhooks_message_idx
  on public.wovo_adam_outreach_webhook_events (message_id, created_at desc)
  where message_id is not null;

create index if not exists wovo_meta_publish_jobs_connection_idx
  on public.wovo_meta_publish_jobs (connection_id, created_at desc);

create index if not exists wovo_meta_publish_jobs_created_by_idx
  on public.wovo_meta_publish_jobs (created_by, created_at desc);
