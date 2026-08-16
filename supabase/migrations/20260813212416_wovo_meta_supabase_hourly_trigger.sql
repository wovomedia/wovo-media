-- The Vercel Hobby plan permits daily crons only. Supabase Cron provides the
-- hourly trigger while the Vercel function remains the only component allowed
-- to decrypt provider tokens or publish. The request is authenticated with a
-- one-hour HMAC derived from encrypted server-only connection material; no
-- plaintext provider token or additional shared secret is sent or stored.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'wovo-meta-publishing-hourly',
  '0 * * * *',
  $cron$
    select net.http_get(
      url := 'https://wovomedia.com/api/cron/meta-publishing',
      headers := jsonb_build_object(
        'x-wovo-meta-scheduler-bucket',
        floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
        'x-wovo-meta-scheduler-signature',
        encode(
          extensions.hmac(
            'wovo-meta-scheduler:' || id || ':' || floor(extract(epoch from clock_timestamp()) / 3600)::bigint::text,
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
      and action_policy = 'scheduled_auto_publish'
      and kill_switch = false
    limit 1;
  $cron$
);
