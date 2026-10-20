-- A recovery precredit is already earned word XP, not another source of XP.
-- Replacing it with individual word keys must not increase an optimistic cached total.
CREATE OR REPLACE FUNCTION public.proplet_account_snapshot_v1(p_player uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_active_generation integer DEFAULT 4, p_base_levels jsonb DEFAULT '{"easy": 200, "hard": 200, "medium": 200, "hardcore": 200, "mozkomor": 100}'::jsonb, p_mozkomor_unlock_base integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with
stamp as (
  select statement_timestamp() as value,
         coalesce((select preview_date from public.daily_specials_policy where singleton and enabled),(statement_timestamp() at time zone 'Europe/Prague')::date) as today
),
player_row as (
  select p.family_code, p.team_joined_at,
         coalesce(l.name, p.family_code) as league_name
  from public.players p
  left join public.leagues l on l.code = p.family_code
  where p.id = p_player
),
normalized_results as (
  select r.*,
         coalesce(
           r.content_generation::integer,
           case when r.puzzle_id like 'g4-%' then 4 else 1 end
         ) as normalized_generation,
         coalesce(
           r.content_level,
           case
             when substring(r.puzzle_id from '([0-9]+)$') is not null
             then substring(r.puzzle_id from '([0-9]+)$')::integer
           end
         ) as normalized_level
  from public.results r
  where r.player_id = p_player
),
reward_stats as (
  select
    coalesce(sum(greatest(points, 0)), 0)::integer as reward_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key = 'account_creation_v1'), 0)::integer as account_bonus_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key like 'word_discovery_v1:%' or reward_key like 'word_discovery_recovery_v1:%'), 0)::integer as word_discovery_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key <> 'account_creation_v1' and reward_key not like 'word_discovery_v1:%' and reward_key not like 'word_discovery_recovery_v1:%'), 0)::integer as other_reward_xp,
    count(*) filter (where reward_key like 'word_discovery_v1:%')::integer as word_discovery_rewards,
    count(distinct nullif(lower(trim(coalesce(reward_word, split_part(reward_key, ':', 2)))), ''))
      filter (where reward_key like 'word_discovery_v1:%')::integer as discovered_words
  from public.account_rewards
  where player_id = p_player
),
result_stats as (
  select
    coalesce(sum(points), 0)::integer as result_xp,
    count(*) filter (where mode in ('daily', 'free'))::integer as total_completed,
    count(distinct daily_date) filter (where mode = 'daily' and daily_date is not null)::integer as daily_completed,
    count(distinct challenge_key) filter (where mode = 'daily_special')::integer as daily_special_completed,
    min(best_elapsed_ms) filter (where mode = 'daily' and daily_date is not null) as best_daily_ms,
    count(*) filter (where mode in ('daily', 'free') and clean_solve is true)::integer as clean_solves,
    count(*) filter (where mode = 'daily' and clean_solve is true)::integer as clean_daily,
    count(*) filter (where mode = 'tajenka')::integer as tajenka_completed,
    count(*) filter (where mode = 'free' and difficulty = 'mozkomor')::integer as mozkomor_completed,
    bool_or(mode = 'free' and difficulty = 'mozkomor') as has_mozkomor,
    bool_or(mode = 'free' and normalized_generation <> p_active_generation) as has_prior_free,
    bool_or(mode = 'free' and normalized_generation = p_active_generation) as has_current_free
  from normalized_results
),
difficulties(difficulty) as (
  values ('easy'), ('medium'), ('hard'), ('hardcore'), ('mozkomor'), ('mozkokalypsa')
),
free_counts as (
  select d.difficulty,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_level is not null
    )::integer as effective,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_generation = p_active_generation
        and nr.normalized_level is not null
    )::integer as current_count,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_generation = p_active_generation
        and nr.normalized_level between 1 and coalesce((p_base_levels ->> d.difficulty)::integer, 0)
    )::integer as base_current,
    count(nr.id)::integer as history_count
  from difficulties d
  left join normalized_results nr
    on nr.mode = 'free' and nr.difficulty = d.difficulty
  group by d.difficulty
),
free_transferred as (
  select d.difficulty,
    count(slots.normalized_level)::integer as transferred
  from difficulties d
  left join lateral (
    select distinct prior.normalized_level
    from normalized_results prior
    where prior.mode = 'free'
      and prior.difficulty = d.difficulty
      and prior.normalized_generation <> p_active_generation
      and prior.normalized_level is not null
      and not exists (
        select 1
        from normalized_results current_row
        where current_row.mode = 'free'
          and current_row.difficulty = d.difficulty
          and current_row.normalized_generation = p_active_generation
          and current_row.normalized_level = prior.normalized_level
      )
  ) slots on true
  group by d.difficulty
),
free_json as (
  select
    jsonb_object_agg(fc.difficulty, fc.effective) as effective,
    jsonb_object_agg(fc.difficulty, coalesce(ft.transferred, 0)) as transferred,
    jsonb_object_agg(fc.difficulty, fc.current_count) as current_count,
    jsonb_object_agg(fc.difficulty, fc.base_current) as base_current,
    jsonb_object_agg(fc.difficulty, fc.history_count) as history_count,
    max(fc.current_count) filter (where fc.difficulty = 'hardcore') as hardcore_current
  from free_counts fc
  join free_transferred ft using (difficulty)
),
effective_dates as (
  select distinct daily_date as value
  from normalized_results
  where mode = 'daily' and daily_date is not null
  union
  select distinct missed_date
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
date_groups as (
  select value,
         value - row_number() over (order by value)::integer as island
  from effective_dates
),
streak_runs as (
  select min(value) as first_day, max(value) as last_day, count(*)::integer as days
  from date_groups
  group by island
),
streak_stats as (
  select
    coalesce(max(days) filter (where last_day in (
      (select today from stamp), (select today - 1 from stamp)
    )), 0)::integer as current_streak,
    coalesce(max(days), 0)::integer as longest_streak
  from streak_runs
),
rescue_stats as (
  select count(distinct missed_date)::integer as rescued_days
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
delta_results as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'puzzleId', nr.puzzle_id,
      'challengeKey', nr.challenge_key,
      'mode', nr.mode,
      'difficulty', nr.difficulty,
      'dailyDate', nr.daily_date,
      'elapsedMs', greatest(coalesce(nr.best_elapsed_ms, 1000), 1000),
      'moves', greatest(coalesce(nr.best_moves, 1), 1),
      'points', coalesce(nr.points, 0),
      'hintsUsed', coalesce(nr.hints_used, 0),
      'wrongAttempts', coalesce(nr.wrong_attempts, 0),
      'maxHintLevel', coalesce(nr.max_hint_level, 0),
      'cleanSolve', nr.clean_solve is true,
      'completedAt', nr.completed_at,
      'level', case when nr.mode = 'free' then nr.normalized_level end,
      'contentGeneration', case when nr.mode = 'free' then nr.normalized_generation end,
      'legacy', nr.mode = 'free' and nr.normalized_generation <> p_active_generation
    ) || case when nr.timing_verified is null then '{}'::jsonb
              else jsonb_build_object('timingVerified', nr.timing_verified) end
    order by nr.completed_at, nr.id
  ), '[]'::jsonb) as completed
  from normalized_results nr
  where p_since is null or nr.completed_at >= p_since - interval '5 minutes'
),
stats_payload as (
  select jsonb_build_object(
    'points', rs.result_xp + rw.reward_xp,
    'resultXp', rs.result_xp,
    'xpAuthoritative', true,
    'rewardXp', rw.reward_xp,
    'accountBonusXp', rw.account_bonus_xp,
    'wordDiscoveryXp', rw.word_discovery_xp,
    'otherRewardXp', rw.other_reward_xp,
    'wordDiscoveryRewards', rw.word_discovery_rewards,
    'discoveredWords', rw.discovered_words,
    'accountRewardsIncluded', true,
    'totalCompleted', rs.total_completed,
    'dailyCompleted', rs.daily_completed,
    'dailySpecialCompleted',rs.daily_special_completed,
    'dailyChallengeCompleted',rs.daily_completed+rs.daily_special_completed,
    'totalChallengeCompleted',rs.total_completed+rs.daily_special_completed,
    'freeCompleted', fj.effective,
    'freeTransferred', fj.transferred,
    'freePlayedCurrent', fj.current_count,
    'freeBasePlayedCurrent', fj.base_current,
    'mozkomorUnlocked', true,
    'freePlayedGen2', fj.current_count,
    'freeHistoryCompleted', fj.history_count,
    'currentStreak', ss.current_streak,
    'longestStreak', ss.longest_streak,
    'bestDailyMs', rs.best_daily_ms,
    'cleanSolves', rs.clean_solves,
    'cleanDaily', rs.clean_daily,
    'tajenkaCompleted', rs.tajenka_completed,
    'mozkomorCompleted', rs.mozkomor_completed,
    'rescuedDays', rc.rescued_days,
    'gen4RewardPolicy', 'per-board',
    'gen4RewardRepairXp', 0,
    'gen4ReturnBonusXp', case when p_active_generation >= 4 and coalesce(rs.has_prior_free, false) and coalesce(rs.has_current_free, false) then 500 else 0 end,
    'gen4ReturnBonusAwardedNow', 0
  ) as stats
  from result_stats rs
  cross join reward_stats rw
  cross join free_json fj
  cross join streak_stats ss
  cross join rescue_stats rc
)
select jsonb_build_object(
  'cursor', stamp.value,
  'leagueName', (select league_name from player_row),
  'stats', stats_payload.stats,
  'completed', delta_results.completed
)
from stamp
cross join stats_payload
cross join delta_results;
$function$
;

CREATE OR REPLACE FUNCTION public.proplet_player_stats_v1(p_player uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with
stamp as (
  select statement_timestamp() as value,
         coalesce((select preview_date from public.daily_specials_policy where singleton and enabled),(statement_timestamp() at time zone 'Europe/Prague')::date) as today
),
normalized_results as (select r.* from public.results r where r.player_id = p_player),
reward_stats as (
  select
    coalesce(sum(greatest(points, 0)), 0)::integer as reward_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key = 'account_creation_v1'), 0)::integer as account_bonus_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key like 'word_discovery_v1:%' or reward_key like 'word_discovery_recovery_v1:%'), 0)::integer as word_discovery_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key <> 'account_creation_v1' and reward_key not like 'word_discovery_v1:%' and reward_key not like 'word_discovery_recovery_v1:%'), 0)::integer as other_reward_xp,
    count(*) filter (where reward_key like 'word_discovery_v1:%')::integer as word_discovery_rewards,
    count(distinct nullif(lower(trim(coalesce(reward_word, split_part(reward_key, ':', 2)))), ''))
      filter (where reward_key like 'word_discovery_v1:%')::integer as discovered_words
  from public.account_rewards
  where player_id = p_player
),
result_stats as (
  select
    coalesce(sum(points), 0)::integer as result_xp,
    count(*) filter (where mode in ('daily', 'free'))::integer as total_completed,
    count(distinct daily_date) filter (where mode = 'daily' and daily_date is not null)::integer as daily_completed,
    count(distinct challenge_key) filter (where mode = 'daily_special')::integer as daily_special_completed,
    min(best_elapsed_ms) filter (where mode = 'daily' and daily_date is not null) as best_daily_ms,
    count(*) filter (where mode in ('daily', 'free') and clean_solve is true)::integer as clean_solves,
    count(*) filter (where mode = 'daily' and daily_date is not null and clean_solve is true)::integer as clean_daily,
    count(*) filter (where mode = 'tajenka')::integer as tajenka_completed,
    count(*) filter (where mode = 'free' and difficulty = 'mozkomor')::integer as mozkomor_completed
  from normalized_results
),
effective_dates as (
  select distinct daily_date as value
  from normalized_results
  where mode = 'daily' and daily_date is not null
  union
  select distinct missed_date
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
date_groups as (
  select value,
         value - row_number() over (order by value)::integer as island
  from effective_dates
),
streak_runs as (
  select min(value) as first_day, max(value) as last_day, count(*)::integer as days
  from date_groups
  group by island
),
streak_stats as (
  select
    coalesce(max(anchor.value - first_day + 1) filter (
      where first_day <= anchor.value and last_day >= anchor.value
    ), 0)::integer as current_streak,
    coalesce(max(days), 0)::integer as longest_streak
  from streak_runs
  cross join lateral (
    select case
      when exists (select 1 from effective_dates where value = (select today from stamp)) then (select today from stamp)
      when exists (select 1 from effective_dates where value = (select today - 1 from stamp)) then (select today - 1 from stamp)
    end as value
  ) anchor
),
rescue_stats as (
  select count(distinct missed_date)::integer as rescued_days
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
stats_payload as (
  select jsonb_build_object(
    'points', rs.result_xp + rw.reward_xp,
    'resultXp', rs.result_xp,
    'xpAuthoritative', true,
    'rewardXp', rw.reward_xp,
    'accountBonusXp', rw.account_bonus_xp,
    'wordDiscoveryXp', rw.word_discovery_xp,
    'otherRewardXp', rw.other_reward_xp,
    'wordDiscoveryRewards', rw.word_discovery_rewards,
    'discoveredWords', rw.discovered_words,
    'accountRewardsIncluded', true,
    'totalCompleted', rs.total_completed,
    'dailyCompleted', rs.daily_completed,
    'dailySpecialCompleted', rs.daily_special_completed,
    'dailyChallengeCompleted', rs.daily_completed + rs.daily_special_completed,
    'totalChallengeCompleted', rs.total_completed + rs.daily_special_completed,
    'freeHistoryCompleted', (select jsonb_object_agg(d.difficulty, (select count(*) from normalized_results nr where nr.mode = 'free' and nr.difficulty = d.difficulty)) from (values ('easy'),('medium'),('hard'),('hardcore'),('mozkomor'),('mozkokalypsa')) d(difficulty)),
    'currentStreak', ss.current_streak,
    'longestStreak', ss.longest_streak,
    'bestDailyMs', rs.best_daily_ms,
    'cleanSolves', rs.clean_solves,
    'cleanDaily', rs.clean_daily,
    'tajenkaCompleted', rs.tajenka_completed,
    'mozkomorCompleted', rs.mozkomor_completed,
    'rescuedDays', rc.rescued_days,
    'gen4RewardPolicy', 'per-board',
    'gen4RewardRepairXp', 0,
    'gen4ReturnBonusXp', 0,
    'gen4ReturnBonusAwardedNow', 0,
    'freeResults', (select coalesce(jsonb_agg(jsonb_build_array(f.puzzle_id, f.difficulty) order by f.puzzle_id, f.difficulty), '[]'::jsonb) from (select distinct puzzle_id, difficulty from normalized_results where mode = 'free') f)
  ) as stats
  from result_stats rs
  cross join reward_stats rw
  cross join streak_stats ss
  cross join rescue_stats rc
)
select stats from stats_payload;
$function$
;

