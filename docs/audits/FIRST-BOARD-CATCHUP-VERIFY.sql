-- TECHNICAL TEST ONLY: intentionally writes is_test=true inside BEGIN/ROLLBACK.
-- Do not count its temporary events as users or experiment observations.
begin;
create temporary table catchup_test_report (result jsonb);
do $test$
declare c int; e int; base int; i int; f uuid; anon text; a jsonb; again jsonb; future_def text;
begin
 select count(distinct context->>'first_steps_run_id') filter(where context->>'experiment_variant'='control_e001'),
        count(distinct context->>'first_steps_run_id') filter(where context->>'experiment_variant'='challenger_e009')
 into c,e from public.product_events where environment='production' and is_test=true
 and event_type='first_board_experiment_assigned' and context->>'experiment_key'='first-board-v1'
 and created_at>=timestamptz '2026-09-29 07:51:55+00';
 base=greatest(c,e);
 for i in 1..(base+11-c) loop
   insert into public.product_events(id,anonymous_id,event_type,created_at,environment,is_test,onboarding_version,measurement_version,client_release,context)
   values(gen_random_uuid(),replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'first_board_experiment_assigned',now(),'production',true,'board-v3-short',2,'rollback-test',
     jsonb_build_object('first_steps_run_id',gen_random_uuid(),'experiment_key','first-board-v1','experiment_variant','control_e001','experiment_bucket',3,'puzzle_id','g4-e-001'));
 end loop;
 for i in 1..(base+29-e) loop
   insert into public.product_events(id,anonymous_id,event_type,created_at,environment,is_test,onboarding_version,measurement_version,client_release,context)
   values(gen_random_uuid(),replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'first_board_experiment_assigned',now(),'production',true,'board-v3-short',2,'rollback-test',
     jsonb_build_object('first_steps_run_id',gen_random_uuid(),'experiment_key','first-board-v1','experiment_variant','challenger_e009','experiment_bucket',53,'puzzle_id','g4-e-009'));
 end loop;
 for i in 1..18 loop
   f=gen_random_uuid(); anon=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   a=public.proplet_first_board_assign('production',true,anon,f,53,'rollback-test','test','4.05.0');
   if a->>'variant'<>'control_e001' or a->>'allocationPolicy'<>'catchup_20261004' or (a->>'bucket')::int>=50 then
     raise exception 'Failed catch-up assignment %: %',i,a;
   end if;
   again=public.proplet_first_board_assign('production',true,anon,gen_random_uuid(),53,'rollback-test','test','4.05.0');
   if again<>a then raise exception 'Retry changed stable assignment'; end if;
 end loop;
 -- At equality the original hash breaks ties; the next allocation restores balance.
 a=public.proplet_first_board_assign('production',true,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),gen_random_uuid(),53,'rollback-test','test','4.05.0');
 if a->>'variant'<>'challenger_e009' then raise exception 'Equality tie-break failed'; end if;
 a=public.proplet_first_board_assign('production',true,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),gen_random_uuid(),53,'rollback-test','test','4.05.0');
 if a->>'variant'<>'control_e001' then raise exception 'Balance maintenance failed'; end if;
 -- Clone the ACTUAL installed function with only its clock replaced to test the midnight boundary.
 future_def=pg_get_functiondef('public.proplet_first_board_assign(text,boolean,text,uuid,integer,text,text,text)'::regprocedure);
 future_def=replace(future_def,'public.proplet_first_board_assign','pg_temp.proplet_first_board_assign');
 future_def=replace(future_def,'clock_timestamp()','timestamptz ''2026-10-04 22:00:00+00''');
 execute future_def;
 a=pg_temp.proplet_first_board_assign('production',true,replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),gen_random_uuid(),53,'rollback-test','test','4.05.0');
 if a->>'variant'<>'challenger_e009' or a->>'allocationPolicy'<>'hash50_v1' or (a->>'bucket')::int<>53 then
   raise exception 'Midnight expiry failed: %',a;
 end if;
 if has_function_privilege('anon','public.proplet_first_board_assign(text,boolean,text,uuid,integer,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.proplet_first_board_assign(text,boolean,text,uuid,integer,text,text,text)','EXECUTE') then
   raise exception 'Public allocator privilege leak';
 end if;
 insert into catchup_test_report values(jsonb_build_object('eighteen_control_assignments',true,'retry_stability',true,
  'balanced_followup',true,'midnight_expiry',true,'public_rpc_denied',true,'all_changes_rolled_back',true));
end;
$test$;
select * from catchup_test_report;
rollback;
