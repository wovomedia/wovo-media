do $$
declare
  expected_columns text[] := array[
    'user_id',
    'stripe_customer_id',
    'stripe_subscription_id',
    'plan',
    'status',
    'current_period_start',
    'current_period_end',
    'credits_total',
    'credits_remaining',
    'weekly_limit',
    'weekly_used',
    'week_start',
    'updated_at'
  ];
  missing_columns text[];
begin
  select array_agg(col)
  into missing_columns
  from unnest(expected_columns) as col
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'subscriptions'
      and c.column_name = col
  );

  if to_regclass('public.subscriptions') is null then
    raise exception 'Missing required table: public.subscriptions';
  end if;

  if coalesce(array_length(missing_columns, 1), 0) > 0 then
    raise exception 'Missing subscriptions columns: %', array_to_string(missing_columns, ', ');
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'consume_generation_credit'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) then
    raise exception 'Missing required function: public.consume_generation_credit(uuid)';
  end if;
end;
$$;
