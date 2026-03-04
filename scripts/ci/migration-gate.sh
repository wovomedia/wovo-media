#!/usr/bin/env bash
set -euo pipefail

# 1) Apply migrations in order.
for migration in $(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

# 2) Validation checks (must all pass).
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  -- Check required tables.
  if to_regclass('public.subscriptions') is null then
    raise exception 'Missing table public.subscriptions';
  end if;

  if to_regclass('public.generations') is null then
    raise exception 'Missing table public.generations';
  end if;

  -- Check function signature: consume_generation_credit(uuid)
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'consume_generation_credit'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    raise exception 'Missing function public.consume_generation_credit(uuid)';
  end if;

  -- Check required columns on public.subscriptions.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'credits_total'
  ) then
    raise exception 'Missing column public.subscriptions.credits_total';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'credits_remaining'
  ) then
    raise exception 'Missing column public.subscriptions.credits_remaining';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'weekly_limit'
  ) then
    raise exception 'Missing column public.subscriptions.weekly_limit';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'weekly_used'
  ) then
    raise exception 'Missing column public.subscriptions.weekly_used';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'week_start'
  ) then
    raise exception 'Missing column public.subscriptions.week_start';
  end if;
end
$$;
SQL
