-- Offline completion lowers time trust only. Rewards, sessions and receipts retain their existing rules.
-- Prepared from production pg_get_functiondef on 2026-10-15; never rewrites existing rows.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

CREATE OR REPLACE FUNCTION public.proplet_daily_special_timing_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.play_sessions;
begin
 if new.mode<>'daily_special' then return new; end if;
 select * into s from public.play_sessions where player_id=new.player_id and actor_key='p:'||new.player_id::text
  and challenge_key=new.challenge_key and puzzle_id=new.puzzle_id;
 new.timing_verified:=coalesce(new.timing_verified,true) and coalesce(s.finished and s.verified,false);
 if tg_op='UPDATE' and old.timing_verified is false then new.timing_verified:=false; end if;
 if tg_table_name='puzzle_runs' then
  new.timing_verified:=coalesce(new.timing_verified and new.attempt_id=s.attempt_id,false);
  if s.finished and new.attempt_id=s.attempt_id then new.elapsed_ms:=greatest(new.elapsed_ms,s.elapsed_ms); end if;
 else
  if s.finished then new.best_elapsed_ms:=greatest(new.best_elapsed_ms,s.elapsed_ms); end if;
 end if;
 if s.finished then
  new.hints_used:=greatest(new.hints_used,coalesce((s.progress->>'hints')::int,0));
  new.max_hint_level:=greatest(new.max_hint_level,coalesce((s.progress->>'maxHintLevel')::int,0));
  new.calm_mode:=new.calm_mode or coalesce((s.progress->>'calmMode')::boolean,false);
  new.clean_solve:=new.clean_solve and new.hints_used=0 and new.max_hint_level=0;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.proplet_result_timing_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.play_sessions; policy public.fair_play_policy;
begin
 select * into policy from public.fair_play_policy where singleton;
 if not coalesce(policy.enabled,false) then return new; end if;
 -- Apply only to newly inserted Daily results from the announced boundary.
 if new.mode<>'daily' or substring(new.challenge_key from 7)::date<policy.daily_from then return new; end if;
 select * into s from public.play_sessions where player_id=new.player_id and actor_key='p:'||new.player_id::text and challenge_key=new.challenge_key and puzzle_id=new.puzzle_id;
 new.timing_verified:=coalesce(new.timing_verified,true) and coalesce(s.finished and s.verified,false);
 if tg_op='UPDATE' and old.timing_verified is false then new.timing_verified:=false; end if;
 if tg_table_name='puzzle_runs' then
   new.timing_verified:=coalesce(new.timing_verified and new.attempt_id=s.attempt_id,false);
   if s.finished and new.attempt_id=s.attempt_id then new.elapsed_ms:=greatest(new.elapsed_ms,s.elapsed_ms); end if;
 else
   if s.finished then new.best_elapsed_ms:=greatest(new.best_elapsed_ms,s.elapsed_ms); end if;
 end if;
 if s.finished then
   new.hints_used:=greatest(new.hints_used,coalesce((s.progress->>'hints')::int,0));
   new.max_hint_level:=greatest(new.max_hint_level,coalesce((s.progress->>'maxHintLevel')::int,0));
   new.calm_mode:=new.calm_mode or coalesce((s.progress->>'calmMode')::boolean,false);
   new.clean_solve:=new.clean_solve and new.hints_used=0 and new.max_hint_level=0;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.proplet_submit_daily_special_v1(p_player_id uuid, p_idempotency_key text, p_request_digest text, p_command_digest text, p_command jsonb)
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
v_timing_verified boolean := case when p_command->'timingUnverified' = 'true'::jsonb then false else null end;
v_team_code text := nullif(p_command ->> 'teamCodeAtCompletion', '');
v_reward_slot jsonb := case
when p_command -> 'legacyRewardSlot' = 'null'::jsonb then null
else p_command -> 'legacyRewardSlot'
end;
v_first_completion boolean := false;
v_attempt_status text := 'not_supplied';
v_existing_result public.results%rowtype;
v_binding public.daily_special_bindings%rowtype;
v_policy public.daily_specials_policy%rowtype;
v_session public.play_sessions%rowtype;
v_practice boolean := coalesce((p_command->>'specialPractice')::boolean,false);
v_today date;
v_end timestamptz;
v_now timestamptz:=clock_timestamp();
begin
if p_player_id is null
or p_idempotency_key is null
or char_length(p_idempotency_key) not between 8 and 240
or p_request_digest is null
or p_command_digest is null
or p_command is null
or jsonb_typeof(p_command) <> 'object'
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
if v_mode <> 'daily_special'
or v_difficulty not in ('hardcore','mozkomor','mozkokalypsa')
or v_puzzle_id is null
or char_length(v_puzzle_id) not between 1 and 160
or v_challenge_key is null
or char_length(v_challenge_key) not between 3 and 240
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
or v_daily_date is null
or (v_content_generation is not null and v_content_generation < 1)
or v_reward_slot is not null
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
select * into v_policy from public.daily_specials_policy where singleton;
select * into v_binding from public.daily_special_bindings where puzzle_id=v_puzzle_id;
v_today:=coalesce(v_policy.preview_date,(v_now at time zone 'Europe/Prague')::date);
v_end:=(v_binding.daily_date+1)::timestamp at time zone 'Europe/Prague';
if not coalesce(v_policy.enabled,false) or v_binding.puzzle_id is null
or (p_command->>'contentHash') is distinct from v_binding.content_hash
or v_daily_date is distinct from v_binding.daily_date
or v_difficulty is distinct from v_binding.difficulty
or v_reward_slot is not null or v_free_level is not null
or v_content_generation is distinct from 6
or v_binding.daily_date>v_today
or nullif(p_command->>'specialPreviewDate','')::date is distinct from v_policy.preview_date then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
select * into v_session from public.play_sessions where player_id=p_player_id
and actor_key='p:'||p_player_id::text and challenge_key=v_challenge_key and puzzle_id=v_puzzle_id for update;
if v_practice then
if v_challenge_key<>'daily-special-practice:'||v_daily_date::text||':'||v_difficulty||':'||v_puzzle_id
or v_binding.daily_date>v_today or v_points<>0 then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
else
if v_challenge_key<>v_binding.challenge_key or v_points<>100 or v_attempt_id is null
or not coalesce(v_session.finished,false) or v_session.attempt_id<>v_attempt_id then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
if v_binding.daily_date<v_today and (
v_policy.preview_date is not null or v_now>v_end+interval '24 hours'
or not coalesce(v_session.verified,false)
or v_session.created_at<(v_binding.daily_date::timestamp at time zone 'Europe/Prague')
or v_session.created_at>=v_end or v_session.last_seen>=v_end
) then raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001'; end if;
-- Server-proven completion time prevents client timestamps from moving XP
-- across competition periods or replacing the first official result.
v_completed_at:=v_session.last_seen;
if v_policy.preview_date is not null then
v_completed_at:=(v_policy.preview_date+(v_session.last_seen at time zone 'Europe/Prague')::time) at time zone 'Europe/Prague';
end if;
end if;
v_run_attempt_id := coalesce(v_attempt_id, 'result:' || v_command_id::text);
perform pg_advisory_xact_lock(hashtextextended(v_run_attempt_id, 8802));
if exists (select 1 from public.puzzle_runs where attempt_id = v_run_attempt_id) then
v_run_attempt_id := 'result:' || v_command_id::text;
end if;
insert into public.puzzle_runs (
id, attempt_id, result_command_id, player_id, puzzle_id, challenge_key,
mode, difficulty, elapsed_ms, moves, hints_used, wrong_attempts,
max_hint_level, clean_solve, completed_at, content_generation,
content_bank, content_level, calm_mode, timing_verified
) values (
gen_random_uuid(), v_run_attempt_id, v_command_id, p_player_id,
v_puzzle_id, v_challenge_key, v_mode, v_difficulty, v_elapsed_ms, v_moves,
v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
v_completed_at, v_content_generation, v_mode, v_free_level, v_calm_mode, v_timing_verified
);
if not v_practice then
insert into public.results (
id, player_id, puzzle_id, challenge_key, mode, difficulty, daily_date,
best_elapsed_ms, best_moves, points, hints_used, wrong_attempts,
max_hint_level, clean_solve, completed_at, team_code_at_completion,
content_generation, content_bank, content_level, calm_mode, timing_verified
) values (
gen_random_uuid(), p_player_id, v_puzzle_id, v_challenge_key,
v_mode, v_difficulty, v_daily_date, v_elapsed_ms, v_moves, v_points,
v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
v_completed_at, v_team_code, v_content_generation, v_mode, v_free_level, v_calm_mode, v_timing_verified
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
if v_existing_result.puzzle_id <> v_puzzle_id then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
if v_existing_result.puzzle_id = v_puzzle_id
and v_session.verified and v_completed_at < v_existing_result.completed_at then
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
calm_mode = v_calm_mode,
      timing_verified = coalesce(v_timing_verified, timing_verified)
where id = v_existing_result.id;
end if;
end if;
end if; -- archive practice stores a run, never an official result or XP
if v_attempt_id is not null then
perform pg_advisory_xact_lock(hashtextextended(v_attempt_id,8803));
insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at,elapsed_ms,moves,wrong_attempts,hints_used,max_hint_level,clean_solve,app_version,content_generation,content_bank,calm_mode)
values(v_attempt_id,p_player_id,v_puzzle_id,v_challenge_key,v_mode,v_difficulty,coalesce(v_session.created_at,v_now),v_completed_at,v_elapsed_ms,v_moves,v_wrong_attempts,v_hints_used,v_max_hint_level,v_clean_solve,'daily-special-v1',6,v_mode,v_calm_mode)
on conflict(id) do nothing;
update public.puzzle_attempts set completed_at=v_completed_at,elapsed_ms=v_elapsed_ms,moves=v_moves,
wrong_attempts=v_wrong_attempts,hints_used=v_hints_used,max_hint_level=v_max_hint_level,clean_solve=v_clean_solve,
content_generation=6,content_bank=v_mode,calm_mode=v_calm_mode
where id=v_attempt_id and player_id=p_player_id and puzzle_id=v_puzzle_id and challenge_key=v_challenge_key and mode=v_mode and difficulty=v_difficulty;
if not found then raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001'; end if;
v_attempt_status:='updated_owned';
end if;
v_receipt := jsonb_build_object(
'commandId', v_command_id::text,
'practice',v_practice,
'firstCompletion', v_first_completion,
'awardedPoints', case when v_first_completion then v_points else 0 end,
'dailyGenerationUpgrade', false,
'transferredSlot', false,
'attemptStatus', v_attempt_status
);
update public.result_commands
set receipt = v_receipt, committed_at = clock_timestamp()
where id = v_command_id;
return v_receipt;
end;
$function$;

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
  v_timing_verified boolean := case when p_command->'timingUnverified' = 'true'::jsonb then false else null end;
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
    content_bank, content_level, calm_mode, timing_verified
  ) values (
    pg_catalog.gen_random_uuid(), v_run_attempt_id, v_command_id, p_player_id,
    v_puzzle_id, v_challenge_key, v_mode, v_difficulty, v_elapsed_ms, v_moves,
    v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
    v_completed_at, v_content_generation, v_mode, v_free_level, v_calm_mode, v_timing_verified
  );

  insert into public.results (
    id, player_id, puzzle_id, challenge_key, mode, difficulty, daily_date,
    best_elapsed_ms, best_moves, points, hints_used, wrong_attempts,
    max_hint_level, clean_solve, completed_at, team_code_at_completion,
    content_generation, content_bank, content_level, calm_mode, timing_verified
  ) values (
    pg_catalog.gen_random_uuid(), p_player_id, v_puzzle_id, v_challenge_key,
    v_mode, v_difficulty, v_daily_date, v_elapsed_ms, v_moves,
    case when v_reward_slot is not null then 0 else v_points end,
    v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
    v_completed_at, v_team_code, v_content_generation, v_mode, v_free_level, v_calm_mode, v_timing_verified
  )
  on conflict (player_id, challenge_key) do nothing
  returning * into v_existing_result;

  if found then
    v_first_completion := true;
    if v_reward_slot is not null then
      -- Only a newly inserted result can acquire a reward. An existing
      -- challenge cannot consume a slot without receiving its XP.
      -- Paid history also consumes a slot. Old writers must be stopped/drained
      -- before rollout; this lookup alone does not serialize their later commit.
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
        calm_mode = v_calm_mode,
        timing_verified = coalesce(v_timing_verified, timing_verified)
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
        calm_mode = v_calm_mode,
        timing_verified = coalesce(v_timing_verified, timing_verified)
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

-- A new RPC name makes API-before-migration deployment fail closed: older
-- databases cannot commit an offline command through a timing-blind writer.
create function public.proplet_submit_offline_result_v1(p_command jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $offline$
begin
  if p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or (p_command->'timingUnverified') is distinct from 'true'::jsonb then
    raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
  end if;
  return public.proplet_submit_result_v1(
    (p_command->>'playerId')::uuid, p_command->>'idempotencyKey',
    p_command->>'requestDigest', p_command->>'commandDigest', p_command
  );
end;
$offline$;
revoke all on function public.proplet_submit_offline_result_v1(jsonb) from public,anon,authenticated;
grant execute on function public.proplet_submit_offline_result_v1(jsonb) to service_role;

create function public.proplet_submit_offline_daily_special_v1(p_command jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $offline$
begin
  if p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or (p_command->'timingUnverified') is distinct from 'true'::jsonb then
    raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
  end if;
  return public.proplet_submit_daily_special_v1(
    (p_command->>'playerId')::uuid, p_command->>'idempotencyKey',
    p_command->>'requestDigest', p_command->>'commandDigest', p_command
  );
end;
$offline$;
revoke all on function public.proplet_submit_offline_daily_special_v1(jsonb) from public,anon,authenticated;
grant execute on function public.proplet_submit_offline_daily_special_v1(jsonb) to service_role;

commit;

