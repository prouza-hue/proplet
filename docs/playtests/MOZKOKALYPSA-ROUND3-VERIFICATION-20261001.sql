WITH cfg AS (
 SELECT * FROM public.mozkokalypsa_experiments WHERE id='mozkokalypsa-round3-interwoven-v2'
), a AS (
 SELECT * FROM public.mozkokalypsa_attempts WHERE experiment_id=(SELECT id FROM cfg)
), ct AS (
 SELECT e.attempt_id,
 max((e.progress->>'elapsedMs')::numeric) FILTER(WHERE jsonb_array_length(e.progress->'found')=11) AS t11,
 max((e.progress->>'elapsedMs')::numeric) FILTER(WHERE jsonb_array_length(e.progress->'found')=14) AS t14,
 count(*) correct_count
 FROM public.mozkokalypsa_events e JOIN a ON a.id=e.attempt_id WHERE e.event_type='correct' GROUP BY e.attempt_id
), rewards AS (
 SELECT * FROM public.account_rewards WHERE reward_key LIKE 'mozkokalypsa_v3:%'
), eligible AS (
 SELECT * FROM a WHERE completed AND (feedback->>'difficulty')::int BETWEEN 1 AND 5 AND (feedback->>'fun')::int BETWEEN 1 AND 5
)
SELECT jsonb_build_object(
 'read_at',now(),
 'summary',(SELECT jsonb_build_object('attempts',count(*),'players',count(DISTINCT player_id),'completed',count(*) FILTER(WHERE completed),
 'median_ms',percentile_cont(0.5) WITHIN GROUP(ORDER BY (progress->>'elapsedMs')::numeric) FILTER(WHERE completed),
 'difficulty',avg((feedback->>'difficulty')::numeric) FILTER(WHERE completed),'fun',avg((feedback->>'fun')::numeric) FILTER(WHERE completed),
 'wrong',sum((progress->>'wrongAttempts')::int) FILTER(WHERE completed)) FROM a),
 'tail',(SELECT jsonb_build_object('n',count(*),'median_last3_ms',percentile_cont(0.5) WITHIN GROUP(ORDER BY t14-t11),
 'mean_share',avg((t14-t11)/(a.progress->>'elapsedMs')::numeric),
 'ratio',(sum(t14-t11)/3)/(sum(t11)/11),'bad_correct_counts',count(*) FILTER(WHERE correct_count<>14)) FROM ct JOIN a ON a.id=ct.attempt_id WHERE a.completed),
 'reward',(SELECT jsonb_build_object('count',count(*),'sum',sum(points),'wrong_amount',count(*) FILTER(WHERE points<>(SELECT reward_xp FROM cfg)),
 'after_close',count(*) FILTER(WHERE granted_at>=(SELECT closes_at FROM cfg))) FROM rewards),
 'missing_rewards',(SELECT count(*) FROM eligible a WHERE NOT EXISTS(SELECT 1 FROM rewards r WHERE r.player_id=a.player_id AND r.reward_key='mozkokalypsa_v3:'||a.board_id)),
 'unexpected_rewards',(SELECT count(*) FROM rewards r WHERE NOT EXISTS(SELECT 1 FROM eligible a WHERE r.player_id=a.player_id AND r.reward_key='mozkokalypsa_v3:'||a.board_id)),
 'duplicate_rewards',(SELECT count(*) FROM (SELECT player_id,reward_key,count(*) n FROM rewards GROUP BY 1,2 HAVING count(*)>1) d),
 'cohort_symmetric_difference',(SELECT count(*) FROM ((SELECT player_id,slot,active,participant_role FROM public.mozkokalypsa_invites WHERE experiment_id='mozkokalypsa-round2-20260925' EXCEPT SELECT player_id,slot,active,participant_role FROM public.mozkokalypsa_invites WHERE experiment_id=(SELECT id FROM cfg)) UNION ALL (SELECT player_id,slot,active,participant_role FROM public.mozkokalypsa_invites WHERE experiment_id=(SELECT id FROM cfg) EXCEPT SELECT player_id,slot,active,participant_role FROM public.mozkokalypsa_invites WHERE experiment_id='mozkokalypsa-round2-20260925')) d),
 'out_of_cohort_attempts',(SELECT count(*) FROM a WHERE NOT EXISTS(SELECT 1 FROM public.mozkokalypsa_invites i WHERE i.experiment_id=a.experiment_id AND i.player_id=a.player_id AND i.active)),
 'outside_window_attempts',(SELECT count(*) FROM a,cfg WHERE a.started_at<cfg.opens_at OR a.updated_at>=cfg.closes_at OR a.completed_at>=cfg.closes_at OR a.rewarded_at>=cfg.closes_at),
 'outside_window_events',(SELECT count(*) FROM public.mozkokalypsa_events e JOIN a ON a.id=e.attempt_id CROSS JOIN cfg WHERE e.created_at<cfg.opens_at OR e.created_at>=cfg.closes_at),
 'last_event_at',(SELECT max(e.created_at) FROM public.mozkokalypsa_events e JOIN a ON a.id=e.attempt_id)
) AS verification;
