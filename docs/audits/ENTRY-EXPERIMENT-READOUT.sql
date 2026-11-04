-- Read only. Default cutoff is the current statement time, capped at the final freeze.
-- Use SET proplet.entry_report_as_of='...Z' in the same session for reproducible test or replay bounds.
WITH params AS (
  SELECT least(coalesce(nullif(current_setting('proplet.entry_report_as_of',true),'')::timestamptz,statement_timestamp()), timestamptz '2026-12-02 08:00Z') AS cutoff,
         timestamptz '2026-11-15 23:00Z' AS opens,
         timestamptz '2026-11-29 23:00Z' AS closes,
         timestamptz '2026-12-02 08:00Z' AS freeze
), assignments AS MATERIALIZED (
  SELECT a.*, e.player_id, e.id IS NULL AS missing_receipt,
         ((a.assigned_at AT TIME ZONE 'Europe/Prague')::date + 1)::timestamp
             AT TIME ZONE 'Europe/Prague' AS d1_start,
         ((a.assigned_at AT TIME ZONE 'Europe/Prague')::date + 2)::timestamp
             AT TIME ZONE 'Europe/Prague' AS d1_end
  FROM proplet_experiment_internal.entry_assignments a CROSS JOIN params p
  LEFT JOIN public.product_events e ON e.id=a.event_id
    AND e.environment='production' AND NOT e.is_test AND e.event_type='entry_experiment_assigned'
    AND e.context->>'entry_experiment'='new-player-entry-v1' AND e.context->>'entry_variant'=a.variant
    AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
  WHERE a.environment='production' AND NOT a.is_test
    AND a.assigned_at>=p.opens AND a.assigned_at<least(p.closes,p.cutoff)
), owners AS (
  SELECT player_id FROM assignments WHERE player_id IS NOT NULL GROUP BY player_id HAVING count(*)>1
), metrics AS (
  SELECT a.*, p.cutoff, p.freeze,
    EXISTS (SELECT FROM owners x WHERE x.player_id=a.player_id) AS shared_account,
    first_game.id AS first_attempt,
    first_game.completed_at AS first_completed,
    games.any_completed, games.continued, games.d1_play,
    evt.d1_visit, evt.tajenka_completed, evt.tajenka_continued, evt.created_account, evt.load_failed, evt.wrong_board, evt.link_missing,
    EXISTS (SELECT FROM public.hint_events h WHERE h.environment='production' AND NOT h.is_test
      AND h.attempt_id=first_game.id AND h.created_at>=a.assigned_at
      AND h.created_at<least(p.cutoff,a.assigned_at+interval '24 hours')) AS helped,
    EXISTS (SELECT FROM public.operational_events o WHERE o.environment='production' AND NOT o.is_test
      AND o.event_type='client_error' AND o.created_at>=a.assigned_at
      AND o.created_at<least(p.cutoff,a.assigned_at+interval '24 hours')
      AND (o.metadata->>'reporting_actor_key' IN ('a:'||a.anonymous_id, 'p:'||a.player_id::text)
        OR o.metadata->>'reported_first_steps_run_id'=a.first_steps_run_id::text)) AS client_error
  FROM assignments a CROSS JOIN params p
  LEFT JOIN LATERAL (
    SELECT g.id, CASE WHEN g.completed_at>=g.started_at
       AND g.completed_at<least(p.cutoff,a.assigned_at+interval '24 hours') THEN g.completed_at END AS completed_at
    FROM public.product_events s JOIN public.puzzle_attempts g ON g.id=s.context->>'run_id'
    WHERE s.environment='production' AND NOT s.is_test AND g.environment='production' AND NOT g.is_test
      AND s.event_type='first_board_experiment_started' AND s.context->>'first_steps_run_id'=a.first_steps_run_id::text
      AND s.context->>'puzzle_id'='g4-e-009' AND g.puzzle_id='g4-e-009' AND g.mode='free'
      AND (g.anonymous_id=a.anonymous_id OR g.player_id=a.player_id)
      AND s.created_at>=a.assigned_at AND s.created_at<least(p.cutoff,a.assigned_at+interval '24 hours')
      AND g.started_at>=a.assigned_at AND g.started_at<least(p.cutoff,a.assigned_at+interval '24 hours')
    ORDER BY g.started_at,g.id LIMIT 1
  ) first_game ON true
  LEFT JOIN LATERAL (
    SELECT bool_or(g.started_at>=a.assigned_at AND g.completed_at>=g.started_at
        AND g.completed_at<least(p.cutoff,a.assigned_at+interval '24 hours')) AS any_completed,
      bool_or(g.id<>first_game.id AND g.started_at>=first_game.completed_at
        AND g.started_at<least(p.cutoff,a.assigned_at+interval '24 hours')) AS continued,
      bool_or((g.started_at>=a.d1_start AND g.started_at<least(a.d1_end,p.cutoff))
           OR (g.last_activity_at>=a.d1_start AND g.last_activity_at<least(a.d1_end,p.cutoff))
           OR (g.completed_at>=a.d1_start AND g.completed_at<least(a.d1_end,p.cutoff))) AS d1_play
    FROM public.puzzle_attempts g
    WHERE g.environment='production' AND NOT g.is_test AND g.mode IN ('free','daily','daily_special')
      AND g.puzzle_id<>'starter-v1' AND (g.anonymous_id=a.anonymous_id OR g.player_id=a.player_id)
      AND g.started_at>=a.assigned_at AND g.started_at<least(greatest(a.d1_end,a.assigned_at+interval '24 hours'),p.cutoff)
  ) games ON true
  LEFT JOIN LATERAL (
    SELECT bool_or(e.event_type='tajenka_completed' AND e.created_at<a.assigned_at+interval '24 hours') AS tajenka_completed,
      bool_or(e.event_type='tajenka_started' AND e.created_at>=first_game.completed_at
             AND e.created_at<a.assigned_at+interval '24 hours') AS tajenka_continued,
      bool_or(e.event_type IN ('app_open','app_session_started','tajenka_started','tajenka_completed') AND e.created_at>=a.d1_start
             AND e.created_at<a.d1_end) AS d1_visit,
      bool_or(e.event_type='account_created' AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
             AND e.created_at<a.assigned_at+interval '24 hours') AS created_account,
      bool_or(e.event_type='entry_board_load_failed' AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
             AND e.created_at<a.assigned_at+interval '24 hours') AS load_failed,
      bool_or(e.event_type='first_board_experiment_started' AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
             AND e.context->>'puzzle_id' IS DISTINCT FROM 'g4-e-009') AS wrong_board,
      bool_or(e.event_type='first_board_experiment_started' AND e.context->>'first_steps_run_id'=a.first_steps_run_id::text
             AND e.created_at<a.assigned_at+interval '24 hours' AND first_game.id IS NULL) AS link_missing
    FROM public.product_events e
    WHERE e.environment='production' AND NOT e.is_test AND e.created_at>=a.assigned_at
      AND e.created_at<least(greatest(a.d1_end,a.assigned_at+interval '24 hours'),p.cutoff)
      AND (e.anonymous_id=a.anonymous_id OR e.player_id=a.player_id OR e.context->>'first_steps_run_id'=a.first_steps_run_id::text)
  ) evt ON true
)
SELECT v.variant,p.cutoff, count(m.assigned_at) AS assigned,
 count(*) FILTER (WHERE (m.assigned_at AT TIME ZONE 'Europe/Prague')::date=
    (p.cutoff AT TIME ZONE 'Europe/Prague')::date-1) AS assigned_yesterday,
 count(*) FILTER (WHERE m.assigned_at+interval '24 hours'>p.cutoff) AS pending_24h,
 count(*) FILTER (WHERE m.d1_end>p.cutoff) AS pending_d1,
 count(*) FILTER (WHERE m.missing_receipt OR m.shared_account OR m.link_missing OR m.wrong_board) AS investigate,
 count(*) FILTER (WHERE m.load_failed) AS load_failures,
 count(*) FILTER (WHERE m.client_error) AS reported_errors,
 count(*) FILTER (WHERE m.assigned_at>=p.cutoff-interval '1 hour') AS assigned_last_hour,
 count(*) FILTER (WHERE m.assigned_at>=p.cutoff-interval '1 hour' AND m.load_failed) AS load_failures_last_hour,
 CASE WHEN p.cutoff=p.freeze THEN count(*) FILTER (WHERE m.any_completed OR m.tajenka_completed) END AS completed_24h,
 CASE WHEN p.cutoff=p.freeze THEN count(m.first_attempt) END AS first_started,
 CASE WHEN p.cutoff=p.freeze THEN count(m.first_completed) END AS first_completed,
 CASE WHEN p.cutoff=p.freeze THEN count(*) FILTER (WHERE m.continued OR m.tajenka_continued) END AS continued,
 CASE WHEN p.cutoff=p.freeze THEN count(*) FILTER (WHERE m.d1_visit OR m.d1_play) END AS returned_d1,
 CASE WHEN p.cutoff=p.freeze THEN count(*) FILTER (WHERE m.created_account) END AS created_accounts,
 CASE WHEN p.cutoff=p.freeze THEN count(*) FILTER (WHERE m.helped) END AS used_hint
FROM (VALUES ('A'),('B')) v(variant) CROSS JOIN params p LEFT JOIN metrics m ON m.variant=v.variant
GROUP BY v.variant,p.cutoff,p.freeze ORDER BY v.variant;
