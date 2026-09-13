-- Additive provenance. Existing rows remain explicitly legacy, never relabelled production.
do $$
declare t text;
begin
  foreach t in array array['product_events','puzzle_attempts','hint_events','helper_events','operational_events','puzzle_feedback'] loop
    execute format('alter table public.%I add column if not exists client_release text',t);
    execute format('alter table public.%I add column if not exists environment text not null default ''legacy'', add column if not exists release text, add column if not exists measurement_version integer not null default 1, add column if not exists onboarding_version text not null default ''legacy'', add column if not exists is_test boolean not null default false',t);
  end loop;
end $$;

create index if not exists product_events_measurement_time on public.product_events(environment, is_test, created_at);
create index if not exists puzzle_attempts_measurement_time on public.puzzle_attempts(environment, is_test, started_at);

create or replace view public.analytics_first_attempts with (security_invoker=true) as
select distinct on (coalesce('p:'||player_id::text,'a:'||anonymous_id),puzzle_id,calm_mode) *
from public.puzzle_attempts
where environment in ('production','legacy') and not is_test
  and coalesce(player_id::text,anonymous_id) is not null
order by coalesce('p:'||player_id::text,'a:'||anonymous_id),puzzle_id,calm_mode,started_at,id;
revoke all on public.analytics_first_attempts from public,anon,authenticated;
grant select on public.analytics_first_attempts to service_role;

create or replace function public.proplet_launch_dataset(p_until timestamptz default now())
returns jsonb language sql stable security invoker set search_path='' as $$
with ev as materialized (
  select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,event_type,created_at,measurement_version,onboarding_version,environment
  from public.product_events where environment in ('production','legacy') and not is_test and created_at<=p_until
), atts as materialized (
  select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,started_at,completed_at,last_activity_at,mode,difficulty,app_version
  from public.puzzle_attempts where environment in ('production','legacy') and not is_test and started_at<=p_until
), firsts as (
  select actor,min(stamp) first_seen from (
    select actor,created_at stamp from ev where event_type in ('app_open','app_session_started','onboarding_started')
    union all select actor,started_at from atts
  ) x where actor is not null group by actor
), onboard as (
  select actor,min(created_at) started from ev where event_type='onboarding_started'
    and measurement_version=2 and onboarding_version='board-v2' and environment='production' group by actor
), et as (
  select actor,event_type,jsonb_agg(created_at order by created_at) stamps
  from ev where created_at>=p_until-interval '30 days' and actor is not null group by actor,event_type
), ea as (
  select actor,jsonb_object_agg(event_type,stamps) events from et group by actor
), aa as (
  select actor,jsonb_agg(jsonb_build_object('started_at',started_at,'completed_at',completed_at,'last_activity_at',last_activity_at,'mode',mode,'difficulty',difficulty,'app_version',app_version) order by started_at) attempts
  from atts where greatest(started_at,completed_at,last_activity_at)>=p_until-interval '30 days' and actor is not null group by actor
), actors as (select actor from ea union select actor from aa), ops as (
  select * from public.operational_events where environment in ('production','legacy') and not is_test
    and created_at between p_until-interval '7 days' and p_until
)
select jsonb_build_object(
  'actors',coalesce((select jsonb_agg(jsonb_build_object('key',a.actor,'first_seen',f.first_seen,'onboarding',o.started,'events',coalesce(e.events,'{}'::jsonb),'attempts',coalesce(g.attempts,'[]'::jsonb))) from actors a left join firsts f using(actor) left join onboard o using(actor) left join ea e using(actor) left join aa g using(actor)),'[]'::jsonb),
  'reliability',jsonb_build_object(
    'available',true,
    'errors24h',(select count(*) from ops where event_type in ('client_error','server_error') and created_at>=p_until-interval '24 hours'),
    'errors7d',(select count(*) from ops where event_type in ('client_error','server_error')),
    'rateLimits24h',(select count(*) from ops where event_type='rate_limit' and created_at>=p_until-interval '24 hours'),
    'rateLimits7d',(select count(*) from ops where event_type='rate_limit'),
    'openSupportReports',(select count(*) from public.support_reports where status in ('new','reviewing')),
    'lastSnapshot',(select max(created_at) from public.quality_snapshots)
  ),
  'newAccounts24h',(select count(*) from public.players where created_at between p_until-interval '24 hours' and p_until),
  'rawEvents30d',(select count(*) from ev where created_at>=p_until-interval '30 days'),
  'legacyEvents30d',(select count(*) from ev where created_at>=p_until-interval '30 days' and (environment='legacy' or measurement_version<2)),
  'measurementStartedAt',(select min(created_at) from ev where environment='production' and measurement_version=2 and onboarding_version='board-v2')
);
$$;
revoke all on function public.proplet_launch_dataset(timestamptz) from public,anon,authenticated;
grant execute on function public.proplet_launch_dataset(timestamptz) to service_role;

create or replace function public.proplet_quality_event_counts(p_from timestamptz,p_until timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_object_agg(event_type,n),'{}'::jsonb) from (
 select event_type,count(distinct coalesce('p:'||player_id::text,'a:'||anonymous_id)) n
 from public.product_events where environment in ('production','legacy') and not is_test
 and created_at between p_from and p_until group by event_type
) x;
$$;
revoke all on function public.proplet_quality_event_counts(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.proplet_quality_event_counts(timestamptz,timestamptz) to service_role;
