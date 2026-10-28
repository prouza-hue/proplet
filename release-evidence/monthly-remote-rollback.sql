begin;
set local statement_timeout='30s';
do $qa$
declare
 p uuid; p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); p3 uuid:=gen_random_uuid();
 m date:=date_trunc('month',now() at time zone 'Europe/Prague')::date; d date;
 cmd jsonb; receipt jsonb; replay jsonb; s jsonb; n int; hints int; j int;
begin
 if current_database()<>'postgres' or not exists(select 1 from public.monthly_competition_settings where isolated and not enabled and not rules_approved) then raise exception 'ISOLATION_GUARD'; end if;
 update public.monthly_competition_settings set enabled=true,rules_approved=true,late_sync_policy='month-close',launch_month=m,preview_now=((m+interval '1 month')::timestamp at time zone 'Europe/Prague')-interval '1 hour' where singleton;
 foreach p in array array[p1,p2,p3] loop
  insert into public.players(id,name,family_code,token_hash) values(p,'Monthly QA '||left(p::text,8),'SOLO_MONTHLY_QA','rollback-'||p::text);
  for j in 0..case when p=p1 then 24 else 19 end loop
   d:=m+j; hints:=case when p=p1 and j<5 then 1 when p=p3 and j=0 then 1 else 0 end;
   cmd:=jsonb_build_object('contractVersion',1,'playerId',p,'idempotencyKey','attempt:monthly-remote-'||p::text||'-'||j,'requestDigest',repeat('a',64),'commandDigest',repeat('b',64),'puzzleId','monthly-remote-'||d::text,'challengeKey','daily:'||d::text,'mode','daily','difficulty','easy','dailyDate',d,'completedAt',(d::timestamp at time zone 'Europe/Prague')+interval '12 hours','elapsedMs',42000,'moves',12,'hintsUsed',hints,'wrongAttempts',0,'maxHintLevel',hints,'cleanSolve',hints=0,'calmMode',false,'attemptId','monthly-remote-'||p::text||'-'||j,'points',987,'contentGeneration',6,'freeLevel',null,'legacyRewardSlot',null,'teamCodeAtCompletion',null);
   receipt:=public.proplet_submit_result_v1(p,cmd->>'idempotencyKey',cmd->>'requestDigest',cmd->>'commandDigest',cmd);
   if j=0 then
    replay:=public.proplet_submit_result_v1(p,cmd->>'idempotencyKey',cmd->>'requestDigest',cmd->>'commandDigest',cmd);
    if receipt<>replay then raise exception 'REPLAY_MISMATCH'; end if;
   end if;
  end loop;
 end loop;
 s:=public.proplet_monthly_state_v1(p1,m);
 if s#>>'{me,points}'<>'2400' or s#>>'{me,validDays}'<>'25' or s#>>'{me,countedDays}'<>'20' then raise exception 'BEST20_FAILED %',s; end if;
 if s#>>'{standings,0,rank}'<>'1' or s#>>'{standings,1,rank}'<>'1' or s#>>'{standings,2,rank}'<>'3' then raise exception 'TIES_FAILED %',s; end if;
 if (select count(*) from public.monthly_competition_days where player_id in(p1,p2,p3))<>65 then raise exception 'DAY_DEDUP_FAILED'; end if;
 if (select sum(points) from public.results where player_id=p1)<>25*987 then raise exception 'XP_CHANGED'; end if;
 update public.monthly_competition_settings set preview_now=((m+interval '1 month')::timestamp at time zone 'Europe/Prague')+interval '48 hours' where singleton;
 s:=public.proplet_finalize_monthly_competition_v1();
 if s->>'finalized'<>'1' then raise exception 'CLOSE_FAILED %',s; end if;
 if (select count(*) from public.monthly_competition_badges where player_id in(p1,p2,p3))<>3 then raise exception 'BADGES_FAILED'; end if;
 s:=public.proplet_finalize_monthly_competition_v1();
 if s->>'finalized'<>'0' then raise exception 'REPEATED_CLOSE_FAILED'; end if;
 if has_function_privilege('anon','public.proplet_monthly_state_v1(uuid,date)','execute') or has_function_privilege('authenticated','public.proplet_finalize_monthly_competition_v1()','execute') then raise exception 'ACL_FAILED'; end if;
end $qa$;
select 'PASS remote isolated atomic RPC: 65 days, best20, ties1-1-3, independent XP987, receipt replay, finalizer retry,3 badges, ACL; all synthetic writes rolled back' as verification;
rollback;
