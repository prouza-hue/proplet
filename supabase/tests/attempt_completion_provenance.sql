-- Disposable synthetic database only. No historical production data is touched.
begin;
create temporary table qa_historical_completion(completed_at timestamptz,completion_received_at timestamptz);
insert into qa_historical_completion values('2026-10-31T22:59:59Z',null);
create trigger qa_historical_completion before insert or update on qa_historical_completion
 for each row execute function public.proplet_attempt_completion_guard_v1();
grant select,update on qa_historical_completion to service_role;
set local role service_role;
do $qa$
declare p uuid:=gen_random_uuid(); a text:=gen_random_uuid()::text; prefix text:=gen_random_uuid()::text;
 original timestamptz:='2026-10-31T22:59:59Z'; received timestamptz; n integer;
begin
 insert into public.players(id,name,family_code,token_hash)
 values(p,'Completion QA','SOLO_QA_COMPLETION',md5(p::text)||md5(p::text));
 insert into public.puzzle_attempts(id,anonymous_id,puzzle_id,challenge_key,mode,difficulty,started_at)
 values(a,repeat('a',64),'qa-completion','free:qa-completion','free','easy',original-interval '1 minute');
 update public.puzzle_attempts set completed_at=original,completion_received_at='2000-01-01' where id=a;
 select completion_received_at into received from public.puzzle_attempts where id=a;
 if received is null or received<now() or (select completed_at from public.puzzle_attempts where id=a)<>original then
  raise exception 'first finish did not separate completion and server receipt';
 end if;
 -- Guest -> owned account -> delayed result retry must retain the original day.
 update public.puzzle_attempts set player_id=p,anonymous_id=null where id=a;
 update public.puzzle_attempts set completed_at=now(),completion_received_at=now()+interval '1 day' where id=a;
 update public.puzzle_attempts set completed_at=original-interval '1 day' where id=a;
 update public.puzzle_attempts set completed_at=null where id=a;
 if (select completed_at from public.puzzle_attempts where id=a)<>original
  or (select completion_received_at from public.puzzle_attempts where id=a) is distinct from received then
  raise exception 'retry/claim changed first completion or receipt';
 end if;
 -- No inferred receipt/backfill for a row completed before installation.
 update qa_historical_completion set completed_at=now(),completion_received_at=now();
 if (select completed_at from qa_historical_completion)<>original
  or (select completion_received_at from qa_historical_completion) is not null then
  raise exception 'historical timestamp or unknown receipt was backfilled';
 end if;
 for n in 1..80 loop
  insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at)
   values(prefix||':'||n,p,'qa-bulk-'||n,'free:qa-bulk-'||n,'free','easy',original-interval '1 minute',original);
 end loop;
 update public.puzzle_attempts set completed_at=now() where player_id=p;
 if (select count(*) from public.puzzle_attempts where player_id=p and completed_at=original)<>81 then
  raise exception 'historical result replay moved completions into receipt day';
 end if;
 if exists(select 1 from public.puzzle_attempts where player_id=p and completion_received_at is null) then
  raise exception 'new completion receipt missing';
 end if;
end $qa$;
rollback;
