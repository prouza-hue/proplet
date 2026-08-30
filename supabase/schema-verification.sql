-- Proplet schema verification definitions (read-only; never an apply migration).
-- Run manually against a disposable/known target only after human approval.
-- These statements intentionally contain SELECT only and do not change data or schema.

-- Confirm the core runtime tables and their owners.
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in ('players', 'results', 'player_sessions', 'push_subscriptions')
order by table_name;

-- Confirm the columns needed by the current v4.01 runtime contracts.
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('players', 'results', 'push_subscriptions')
order by table_name, ordinal_position;

-- Confirm routine names/signatures without invoking any routine.
select n.nspname as routine_schema,
       p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prokind
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'proplet_claim_word_discovery',
    'proplet_rankings_xp_aggregate',
    'proplet_upsert_push_subscription',
    'proplet_push_return_cohort'
  )
order by p.proname, arguments;

-- Confirm row-level security is enabled for the browser-inaccessible core tables.
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as row_security_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('players', 'results', 'player_sessions', 'push_subscriptions')
order by c.relname;
