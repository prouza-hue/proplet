-- Runs inside a rollback-only transaction with synthetic fixtures.
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  legacy text := md5(a::text)||md5(a::text);
  session_digest text := md5(b::text)||md5(b::text);
  actor text := md5(gen_random_uuid()::text);
  code text := 'UT_'||upper(substr(a::text,1,8));
  session_id uuid := gen_random_uuid();
  value jsonb;
begin
  assert not has_function_privilege('anon','public.proplet_request_guard_v1(text,text,integer,integer,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.proplet_ranking_context_v1(uuid[],text[],boolean)','EXECUTE');
  assert not has_function_privilege('anon','public.proplet_player_stats_v1(uuid)','EXECUTE');
  assert has_function_privilege('service_role','public.proplet_player_stats_v1(uuid)','EXECUTE');
  insert into public.players(id,name,family_code,token_hash,public_rankings)
    values(a,'Usage synthetic A',code,legacy,false),
          (b,'Usage synthetic B',code,md5(session_digest),true);
  insert into public.leagues(code,name,public_opt_in) values(code,'Usage synthetic team',false);
  insert into public.player_sessions(id,player_id,token_hash,expires_at,last_used_at)
    values(session_id,b,session_digest,statement_timestamp()+interval '1 day',statement_timestamp()-interval '2 days');

  set local role service_role;
  value := public.proplet_request_guard_v1('usage-test',actor,3600,2,legacy);
  assert (value->>'allowed')::boolean;
  assert value#>>'{auth,player,id}' = a::text;
  assert (value->>'remaining')::integer = 1;
  value := public.proplet_request_guard_v1('usage-test',actor,3600,2,session_digest);
  assert (value->>'allowed')::boolean;
  assert value#>>'{auth,player,id}' = b::text;
  assert (value->>'remaining')::integer = 0;
  value := public.proplet_request_guard_v1('usage-test',actor,3600,2,legacy);
  assert not (value->>'allowed')::boolean;
  assert value->'auth' = 'null'::jsonb;
  value := public.proplet_request_guard_v1('play_session',actor,3600,10,null);
  assert value->'auth' = 'null'::jsonb;
  assert jsonb_typeof(value->'fairPlay') = 'object';
  value := public.proplet_ranking_context_v1(array[a],array[]::text[],false);
  assert jsonb_array_length(value->'players') = 1;
  assert jsonb_array_length(value->'leagues') = 1;
  assert not ((value->'players'->0) ? 'token_hash');
  assert not ((value->'players'->0) ? 'password_hash');
  assert not (value#>>'{players,0,public_rankings}')::boolean;
  value := public.proplet_ranking_context_v1(array[a],array[]::text[],true);
  assert jsonb_array_length(value->'players') = 2;
  reset role;
  delete from public.player_sessions where id = session_id;
  set local role service_role;
  value := public.proplet_request_guard_v1('usage-test-revoked',actor,3600,10,session_digest);
  assert value#>'{auth,player}' = 'null'::jsonb;
  assert not (value#>>'{auth,expired}')::boolean;
  reset role;
end;
$test$;

