-- The current owner portal uses server-scoped queries and does not consume this
-- legacy aggregate view. It must not expose organization metrics through PostgREST.
alter view public.owner_dashboard_stats set (security_invoker = true);
revoke all on public.owner_dashboard_stats from anon, authenticated;

-- These helpers are used by authenticated RLS policies. Anonymous callers do
-- not need direct RPC access, and a fixed search path prevents object shadowing.
alter function public.get_my_wovo_role() set search_path = pg_catalog, public;
alter function public.is_wovo_staff() set search_path = pg_catalog, public;
revoke execute on function public.get_my_wovo_role() from public, anon;
revoke execute on function public.is_wovo_staff() from public, anon;
grant execute on function public.get_my_wovo_role() to authenticated;
grant execute on function public.is_wovo_staff() to authenticated;
