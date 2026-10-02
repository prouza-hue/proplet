-- Approved sixth difficulty. Additive catalog changes only; no player data writes.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.results DROP CONSTRAINT results_difficulty_check;
ALTER TABLE public.results ADD CONSTRAINT results_difficulty_check CHECK (difficulty IN ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));

ALTER TABLE public.puzzle_attempts DROP CONSTRAINT puzzle_attempts_difficulty_check;
ALTER TABLE public.puzzle_attempts ADD CONSTRAINT puzzle_attempts_difficulty_check CHECK (difficulty IN ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));

ALTER TABLE public.free_slot_rewards DROP CONSTRAINT free_slot_rewards_difficulty_check;
ALTER TABLE public.free_slot_rewards ADD CONSTRAINT free_slot_rewards_difficulty_check CHECK (difficulty IN ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));

CREATE OR REPLACE FUNCTION public.proplet_submit_result_v1(p_player_id uuid, p_idempotency_key text, p_request_digest text, p_command_digest text, p_command jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_command_id uuid;
  v_existing_request_digest text;
  v_existing_command_digest text;
  v_receipt jsonb;
  v_mode text := p_command ->> 'mode';
  v_difficulty text := p_command ->> 'difficulty';
  v_puzzle_id text := p_command ->> 'puzzleId';
  v_challenge_key text := p_command ->> 'challengeKey';
  v_attempt_id text := nullif(p_command ->> 'attemptId', '');
  v_run_attempt_id text;
  v_daily_date date;
  v_completed_at timestamptz;
  v_elapsed_ms integer;
  v_moves integer;
  v_hints_used integer;
  v_wrong_attempts integer;
  v_max_hint_level integer;
  v_points integer;
  v_content_generation integer;
  v_free_level integer;
  v_clean_solve boolean;
  v_calm_mode boolean;
  v_team_code text := nullif(p_command ->> 'teamCodeAtCompletion', '');
  v_reward_slot jsonb := case
    when p_command -> 'legacyRewardSlot' = 'null'::jsonb then null
    else p_command -> 'legacyRewardSlot'
  end;
  v_reward_level integer;
  v_first_completion boolean := false;
  v_daily_generation_upgrade boolean := false;
  v_transferred_slot boolean := false;
  v_attempt_status text := 'not_supplied';
  v_reward_inserted boolean := false;
  v_existing_result public.results%rowtype;
  v_attempt public.puzzle_attempts%rowtype;
begin
  if p_player_id is null
     or p_idempotency_key is null
     or pg_catalog.char_length(p_idempotency_key) not between 8 and 240
     or p_request_digest is null
     or p_command_digest is null
     or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or (p_command ->> 'contractVersion') is distinct from '1'
     or (p_command ->> 'playerId') is distinct from p_player_id::text
     or (p_command ->> 'idempotencyKey') is distinct from p_idempotency_key
     or (p_command ->> 'requestDigest') is distinct from p_request_digest
     or (p_command ->> 'commandDigest') is distinct from p_command_digest
     or p_idempotency_key !~ '^(attempt:|legacy:).{1,232}$'
     or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_command_digest !~ '^[0-9a-f]{64}$'
  then
    raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
  end if;

  if v_mode not in ('daily', 'free', 'starter', 'tajenka')
     or v_difficulty not in ('easy', 'medium', 'hard', 'hardcore', 'mozkomor', 'mozkokalypsa')
     or v_puzzle_id is null
     or pg_catalog.char_length(v_puzzle_id) not between 1 and 160
     or v_challenge_key is null
     or pg_catalog.char_length(v_challenge_key) not between 3 and 240
  then
    raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
  end if;

  begin
    v_daily_date := nullif(p_command ->> 'dailyDate', '')::date;
    v_completed_at := (p_command ->> 'completedAt')::timestamptz;
    v_elapsed_ms := (p_command ->> 'elapsedMs')::integer;
    v_moves := (p_command ->> 'moves')::integer;
    v_hints_used := (p_command ->> 'hintsUsed')::integer;
    v_wrong_attempts := (p_command ->> 'wrongAttempts')::integer;
    v_max_hint_level := (p_command ->> 'maxHintLevel')::integer;
    v_points := (p_command ->> 'points')::integer;
    v_content_generation := nullif(p_command ->> 'contentGeneration', '')::integer;
    v_free_level := nullif(p_command ->> 'freeLevel', '')::integer;
    v_clean_solve := (p_command ->> 'cleanSolve')::boolean;
    v_calm_mode := (p_command ->> 'calmMode')::boolean;
    v_reward_level := nullif(v_reward_slot ->> 'level', '')::integer;
  exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
    raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
  end;

  if v_completed_at is null
     or v_elapsed_ms is null or v_elapsed_ms not between 1000 and 86400000
     or v_moves is null or v_moves not between 1 and 10000
     or v_hints_used is null or v_hints_used not between 0 and 99
     or v_wrong_attempts is null or v_wrong_attempts not between 0 and 999
     or v_max_hint_level is null or v_max_hint_level not between 0 and 3
     or v_points is null or v_points not between 0 and 10000
     or v_clean_solve is null
     or v_calm_mode is null
     or (v_hints_used = 0 and v_max_hint_level > 0)
     or (v_clean_solve and v_hints_used <> 0)
     or (v_mode = 'daily' and v_daily_date is null)
     or (v_mode <> 'daily' and v_daily_date is not null)
     or (v_mode = 'free' and (v_content_generation is null or v_free_level is null))
     or (v_content_generation is not null and v_content_generation < 1)
     or (v_free_level is not null and v_free_level < 1)
     or (v_reward_slot is not null and (
       v_mode <> 'free'
       or pg_catalog.jsonb_typeof(v_reward_slot) <> 'object'
       or (v_reward_slot ->> 'difficulty') is distinct from v_difficulty
       or v_reward_level is distinct from v_free_level
     ))
  then
    raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
  end if;

  insert into public.result_commands (
    player_id, idempotency_key, request_digest, command_digest
  ) values (
    p_player_id, p_idempotency_key, p_request_digest, p_command_digest
  )
  on conflict (player_id, idempotency_key) do nothing
  returning id into v_command_id;

  select id, request_digest, command_digest, receipt
    into v_command_id, v_existing_request_digest, v_existing_command_digest, v_receipt
  from public.result_commands
  where player_id = p_player_id and idempotency_key = p_idempotency_key
  for update;

  if v_existing_request_digest is distinct from p_request_digest
     or v_existing_command_digest is distinct from p_command_digest
  then
    raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = 'P0001';
  end if;
  if v_receipt is not null then
    return v_receipt;
  end if;

  if v_reward_slot is not null then
    insert into public.free_slot_rewards (
      id, player_id, difficulty, level, source_puzzle_id,
      content_generation, points, earned_at
    ) values (
      pg_catalog.gen_random_uuid(), p_player_id, v_difficulty, v_free_level, v_puzzle_id,
      v_content_generation, v_points, pg_catalog.clock_timestamp()
    )
    on conflict (player_id, difficulty, level) do nothing
    returning true into v_reward_inserted;
    v_transferred_slot := not coalesce(v_reward_inserted, false) or v_points = 0;
  end if;

  v_run_attempt_id := coalesce(v_attempt_id, 'result:' || v_command_id::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_run_attempt_id, 8802));
  if exists (select 1 from public.puzzle_runs where attempt_id = v_run_attempt_id) then
    v_run_attempt_id := 'result:' || v_command_id::text;
  end if;

  insert into public.puzzle_runs (
    id, attempt_id, result_command_id, player_id, puzzle_id, challenge_key,
    mode, difficulty, elapsed_ms, moves, hints_used, wrong_attempts,
    max_hint_level, clean_solve, completed_at, content_generation,
    content_bank, content_level, calm_mode
  ) values (
    pg_catalog.gen_random_uuid(), v_run_attempt_id, v_command_id, p_player_id,
    v_puzzle_id, v_challenge_key, v_mode, v_difficulty, v_elapsed_ms, v_moves,
    v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
    v_completed_at, v_content_generation, v_mode, v_free_level, v_calm_mode
  );

  insert into public.results (
    id, player_id, puzzle_id, challenge_key, mode, difficulty, daily_date,
    best_elapsed_ms, best_moves, points, hints_used, wrong_attempts,
    max_hint_level, clean_solve, completed_at, team_code_at_completion,
    content_generation, content_bank, content_level, calm_mode
  ) values (
    pg_catalog.gen_random_uuid(), p_player_id, v_puzzle_id, v_challenge_key,
    v_mode, v_difficulty, v_daily_date, v_elapsed_ms, v_moves, v_points,
    v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
    v_completed_at, v_team_code, v_content_generation, v_mode, v_free_level, v_calm_mode
  )
  on conflict (player_id, challenge_key) do nothing
  returning * into v_existing_result;

  if found then
    v_first_completion := true;
  else
    select * into v_existing_result
    from public.results
    where player_id = p_player_id and challenge_key = v_challenge_key
    for update;

    if v_mode = 'daily'
       and v_existing_result.puzzle_id <> v_puzzle_id
       and coalesce(v_content_generation, 0) >
           coalesce(v_existing_result.content_generation, 0)
    then
      update public.results set
        puzzle_id = v_puzzle_id,
        difficulty = v_difficulty,
        daily_date = v_daily_date,
        best_elapsed_ms = v_elapsed_ms,
        best_moves = v_moves,
        hints_used = v_hints_used,
        wrong_attempts = v_wrong_attempts,
        max_hint_level = v_max_hint_level,
        clean_solve = v_clean_solve,
        completed_at = v_completed_at,
        content_generation = v_content_generation,
        content_bank = v_mode,
        content_level = v_free_level,
        calm_mode = v_calm_mode
      where id = v_existing_result.id;
      v_daily_generation_upgrade := true;
    elsif v_existing_result.puzzle_id = v_puzzle_id
          and v_completed_at < v_existing_result.completed_at then
      update public.results set
        team_code_at_completion = v_team_code,
        best_elapsed_ms = v_elapsed_ms,
        best_moves = v_moves,
        hints_used = v_hints_used,
        wrong_attempts = v_wrong_attempts,
        max_hint_level = v_max_hint_level,
        clean_solve = v_clean_solve,
        completed_at = v_completed_at,
        content_generation = v_content_generation,
        content_bank = v_mode,
        content_level = v_free_level,
        calm_mode = v_calm_mode
      where id = v_existing_result.id;
    end if;
  end if;

  if v_attempt_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_attempt_id, 8803));
    select * into v_attempt
    from public.puzzle_attempts
    where id = v_attempt_id
    for update;
    if found then
      if v_attempt.player_id = p_player_id
         and v_attempt.puzzle_id = v_puzzle_id
         and v_attempt.challenge_key = v_challenge_key
         and v_attempt.mode = v_mode
         and v_attempt.difficulty = v_difficulty
      then
        update public.puzzle_attempts set
          completed_at = pg_catalog.clock_timestamp(),
          elapsed_ms = v_elapsed_ms,
          moves = v_moves,
          wrong_attempts = v_wrong_attempts,
          hints_used = v_hints_used,
          max_hint_level = v_max_hint_level,
          clean_solve = v_clean_solve,
          content_generation = v_content_generation,
          content_bank = v_mode,
          content_level = v_free_level,
          calm_mode = v_calm_mode
        where id = v_attempt_id;
        v_attempt_status := 'updated_owned';
      else
        v_attempt_status := 'ownership_conflict';
      end if;
    else
      insert into public.puzzle_attempts (
        id, player_id, puzzle_id, challenge_key, mode, difficulty,
        started_at, completed_at, elapsed_ms, moves, wrong_attempts,
        hints_used, max_hint_level, clean_solve, app_version,
        content_generation, content_bank, content_level, calm_mode
      ) values (
        v_attempt_id, p_player_id, v_puzzle_id, v_challenge_key, v_mode, v_difficulty,
        pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(), v_elapsed_ms, v_moves,
        v_wrong_attempts, v_hints_used, v_max_hint_level, v_clean_solve,
        '4.01.38-atomic-offline', v_content_generation, v_mode, v_free_level, v_calm_mode
      );
      v_attempt_status := 'created_offline';
    end if;
  end if;

  v_receipt := pg_catalog.jsonb_build_object(
    'commandId', v_command_id::text,
    'firstCompletion', v_first_completion,
    'awardedPoints', case when v_first_completion then v_points else 0 end,
    'dailyGenerationUpgrade', v_daily_generation_upgrade,
    'transferredSlot', v_transferred_slot,
    'attemptStatus', v_attempt_status
  );

  update public.result_commands
  set receipt = v_receipt, committed_at = pg_catalog.clock_timestamp()
  where id = v_command_id;

  return v_receipt;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proplet_account_snapshot_v1(p_player uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_active_generation integer DEFAULT 4, p_base_levels jsonb DEFAULT '{"easy": 200, "hard": 200, "medium": 200, "hardcore": 200, "mozkomor": 100}'::jsonb, p_mozkomor_unlock_base integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with
stamp as (
  select statement_timestamp() as value,
         (statement_timestamp() at time zone 'Europe/Prague')::date as today
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
    coalesce(sum(greatest(points, 0)) filter (where reward_key like 'word_discovery_v1:%'), 0)::integer as word_discovery_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key <> 'account_creation_v1' and reward_key not like 'word_discovery_v1:%'), 0)::integer as other_reward_xp,
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
$function$;

-- CREATE OR REPLACE retains ownership and grants; explicitly retain service-only RPC access.
REVOKE ALL ON FUNCTION public.proplet_submit_result_v1(uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proplet_submit_result_v1(uuid,text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.proplet_account_snapshot_v1(uuid,timestamptz,integer,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proplet_account_snapshot_v1(uuid,timestamptz,integer,jsonb,integer) TO service_role;
