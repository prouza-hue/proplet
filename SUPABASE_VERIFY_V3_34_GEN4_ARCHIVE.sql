-- Read-only verification after SUPABASE_MIGRATION_V3_34_GEN4_ARCHIVE.sql

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('content_catalog', 'content_catalog_contexts', 'content_archive_tombstones')
order by table_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('results', 'puzzle_runs', 'puzzle_attempts')
  and column_name in (
    'content_key',
    'content_generation',
    'content_bank',
    'content_level',
    'content_lineage_confidence',
    'calm_mode'
  )
order by table_name, column_name;

select
  (select count(*) from public.content_catalog) as catalog_rows,
  (select count(*) from public.content_catalog_contexts) as context_rows,
  (select count(*) from public.content_archive_tombstones) as tombstone_rows,
  (select count(*) from public.results where content_key is not null) as results_backfilled,
  (select count(*) from public.puzzle_runs where content_key is not null) as runs_backfilled,
  (select count(*) from public.puzzle_attempts where content_key is not null) as attempts_backfilled;

select table_name, content_lineage_confidence, count(*) as rows
from (
  select 'results'::text table_name, content_lineage_confidence from public.results
  union all select 'puzzle_runs', content_lineage_confidence from public.puzzle_runs
  union all select 'puzzle_attempts', content_lineage_confidence from public.puzzle_attempts
) lineage
group by table_name, content_lineage_confidence
order by table_name, content_lineage_confidence;

select
  content_generation,
  content_bank,
  difficulty,
  puzzle_count,
  completed_results,
  completed_runs
from public.content_archive_stats
order by content_generation, content_bank, difficulty;

select event_object_table, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name like '%attach_content_lineage'
order by event_object_table;

select
  (select count(*) from public.results where calm_mode) as calm_results,
  (select count(*) from public.puzzle_runs where calm_mode) as calm_runs,
  (select count(*) from public.puzzle_attempts where calm_mode) as calm_attempts;
