-- Make future-date approvals a single database transaction and tighten
-- execution privileges on helper/trigger functions.

create or replace function public.wovo_approve_content_range(
  p_account_id uuid,
  p_approved_by uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_correlation_id uuid default gen_random_uuid()
) returns setof public.wovo_portal_content_approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  if p_range_start is null or p_range_end is null or p_range_end < p_range_start then
    raise exception 'A valid approval date range is required';
  end if;
  if p_range_end - p_range_start > interval '93 days' then
    raise exception 'Approve at most 93 days at once';
  end if;
  for v_item in
    select id
    from public.wovo_portal_content_items
    where account_id = p_account_id
      and status in ('draft', 'client_review', 'revision_requested')
      and scheduled_for between p_range_start and p_range_end
      and archived_at is null
    order by scheduled_for asc, id asc
    for update
  loop
    v_count := v_count + 1;
    if v_count > 100 then raise exception 'Approve at most 100 items at once'; end if;
    return next public.wovo_approve_content_item(
      p_account_id,
      v_item.id,
      p_approved_by,
      'date_range',
      p_range_start,
      p_range_end,
      p_correlation_id
    );
  end loop;
  if v_count = 0 then raise exception 'No review-ready scheduled posts were found in that range'; end if;
  return;
end;
$$;

revoke all on function public.wovo_approve_content_range(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.wovo_approve_content_range(uuid, uuid, timestamptz, timestamptz, uuid) to service_role;
revoke all on function public.wovo_validate_content_approval() from public, anon, authenticated;
revoke all on function public.wovo_protect_content_approval_snapshot() from public, anon, authenticated;
