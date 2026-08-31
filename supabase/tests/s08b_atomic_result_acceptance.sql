-- Sprint 08B disposable-database acceptance test.
-- The outer transaction rolls back every synthetic row and test trigger.

begin;

insert into public.players (id, name, family_code, token_hash, avatar)
values (
  '080b0000-0000-4000-8000-000000000001'::uuid,
  'S08B',
  'S08B_TEST',
  's08b-atomic-result-test-token',
  '🧪'
);

create function pg_temp.s08b_command(p_suffix integer, p_with_reward boolean default false)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contractVersion', 1,
    'playerId', '080b0000-0000-4000-8000-000000000001',
    'idempotencyKey', 'attempt:s08b-' || p_suffix::text,
    'requestDigest', pg_catalog.repeat('b', 64),
    'commandDigest', pg_catalog.repeat('c', 64),
    'puzzleId', 's08b-free-' || p_suffix::text,
    'challengeKey', 'free:s08b-free-' || p_suffix::text,
    'mode', 'free',
    'difficulty', 'easy',
    'dailyDate', null,
    'completedAt', '2026-08-30T12:00:00+00:00',
    'elapsedMs', 42000,
    'moves', 12,
    'hintsUsed', 0,
    'wrongAttempts', 0,
    'maxHintLevel', 0,
    'cleanSolve', true,
    'calmMode', false,
    'attemptId', 's08b-attempt-' || p_suffix::text,
    'points', 15,
    'contentGeneration', 4,
    'freeLevel', 700 + p_suffix,
    'legacyRewardSlot', case when p_with_reward then
      pg_catalog.jsonb_build_object('difficulty', 'easy', 'level', 700 + p_suffix)
      else null end,
    'teamCodeAtCompletion', null
  );
$$;

do $$
declare
  v_command jsonb := pg_temp.s08b_command(1, false);
  v_first jsonb;
  v_retry jsonb;
begin
  v_first := public.proplet_submit_result_v1(
    '080b0000-0000-4000-8000-000000000001'::uuid,
    v_command ->> 'idempotencyKey', v_command ->> 'requestDigest',
    v_command ->> 'commandDigest', v_command
  );
  v_retry := public.proplet_submit_result_v1(
    '080b0000-0000-4000-8000-000000000001'::uuid,
    v_command ->> 'idempotencyKey', v_command ->> 'requestDigest',
    v_command ->> 'commandDigest', v_command
  );
  if v_first is distinct from v_retry
     or (v_first ->> 'firstCompletion')::boolean is not true
     or (v_first ->> 'awardedPoints')::integer <> 15
  then
    raise exception 'S08B acceptance: exact retry receipt mismatch: % / %', v_first, v_retry;
  end if;
  if (select count(*) from public.result_commands where player_id =
        '080b0000-0000-4000-8000-000000000001'::uuid) <> 1
     or (select count(*) from public.puzzle_runs where result_command_id is not null
          and player_id = '080b0000-0000-4000-8000-000000000001'::uuid) <> 1
     or (select count(*) from public.results where player_id =
          '080b0000-0000-4000-8000-000000000001'::uuid) <> 1
  then
    raise exception 'S08B acceptance: exact retry duplicated a durable write';
  end if;

  begin
    perform public.proplet_submit_result_v1(
      '080b0000-0000-4000-8000-000000000001'::uuid,
      v_command ->> 'idempotencyKey', pg_catalog.repeat('d', 64),
      v_command ->> 'commandDigest',
      pg_catalog.jsonb_set(v_command, '{requestDigest}', pg_catalog.to_jsonb(pg_catalog.repeat('d', 64)))
    );
    raise exception 'S08B acceptance: conflicting retry unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'IDEMPOTENCY_CONFLICT' then
      raise;
    end if;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.proplet_submit_result_v1(
      '080b0000-0000-4000-8000-000000000001'::uuid,
      'attempt:s08b-denied', pg_catalog.repeat('e', 64), pg_catalog.repeat('f', 64), '{}'::jsonb
    );
    raise exception 'S08B acceptance: anon unexpectedly executed RPC';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

create function pg_temp.s08b_fail_phase()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_phase text := pg_catalog.current_setting('proplet.test_fail_phase', true);
begin
  if v_phase = tg_argv[0] then
    raise exception using message = 'S08B_INJECTED_' || v_phase, errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger s08b_fail_ledger after insert on public.result_commands
for each row execute function pg_temp.s08b_fail_phase('ledger');
create trigger s08b_fail_reward after insert on public.free_slot_rewards
for each row execute function pg_temp.s08b_fail_phase('reward');
create trigger s08b_fail_run after insert on public.puzzle_runs
for each row execute function pg_temp.s08b_fail_phase('run');
create trigger s08b_fail_result after insert on public.results
for each row execute function pg_temp.s08b_fail_phase('result');
create trigger s08b_fail_attempt after insert or update on public.puzzle_attempts
for each row execute function pg_temp.s08b_fail_phase('attempt');
create trigger s08b_fail_receipt after update of receipt on public.result_commands
for each row when (new.receipt is not null)
execute function pg_temp.s08b_fail_phase('receipt');

do $$
declare
  v_phases text[] := array['ledger', 'reward', 'run', 'result', 'attempt', 'receipt'];
  v_phase text;
  v_suffix integer := 10;
  v_command jsonb;
begin
  foreach v_phase in array v_phases loop
    v_suffix := v_suffix + 1;
    v_command := pg_temp.s08b_command(v_suffix, true);
    perform pg_catalog.set_config('proplet.test_fail_phase', v_phase, true);
    begin
      perform public.proplet_submit_result_v1(
        '080b0000-0000-4000-8000-000000000001'::uuid,
        v_command ->> 'idempotencyKey', v_command ->> 'requestDigest',
        v_command ->> 'commandDigest', v_command
      );
      raise exception 'S08B acceptance: phase % unexpectedly committed', v_phase;
    exception when raise_exception then
      if sqlerrm <> 'S08B_INJECTED_' || v_phase then
        raise;
      end if;
    end;
    perform pg_catalog.set_config('proplet.test_fail_phase', '', true);

    if exists (
         select 1 from public.result_commands
         where player_id = '080b0000-0000-4000-8000-000000000001'::uuid
           and idempotency_key = v_command ->> 'idempotencyKey'
       )
       or exists (
         select 1 from public.puzzle_runs
         where player_id = '080b0000-0000-4000-8000-000000000001'::uuid
           and challenge_key = v_command ->> 'challengeKey'
       )
       or exists (
         select 1 from public.results
         where player_id = '080b0000-0000-4000-8000-000000000001'::uuid
           and challenge_key = v_command ->> 'challengeKey'
       )
       or exists (
         select 1 from public.puzzle_attempts where id = v_command ->> 'attemptId'
       )
       or exists (
         select 1 from public.free_slot_rewards
         where player_id = '080b0000-0000-4000-8000-000000000001'::uuid
           and level = (v_command ->> 'freeLevel')::integer
       )
    then
      raise exception 'S08B acceptance: phase % left a partial write', v_phase;
    end if;
  end loop;
end;
$$;

rollback;
