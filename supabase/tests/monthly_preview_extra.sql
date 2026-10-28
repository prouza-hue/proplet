-- Actual official Extra completion through its atomic RPC; no monthly points.
begin;
do $qa$
declare p uuid:=gen_random_uuid(); owner uuid:=gen_random_uuid(); binding public.daily_special_bindings;
  cmd jsonb; receipt jsonb; session jsonb; policy_date date;
begin
  if not exists(select 1 from monthly_competition_settings where isolated and not enabled) then
    raise exception 'ISOLATED_DISABLED_DATABASE_REQUIRED'; end if;
  select * into binding from public.daily_special_bindings where daily_date='2026-11-01' limit 1;
  if not found then raise exception 'NOVEMBER_EXTRA_BINDING_REQUIRED'; end if;
  update public.daily_specials_policy set enabled=true,preview_date='2026-10-21';
  perform set_config('request.headers','{"x-proplet-monthly-preview":"codex/monthly-competition-202611"}',true);
  perform public.proplet_monthly_preview_control_v1('clock','2026-11-01 12:00:00 Europe/Prague');
  insert into players(id,name,family_code,token_hash) values(p,'Monthly Extra QA','SOLO_MONTHLY_EXTRA_QA','extra-qa-'||p);
  session:=public.proplet_play_session_v1('p:'||p,p,binding.challenge_key,binding.puzzle_id,'daily_special','monthly-extra-qa-'||p,owner,1,'open','{"elapsedMs":0,"found":[]}'::jsonb);
  session:=public.proplet_play_session_v1('p:'||p,p,binding.challenge_key,binding.puzzle_id,'daily_special','monthly-extra-qa-'||p,owner,2,'finish','{"elapsedMs":3000,"moves":12,"found":[]}'::jsonb);
  cmd:=jsonb_build_object('contractVersion',1,'playerId',p,'idempotencyKey','attempt:monthly-extra-qa-'||p,
    'requestDigest',repeat('a',64),'commandDigest',repeat('b',64),'puzzleId',binding.puzzle_id,
    'challengeKey',binding.challenge_key,'mode','daily_special','difficulty',binding.difficulty,'dailyDate',binding.daily_date,
    'completedAt',public.proplet_monthly_preview_clock_v1(),'elapsedMs',3000,'moves',12,'hintsUsed',0,'wrongAttempts',0,
    'maxHintLevel',0,'cleanSolve',true,'calmMode',false,'attemptId','monthly-extra-qa-'||p,'points',200,
    'contentGeneration',6,'freeLevel',null,'legacyRewardSlot',null,'teamCodeAtCompletion',null,
    'contentHash',binding.content_hash,'specialPractice',false,'specialPreviewDate',null);
  receipt:=public.proplet_submit_daily_special_v1(p,cmd->>'idempotencyKey',cmd->>'requestDigest',cmd->>'commandDigest',cmd);
  if receipt->>'firstCompletion'<>'true' or receipt->>'awardedPoints'<>'200'
    or not exists(select 1 from results where player_id=p and mode='daily_special' and points=200)
    or exists(select 1 from monthly_competition_days where player_id=p) then raise exception 'EXTRA_OFFICIAL_OR_MONTHLY_EXCLUSION_FAILED'; end if;
  select preview_date into policy_date from daily_specials_policy where singleton;
  if policy_date<>date '2026-10-21' then raise exception 'LEGACY_SPECIAL_POLICY_CHANGED'; end if;
end $qa$;
select 'PASS real official November Extra RPC under monthly QA clock; no monthly points; legacy October policy preserved' as verification;
rollback;
