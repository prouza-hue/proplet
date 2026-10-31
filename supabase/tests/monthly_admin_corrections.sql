-- Disposable isolated database acceptance only. Always rolls back every fixture.
begin;
set local statement_timeout='30s';
do $qa$
declare
  p uuid; ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  m date:=date_trunc('month',now() at time zone 'Europe/Prague')::date;
  cmd jsonb; saved jsonb; first_receipt jsonb; result jsonb; xp bigint; j integer; hints integer;
begin
  if not exists(select 1 from public.monthly_competition_settings
    where singleton and isolated and not enabled and rules_approved and late_sync_policy='review-close') then
    raise exception 'ISOLATION_APPROVED_POLICY_GUARD'; end if;
  if exists(select 1 from public.monthly_competition_rounds where month=m) then
    raise exception 'FRESH_MONTH_GUARD'; end if;
  update public.monthly_competition_settings set enabled=true,launch_month=m,
    preview_now=((m+interval '1 month') at time zone 'Europe/Prague')-interval '1 hour';
  for j in 1..4 loop
    p:=ids[j]; hints:=case when j<=2 then 0 else 1 end;
    insert into public.players(id,name,family_code,token_hash)
      values(p,'Admin QA '||left(p::text,8),'SOLO_MONTHLY_ADMIN_QA','admin-rollback-'||p::text);
    cmd:=jsonb_build_object('contractVersion',1,'playerId',p,'idempotencyKey','attempt:admin-qa-'||p,
      'requestDigest',repeat('a',64),'commandDigest',repeat('b',64),'puzzleId','admin-qa-'||m,
      'challengeKey','daily:'||m,'mode','daily','difficulty','easy','dailyDate',m,
      'completedAt',(m::timestamp at time zone 'Europe/Prague')+interval '12 hours',
      'elapsedMs',42000,'moves',12,'hintsUsed',hints,'wrongAttempts',0,'maxHintLevel',hints,
      'cleanSolve',hints=0,'calmMode',false,'attemptId','admin-qa-'||p,'points',987,
      'contentGeneration',6,'freeLevel',null,'legacyRewardSlot',null,'teamCodeAtCompletion',null);
    perform public.proplet_submit_result_v1(p,cmd->>'idempotencyKey',cmd->>'requestDigest',cmd->>'commandDigest',cmd);
  end loop;
  update public.monthly_competition_settings set preview_now=
    ((m+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours';
  perform public.proplet_finalize_monthly_competition_v1();
  if (select array_agg(rank order by rank) from public.monthly_competition_badges where month=m)<>array[1,1,3,3] then
    raise exception 'SHARED_PODIUM_FIXTURE_FAILED'; end if;
  select to_jsonb(r) into saved from public.results r where player_id=ids[1] and daily_date=m;
  delete from public.results where player_id=ids[1] and daily_date=m;
  select sum(points) into xp from public.results where player_id=any(ids);
  if has_function_privilege('anon','public.proplet_correct_monthly_competition_v1(date,uuid,date,integer,text,text,text)','execute')
    or has_function_privilege('authenticated','public.proplet_correct_monthly_competition_v1(date,uuid,date,integer,text,text,text)','execute')
    or has_table_privilege('service_role','public.monthly_competition_rounds','update')
    or has_table_privilege('service_role','proplet_private.monthly_corrections','delete') then
    raise exception 'CORRECTION_ACL_FAILED'; end if;
  execute 'set local role service_role';
  first_receipt:=public.proplet_correct_monthly_competition_v1(m,ids[1],m,1,'reject-official-day','qa-operator','Confirmed rejection of official result');
  result:=public.proplet_correct_monthly_competition_v1(m,ids[1],m,1,'reject-official-day','qa-operator','Confirmed rejection of official result');
  if first_receipt<>result or result->>'revision'<>'2' or result->>'dayPoints'<>'0' then
    raise exception 'CORRECTION_REPLAY_FAILED'; end if;
  begin
    perform public.proplet_correct_monthly_competition_v1(m,ids[1],m,1,'reject-official-day','qa-operator','Different command reuses existing key');
    raise exception 'IDEMPOTENCY_CONFLICT_NOT_REJECTED';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.proplet_correct_monthly_competition_v1(m,ids[1],m,1,'stale-command','qa-operator','Stale revision must not overwrite standings');
    raise exception 'STALE_REVISION_NOT_REJECTED';
  exception when serialization_failure then null; end;
  if exists(select 1 from public.monthly_competition_badges where month=m and player_id=ids[1])
    or (select sum(points) from public.results where player_id=any(ids)) is distinct from xp
    or (select count(*) from proplet_private.monthly_corrections where month=m)<>1 then
    raise exception 'REJECTION_BADGE_AUDIT_OR_XP_FAILED'; end if;
  execute 'reset role';
  insert into public.results select (json_populate_record(null::public.results,saved::json)).*;
  select sum(points) into xp from public.results where player_id=any(ids);
  execute 'set local role service_role';
  result:=public.proplet_correct_monthly_competition_v1(m,ids[1],m,2,'restore-official-day','qa-operator','Confirmed restoration of official result');
  if result->>'revision'<>'3' or result->>'dayPoints'<>'120'
    or (select array_agg(rank order by rank) from public.monthly_competition_badges where month=m)<>array[1,1,3,3]
    or (select sum(points) from public.results where player_id=any(ids)) is distinct from xp
    or (select count(*) from proplet_private.monthly_corrections where month=m)<>2 then
    raise exception 'RESTORATION_BADGE_AUDIT_OR_XP_FAILED'; end if;
  execute 'reset role';
end $qa$;
select 'PASS isolated rollback: actual atomic Daily sources; shared1-1-3-3; explicit correction/replay/CAS; badge removal/regrant;2 immutable audits;XP unchanged;ACL' as verification;
rollback;
