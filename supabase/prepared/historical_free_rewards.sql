-- Prepared historical reward isolation. No change to previously awarded XP.
-- Apply only after pinned preflight and isolated PostgreSQL acceptance.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.free_slot_rewards, public.results in share row exclusive mode;

create temporary table proplet_historical_reward_baseline on commit drop as
select
  (select count(*) from public.results) as result_count,
  (select coalesce(sum(points), 0) from public.results) as result_xp,
  (select count(*) from public.free_slot_rewards) as old_claim_count,
  (select md5(coalesce(string_agg(to_jsonb(f)::text, ',' order by f.id), ''))
     from public.free_slot_rewards f) as old_claim_digest;

create table if not exists public.historical_free_slot_rewards (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'hardcore')),
  level integer not null check (level >= 1),
  source_puzzle_id text not null,
  source_result_id uuid references public.results(id) on delete set null,
  -- NULL is retained for the oldest exact-lineage history. It is not invented.
  content_generation integer check (content_generation between 1 and 3),
  points integer not null check (points >= 0),
  earned_at timestamptz not null,
  unique (player_id, difficulty, level)
);
alter table public.historical_free_slot_rewards enable row level security;
revoke all on table public.historical_free_slot_rewards from public, anon, authenticated, service_role;
grant select on table public.historical_free_slot_rewards to service_role;
comment on table public.historical_free_slot_rewards is
  'Consumed G1-G3 difficulty/level slots; reward audit only, never added to XP totals.';

-- Preserve all original IDs and fields in a separate ledger. G4 claims do
-- not reserve historical slots. The original table stays completely intact.
insert into public.historical_free_slot_rewards (
  id, player_id, difficulty, level, source_puzzle_id, source_result_id,
  content_generation, points, earned_at
)
select f.id, f.player_id, f.difficulty, f.level, f.source_puzzle_id,
       r.id, f.content_generation, f.points, f.earned_at
from public.free_slot_rewards f
left join public.results r
  on r.player_id = f.player_id and r.puzzle_id = f.source_puzzle_id and r.mode = 'free'
where f.content_generation between 1 and 3
on conflict (player_id, difficulty, level) do nothing;

-- Some G1 results predate the original ledger. Mark already-paid slots once,
-- choosing their earliest result, without paying anything or rewriting history.
insert into public.historical_free_slot_rewards (
  player_id, difficulty, level, source_puzzle_id, source_result_id,
  content_generation, points, earned_at
)
select distinct on (r.player_id, r.difficulty, r.content_level)
       r.player_id, r.difficulty, r.content_level, r.puzzle_id, r.id,
       r.content_generation, r.points, r.completed_at
from public.results r
where r.mode = 'free'
      and r.difficulty in ('easy', 'medium', 'hard', 'hardcore')
      and r.points > 0 and r.content_level is not null
      and (
        r.content_generation between 1 and 3
        or (
          r.content_generation is null
          and r.content_lineage_confidence = 'exact'
          and r.puzzle_id ~ '^(g[1-3]-[emhx]-|[emhx]([23])?-)[0-9]+$'
        )
      )
order by r.player_id, r.difficulty, r.content_level, r.completed_at, r.id
on conflict (player_id, difficulty, level) do nothing;

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
       or v_content_generation not between 1 and 3
       or v_difficulty not in ('easy', 'medium', 'hard', 'hardcore')
       or pg_catalog.jsonb_typeof(v_reward_slot) <> 'object'
       or (v_reward_slot ->> 'difficulty') is distinct from v_difficulty
       or v_reward_level is distinct from v_free_level
     ))
     or (v_mode = 'free' and v_content_generation between 1 and 3
         and v_reward_slot is null)
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

  if v_existing_request_digest is distinct from p_request_digest then
    raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = 'P0001';
  end if;
  -- A committed receipt belongs to the original browser request. A later
  -- server reward calculation must not turn its exact replay into a 409.
  if v_receipt is not null then
    return v_receipt;
  end if;
  if v_existing_command_digest is distinct from p_command_digest then
    raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = 'P0001';
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
    v_mode, v_difficulty, v_daily_date, v_elapsed_ms, v_moves,
    case when v_reward_slot is not null then 0 else v_points end,
    v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
    v_completed_at, v_team_code, v_content_generation, v_mode, v_free_level, v_calm_mode
  )
  on conflict (player_id, challenge_key) do nothing
  returning * into v_existing_result;

  if found then
    v_first_completion := true;
    if v_reward_slot is not null then
      -- Only a newly inserted result can acquire a reward. An existing
      -- challenge cannot consume a slot without receiving its XP.
      -- The paid-history guard also covers old in-flight writers during rollout.
      if exists (
        select 1 from public.results r
        where r.player_id = p_player_id and r.mode = 'free'
          and r.difficulty = v_difficulty and r.content_level = v_free_level
          and r.points > 0
          and (
            r.content_generation between 1 and 3
            or (
              r.content_generation is null
              and r.content_lineage_confidence = 'exact'
              and r.puzzle_id ~ '^(g[1-3]-[emhx]-|[emhx]([23])?-)[0-9]+$'
            )
          )
      ) then
        v_points := 0;
      end if;
      insert into public.historical_free_slot_rewards (
        id, player_id, difficulty, level, source_puzzle_id, source_result_id,
        content_generation, points, earned_at
      ) values (
        pg_catalog.gen_random_uuid(), p_player_id, v_difficulty, v_free_level,
        v_puzzle_id, v_existing_result.id, v_content_generation, v_points,
        pg_catalog.clock_timestamp()
      )
      on conflict (player_id, difficulty, level) do nothing
      returning true into v_reward_inserted;
      if not coalesce(v_reward_inserted, false) then
        v_points := 0;
      end if;
      v_transferred_slot := v_points = 0;
      if v_points > 0 then
        update public.results set points = v_points where id = v_existing_result.id;
      end if;
    end if;
  else
    if v_reward_slot is not null then
      v_transferred_slot := true;
    end if;
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

revoke all on function public.proplet_submit_result_v1(uuid,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.proplet_submit_result_v1(uuid,text,text,text,jsonb) to service_role;

do $verify$
declare
  v_baseline record;
begin
  select * into strict v_baseline from proplet_historical_reward_baseline;
  if (select count(*) from public.results) <> v_baseline.result_count
     or (select coalesce(sum(points), 0) from public.results) <> v_baseline.result_xp
     or (select count(*) from public.free_slot_rewards) <> v_baseline.old_claim_count
     or (select md5(coalesce(string_agg(to_jsonb(f)::text, ',' order by f.id), ''))
          from public.free_slot_rewards f) <> v_baseline.old_claim_digest then
    raise exception 'HISTORICAL_REWARD_PREPARATION_CHANGED_EXISTING_HISTORY';
  end if;
  if exists (
    select 1 from public.results r
    where r.mode = 'free'
      and r.difficulty in ('easy', 'medium', 'hard', 'hardcore')
      and r.points > 0 and r.content_level is not null
      and (
        r.content_generation between 1 and 3
        or (
          r.content_generation is null
          and r.content_lineage_confidence = 'exact'
          and r.puzzle_id ~ '^(g[1-3]-[emhx]-|[emhx]([23])?-)[0-9]+$'
        )
      )
      and not exists (
        select 1 from public.historical_free_slot_rewards h
        where h.player_id = r.player_id and h.difficulty = r.difficulty
          and h.level = r.content_level
      )
  ) then
    raise exception 'HISTORICAL_REWARD_PREPARATION_UNCOVERED_PAID_SLOT';
  end if;
end;
$verify$;
commit;
