-- PROPOSAL ONLY. Not an automatically applied migration. Run dry-run first.
-- Defaults to ROLLBACK. COMMIT requires separately approved execution.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE starter_v3_before ON COMMIT DROP AS
SELECT id, onboarding_version
FROM public.product_events
WHERE environment = 'production' AND is_test = false
  AND onboarding_version = 'legacy'
  AND client_release IN ('proplet-v4.02.2-firststeps5','proplet-v4.02.2-metaacquisition2');
SELECT count(*) AS before_rows FROM starter_v3_before;
UPDATE public.product_events e SET onboarding_version = 'board-v3-short'
FROM starter_v3_before b
WHERE e.id=b.id AND e.environment='production' AND e.is_test=false
  AND e.onboarding_version='legacy'
  AND e.client_release IN ('proplet-v4.02.2-firststeps5','proplet-v4.02.2-metaacquisition2');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM starter_v3_before b LEFT JOIN public.product_events e USING(id)
            WHERE e.id IS NULL OR e.onboarding_version IS DISTINCT FROM 'board-v3-short')
 THEN RAISE EXCEPTION 'Backfill post-check failed'; END IF;
END $$;
SELECT count(*) AS after_rows FROM starter_v3_before b JOIN public.product_events e USING(id)
WHERE e.onboarding_version='board-v3-short';
ROLLBACK;
