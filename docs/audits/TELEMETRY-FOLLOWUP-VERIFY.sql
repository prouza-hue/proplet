-- first_game_integrity
-- Read-only. Edit Prague-day bounds. Follow-up is read through statement time;
-- late completions are listed separately and must not change closed-day totals.
-- Absence of a row/sample is NOT PASS. No time-guess links or account attribution.
with bounds as (
 select '2026-10-18T22:00:00Z'::timestamptz lo,
        '2026-10-19T22:00:00Z'::timestamptz hi, now() as_of
), assignments as materialized (
 select a.* from proplet_experiment_internal.first_board_assignments a,bounds b
 where a.environment='production' and a.is_test=false
 and a.assigned_at>=b.lo and a.assigned_at<least(b.hi,b.as_of)
), ev as materialized (
 select e.*,e.context->>'first_steps_run_id' flow,e.context->>'run_id' attempt_id,
 coalesce('p:'||e.player_id::text,'a:'||e.anonymous_id) actor
 from product_events e,bounds b
 where e.environment='production' and e.is_test=false
 and e.created_at>='2026-09-29T07:51:55Z' and e.created_at<b.as_of
 and e.event_type in ('first_board_experiment_assigned','first_board_experiment_started',
                     'first_board_experiment_completed','first_steps_v1_offer')
 and e.context->>'first_steps_run_id' in(select first_steps_run_id::text from assignments)
), linked as materialized (
 select distinct e.flow,p.id,p.started_at,p.completed_at,p.client_release,p.puzzle_id
 from ev e join puzzle_attempts p on p.id::text=e.attempt_id
 where p.environment='production' and p.is_test=false and p.mode='free'
), duplicate_groups as (
 select flow,event_type,case when event_type='first_board_experiment_assigned' then flow else attempt_id end identity,
 count(*) n from ev group by 1,2,3
)
select a.first_steps_run_id,a.variant,a.bucket,a.identity_bucket,a.policy,
 case when not exists(select 1 from ev where flow=a.first_steps_run_id::text and event_type='first_board_experiment_assigned') then 1 else 0 end missing_assignment_event,
 (select count(distinct actor) from ev where flow=a.first_steps_run_id::text) actors,
 (select jsonb_agg(x order by x.event_type) from (
   select event_type,count(*) rows,count(distinct attempt_id) linked_attempt_ids,
   count(*) filter(where event_type<>'first_board_experiment_assigned' and attempt_id is null) missing_attempt_id,
   array_agg(distinct client_release) client_releases,
   count(*) filter(where created_at>=b.hi) later_rows
   from ev where flow=a.first_steps_run_id::text group by event_type
 )x) raw_event_counts,
 (select coalesce(sum(greatest(n-1,0)),0) from duplicate_groups where flow=a.first_steps_run_id::text) duplicate_rows,
 (select jsonb_object_agg(event_type,n) from (
    select event_type,sum(greatest(n-1,0)) n from duplicate_groups where flow=a.first_steps_run_id::text group by event_type
 )d) duplicate_rows_by_type,
 (select count(*) from ev where flow=a.first_steps_run_id::text and (
   context->>'experiment_variant' is distinct from a.variant or
   context->>'experiment_bucket' is distinct from a.bucket::text or
   context->>'puzzle_id' is distinct from case when a.variant='control_e001' then 'g4-e-001' else 'g4-e-009' end or
   onboarding_version is distinct from 'board-v3-short')) metadata_mismatches,
 (select count(*) from linked where flow=a.first_steps_run_id::text) directly_linked_attempts,
 (select count(*) from linked where flow=a.first_steps_run_id::text and completed_at<b.hi) completed_by_day_end,
 (select count(*) from linked where flow=a.first_steps_run_id::text and completed_at>=b.hi and completed_at<b.as_of) later_completions,
 (select count(*) from linked p where p.flow=a.first_steps_run_id::text and not exists(
   select 1 from ev e where e.flow=p.flow and e.attempt_id=p.id::text and event_type='first_board_experiment_started')) missing_start_for_linked_attempt,
 (select count(*) from linked p where p.flow=a.first_steps_run_id::text and p.completed_at<b.as_of and not exists(
   select 1 from ev e where e.flow=p.flow and e.attempt_id=p.id::text and event_type='first_board_experiment_completed')) missing_completion_for_completed_attempt,
 (select count(*) from linked p where p.flow=a.first_steps_run_id::text and p.completed_at<b.as_of and not exists(
   select 1 from ev e where e.flow=p.flow and e.attempt_id=p.id::text and event_type='first_steps_v1_offer')) missing_offer_for_completed_attempt,
 (select count(*) from ev e where e.flow=a.first_steps_run_id::text and e.event_type<>'first_board_experiment_assigned'
   and not exists(select 1 from linked p where p.flow=e.flow and p.id::text=e.attempt_id)) missing_attempt_link,
 (select jsonb_agg(to_jsonb(p)) from linked p where p.flow=a.first_steps_run_id::text) attempts
from assignments a cross join bounds b order by assigned_at;

-- starter_diagnostics
-- New additive phases are NOT funnel steps and have no pre-release baseline.
select client_release,onboarding_version,event_type,context->>'reason' reason,
 count(*) rows,count(distinct coalesce('p:'||player_id::text,'a:'||anonymous_id)) actors,
 count(distinct context->>'starter_run_id') runs,
 count(*) filter(where nullif(context->>'starter_run_id','') is null) missing_run_id
from product_events
where environment='production' and is_test=false
and created_at>='2026-10-18T22:00:00Z' and created_at<least('2026-10-19T22:00:00Z'::timestamptz,now())
and event_type in('starter_v1_ready','starter_v1_interaction','starter_v1_completed',
                 'starter_v1_presentation_checked','starter_v1_idle')
group by 1,2,3,4 order by 1,3,4;

-- error_observability
-- Preserve unknown producer. reporter_release and server_version are NOT client versions.
select client_release,app_version,metadata->>'client_provenance' provenance,
 metadata->>'reporter_release' reporter_release,metadata->>'source_availability' source_availability,
 metadata->>'unknown_producer_reason' unknown_producer_reason,route,code,
 metadata->>'message' message,metadata->>'source_file' source_file,
 metadata->>'source_line' source_line,metadata->>'source_column' source_column,
 metadata->'source_frames' source_frames,count(*) rows,count(distinct request_id) requests,
 array_agg(request_id order by created_at) request_ids,min(created_at) first_at,max(created_at) last_at
from operational_events
where environment='production' and is_test=false and event_type='client_error'
and created_at>='2026-10-18T22:00:00Z' and created_at<least('2026-10-19T22:00:00Z'::timestamptz,now())
group by 1,2,3,4,5,6,7,8,9,10,11,12,13 order by first_at;
