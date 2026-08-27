-- Restore the explicit WOVO-owner publishing opt-in recorded by the existing
-- scheduled policy and disabled kill switch. Client connections are untouched.
update public.wovo_meta_connections
set auto_publish_opted_in_at = coalesce(auto_publish_opted_in_at, now()),
    updated_at = now()
where owner_scope = true
  and account_id is null
  and status = 'healthy'
  and action_policy = 'scheduled_auto_publish'
  and kill_switch = false;
