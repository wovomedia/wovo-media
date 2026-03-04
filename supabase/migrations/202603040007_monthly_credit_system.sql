alter table public.profiles
  add column if not exists plan text default 'starter',
  add column if not exists monthly_limit integer not null default 25,
  add column if not exists monthly_used integer not null default 0,
  add column if not exists credits_reset_at timestamptz not null default now(),
  add column if not exists extra_credits integer not null default 0;

create or replace function public.consume_generation_credit(p_user_id uuid)
returns table (
  consumed boolean,
  monthly_limit integer,
  monthly_used integer,
  extra_credits integer,
  remaining_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  period_start timestamptz;
  curr_limit integer;
  curr_used integer;
  curr_extra integer;
begin
  period_start := date_trunc('month', now());

  update public.profiles
    set monthly_used = case
          when credits_reset_at < period_start then 0
          else monthly_used
        end,
        credits_reset_at = case
          when credits_reset_at < period_start then period_start
          else credits_reset_at
        end,
        updated_at = now()
  where user_id = p_user_id;

  update public.profiles
    set monthly_used = monthly_used + 1,
        updated_at = now()
  where user_id = p_user_id
    and (monthly_limit + extra_credits - monthly_used) > 0
  returning profiles.monthly_limit, profiles.monthly_used, profiles.extra_credits
    into curr_limit, curr_used, curr_extra;

  if found then
    return query select true, curr_limit, curr_used, curr_extra, curr_limit + curr_extra - curr_used;
  else
    select p.monthly_limit, p.monthly_used, p.extra_credits
      into curr_limit, curr_used, curr_extra
    from public.profiles p
    where p.user_id = p_user_id;

    return query select false,
      coalesce(curr_limit, 0),
      coalesce(curr_used, 0),
      coalesce(curr_extra, 0),
      greatest(coalesce(curr_limit, 0) + coalesce(curr_extra, 0) - coalesce(curr_used, 0), 0);
  end if;
end;
$$;

grant execute on function public.consume_generation_credit(uuid) to authenticated;
