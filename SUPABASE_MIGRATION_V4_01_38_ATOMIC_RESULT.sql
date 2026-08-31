-- Proplet v4.01.38 — Sprint 08B atomic result command
-- Additive schema. Runtime adoption is controlled separately by
-- PROPLET_ATOMIC_RESULT_V1_ENABLED and is disabled by default.

begin;

create table if not exists public.result_commands (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  idempotency_key text not null,
  request_digest text not null,
  command_digest text not null,
  receipt jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  committed_at timestamptz,
  constraint result_commands_identity_uq unique (player_id, idempotency_key),
  constraint result_commands_key_check
    check (pg_catalog.char_length(idempotency_key) between 8 and 240),
  constraint result_commands_request_digest_check
    check (request_digest ~ '^[0-9a-f]{64}$'),
  constraint result_commands_command_digest_check
    check (command_digest ~ '^[0-9a-f]{64}$'),
  constraint result_commands_receipt_check
    check (receipt is null or pg_catalog.jsonb_typeof(receipt) = 'object'),
  constraint result_commands_commit_check
    check ((receipt is null) = (committed_at is null))
);

create index if not exists result_commands_player_created_idx
  on public.result_commands (player_id, created_at desc);

alter table public.result_commands enable row level security;
revoke all on table public.result_commands from public, anon, authenticated;
grant select on table public.result_commands to service_role;

alter table public.puzzle_runs
  add column if not exists result_command_id uuid
  references public.result_commands(id) on delete restrict;

create unique index if not exists puzzle_runs_result_command_uq
  on public.puzzle_runs (result_command_id)
  where result_command_id is not null;

alter table public.puzzle_attempts
  drop constraint if exists puzzle_attempts_mode_check;
alter table public.puzzle_attempts
  add constraint puzzle_attempts_mode_check
  check (mode = any (array['daily'::text, 'free'::text, 'starter'::text, 'tajenka'::text]));

create or replace function public.proplet_submit_result_v1(
  p_player_id uuid,
  p_idempotency_key text,
  p_request_digest text,
  p_command_digest text,
  p_command jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
     or v_difficulty not in ('easy', 'medium', 'hard', 'hardcore', 'mozkomor')
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
$$;

revoke all on function public.proplet_submit_result_v1(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.proplet_submit_result_v1(uuid, text, text, text, jsonb)
  to service_role;

comment on table public.result_commands is
  'Sprint 08B durable idempotency ledger. A non-null receipt means every result write committed atomically.';
comment on function public.proplet_submit_result_v1(uuid, text, text, text, jsonb) is
  'Service-role-only atomic result command. Exact retries return the stored receipt.';

commit;
