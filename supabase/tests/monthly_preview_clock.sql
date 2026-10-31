-- Real SQL acceptance for the isolated trusted-request clock. All rows roll back.
begin;
set local statement_timeout='30s';
do $qa$
declare
  ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  p uuid; owner uuid:=gen_random_uuid(); cmd jsonb; response jsonb;
  first_stamp timestamptz; next_stamp timestamptz; stored timestamptz; day date; i integer;
begin
  if not exists(select 1 from public.monthly_competition_settings where isolated and not enabled) then
    raise exception 'ISOLATED_DISABLED_DATABASE_REQUIRED'; end if;
  if has_function_privilege('anon','public.proplet_monthly_preview_control_v1(text,timestamp with time zone)','execute')
    or has_function_privilege('authenticated','public.proplet_monthly_preview_clock_v1()','execute') then
    raise exception 'CLOCK_ACL_FAILED'; end if;
  perform set_config('request.headers','{}',true);
  begin
    perform public.proplet_monthly_preview_control_v1('clock','2026-11-01 12:00:00 Europe/Prague');
    raise exception 'UNMARKED_CONTROL_ACCEPTED';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-proplet-monthly-preview":"codex/monthly-competition-202611"}',true);
  update public.monthly_competition_settings set isolated=false;
  begin
    perform public.proplet_monthly_preview_control_v1('clock','2026-11-01 12:00:00 Europe/Prague');
    raise exception 'NONISOLATED_CONTROL_ACCEPTED';
  exception when insufficient_privilege then null; end;
  update public.monthly_competition_settings set isolated=true;
  begin
    perform public.proplet_monthly_preview_control_v1('clock','2027-01-05 00:00:00 Europe/Prague');
    raise exception 'OUT_OF_RANGE_CLOCK_ACCEPTED';
  exception when invalid_parameter_value then null; end;
  perform public.proplet_monthly_preview_control_v1('clock','2027-01-04 12:00:00 Europe/Prague');
  response:=public.proplet_monthly_preview_control_v1('clock','2026-11-01 12:00:00 Europe/Prague');
  if response->>'qaDate'<>'2026-11-01' or response->>'enabled'<>'true' then raise exception 'CLOCK_CONTROL_FAILED'; end if;
  first_stamp:=public.proplet_monthly_preview_clock_v1();
  perform pg_sleep(0.025);
  next_stamp:=public.proplet_monthly_preview_clock_v1();
  if next_stamp-first_stamp<interval '20 milliseconds' or next_stamp-first_stamp>interval '2 seconds' then
    raise exception 'CLOCK_NOT_MOVING_WITH_REAL_ELAPSED'; end if;
  foreach p in array ids loop
    insert into public.players(id,name,family_code,token_hash)
      values(p,'Clock QA '||left(p::text,8),'SOLO_MONTHLY_CLOCK_QA','clock-qa-'||p);
  end loop;
  response:=public.proplet_play_session_v1('p:'||ids[1],ids[1],'daily:2026-11-01','clock-qa-day1','daily','clock-qa-online',owner,1,'open','{"elapsedMs":0,"moves":0,"found":[]}'::jsonb);
  response:=public.proplet_play_session_v1('p:'||ids[1],ids[1],'daily:2026-11-01','clock-qa-day1','daily','clock-qa-online',owner,2,'finish','{"elapsedMs":3000,"moves":12,"found":[]}'::jsonb);
  if (response->>'created_at')::timestamptz<first_stamp-interval '1 second'
    or (response->>'last_seen')::timestamptz<first_stamp or (response->>'elapsed_ms')::bigint<3000 then
    raise exception 'SESSION_LOGICAL_CLOCK_OR_REAL_DURATION_FAILED'; end if;
  for i in 1..4 loop
    p:=ids[i];
    if i=2 then perform public.proplet_monthly_preview_control_v1('clock','2026-11-02 12:00:00 Europe/Prague'); end if;
    if i=3 then perform public.proplet_monthly_preview_control_v1('clock','2026-12-02 12:00:00 Europe/Prague'); end if;
    if i=4 then perform public.proplet_monthly_preview_control_v1('clock','2026-12-03 00:00:01 Europe/Prague'); end if;
    day:=case when i<=2 then date '2026-11-01' else date '2026-11-30' end;
    cmd:=jsonb_build_object('contractVersion',1,'playerId',p,'idempotencyKey','attempt:clock-qa-'||p,
      'requestDigest',repeat('a',64),'commandDigest',repeat('b',64),'puzzleId',case when i=1 then 'clock-qa-day1' else 'clock-qa-'||day end,
      'challengeKey','daily:'||day,'mode','daily','difficulty','easy','dailyDate',day,
      'completedAt',case when i=1 then '2026-10-28 12:00:00 Europe/Prague'::timestamptz else (day::timestamp at time zone 'Europe/Prague')+interval '14 hours' end,
      'elapsedMs',3000,'moves',12,'hintsUsed',case when i=2 then 1 else 0 end,'wrongAttempts',0,
      'maxHintLevel',case when i=2 then 1 else 0 end,'cleanSolve',i<>2,'calmMode',false,
      'attemptId',case when i=1 then 'clock-qa-online' else 'clock-qa-'||p end,
      'points',100,'contentGeneration',6,'freeLevel',null,'legacyRewardSlot',null,'teamCodeAtCompletion',null);
    if i=1 then
      response:=public.proplet_submit_result_v1(p,cmd->>'idempotencyKey',cmd->>'requestDigest',cmd->>'commandDigest',cmd);
    else
      cmd:=cmd||jsonb_build_object('timingUnverified',true);
      response:=public.proplet_submit_offline_result_v1(cmd);
    end if;
    select completed_at into stored from public.results where player_id=p and daily_date=day;
    if (stored at time zone 'Europe/Prague')::date<>day then raise exception 'OFFICIAL_COMPLETION_DAY_CHANGED'; end if;
    if i=1 and stored<first_stamp then raise exception 'ONLINE_CLOCK_NOT_AUTHORITATIVE'; end if;
    if i>1 and stored<>(day::timestamp at time zone 'Europe/Prague')+interval '14 hours' then
      raise exception 'OFFLINE_ORIGINAL_COMPLETION_WAS_REWRITTEN'; end if;
    select committed_at into stored from public.result_commands where player_id=p;
    if (stored at time zone 'Europe/Prague')::date<>(case i when 1 then date '2026-11-01' when 2 then date '2026-11-02' when 3 then date '2026-12-02' else date '2026-12-03' end) then
      raise exception 'RECEIPT_NOT_USING_QA_RECEIVE_CLOCK'; end if;
  end loop;
  if (select count(*) from public.monthly_competition_days where player_id=any(ids))<>3
    or (select points from public.monthly_competition_days where player_id=ids[2])<>100
    or exists(select 1 from public.monthly_competition_days where player_id=ids[4]) then
    raise exception 'REVIEW_CUTOFF_OR_HINT_SCORE_FAILED'; end if;
  response:=public.proplet_monthly_preview_control_v1('finalize');
  if response#>>'{result,finalized}'<>'1' then raise exception 'QA_CONTROL_REAL_FINALIZER_FAILED'; end if;
  if (select count(*) from public.monthly_competition_badges where player_id=any(ids))<>3 then
    raise exception 'QA_REAL_BADGES_FAILED'; end if;
  perform set_config('request.headers','{}',true);
  if abs(extract(epoch from public.proplet_monthly_preview_clock_v1()-clock_timestamp()))>1 then
    raise exception 'UNMARKED_LEGACY_CLOCK_CHANGED'; end if;
end $qa$;
select 'PASS isolated moving clock: request marker/ACL; real session duration; online authority; original offline day; real receipt receive clock;48h cutoff;real finalizer/badges;unmarked legacy wall clock' as verification;
rollback;
