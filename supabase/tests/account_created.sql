-- Run only against disposable synthetic databases. Roll back all test rows.
begin;
set local role service_role;
select set_config('request.headers', '{"x-proplet-signup-environment":"preview","x-proplet-signup-version":"4.2.2","email":"never-copy@example.invalid"}', true);
insert into public.players(id,name,family_code,token_hash)
values ('10000000-0000-4000-8000-000000000001','Private synthetic name','SOLO_ANALYTICS','synthetic-token');
insert into public.players(id,name,family_code,token_hash)
values ('10000000-0000-4000-8000-000000000001','Private synthetic name','SOLO_ANALYTICS','synthetic-token')
on conflict (id) do nothing;
update public.players set avatar='🙂' where id='10000000-0000-4000-8000-000000000001';
-- Old cached clients and a forged anonymous event are ignored.
insert into public.product_events(id,player_id,event_type,app_version)
values (gen_random_uuid(),'10000000-0000-4000-8000-000000000001','account_created','old');
insert into public.product_events(id,anonymous_id,event_type,app_version)
values (gen_random_uuid(),'synthetic-guest','account_created','old');
update public.product_events set player_id='10000000-0000-4000-8000-000000000001',anonymous_id=null
where id='20000000-0000-4000-8000-000000000002';
do $$
declare e public.product_events%rowtype;
begin
  assert not has_function_privilege('anon','public.proplet_account_created_event()','execute');
  assert not has_function_privilege('authenticated','public.proplet_guard_account_created_event()','execute');
  assert not exists (select 1 from public.product_events where player_id='20000000-0000-4000-8000-000000000001');
  assert exists (select 1 from public.product_events where id='20000000-0000-4000-8000-000000000002' and anonymous_id='historical-guest' and player_id is null);
  assert (select count(*) from public.product_events where player_id='10000000-0000-4000-8000-000000000001' and event_type='account_created')=1;
  select * into strict e from public.product_events where player_id='10000000-0000-4000-8000-000000000001' and event_type='account_created';
  assert e.environment='preview' and e.is_test=true;
  assert e.context='{"origin":"players_insert"}'::jsonb;
  assert e.anonymous_id is null and e.app_version='4.2.2';
  assert to_jsonb(e)::text not like '%Private synthetic%' and to_jsonb(e)::text not like '%@%';
  assert not exists (select 1 from public.product_events where anonymous_id='synthetic-guest' and event_type='account_created');
  begin
    insert into public.players(id,name,family_code,token_hash)
    values ('10000000-0000-4000-8000-000000000002','Rollback','SOLO_ROLLBACK','rollback');
    raise exception 'synthetic registration failure';
  exception when raise_exception then null;
  end;
  assert not exists(select 1 from public.players where id='10000000-0000-4000-8000-000000000002');
  assert not exists(select 1 from public.product_events where player_id='10000000-0000-4000-8000-000000000002');
end $$;
rollback;
