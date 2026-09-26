-- Read-only. Pin the upper cutoff for a reproducible report; UTC timestamps.
-- A result with <30 requested runs is WAITING, never definitive PASS.
WITH events AS (
 SELECT *,context->>'starter_run_id' AS run FROM public.product_events
 WHERE environment='production' AND is_test=false AND client_release='proplet-v4.02.2-flowcontext1'
), cohort AS (
 SELECT DISTINCT run FROM events WHERE event_type='starter_v1_requested' AND onboarding_version='board-v3-short' AND run IS NOT NULL
), phases AS (
 SELECT e.*, CASE event_type WHEN 'starter_v1_requested' THEN 1 WHEN 'starter_v1_data_ready' THEN 2 WHEN 'starter_v1_ready' THEN 3 WHEN 'starter_v1_interaction' THEN 4 WHEN 'starter_v1_first_correct' THEN 5 WHEN 'starter_v1_completed' THEN 6 END AS phase
 FROM events e JOIN cohort c USING(run) WHERE event_type LIKE 'starter_v1_%'
), ordered AS (
 SELECT *,lag(phase) OVER(PARTITION BY run ORDER BY created_at,phase) AS previous FROM phases WHERE phase IS NOT NULL
)
SELECT (SELECT count(*) FROM cohort) AS new_non_test_runs,
 (SELECT count(*) FROM events WHERE event_type LIKE 'starter_v1_%' AND nullif(run,'') IS NULL) AS missing_run_ids,
 (SELECT count(*) FROM (SELECT run FROM phases GROUP BY run HAVING count(DISTINCT onboarding_version)>1 OR min(onboarding_version)<>'board-v3-short') x) AS mixed_or_wrong_versions,
 (SELECT count(*) FROM (SELECT run,event_type FROM phases GROUP BY run,event_type HAVING count(*)>1) x) AS duplicate_phases,
 (SELECT count(*) FROM ordered WHERE phase<previous) AS wrong_order,
 (SELECT count(*) FROM phases WHERE event_type IN ('starter_v1_left','starter_v1_hidden','starter_v1_cancelled','starter_v1_failed') AND nullif(context->>'reason','') IS NULL) AS missing_reasons;

-- Account funnel join uses stable flow ID, never timing-based attribution.
WITH e AS (
 SELECT *,context->>'first_steps_run_id' AS flow FROM public.product_events
 WHERE environment='production' AND NOT is_test AND client_release='proplet-v4.02.2-flowcontext1'
), accounts AS (SELECT * FROM e WHERE event_type='account_created' AND context->>'creation_source'='first_steps_v1')
SELECT a.id AS signup_event,a.flow,
 EXISTS(SELECT 1 FROM e WHERE flow=a.flow AND event_type='first_steps_v1_offer' AND created_at<=a.created_at) AS has_offer,
 EXISTS(SELECT 1 FROM e WHERE flow=a.flow AND event_type IN ('first_steps_v1_google','first_steps_v1_manual') AND created_at<=a.created_at) AS has_branch,
 (SELECT count(*) FROM e WHERE flow=a.flow AND event_type='first_steps_v1_saved') AS saved_count,
 EXISTS(SELECT 1 FROM public.results r WHERE r.player_id=a.player_id AND r.challenge_key='starter:starter-v1')
 AND EXISTS(SELECT 1 FROM public.results r WHERE r.player_id=a.player_id AND r.challenge_key='free:g4-e-001') AS both_results_stored
FROM accounts a;

-- Must be empty: false saved, duplicates, wrong order, lost correlation.
WITH e AS (
 SELECT *,context->>'first_steps_run_id' flow FROM public.product_events
 WHERE environment='production' AND NOT is_test AND client_release='proplet-v4.02.2-flowcontext1'
)
SELECT id,event_type,flow FROM e s WHERE event_type='first_steps_v1_saved' AND (
 flow IS NULL OR NOT EXISTS(SELECT 1 FROM e a WHERE a.flow=s.flow AND a.event_type='first_steps_v1_offer' AND a.created_at<=s.created_at)
 OR NOT EXISTS(SELECT 1 FROM public.results r WHERE r.player_id=s.player_id AND r.challenge_key='starter:starter-v1')
 OR NOT EXISTS(SELECT 1 FROM public.results r WHERE r.player_id=s.player_id AND r.challenge_key='free:g4-e-001'));
-- Existing-account login can legitimately save without a NEW account_created.
-- Check 5xx separately in Vercel logs for /api/product-event, /api/player,
-- /api/auth/google/*, /api/anonymous/claim, /api/result and /api/progress.
