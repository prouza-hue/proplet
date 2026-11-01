-- Synthetic isolated rollback test: a lower score group must explain its own
-- equal-total quality criterion, not the unrelated previous score group.
begin;
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();pid uuid;
 m date:='2030-01-01';rows jsonb;r jsonb;i integer:=0;
begin
 if not exists(select 1 from public.monthly_competition_settings where isolated and scoring_version=2) then
 raise exception 'ISOLATED_QUALITY_V2_REQUIRED';end if;
 foreach pid in array array[a,b,c] loop
 i:=i+1;
 insert into public.players(id,name,family_code,token_hash) values(pid,'Quality reason '||i,'SOLO_QUALITY_REASON','quality-reason-'||pid);
 insert into public.monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at,scoring_version,clean,hints,verified_time_ms)
 values(m,pid,m,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),case when i=1 then 100 else 90 end,now(),2,i=2,0,1000);
 end loop;
 rows:=public.proplet_monthly_standings_v1(m);
 if jsonb_array_length(rows)<>3 then raise exception 'REASON_FIXTURE_COUNT';end if;
 select x into r from jsonb_array_elements(rows) x where x->>'playerId'=b::text;
 if r->>'rank'<>'2' or r->>'tieBreakReason'<>'cleanCount' then raise exception 'FIRST_EQUAL_TOTAL_GROUP_REASON: %',r;end if;
 select x into r from jsonb_array_elements(rows) x where x->>'playerId'=c::text;
 if r->>'rank'<>'3' or r->>'tieBreakReason'<>'cleanCount' then raise exception 'SECOND_EQUAL_TOTAL_GROUP_REASON: %',r;end if;
end $$;
select 'PASS quality reason selects adjacent equal-total contender across 100/90/90 score groups' as verification;
rollback;
