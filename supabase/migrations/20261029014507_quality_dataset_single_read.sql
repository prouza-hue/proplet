-- The former report performed 59 sequential REST pages on 2026-10-29 data.
-- Preserve its five complete datasets and calibration; only replace transport.
-- 56,256 current rows fit below the explicit 250,000-row safety cap. Exceeding
-- the cap fails closed, without returning a truncated or sampled calibration.
create or replace function public.proplet_quality_dataset_v1(p_from timestamptz,p_until timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
with
 valid_window as (
  select coalesce(p_from is not null and p_until is not null and p_from<=p_until
   and p_until<=statement_timestamp()+interval '5 minutes'
   -- Python's existing 90-day Prague window crosses DST. Preserve calendar
   -- arithmetic, including a 90-day period with 90 days + 1 elapsed hour.
   and (p_until at time zone 'Europe/Prague')-(p_from at time zone 'Europe/Prague')<=interval '90 days',false) valid
 ),
 attempts as materialized (
  -- The view chooses the first LIFETIME actor/puzzle/calm exposure before this
  -- outer 90-day filter. Never replace it with first exposure inside the window.
  select id,player_id,anonymous_id,puzzle_id,mode,difficulty,started_at,completed_at,calm_mode,
   elapsed_ms,wrong_attempts,hints_used,clean_solve,first_correct_ms,reset_count,resume_count,first_hint_ms
  from public.analytics_first_attempts
  where (select valid from valid_window) and environment in('production','legacy') and not is_test
   and started_at between p_from and p_until
 ),
 feedback as materialized (
  select id,puzzle_id,kind,rating from public.puzzle_feedback
  where (select valid from valid_window) and environment in('production','legacy') and not is_test
   and created_at between p_from and p_until and kind in('difficulty','word')
 ),
 hints as materialized (
  select id,attempt_id,source,complimentary,hint_level from public.hint_events
  where (select valid from valid_window) and environment in('production','legacy') and not is_test
   and created_at between p_from and p_until
 ),
 helpers as materialized (
  select id,attempt_id,event_type,idle_ms,support_mode from public.helper_events
  where (select valid from valid_window) and environment in('production','legacy') and not is_test
   and created_at between p_from and p_until
 ),
 counts as (
  select (select count(*) from attempts) attempts,
   (select count(*) from feedback where kind='difficulty') feedback,
   (select count(*) from feedback where kind='word') word_feedback,
   (select count(*) from hints) hint_events,(select count(*) from helpers) helper_events
 ),
 shape as (
  select jsonb_build_object(
   'attempts',jsonb_build_array('id','player_id','anonymous_id','puzzle_id','mode','difficulty','started_at','completed_at',
    'calm_mode','elapsed_ms','wrong_attempts','hints_used','clean_solve','first_correct_ms','reset_count','resume_count','first_hint_ms'),
   'feedback',jsonb_build_array('puzzle_id','rating'),'word_feedback',jsonb_build_array('puzzle_id'),
   'hint_events',jsonb_build_array('attempt_id','source','complimentary','hint_level'),
   'helper_events',jsonb_build_array('attempt_id','event_type','idle_ms','support_mode')) columns
 )
select case when not (select valid from valid_window) then
 jsonb_build_object('ok',false,'schemaVersion',1,'code','invalid_window')
 when (select attempts+feedback+word_feedback+hint_events+helper_events from counts)>250000 then
 jsonb_build_object('ok',false,'schemaVersion',1,'code','dataset_too_large')
 else jsonb_build_object('ok',true,'schemaVersion',1,
  'window',jsonb_build_object('from',p_from,'until',p_until,'timeZone','Europe/Prague'),
  'columns',(select columns from shape),'counts',(select to_jsonb(c) from counts c),
  'datasets',jsonb_build_object(
   'attempts',coalesce((select jsonb_agg(jsonb_build_array(id,player_id,anonymous_id,puzzle_id,mode,difficulty,started_at,completed_at,
    calm_mode,elapsed_ms,wrong_attempts,hints_used,clean_solve,first_correct_ms,reset_count,resume_count,first_hint_ms) order by id) from attempts),'[]'::jsonb),
   'feedback',coalesce((select jsonb_agg(jsonb_build_array(puzzle_id,rating) order by id) from feedback where kind='difficulty'),'[]'::jsonb),
   'word_feedback',coalesce((select jsonb_agg(jsonb_build_array(puzzle_id) order by id) from feedback where kind='word'),'[]'::jsonb),
   'hint_events',coalesce((select jsonb_agg(jsonb_build_array(attempt_id,source,complimentary,hint_level) order by id) from hints),'[]'::jsonb),
   'helper_events',coalesce((select jsonb_agg(jsonb_build_array(attempt_id,event_type,idle_ms,support_mode) order by id) from helpers),'[]'::jsonb)),
  'eventCounts',public.proplet_quality_event_counts(p_from,p_until)) end;
$$;
revoke all on function public.proplet_quality_dataset_v1(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.proplet_quality_dataset_v1(timestamptz,timestamptz) to service_role;
