-- first-board-v1: production experiment readout
--
-- READ ONLY: every executable statement in this file is SELECT-only.
-- Cohort contract:
--   environment = 'production' AND is_test = false
--   experiment_key = 'first-board-v1'
--   control_e001    = buckets  0-49 = g4-e-001
--   challenger_e009 = buckets 50-99 = g4-e-009
--
-- Unit: one valid first_steps_run_id with exactly one assignment event.
-- account_created is attributed ONLY through first_steps_run_id.
-- saved_any_account may legitimately exist without account_created when a player
-- signs into an existing account. saved_after_new_account is the strict
-- account_created -> saved step.
--
-- live_diagnostic is useful for instrumentation checks only. mature_24h includes
-- assignments whose complete 24-hour outcome window closed before analysis_as_of.
-- Never call a rolling/live difference an uplift or a product decision.
--
-- For a locked report, replace every analysis_as_of expression below with the
-- same explicit UTC timestamptz literal. The default makes an ad-hoc run usable.

-- 1) Funnel, sample sizes and descriptive conversion by arm.
WITH params AS (
  SELECT
    timestamptz '2026-09-29 07:51:16+00' AS rollout_at,
    date_trunc('minute', statement_timestamp()) AS analysis_as_of,
    interval '24 hours' AS outcome_window
),
variants(variant, board_id) AS (
  VALUES
    ('control_e001'::text, 'g4-e-001'::text),
    ('challenger_e009'::text, 'g4-e-009'::text)
),
cohorts(cohort, mature_only) AS (
  VALUES
    ('live_diagnostic'::text, false),
    ('mature_24h'::text, true)
),
events AS MATERIALIZED (
  SELECT
    pe.id,
    pe.player_id,
    pe.anonymous_id,
    pe.event_type,
    pe.created_at,
    pe.client_release,
    pe.measurement_version,
    pe.onboarding_version,
    pe.context,
    nullif(pe.context ->> 'first_steps_run_id', '') AS flow,
    pe.context ->> 'experiment_key' AS experiment_key,
    pe.context ->> 'experiment_variant' AS variant,
    CASE
      WHEN pe.context ->> 'experiment_bucket' ~ '^[0-9]{1,2}$'
        THEN (pe.context ->> 'experiment_bucket')::integer
    END AS bucket,
    pe.context ->> 'puzzle_id' AS puzzle_id,
    pe.context ->> 'auth_at_event' AS auth_at_event,
    pe.context ->> 'creation_source' AS creation_source
  FROM public.product_events pe
  CROSS JOIN params p
  WHERE pe.environment = 'production'
    AND pe.is_test = false
    AND pe.created_at >= p.rollout_at
    AND pe.created_at < p.analysis_as_of
    AND pe.event_type IN (
      'first_board_experiment_assigned',
      'first_board_experiment_started',
      'first_board_experiment_completed',
      'first_steps_v1_offer',
      'account_created',
      'first_steps_v1_saved'
    )
),
assignment_groups AS (
  SELECT
    flow,
    min(created_at) AS assigned_at,
    min(variant) AS variant,
    min(bucket) AS bucket,
    min(puzzle_id) AS puzzle_id,
    min(client_release) AS client_release,
    min(coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner,
    min(onboarding_version) AS onboarding_version,
    min(measurement_version) AS measurement_version,
    min(auth_at_event) AS auth_at_event,
    count(*) AS assignment_event_count,
    count(DISTINCT variant) AS variant_count,
    count(DISTINCT bucket) AS bucket_count,
    count(DISTINCT puzzle_id) AS puzzle_count,
    count(DISTINCT client_release) AS release_count,
    count(DISTINCT coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner_count
  FROM events
  WHERE event_type = 'first_board_experiment_assigned'
    AND experiment_key = 'first-board-v1'
  GROUP BY flow
),
valid_assignments AS (
  SELECT
    ag.*
  FROM assignment_groups ag
  WHERE ag.flow IS NOT NULL
    AND ag.assignment_event_count = 1
    AND ag.variant_count = 1
    AND ag.bucket_count = 1
    AND ag.puzzle_count = 1
    AND ag.release_count = 1
    AND ag.current_owner_count = 1
    AND ag.measurement_version = 2
    AND ag.onboarding_version = 'board-v3-short'
    AND ag.auth_at_event = 'anonymous'
    AND ag.current_owner IS NOT NULL
    AND (
      (ag.variant = 'control_e001'
        AND ag.bucket BETWEEN 0 AND 49
        AND ag.puzzle_id = 'g4-e-001')
      OR
      (ag.variant = 'challenger_e009'
        AND ag.bucket BETWEEN 50 AND 99
        AND ag.puzzle_id = 'g4-e-009')
    )
),
flow_rollup AS (
  SELECT
    a.flow,
    a.current_owner,
    a.variant,
    a.bucket,
    a.puzzle_id,
    a.client_release,
    a.assigned_at,
    min(e.created_at) FILTER (
      WHERE e.event_type = 'first_board_experiment_started'
    ) AS started_at,
    min(e.created_at) FILTER (
      WHERE e.event_type = 'first_board_experiment_completed'
    ) AS completed_at,
    min(e.created_at) FILTER (
      WHERE e.event_type = 'first_steps_v1_offer'
    ) AS offer_at,
    min(e.created_at) FILTER (
      WHERE e.event_type = 'account_created'
        AND e.creation_source = 'first_steps_v1'
    ) AS account_created_at,
    min(e.created_at) FILTER (
      WHERE e.event_type = 'first_steps_v1_saved'
    ) AS saved_at
  FROM valid_assignments a
  LEFT JOIN events e ON e.flow = a.flow
  GROUP BY
    a.flow,
    a.current_owner,
    a.variant,
    a.bucket,
    a.puzzle_id,
    a.client_release,
    a.assigned_at
),
stages AS (
  SELECT
    fr.*,
    fr.started_at IS NOT NULL
      AND fr.started_at >= fr.assigned_at AS reached_started,
    fr.completed_at IS NOT NULL
      AND fr.started_at IS NOT NULL
      AND fr.completed_at >= fr.started_at AS reached_completed,
    fr.offer_at IS NOT NULL
      AND fr.completed_at IS NOT NULL
      AND fr.offer_at >= fr.completed_at AS reached_offer,
    fr.account_created_at IS NOT NULL
      AND fr.offer_at IS NOT NULL
      AND fr.account_created_at >= fr.offer_at AS reached_account_created,
    fr.saved_at IS NOT NULL
      AND fr.offer_at IS NOT NULL
      AND fr.saved_at >= fr.offer_at AS reached_saved_any_account,
    fr.saved_at IS NOT NULL
      AND fr.account_created_at IS NOT NULL
      AND fr.saved_at >= fr.account_created_at AS reached_saved_after_new_account
  FROM flow_rollup fr
),
funnel AS (
  SELECT
    c.cohort,
    p.analysis_as_of,
    v.variant,
    v.board_id,
    count(s.flow) AS assigned_flows,
    count(DISTINCT s.current_owner) AS distinct_current_owners,
    count(s.flow) FILTER (WHERE s.reached_started) AS started_flows,
    count(s.flow) FILTER (WHERE s.reached_completed) AS completed_flows,
    count(s.flow) FILTER (WHERE s.reached_account_created) AS account_created_flows,
    count(s.flow) FILTER (WHERE s.reached_saved_after_new_account) AS saved_after_new_account_flows,
    count(s.flow) FILTER (WHERE s.reached_saved_any_account) AS saved_any_account_flows,
    min(s.assigned_at) AS first_assignment_at,
    max(s.assigned_at) AS last_assignment_at
  FROM params p
  CROSS JOIN cohorts c
  CROSS JOIN variants v
  LEFT JOIN stages s
    ON s.variant = v.variant
   AND s.assigned_at < p.analysis_as_of
   AND (c.mature_only = false OR s.assigned_at < p.analysis_as_of - p.outcome_window)
  GROUP BY c.cohort, c.mature_only, p.analysis_as_of, v.variant, v.board_id
)
SELECT
  cohort,
  analysis_as_of,
  variant,
  board_id,
  assigned_flows,
  distinct_current_owners,
  started_flows,
  completed_flows,
  account_created_flows,
  saved_after_new_account_flows,
  saved_any_account_flows,
  round(100.0 * started_flows / nullif(assigned_flows, 0), 2) AS started_per_assigned_pct,
  round(100.0 * completed_flows / nullif(started_flows, 0), 2) AS completed_per_started_pct,
  round(100.0 * completed_flows / nullif(assigned_flows, 0), 2) AS completed_per_assigned_pct,
  round(100.0 * account_created_flows / nullif(completed_flows, 0), 2) AS account_created_per_completed_pct,
  round(100.0 * saved_any_account_flows / nullif(completed_flows, 0), 2) AS saved_any_per_completed_pct,
  round(100.0 * saved_after_new_account_flows / nullif(account_created_flows, 0), 2) AS saved_after_new_account_pct,
  first_assignment_at,
  last_assignment_at,
  CASE
    WHEN cohort = 'live_diagnostic' THEN 'DESCRIPTIVE_ONLY'
    WHEN assigned_flows = 0 THEN 'WAITING_FOR_CLOSED_24H_WINDOW'
    ELSE 'QUALITY_GATES_STILL_REQUIRED'
  END AS interpretation
FROM funnel
ORDER BY cohort, variant;


-- 2) 50/50 sample-ratio mismatch check on valid unique assignments.
-- chi_square_p_value is the df=1 chi-square approximation. It tests assignment
-- balance only; it says nothing about which board performs better.
WITH params AS (
  SELECT
    timestamptz '2026-09-29 07:51:16+00' AS rollout_at,
    date_trunc('minute', statement_timestamp()) AS analysis_as_of,
    interval '24 hours' AS outcome_window
),
cohorts(cohort, mature_only) AS (
  VALUES
    ('live_diagnostic'::text, false),
    ('mature_24h'::text, true)
),
raw_assignments AS MATERIALIZED (
  SELECT
    nullif(pe.context ->> 'first_steps_run_id', '') AS flow,
    pe.created_at AS assigned_at,
    pe.anonymous_id,
    pe.player_id,
    pe.client_release,
    pe.measurement_version,
    pe.onboarding_version,
    pe.context ->> 'auth_at_event' AS auth_at_event,
    pe.context ->> 'experiment_variant' AS variant,
    CASE
      WHEN pe.context ->> 'experiment_bucket' ~ '^[0-9]{1,2}$'
        THEN (pe.context ->> 'experiment_bucket')::integer
    END AS bucket,
    pe.context ->> 'puzzle_id' AS puzzle_id
  FROM public.product_events pe
  CROSS JOIN params p
  WHERE pe.environment = 'production'
    AND pe.is_test = false
    AND pe.created_at >= p.rollout_at
    AND pe.created_at < p.analysis_as_of
    AND pe.event_type = 'first_board_experiment_assigned'
    AND pe.context ->> 'experiment_key' = 'first-board-v1'
),
assignment_groups AS (
  SELECT
    flow,
    min(assigned_at) AS assigned_at,
    min(variant) AS variant,
    min(bucket) AS bucket,
    min(puzzle_id) AS puzzle_id,
    min(coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner,
    min(client_release) AS client_release,
    min(measurement_version) AS measurement_version,
    min(onboarding_version) AS onboarding_version,
    min(auth_at_event) AS auth_at_event,
    count(*) AS assignment_event_count,
    count(DISTINCT variant) AS variant_count,
    count(DISTINCT bucket) AS bucket_count,
    count(DISTINCT puzzle_id) AS puzzle_count,
    count(DISTINCT coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner_count,
    count(DISTINCT client_release) AS release_count
  FROM raw_assignments
  GROUP BY flow
),
valid_assignments AS (
  SELECT *
  FROM assignment_groups
  WHERE flow IS NOT NULL
    AND assignment_event_count = 1
    AND variant_count = 1
    AND bucket_count = 1
    AND puzzle_count = 1
    AND current_owner_count = 1
    AND release_count = 1
    AND measurement_version = 2
    AND onboarding_version = 'board-v3-short'
    AND auth_at_event = 'anonymous'
    AND current_owner IS NOT NULL
    AND (
      (variant = 'control_e001' AND bucket BETWEEN 0 AND 49 AND puzzle_id = 'g4-e-001')
      OR
      (variant = 'challenger_e009' AND bucket BETWEEN 50 AND 99 AND puzzle_id = 'g4-e-009')
    )
),
counts AS (
  SELECT
    c.cohort,
    count(*) FILTER (WHERE a.variant = 'control_e001') AS control_n,
    count(*) FILTER (WHERE a.variant = 'challenger_e009') AS challenger_n
  FROM params p
  CROSS JOIN cohorts c
  LEFT JOIN valid_assignments a
    ON a.assigned_at < p.analysis_as_of
   AND (c.mature_only = false OR a.assigned_at < p.analysis_as_of - p.outcome_window)
  GROUP BY c.cohort
),
stats AS (
  SELECT
    *,
    control_n + challenger_n AS total_n,
    CASE
      WHEN control_n + challenger_n > 0
        THEN power(control_n - challenger_n, 2)::double precision
             / (control_n + challenger_n)
    END AS chi_square
  FROM counts
)
SELECT
  cohort,
  total_n,
  control_n,
  challenger_n,
  round(100.0 * control_n / nullif(total_n, 0), 2) AS control_share_pct,
  round(100.0 * challenger_n / nullif(total_n, 0), 2) AS challenger_share_pct,
  round(chi_square::numeric, 4) AS chi_square_df1,
  round(erfc(sqrt(chi_square / 2.0))::numeric, 6) AS chi_square_p_value,
  CASE
    WHEN total_n < 20 THEN 'TOO_EARLY'
    WHEN erfc(sqrt(chi_square / 2.0)) < 0.05 THEN 'WARNING_SRM'
    ELSE 'PASS_NO_SRM_EVIDENCE'
  END AS srm_status
FROM stats
ORDER BY cohort;


-- 3) Core invariants. Every row should be PASS before outcome comparison.
WITH params AS (
  SELECT
    timestamptz '2026-09-29 07:51:16+00' AS rollout_at,
    date_trunc('minute', statement_timestamp()) AS analysis_as_of,
    interval '24 hours' AS outcome_window
),
events AS MATERIALIZED (
  SELECT
    pe.id,
    pe.player_id,
    pe.anonymous_id,
    pe.event_type,
    pe.created_at,
    pe.client_release,
    pe.measurement_version,
    pe.onboarding_version,
    nullif(pe.context ->> 'first_steps_run_id', '') AS flow,
    pe.context ->> 'experiment_key' AS experiment_key,
    pe.context ->> 'experiment_variant' AS variant,
    CASE
      WHEN pe.context ->> 'experiment_bucket' ~ '^[0-9]{1,2}$'
        THEN (pe.context ->> 'experiment_bucket')::integer
    END AS bucket,
    pe.context ->> 'puzzle_id' AS puzzle_id,
    pe.context ->> 'auth_at_event' AS auth_at_event,
    pe.context ->> 'creation_source' AS creation_source
  FROM public.product_events pe
  CROSS JOIN params p
  WHERE pe.environment = 'production'
    AND pe.is_test = false
    AND pe.created_at >= p.rollout_at
    AND pe.created_at < p.analysis_as_of
    AND pe.event_type IN (
      'first_board_experiment_assigned',
      'first_board_experiment_started',
      'first_board_experiment_completed',
      'first_steps_v1_offer',
      'account_created',
      'first_steps_v1_saved'
    )
),
experiment_phases AS (
  SELECT *
  FROM events
  WHERE event_type IN (
    'first_board_experiment_assigned',
    'first_board_experiment_started',
    'first_board_experiment_completed'
  )
),
assignment_groups AS (
  SELECT
    flow,
    min(created_at) AS assigned_at,
    min(variant) AS variant,
    min(bucket) AS bucket,
    min(puzzle_id) AS puzzle_id,
    min(client_release) AS client_release,
    min(coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner,
    min(onboarding_version) AS onboarding_version,
    min(measurement_version) AS measurement_version,
    min(auth_at_event) AS auth_at_event,
    count(*) AS assignment_event_count,
    count(DISTINCT variant) AS variant_count,
    count(DISTINCT bucket) AS bucket_count,
    count(DISTINCT puzzle_id) AS puzzle_count,
    count(DISTINCT client_release) AS release_count,
    count(DISTINCT coalesce('player:' || player_id::text, 'anon:' || anonymous_id)) AS current_owner_count
  FROM events
  WHERE event_type = 'first_board_experiment_assigned'
    AND experiment_key = 'first-board-v1'
  GROUP BY flow
),
valid_assignments AS (
  SELECT *
  FROM assignment_groups
  WHERE flow IS NOT NULL
    AND assignment_event_count = 1
    AND variant_count = 1
    AND bucket_count = 1
    AND puzzle_count = 1
    AND release_count = 1
    AND current_owner_count = 1
    AND measurement_version = 2
    AND onboarding_version = 'board-v3-short'
    AND auth_at_event = 'anonymous'
    AND current_owner IS NOT NULL
    AND (
      (variant = 'control_e001' AND bucket BETWEEN 0 AND 49 AND puzzle_id = 'g4-e-001')
      OR
      (variant = 'challenger_e009' AND bucket BETWEEN 50 AND 99 AND puzzle_id = 'g4-e-009')
    )
),
mature_assignments AS (
  SELECT a.*
  FROM valid_assignments a
  CROSS JOIN params p
  WHERE a.assigned_at < p.analysis_as_of - p.outcome_window
),
mature_rollup AS (
  SELECT
    a.flow,
    a.variant,
    a.bucket,
    a.puzzle_id,
    a.assigned_at,
    min(e.created_at) FILTER (WHERE e.event_type = 'first_board_experiment_started') AS started_at,
    min(e.created_at) FILTER (WHERE e.event_type = 'first_board_experiment_completed') AS completed_at,
    min(e.created_at) FILTER (WHERE e.event_type = 'first_steps_v1_offer') AS offer_at,
    min(e.created_at) FILTER (WHERE e.event_type = 'account_created') AS account_created_at,
    min(e.created_at) FILTER (WHERE e.event_type = 'first_steps_v1_saved') AS saved_at
  FROM mature_assignments a
  LEFT JOIN events e ON e.flow = a.flow
  GROUP BY a.flow, a.variant, a.bucket, a.puzzle_id, a.assigned_at
),
saved_rows AS (
  SELECT e.id, e.flow, e.player_id, a.puzzle_id
  FROM events e
  JOIN valid_assignments a ON a.flow = e.flow
  WHERE e.event_type = 'first_steps_v1_saved'
),
checks(check_name, check_scope, violations, detail) AS (
  SELECT
    'experiment_phase_contract',
    'live_all',
    count(*),
    'Every assigned/started/completed event has the expected key, anonymous v2/v3 provenance, arm, bucket and board.'
  FROM experiment_phases e
  WHERE (
    e.flow IS NOT NULL
    AND e.experiment_key = 'first-board-v1'
    AND e.measurement_version = 2
    AND e.onboarding_version = 'board-v3-short'
    AND e.auth_at_event = 'anonymous'
    AND (
      (e.variant = 'control_e001' AND e.bucket BETWEEN 0 AND 49 AND e.puzzle_id = 'g4-e-001')
      OR
      (e.variant = 'challenger_e009' AND e.bucket BETWEEN 50 AND 99 AND e.puzzle_id = 'g4-e-009')
    )
  ) IS NOT TRUE

  UNION ALL
  SELECT
    'duplicate_phase_per_flow',
    'live_all',
    count(*),
    'At most one event of each measured funnel type per flow.'
  FROM (
    SELECT flow, event_type
    FROM events
    WHERE flow IS NOT NULL
    GROUP BY flow, event_type
    HAVING count(*) > 1
  ) duplicates

  UNION ALL
  SELECT
    'mixed_experiment_context_per_flow',
    'live_all',
    count(*),
    'No flow changes arm, bucket or board between experiment phases.'
  FROM (
    SELECT flow
    FROM experiment_phases
    WHERE flow IS NOT NULL
    GROUP BY flow
    HAVING count(DISTINCT variant) <> 1
        OR count(DISTINCT bucket) <> 1
        OR count(DISTINCT puzzle_id) <> 1
  ) mixed

  UNION ALL
  SELECT
    'orphan_started_or_completed',
    'live_all',
    count(*),
    'Started/completed must join one valid assignment; no inference by actor or time.'
  FROM experiment_phases e
  LEFT JOIN valid_assignments a ON a.flow = e.flow
  WHERE e.event_type IN ('first_board_experiment_started', 'first_board_experiment_completed')
    AND a.flow IS NULL

  UNION ALL
  SELECT
    'multiple_flows_per_current_owner',
    'live_all',
    count(*),
    'A current claimed/anonymous event owner should not contribute multiple experiment flows.'
  FROM (
    SELECT current_owner
    FROM valid_assignments
    GROUP BY current_owner
    HAVING count(*) > 1
  ) repeat_actors

  UNION ALL
  SELECT
    'downstream_experiment_provenance_mismatch',
    'live_all',
    count(*),
    'Offer and saved keep the assignment key, arm and bucket; account_created is joined by flow instead.'
  FROM events e
  JOIN valid_assignments a ON a.flow = e.flow
  WHERE e.event_type IN ('first_steps_v1_offer', 'first_steps_v1_saved')
    AND (
      e.experiment_key = 'first-board-v1'
      AND e.variant = a.variant
      AND e.bucket = a.bucket
    ) IS NOT TRUE

  UNION ALL
  SELECT
    'account_created_source_mismatch',
    'live_all',
    count(*),
    'Correlated account_created rows are authoritative and carry creation_source=first_steps_v1.'
  FROM events e
  JOIN valid_assignments a ON a.flow = e.flow
  WHERE e.event_type = 'account_created'
    AND e.creation_source IS DISTINCT FROM 'first_steps_v1'

  UNION ALL
  SELECT
    'mature_phase_order_or_missing_prerequisite',
    'mature_24h',
    count(*),
    'Observed downstream phases are ordered assigned -> started -> completed -> offer -> account/saved.'
  FROM mature_rollup r
  WHERE (r.started_at IS NOT NULL AND r.started_at < r.assigned_at)
     OR (r.completed_at IS NOT NULL AND (r.started_at IS NULL OR r.completed_at < r.started_at))
     OR (r.offer_at IS NOT NULL AND (r.completed_at IS NULL OR r.offer_at < r.completed_at))
     OR (r.account_created_at IS NOT NULL AND (r.offer_at IS NULL OR r.account_created_at < r.offer_at))
     OR (r.saved_at IS NOT NULL AND (r.offer_at IS NULL OR r.saved_at < r.offer_at))

  UNION ALL
  SELECT
    'saved_without_confirmed_results',
    'live_all',
    count(*),
    'Every saved event has a player plus starter-v1 and the assigned free-board result.'
  FROM saved_rows s
  WHERE s.player_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.results r
       WHERE r.player_id = s.player_id
         AND r.challenge_key = 'starter:starter-v1'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.results r
       WHERE r.player_id = s.player_id
         AND r.challenge_key = 'free:' || s.puzzle_id
     )
)
SELECT
  check_name,
  check_scope,
  violations,
  CASE WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  detail
FROM checks
ORDER BY check_scope, check_name;


-- 4) Assignment balance by Prague calendar day and client release.
-- Use this to diagnose an SRM warning; do not cherry-pick a better-looking slice.
WITH params AS (
  SELECT
    timestamptz '2026-09-29 07:51:16+00' AS rollout_at,
    date_trunc('minute', statement_timestamp()) AS analysis_as_of
),
assignments AS (
  SELECT
    nullif(pe.context ->> 'first_steps_run_id', '') AS flow,
    min(pe.created_at) AS assigned_at,
    min(pe.client_release) AS client_release,
    min(pe.context ->> 'experiment_variant') AS variant,
    min((pe.context ->> 'experiment_bucket')::integer) AS bucket,
    count(*) AS assignment_events
  FROM public.product_events pe
  CROSS JOIN params p
  WHERE pe.environment = 'production'
    AND pe.is_test = false
    AND pe.created_at >= p.rollout_at
    AND pe.created_at < p.analysis_as_of
    AND pe.event_type = 'first_board_experiment_assigned'
    AND pe.context ->> 'experiment_key' = 'first-board-v1'
    AND pe.context ->> 'experiment_bucket' ~ '^[0-9]{1,2}$'
  GROUP BY nullif(pe.context ->> 'first_steps_run_id', '')
)
SELECT
  timezone('Europe/Prague', assigned_at)::date AS assignment_day_prague,
  client_release,
  variant,
  count(*) AS assigned_flows,
  min(bucket) AS min_bucket,
  max(bucket) AS max_bucket
FROM assignments
WHERE flow IS NOT NULL
  AND assignment_events = 1
  AND (
    (variant = 'control_e001' AND bucket BETWEEN 0 AND 49)
    OR (variant = 'challenger_e009' AND bucket BETWEEN 50 AND 99)
  )
GROUP BY assignment_day_prague, client_release, variant
ORDER BY assignment_day_prague, client_release, variant;
