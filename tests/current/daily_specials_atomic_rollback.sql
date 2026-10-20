-- Run ONLY against the isolated preview project after its two migrations.
-- Every fixture, ledger row and policy update is rolled back.
begin;
do $test$
declare
 p uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); b public.daily_special_bindings;
 attempt text:='special-sql-'||p::text;
 cmd jsonb; base_cmd jsonb; response jsonb; retry jsonb; stats jsonb; aggregate_stats jsonb; stats_key text;
 stamp timestamptz:=clock_timestamp(); failed boolean;
begin
 update public.daily_specials_policy set enabled=true,preview_date='2026-10-14' where singleton;
 select * into b from public.daily_special_bindings where daily_date='2026-10-14';
 insert into public.players(id,name,family_code,token_hash,public_rankings)
 values(p,'Special SQL rollback','SOLO_SPECIAL_QA',repeat('0',64),false);
 perform public.proplet_play_session_v1('p:'||p::text,p,b.challenge_key,b.puzzle_id,'daily_special',attempt,owner_id,1,'open',
   '{"elapsedMs":0,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 perform public.proplet_play_session_v1('p:'||p::text,p,b.challenge_key,b.puzzle_id,'daily_special',attempt,owner_id,2,'finish',
   '{"elapsedMs":60000,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 cmd:=jsonb_build_object('contractVersion',1,'playerId',p::text,'idempotencyKey','attempt:'||attempt,
   'requestDigest',repeat('a',64),'commandDigest',repeat('b',64),'puzzleId',b.puzzle_id,
   'challengeKey',b.challenge_key,'mode','daily_special','difficulty',b.difficulty,
   'dailyDate',b.daily_date::text,'completedAt',stamp,'elapsedMs',60000,'moves',30,'hintsUsed',0,
   'wrongAttempts',0,'maxHintLevel',0,'cleanSolve',true,'calmMode',false,'attemptId',attempt,'points',200,
   'contentGeneration',6,'freeLevel',null,'legacyRewardSlot',null,'teamCodeAtCompletion',null,
   'contentHash',b.content_hash,'specialPractice',false,'specialPreviewDate','2026-10-14');
 response:=public.proplet_submit_daily_special_v1(p,'attempt:'||attempt,repeat('a',64),repeat('b',64),cmd);
 if response->>'firstCompletion'<>'true' or (response->>'awardedPoints')::int<>200 then raise exception 'special first reward failed'; end if;
 retry:=public.proplet_submit_daily_special_v1(p,'attempt:'||attempt,repeat('a',64),repeat('b',64),cmd);
 if retry<>response then raise exception 'durable retry changed receipt'; end if;
 -- A distinct command for the same completed challenge remains once-only.
 cmd:=cmd||jsonb_build_object('idempotencyKey','legacy:qa-second-'||p::text,'requestDigest',repeat('c',64),'commandDigest',repeat('d',64));
 retry:=public.proplet_submit_daily_special_v1(p,'legacy:qa-second-'||p::text,repeat('c',64),repeat('d',64),cmd);
 if (retry->>'awardedPoints')::int<>0 or retry->>'firstCompletion'<>'false' then raise exception 'duplicate reward paid'; end if;
 if (select count(*) from public.results where player_id=p and mode='daily_special')<>1 then raise exception 'special result duplicated'; end if;
 if (select sum(points) from public.results where player_id=p)<>200 then raise exception 'special XP duplicated'; end if;
 if not (select timing_verified from public.results where player_id=p and mode='daily_special') then raise exception 'special timing unverified'; end if;
 stats:=public.proplet_account_snapshot_v1(p)->'stats';
 aggregate_stats:=public.proplet_player_stats_v1(p);
 foreach stats_key in array array['dailySpecialCompleted','dailyChallengeCompleted','totalChallengeCompleted','dailyCompleted','currentStreak','longestStreak','totalCompleted','cleanDaily','points'] loop
   if stats->stats_key is distinct from aggregate_stats->stats_key then
     raise exception 'snapshot/player_stats parity mismatch: %', stats_key;
   end if;
 end loop;
 if (stats->>'dailyCompleted')::int<>0 or (stats->>'currentStreak')::int<>0 or (stats->>'dailySpecialCompleted')::int<>1 then
   raise exception 'special altered base streak'; end if;
 -- Base result on the same date has its independent once-only identity.
 perform public.proplet_play_session_v1('p:'||p::text,p,'daily:2026-10-14','g6-d-20261014','daily','base-'||attempt,owner_id,1,'open',
   '{"elapsedMs":0,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 perform public.proplet_play_session_v1('p:'||p::text,p,'daily:2026-10-14','g6-d-20261014','daily','base-'||attempt,owner_id,2,'finish',
   '{"elapsedMs":60000,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 base_cmd:=cmd||jsonb_build_object('idempotencyKey','legacy:qa-base-'||p::text,'requestDigest',repeat('e',64),'commandDigest',repeat('f',64),
   'puzzleId','g6-d-20261014','challengeKey','daily:2026-10-14','mode','daily','difficulty','medium','attemptId','base-'||attempt,'points',100);
 retry:=public.proplet_submit_result_v1(p,'legacy:qa-base-'||p::text,repeat('e',64),repeat('f',64),base_cmd);
 if (retry->>'awardedPoints')::int<>100 then raise exception 'base first reward missing'; end if;
 if not (select timing_verified from public.results where player_id=p and mode='daily') then raise exception 'base timing unverified'; end if;
 stats:=public.proplet_account_snapshot_v1(p)->'stats';
 if (stats->>'dailyChallengeCompleted')::int<>2 or (stats->>'dailyCompleted')::int<>1 or (stats->>'currentStreak')::int<>1 then
   raise exception 'same-date challenge/streak collision'; end if;
 -- Archive/replay command adds only a run and receipt, never results or XP.
 perform public.proplet_play_session_v1('p:'||p::text,p,'daily-special-practice:'||b.daily_date::text||':'||b.difficulty||':'||b.puzzle_id,
   b.puzzle_id,'daily_special','practice-'||p::text,owner_id,1,'open',
   '{"elapsedMs":0,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 perform public.proplet_play_session_v1('p:'||p::text,p,'daily-special-practice:'||b.daily_date::text||':'||b.difficulty||':'||b.puzzle_id,
   b.puzzle_id,'daily_special','practice-'||p::text,owner_id,2,'finish',
   '{"elapsedMs":60000,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
 cmd:=cmd||jsonb_build_object('idempotencyKey','attempt:practice-'||p::text,'requestDigest',repeat('1',64),'commandDigest',repeat('2',64),
   'challengeKey','daily-special-practice:'||b.daily_date::text||':'||b.difficulty||':'||b.puzzle_id,
   'attemptId','practice-'||p::text,'points',0,'specialPractice',true);
 retry:=public.proplet_submit_daily_special_v1(p,'attempt:practice-'||p::text,repeat('1',64),repeat('2',64),cmd);
 if (retry->>'awardedPoints')::int<>0 or retry->>'practice'<>'true' then raise exception 'practice reward leaked'; end if;
 if (select count(*) from public.results where player_id=p)<>2 then raise exception 'practice entered official results'; end if;
 if not (select timing_verified from public.puzzle_runs where player_id=p and attempt_id='practice-'||p::text) then
   raise exception 'practice timing unverified'; end if;
 -- Same idempotency identity with a changed payload must reject atomically.
 failed:=false;
 begin
  perform public.proplet_submit_daily_special_v1(p,'attempt:practice-'||p::text,repeat('3',64),repeat('2',64),cmd||jsonb_build_object('requestDigest',repeat('3',64)));
 exception when others then failed:=sqlerrm='IDEMPOTENCY_CONFLICT'; end;
 if not failed then raise exception 'idempotency conflict accepted'; end if;
 -- Bound hashes are server-owned; no new run/ledger may survive tampering.
 failed:=false;
 begin
  perform public.proplet_submit_daily_special_v1(p,'attempt:tampered-'||p::text,repeat('4',64),repeat('5',64),cmd||jsonb_build_object(
    'idempotencyKey','attempt:tampered-'||p::text,'requestDigest',repeat('4',64),'commandDigest',repeat('5',64),'contentHash',repeat('0',64)));
 exception when others then failed:=sqlerrm='RESULT_COMMAND_INVALID'; end;
 if not failed then raise exception 'tampered binding accepted'; end if;
 if (select count(*) from public.result_commands where player_id=p)<>4 then raise exception 'failed transaction left ledger'; end if;
 stats:=public.proplet_account_snapshot_v1(p)->'stats';
 aggregate_stats:=public.proplet_player_stats_v1(p);
 foreach stats_key in array array['dailySpecialCompleted','dailyChallengeCompleted','totalChallengeCompleted','dailyCompleted','currentStreak','longestStreak','totalCompleted','cleanDaily','points'] loop
   if stats->stats_key is distinct from aggregate_stats->stats_key then
     raise exception 'snapshot/player_stats parity mismatch after base/practice: %', stats_key;
   end if;
 end loop;
 raise notice 'PASS special200 once, retry receipt, distinct-command0, base+special two results/one streak, practice0 no result, tamper rollback';
end $test$;

-- All three Extra difficulties have one server-owned 200 XP reward, including
-- old app servers which still send 100 while a release is rolling out.
do $uniform_reward$
declare
 b public.daily_special_bindings;
 p uuid; owner_id uuid; attempt text; supplied_points integer; difficulty_count integer:=0;
 cmd jsonb; response jsonb; retry jsonb; failed boolean;
begin
 for b in select * from public.daily_special_bindings
   where daily_date in ('2026-10-14','2026-10-16','2026-10-18') order by daily_date
 loop
  difficulty_count:=difficulty_count+1;
  update public.daily_specials_policy set enabled=true,preview_date=b.daily_date where singleton;
  foreach supplied_points in array array[100,200] loop
   p:=gen_random_uuid(); owner_id:=gen_random_uuid(); attempt:='uniform-extra-'||p::text;
   insert into public.players(id,name,family_code,token_hash,public_rankings)
   values(p,'Extra SQL fixture','SOLO_EXTRA_'||left(p::text,8),p::text,false);
   perform public.proplet_play_session_v1('p:'||p::text,p,b.challenge_key,b.puzzle_id,
     'daily_special',attempt,owner_id,1,'open',
     '{"elapsedMs":0,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
   perform public.proplet_play_session_v1('p:'||p::text,p,b.challenge_key,b.puzzle_id,
     'daily_special',attempt,owner_id,2,'finish',
     '{"elapsedMs":60000,"hints":0,"maxHintLevel":0,"calmMode":false,"found":[]}');
   cmd:=jsonb_build_object('contractVersion',1,'playerId',p::text,
     'idempotencyKey','attempt:'||attempt,'requestDigest',repeat('a',64),
     'commandDigest',repeat('b',64),'puzzleId',b.puzzle_id,'challengeKey',b.challenge_key,
     'mode','daily_special','difficulty',b.difficulty,'dailyDate',b.daily_date::text,
     'completedAt',clock_timestamp(),'elapsedMs',60000,'moves',30,'hintsUsed',0,
     'wrongAttempts',0,'maxHintLevel',0,'cleanSolve',true,'calmMode',false,
     'attemptId',attempt,'points',supplied_points,'contentGeneration',6,'freeLevel',null,
     'legacyRewardSlot',null,'teamCodeAtCompletion',null,'contentHash',b.content_hash,
     'specialPractice',false,'specialPreviewDate',b.daily_date::text);
   response:=public.proplet_submit_daily_special_v1(p,'attempt:'||attempt,
     repeat('a',64),repeat('b',64),cmd);
   if (response->>'awardedPoints')::int<>200 or response->>'firstCompletion'<>'true' then
    raise exception 'uniform Extra reward failed: %, input %',b.difficulty,supplied_points;
   end if;
   retry:=public.proplet_submit_daily_special_v1(p,'attempt:'||attempt,
     repeat('a',64),repeat('b',64),cmd);
   if retry<>response then raise exception 'uniform Extra durable retry changed'; end if;
   if (select sum(points) from public.results where player_id=p)<>200 then
    raise exception 'uniform Extra persisted points differ from receipt';
   end if;
   -- A client cannot choose an arbitrary reward amount.
   failed:=false;
   begin
    cmd:=cmd||jsonb_build_object('idempotencyKey','legacy:invalid-extra-'||p::text,
      'requestDigest',repeat('c',64),'commandDigest',repeat('d',64),'points',199);
    perform public.proplet_submit_daily_special_v1(p,'legacy:invalid-extra-'||p::text,
      repeat('c',64),repeat('d',64),cmd);
   exception when others then failed:=sqlerrm='RESULT_COMMAND_INVALID'; end;
   if not failed then raise exception 'arbitrary Extra reward amount accepted'; end if;
   if (select count(*) from public.result_commands where player_id=p)<>1 then
    raise exception 'invalid Extra reward left a ledger row';
   end if;
  end loop;
 end loop;
 if difficulty_count<>3 then raise exception 'uniform Extra test did not exercise all three difficulties'; end if;
 raise notice 'PASS all3 Extra difficulties200; legacy100 canonicalized200; durable retry; arbitrary reward rejected';
end $uniform_reward$;
rollback;
