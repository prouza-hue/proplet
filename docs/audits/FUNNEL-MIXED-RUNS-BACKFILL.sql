-- Exact mixed-run repair only. Review dry-run first; ROLLBACK is the safe default.
-- Legacy rows retain the separate two-release allowlist proposal; no inferred account history.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE funnel_repair_ids ON COMMIT DROP AS
WITH phases AS (
 SELECT id,created_at,onboarding_version,context->>'starter_run_id' AS run
 FROM public.product_events WHERE environment='production' AND is_test=false
 AND event_type LIKE 'starter_v1_%' AND nullif(context->>'starter_run_id','') IS NOT NULL
), firsts AS (
 SELECT DISTINCT ON (run) run,created_at,onboarding_version FROM phases ORDER BY run,created_at,id
)
SELECT p.id,p.run FROM phases p JOIN firsts f USING(run)
WHERE f.onboarding_version='board-v3-short' AND p.onboarding_version='board-v2' AND p.created_at>f.created_at
AND NOT EXISTS (SELECT 1 FROM phases x WHERE x.run=f.run AND x.created_at<=f.created_at AND x.onboarding_version<>'board-v3-short');
SELECT count(*) AS before_rows,count(DISTINCT run) AS before_runs FROM funnel_repair_ids;
UPDATE public.product_events e SET onboarding_version='board-v3-short'
FROM funnel_repair_ids f WHERE e.id=f.id AND e.environment='production' AND e.is_test=false AND e.onboarding_version='board-v2';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.product_events e JOIN funnel_repair_ids f USING(id) WHERE e.onboarding_version<>'board-v3-short') THEN RAISE EXCEPTION 'Backfill verification failed'; END IF;
END $$;
SELECT count(*) AS verified_rows,count(DISTINCT f.run) AS verified_runs FROM public.product_events e JOIN funnel_repair_ids f USING(id) WHERE e.onboarding_version='board-v3-short';
ROLLBACK;
