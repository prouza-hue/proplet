-- Disposable synthetic DB only. All fixtures roll back; no production execution.
begin;
insert into public.players(id,name,family_code,token_hash) values
 ('21200000-0000-4000-8000-000000000001','Synthetic integrity A','SOLO_INTEGRITY_A','synthetic-integrity-a'),
 ('21200000-0000-4000-8000-000000000002','Synthetic integrity B','SOLO_INTEGRITY_B','synthetic-integrity-b');
insert into public.results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,clean_solve)
select gen_random_uuid(),'21200000-0000-4000-8000-000000000001', 'synthetic-'||i,'free:synthetic-'||i,'free','easy',10000,10,15,true
from generate_series(1,20001) i;
insert into public.player_sessions(id,player_id,token_hash)
select gen_random_uuid(),'21200000-0000-4000-8000-000000000001','synthetic-integrity-session-'||i from generate_series(1,2) i;
insert into public.push_subscriptions(id,player_id,endpoint,p256dh,auth)
select gen_random_uuid(),'21200000-0000-4000-8000-000000000001','https://synthetic.invalid/'||i,'synthetic','synthetic' from generate_series(1,3) i;
set local role service_role;
do $$
declare value jsonb;
begin
  value := public.proplet_account_integrity_counts(array[
    '21200000-0000-4000-8000-000000000001'::uuid,
    '21200000-0000-4000-8000-000000000002'::uuid,
    '21200000-0000-4000-8000-000000000001'::uuid]);
  assert jsonb_array_length(value)=2, 'deduplicate candidate IDs';
  assert value->0->>'results'='20001', 'exact count beyond raw-row cap';
  assert value->0->>'sessions'='2' and value->0->>'pushes'='3', 'no join fanout';
  assert value->1->>'results'='0' and value->1->>'sessions'='0' and value->1->>'pushes'='0', 'no cross-player counts';
  assert public.proplet_account_integrity_counts('{}'::uuid[])='[]'::jsonb;
  begin
    perform public.proplet_account_integrity_counts(array_fill('21200000-0000-4000-8000-000000000001'::uuid,array[5001]));
    raise exception 'oversized list accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.proplet_account_integrity_counts(array[null::uuid]);
    raise exception 'null ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.proplet_account_integrity_counts(null);
    raise exception 'null list accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$
begin
  assert not has_function_privilege('anon','public.proplet_account_integrity_counts(uuid[])','execute');
  assert not has_function_privilege('authenticated','public.proplet_account_integrity_counts(uuid[])','execute');
  assert has_function_privilege('service_role','public.proplet_account_integrity_counts(uuid[])','execute');
  assert not (select prosecdef from pg_proc where oid='public.proplet_account_integrity_counts(uuid[])'::regprocedure);
end $$;
set local role anon;
do $$ begin
  perform public.proplet_account_integrity_counts('{}'::uuid[]);
  raise exception 'anon executed admin aggregate';
exception when insufficient_privilege then null; end $$;
reset role;
set local role authenticated;
do $$ begin
  perform public.proplet_account_integrity_counts('{}'::uuid[]);
  raise exception 'authenticated executed admin aggregate';
exception when insufficient_privilege then null; end $$;
reset role;
rollback;
