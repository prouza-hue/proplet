-- Operator read in the isolated QA project. Zero rows mean the latest draft has not been handed in.
select b.revision,b.submitted_at,coalesce((
  select jsonb_object_agg('tajenka-v2-week-'||r.edition,jsonb_build_object('version',r.version,'fields',r.fields))
  from proplet_editorial.tajenka_reviews r
),'{}'::jsonb) as reviews
from proplet_editorial.tajenka_batch b
where b.series='2026-12' and b.submitted_revision=b.revision and b.submitted_at is not null
  and b.processed_revision is distinct from b.revision;

-- After successful processing, bind $1 to the exact revision returned above.
-- UPDATE proplet_editorial.tajenka_batch SET processed_revision=$1
-- WHERE series='2026-12' AND revision=$1 AND submitted_revision=$1 AND submitted_at IS NOT NULL
--   AND processed_revision IS DISTINCT FROM $1 RETURNING revision;
