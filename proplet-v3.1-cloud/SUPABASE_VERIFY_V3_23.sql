-- Proplet v3.23 — post-migration verification
-- Run AFTER SUPABASE_MIGRATION_V3_23.sql and BEFORE deploying the 3.23 app.
-- Fails loudly if any required launch-readiness database invariant is missing.
-- The only temporary write is one isolated rate-limit probe, removed again in the same script.

begin;

do $$
declare
  nullable_flag text;
  delete_rule text;
  rls_rate boolean;
  rls_ops boolean;
  rls_support boolean;
  fn_rate regprocedure;
  fn_house regprocedure;
begin
  -- Secondary session lifetime columns.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player_sessions' and column_name='expires_at' and data_type='timestamp with time zone'
  ) then
    raise exception 'VERIFY v3.23: player_sessions.expires_at missing or wrong type';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='player_sessions' and column_name='last_used_at' and data_type='timestamp with time zone'
  ) then
    raise exception 'VERIFY v3.23: player_sessions.last_used_at missing or wrong type';
  end if;
  if exists (select 1 from public.player_sessions where expires_at is null) then
    raise exception 'VERIFY v3.23: some secondary sessions still have NULL expires_at';
  end if;

  -- New security/operations tables.
  if to_regclass('public.security_rate_limits') is null then
    raise exception 'VERIFY v3.23: security_rate_limits missing';
  end if;
  if to_regclass('public.operational_events') is null then
    raise exception 'VERIFY v3.23: operational_events missing';
  end if;
  if to_regclass('public.support_reports') is null then
    raise exception 'VERIFY v3.23: support_reports missing';
  end if;

  select relrowsecurity into rls_rate from pg_class where oid='public.security_rate_limits'::regclass;
  select relrowsecurity into rls_ops from pg_class where oid='public.operational_events'::regclass;
  select relrowsecurity into rls_support from pg_class where oid='public.support_reports'::regclass;
  if not coalesce(rls_rate,false) or not coalesce(rls_ops,false) or not coalesce(rls_support,false) then
    raise exception 'VERIFY v3.23: RLS is not enabled on all launch-readiness tables';
  end if;

  -- Former admins must be deletable without deleting their historical audit row.
  select is_nullable into nullable_flag
  from information_schema.columns
  where table_schema='public' and table_name='admin_audit_log' and column_name='admin_player_id';
  if nullable_flag is distinct from 'YES' then
    raise exception 'VERIFY v3.23: admin_audit_log.admin_player_id must be nullable';
  end if;

  select rc.delete_rule into delete_rule
  from information_schema.referential_constraints rc
  where rc.constraint_schema='public'
    and rc.constraint_name='admin_audit_log_admin_player_id_fkey';
  if delete_rule is distinct from 'SET NULL' then
    raise exception 'VERIFY v3.23: admin audit FK must use ON DELETE SET NULL, found %', coalesce(delete_rule,'missing');
  end if;

  -- Required RPCs and privilege boundary.
  fn_rate := to_regprocedure('public.proplet_rate_limit(text,text,integer,integer)');
  fn_house := to_regprocedure('public.proplet_launch_housekeeping()');
  if fn_rate is null then
    raise exception 'VERIFY v3.23: proplet_rate_limit RPC missing';
  end if;
  if fn_house is null then
    raise exception 'VERIFY v3.23: proplet_launch_housekeeping RPC missing';
  end if;

  if has_function_privilege('anon', fn_rate, 'EXECUTE') or has_function_privilege('authenticated', fn_rate, 'EXECUTE') then
    raise exception 'VERIFY v3.23: anon/authenticated can execute proplet_rate_limit';
  end if;
  if has_function_privilege('anon', fn_house, 'EXECUTE') or has_function_privilege('authenticated', fn_house, 'EXECUTE') then
    raise exception 'VERIFY v3.23: anon/authenticated can execute proplet_launch_housekeeping';
  end if;

  if not has_function_privilege('service_role', fn_rate, 'EXECUTE') then
    raise exception 'VERIFY v3.23: service_role cannot execute proplet_rate_limit';
  end if;
  if not has_function_privilege('service_role', fn_house, 'EXECUTE') then
    raise exception 'VERIFY v3.23: service_role cannot execute proplet_launch_housekeeping';
  end if;
end
$$;

-- Exercise the atomic rate-limit RPC with a dedicated non-secret test actor.
do $$
declare
  first_allowed boolean;
  first_remaining integer;
  second_allowed boolean;
  second_remaining integer;
begin
  select allowed, remaining into first_allowed, first_remaining
  from public.proplet_rate_limit(
    '__v323_verify__',
    repeat('a',64),
    60,
    1
  );
  select allowed, remaining into second_allowed, second_remaining
  from public.proplet_rate_limit(
    '__v323_verify__',
    repeat('a',64),
    60,
    1
  );
  if first_allowed is not true or first_remaining <> 0 then
    raise exception 'VERIFY v3.23: rate limiter first hit behaved unexpectedly';
  end if;
  if second_allowed is not false or second_remaining <> 0 then
    raise exception 'VERIFY v3.23: rate limiter did not block the second hit';
  end if;
end
$$;

delete from public.security_rate_limits
where scope='__v323_verify__' and actor_hash=repeat('a',64);

commit;

select jsonb_build_object(
  'verification', 'PASS',
  'version', '3.23.0',
  'sessionExpiryColumns', true,
  'securityRateLimits', true,
  'operationalEvents', true,
  'supportReports', true,
  'adminAuditDeleteRule', 'SET NULL',
  'rateLimiterProbe', true,
  'serviceOnlyRpcs', true
) as proplet_v3_23_verify;
