-- Proplet v3.30 — verification after SUPABASE_MIGRATION_V3_30.sql
-- Expected result: one JSON object with "verification":"PASS".

with push_cols as (
  select
    count(*) filter (where column_name = 'daily_enabled' and is_nullable = 'NO') as daily_ok,
    count(*) filter (where column_name = 'content_enabled' and is_nullable = 'NO') as content_ok
  from information_schema.columns
  where table_schema = 'public' and table_name = 'push_subscriptions'
),
level_constraint as (
  select coalesce(pg_get_constraintdef(c.oid), '') as definition
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'free_slot_rewards'
    and c.conname = 'free_slot_rewards_level_check'
  limit 1
),
delivery_table as (
  select count(*) as n
  from information_schema.tables
  where table_schema = 'public' and table_name = 'push_delivery_log'
),
content_default as (
  select count(*) filter (where content_enabled = false) as disabled,
         count(*) as total
  from public.push_subscriptions
)
select json_build_object(
  'verification', case
    when (select daily_ok from push_cols) = 1
     and (select content_ok from push_cols) = 1
     and (select n from delivery_table) = 1
     and (select definition from level_constraint) ilike '%level >= 1%'
     and (select definition from level_constraint) not ilike '%200%'
    then 'PASS' else 'FAIL' end,
  'pushPreferenceColumns', json_build_object(
    'dailyEnabled', (select daily_ok from push_cols) = 1,
    'contentEnabled', (select content_ok from push_cols) = 1
  ),
  'existingSubscriptions', json_build_object(
    'total', (select total from content_default),
    'contentOff', (select disabled from content_default)
  ),
  'deliveryLedger', (select n from delivery_table) = 1,
  'freeSlotConstraint', (select definition from level_constraint)
) as proplet_v3_30;
