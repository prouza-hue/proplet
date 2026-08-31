-- Sprint 08B safe production rollback.
-- Disable PROPLET_ATOMIC_RESULT_V1_ENABLED first, then remove only the RPC.
-- The additive ledger, receipts and run links intentionally remain for audit
-- and for already accepted results; destructive schema downgrade is unsafe.

begin;

revoke all on function public.proplet_submit_result_v1(uuid, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
drop function if exists public.proplet_submit_result_v1(uuid, text, text, text, jsonb);

commit;
