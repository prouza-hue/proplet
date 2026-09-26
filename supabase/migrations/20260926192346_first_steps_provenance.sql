-- Forward-only signup provenance. No player/result mutations or historical inference.
begin;
create or replace function public.proplet_account_created_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  env text := headers->>'x-proplet-signup-environment';
  version text := headers->>'x-proplet-signup-version';
  run text := headers->>'x-proplet-signup-run';
  onboarding text := headers->>'x-proplet-signup-onboarding';
  client text := left(coalesce(headers->>'x-proplet-signup-release','legacy'),80);
  details jsonb := jsonb_build_object('origin','players_insert','creation_source','other');
begin
  if env is null or env not in ('production','preview','local','development') then env := 'unknown'; end if;
  if version is null or version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then version := 'server'; end if;
  if onboarding is null or onboarding not in ('board-v2','board-v3-short') then onboarding := 'legacy'; end if;
  if headers->>'x-proplet-signup-source'='first_steps_v1'
     and run ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    details := details || jsonb_build_object('creation_source','first_steps_v1','first_steps_run_id',run);
  end if;
  insert into public.product_events
    (id,player_id,anonymous_id,event_type,app_version,created_at,
     environment,measurement_version,is_test,onboarding_version,client_release,context)
  values (md5('proplet:account-created:'||new.id::text)::uuid,new.id,null,'account_created',version,statement_timestamp(),
    env,2,env in ('preview','local','development') or coalesce(headers->>'x-proplet-signup-test'='1',false),onboarding,client,details)
  on conflict (player_id) where event_type='account_created' and player_id is not null do nothing;
  return new;
end;
$$;
revoke all on function public.proplet_account_created_event() from public,anon,authenticated;
grant execute on function public.proplet_account_created_event() to service_role;
commit;
