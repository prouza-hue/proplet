-- Read-only verification after SUPABASE_MIGRATION_V4_01_39_QUERY_BOUNDS.sql

select
  p.proname,
  p.prosecdef as security_definer,
  p.provolatile,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'proplet_ranking_runs_v1',
    'proplet_admin_overview_v1',
    'proplet_admin_users_v1'
  )
order by p.proname;

explain (format json)
select r.id, r.player_id, r.completed_at
from public.puzzle_runs r
where r.mode = 'daily'
  and r.puzzle_id = '__s09_verify_missing__'
  and r.calm_mode = false
order by r.completed_at asc, r.id asc;
