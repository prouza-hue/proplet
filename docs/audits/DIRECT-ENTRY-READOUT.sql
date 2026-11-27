-- Read only. Monitor the 100% direct-entry rollout in production.
WITH bounds AS (
    SELECT starts_at, enabled, statement_timestamp() AS as_of
    FROM proplet_experiment_internal.entry_direct_control
    WHERE environment='production'
), cohort AS MATERIALIZED (
    SELECT a.*, receipt.player_id, receipt.id IS NULL AS missing_receipt,
           count(receipt.player_id) OVER (PARTITION BY receipt.player_id)>1 AS shared_account
    FROM proplet_experiment_internal.entry_assignments a
    CROSS JOIN bounds b
    LEFT JOIN public.product_events receipt
        ON receipt.id=a.event_id AND receipt.environment='production' AND NOT receipt.is_test
        AND receipt.event_type='entry_experiment_assigned'
        AND receipt.context->>'entry_experiment'='new-player-entry-v1'
        AND receipt.context->>'entry_allocation_policy'='direct_entry_v1'
        AND receipt.context->>'entry_variant'=a.variant
        AND receipt.context->>'first_steps_run_id'=a.first_steps_run_id::text
    WHERE a.environment='production' AND NOT a.is_test
      AND a.allocation_policy='direct_entry_v1'
      AND a.assigned_at>=b.starts_at AND a.assigned_at<b.as_of
), scored AS (
    SELECT a.*,
           (a.missing_receipt OR a.shared_account OR
            a.variant IS DISTINCT FROM 'B') AS investigate,
           EXISTS (
               SELECT FROM public.product_events e
               WHERE e.environment='production' AND NOT e.is_test
                 AND e.event_type='entry_board_load_failed'
                 AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
                 AND e.created_at>=a.assigned_at
                 AND e.created_at<least(b.as_of,a.assigned_at+interval '24 hours')
           ) AS load_failed,
           CASE WHEN a.assigned_at+interval '24 hours'<=b.as_of THEN (
               EXISTS (
                   SELECT FROM public.puzzle_attempts g
                   WHERE g.environment='production' AND NOT g.is_test
                     AND g.mode IN ('free','daily','daily_special','tajenka')
                     AND g.puzzle_id<>'starter-v1'
                     AND g.started_at>=a.assigned_at AND g.completed_at>=g.started_at
                     AND g.completed_at<a.assigned_at+interval '24 hours'
                     AND (g.anonymous_id=a.anonymous_id OR
                          (g.anonymous_id IS NULL AND NOT a.shared_account AND g.player_id=a.player_id))
               ) OR EXISTS (
                   SELECT FROM public.product_events e
                   WHERE e.environment='production' AND NOT e.is_test
                     AND e.event_type='tajenka_completed'
                     AND e.created_at>=a.assigned_at AND e.created_at<a.assigned_at+interval '24 hours'
                     AND (e.anonymous_id=a.anonymous_id OR
                          (e.anonymous_id IS NULL AND NOT a.shared_account AND e.player_id=a.player_id))
               )
           ) END AS completed
    FROM cohort a CROSS JOIN bounds b
)
SELECT b.starts_at,b.enabled,b.as_of AS read_at,
       count(s.event_id) AS assigned,
       count(*) FILTER (WHERE (s.assigned_at AT TIME ZONE 'Europe/Prague')::date =
                              (b.as_of AT TIME ZONE 'Europe/Prague')::date-1) AS assigned_yesterday,
       count(s.completed) AS observed_24h,
       count(*) FILTER (WHERE s.completed) AS completed_24h,
       count(*) FILTER (WHERE s.investigate) AS investigate,
       count(*) FILTER (WHERE s.shared_account) AS shared_accounts,
       count(*) FILTER (WHERE s.load_failed) AS load_failures
FROM bounds b LEFT JOIN scored s ON true
GROUP BY b.starts_at,b.enabled,b.as_of;
