-- Forward-only: no backfill, relabelling, or deletion of historical events.
-- A real INSERT and its event commit/roll back together. UPDATE/login/linking
-- and INSERT ... ON CONFLICT retries do not create another event.
begin;

create unique index if not exists product_events_account_created_once
on public.product_events (player_id)
where event_type = 'account_created' and player_id is not null;

create or replace function public.proplet_account_created_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  env text := headers->>'x-proplet-signup-environment';
  version text := headers->>'x-proplet-signup-version';
begin
  if env is null or env not in ('production', 'preview', 'local', 'development') then
    env := 'unknown';
  end if;
  if version is null or version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    version := 'server';
  end if;
  insert into public.product_events
    (id, player_id, anonymous_id, event_type, app_version, created_at,
     environment, measurement_version, is_test, context)
  values
    (md5('proplet:account-created:' || new.id::text)::uuid,
     new.id, null, 'account_created', version, statement_timestamp(),
     env, 2, env in ('preview', 'local', 'development'),
     jsonb_build_object('origin', 'players_insert'))
  on conflict (player_id) where event_type = 'account_created' and player_id is not null
  do nothing;
  return new;
end;
$$;
revoke all on function public.proplet_account_created_event() from public, anon, authenticated;
grant execute on function public.proplet_account_created_event() to service_role;

-- Old server/client versions may still write this event independently. Suppress
-- those writes, including anonymous events, without breaking their HTTP request.
-- Only the nested players trigger can produce the new authoritative event.
create or replace function public.proplet_guard_account_created_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Do not turn old anonymous telemetry into a second signup when an old
  -- client's anonymous-claim request attaches its history after registration.
  if tg_op = 'UPDATE' then
    if new.event_type = 'account_created' and old.player_id is null and new.player_id is not null
       and exists (select 1 from public.product_events e
                   where e.player_id=new.player_id and e.event_type='account_created' and e.id<>new.id) then
      return null;
    end if;
    return new;
  end if;
  if new.event_type = 'account_created' and
     (pg_trigger_depth() < 2 or new.context->>'origin' is distinct from 'players_insert'
      or new.player_id is null or new.id is distinct from md5('proplet:account-created:' || new.player_id::text)::uuid) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.proplet_guard_account_created_event() from public, anon, authenticated;
grant execute on function public.proplet_guard_account_created_event() to service_role;

create trigger product_events_account_created_guard before insert or update on public.product_events
for each row execute function public.proplet_guard_account_created_event();
create trigger players_account_created after insert on public.players
for each row execute function public.proplet_account_created_event();
commit;
