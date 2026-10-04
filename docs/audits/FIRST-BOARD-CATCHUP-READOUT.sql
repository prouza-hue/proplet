-- READ ONLY. Operational catch-up is descriptive, NOT a randomized arm comparison.
-- Missing historical policy = hash50_v1. Keep separate rows by policy.
-- Replace analysis_as_of with a locked UTC timestamp for the Oct 5 report.
WITH params AS (
  SELECT date_trunc('minute', statement_timestamp()) AS analysis_as_of
), events AS MATERIALIZED (
  SELECT pe.*, nullif(context->>'first_steps_run_id','') AS flow
  FROM public.product_events pe, params p
  WHERE environment='production' AND is_test=false
    AND created_at >= timestamptz '2026-09-29 07:51:16+00'
    AND created_at < p.analysis_as_of
    AND event_type IN ('first_board_experiment_assigned','first_board_experiment_started',
      'first_board_experiment_completed','first_steps_v1_offer','first_steps_v1_google',
      'first_steps_v1_manual','first_steps_v1_continue','account_created','first_steps_v1_saved')
), assignments AS (
  SELECT flow, min(created_at) assigned_at,
    min(context->>'experiment_variant') variant,
    min(coalesce(context->>'experiment_allocation_policy','hash50_v1')) policy,
    min(context->>'puzzle_id') puzzle_id,
    count(*) assignment_events,
    count(DISTINCT coalesce(context->>'experiment_allocation_policy','hash50_v1')) policy_count,
    count(DISTINCT context->>'experiment_variant') variant_count
  FROM events
  WHERE event_type='first_board_experiment_assigned'
    AND context->>'experiment_key'='first-board-v1'
  GROUP BY flow
), windows(label, mature_only) AS (
  VALUES ('live_diagnostic'::text,false), ('mature_24h'::text,true)
), flows AS (
  SELECT w.label,a.policy,a.variant,a.flow,a.assigned_at,
    min(e.created_at) FILTER (WHERE e.event_type='first_board_experiment_started') started_at,
    min(e.created_at) FILTER (WHERE e.event_type='first_board_experiment_completed') completed_at,
    min(e.created_at) FILTER (WHERE e.event_type='first_steps_v1_offer') offer_at,
    min(e.created_at) FILTER (WHERE e.event_type='account_created') account_at,
    min(e.created_at) FILTER (WHERE e.event_type='first_steps_v1_saved') saved_at
  FROM assignments a CROSS JOIN windows w CROSS JOIN params p
  LEFT JOIN events e ON e.flow=a.flow
    AND e.created_at>=a.assigned_at
    AND (NOT w.mature_only OR e.created_at<a.assigned_at+interval '24 hours')
  WHERE a.flow IS NOT NULL AND a.assignment_events=1
    AND a.policy_count=1 AND a.variant_count=1
    AND (NOT w.mature_only OR a.assigned_at<=p.analysis_as_of-interval '24 hours')
  GROUP BY w.label,a.policy,a.variant,a.flow,a.assigned_at
)
SELECT label,policy,variant,count(*) assigned,
  count(*) FILTER (WHERE started_at IS NOT NULL) started,
  count(*) FILTER (WHERE completed_at>=started_at) completed,
  count(*) FILTER (WHERE offer_at>=completed_at) offer,
  count(*) FILTER (WHERE account_at>=offer_at) new_accounts,
  count(*) FILTER (WHERE saved_at>=completed_at) saved_any_account,
  count(*) FILTER (WHERE saved_at>=account_at AND account_at>=offer_at) saved_after_new_account,
  min(assigned_at) first_assignment,max(assigned_at) last_assignment
FROM flows GROUP BY label,policy,variant ORDER BY label,policy,variant;
