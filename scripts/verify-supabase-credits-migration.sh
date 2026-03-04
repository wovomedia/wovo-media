#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is required" >&2
  exit 1
fi

MIGRATION_DIR="supabase/migrations"
TARGET_MIGRATION="${MIGRATION_DIR}/202603040005_subscription_credits_refactor.sql"

if [[ ! -d "${MIGRATION_DIR}" ]]; then
  echo "Missing migration directory: ${MIGRATION_DIR}" >&2
  exit 1
fi

if [[ ! -f "${TARGET_MIGRATION}" ]]; then
  echo "Missing expected migration: ${TARGET_MIGRATION}" >&2
  exit 1
fi

echo "Applying migrations in lexical order..."
while IFS= read -r migration; do
  echo "  -> ${migration}"
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -f "${migration}"
done < <(find "${MIGRATION_DIR}" -maxdepth 1 -type f -name '*.sql' | sort)

echo "Validating subscription credits schema + function signature..."
psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'credits_total'
  ) then
    raise exception 'Missing public.subscriptions.credits_total';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'credits_remaining'
  ) then
    raise exception 'Missing public.subscriptions.credits_remaining';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'weekly_limit'
  ) then
    raise exception 'Missing public.subscriptions.weekly_limit';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'weekly_used'
  ) then
    raise exception 'Missing public.subscriptions.weekly_used';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'week_start'
  ) then
    raise exception 'Missing public.subscriptions.week_start';
  end if;

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
end
$$;
SQL

echo "Verifying backfill from legacy monthly_credits_* columns (if they exist)..."
psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'monthly_credits_total'
  ) then
    if exists (
      select 1
      from public.subscriptions
      where coalesce(monthly_credits_total, 0) > 0
        and coalesce(credits_total, 0) = 0
    ) then
      raise exception 'Backfill failed for credits_total from monthly_credits_total';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'monthly_credits_remaining'
  ) then
    if exists (
      select 1
      from public.subscriptions
      where coalesce(monthly_credits_remaining, 0) > 0
        and coalesce(credits_remaining, 0) = 0
    ) then
      raise exception 'Backfill failed for credits_remaining from monthly_credits_remaining';
    end if;
  end if;
end
$$;
SQL

echo "Refreshing consume_generation_credit(uuid) function body from target migration..."
psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 <<'SQL'
\set ON_ERROR_STOP on
begin;
\i supabase/migrations/202603040005_subscription_credits_refactor.sql
commit;
SQL

echo "Done."
