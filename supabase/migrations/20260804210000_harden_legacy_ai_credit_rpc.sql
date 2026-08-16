-- Legacy WOVO AI routes call this RPC through the server service role. Browser
-- roles must never be able to debit another user's generation allowance.
revoke all on function public.consume_generation_credit(uuid) from public, anon, authenticated;
grant execute on function public.consume_generation_credit(uuid) to service_role;

comment on function public.consume_generation_credit(uuid) is
  'Server-only legacy WOVO AI credit debit. New WOVO AI uses idempotent workspace usage reservations.';
