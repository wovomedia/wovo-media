-- Vercel Hobby supports only daily cron schedules. Supabase Cron invokes the
-- hourly WOVO media and social workers with a path-bound one-hour HMAC. The
-- provider token remains encrypted and is never sent in the request.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'wovo-media-reconciliation-hourly',
  '5 * * * *',
  $cron$
    select net.http_get(
      url := 'https://wovomedia.com/api/cron/video-jobs',
      headers := jsonb_build_object(
        'x-wovo-scheduler-bucket', floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
        'x-wovo-scheduler-signature', encode(
          extensions.hmac(
            'wovo-scheduler:/api/cron/video-jobs:' || id || ':' || floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
            token_ciphertext,
            'sha256'
          ),
          'hex'
        )
      ),
      timeout_milliseconds := 10000
    )
    from public.wovo_meta_connections
    where owner_scope = true
      and account_id is null
      and status = 'healthy'
      and kill_switch = false
    limit 1;
  $cron$
);

select cron.schedule(
  'wovo-social-publishing-hourly',
  '15 * * * *',
  $cron$
    select net.http_get(
      url := 'https://wovomedia.com/api/cron/social-publishing',
      headers := jsonb_build_object(
        'x-wovo-scheduler-bucket', floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
        'x-wovo-scheduler-signature', encode(
          extensions.hmac(
            'wovo-scheduler:/api/cron/social-publishing:' || id || ':' || floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
            token_ciphertext,
            'sha256'
          ),
          'hex'
        )
      ),
      timeout_milliseconds := 10000
    )
    from public.wovo_meta_connections
    where owner_scope = true
      and account_id is null
      and status = 'healthy'
      and kill_switch = false
    limit 1;
  $cron$
);
