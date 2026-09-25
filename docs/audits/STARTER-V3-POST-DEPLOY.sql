-- Read-only after an explicitly approved deployment. Wait for organic traffic.
SELECT onboarding_version, client_release, event_type, count(*) AS rows,
       count(DISTINCT coalesce(player_id::text,anonymous_id)) AS actors,
       min(created_at) AS first_at, max(created_at) AS last_at
FROM public.product_events
WHERE environment='production' AND is_test=false
  AND client_release='proplet-v4.02.2-starterinput1'
  AND (event_type LIKE 'starter_v1_%' OR event_type LIKE 'first_steps_v1_%')
GROUP BY onboarding_version,client_release,event_type
ORDER BY onboarding_version,event_type;
-- Empty result = no organic evidence yet, never a PASS on its own.
-- Expected: board-v3-short only. Do not generate production test events to fill it.
