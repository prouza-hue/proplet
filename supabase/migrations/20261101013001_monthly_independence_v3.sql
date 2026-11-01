-- Approved 2026-11-01: 55 completion + max(25-5*hints,0) independence
-- + unchanged verified relative speed. Dormant until explicit v3 activation.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.monthly_competition_settings drop constraint monthly_competition_settings_scoring_version_check;
alter table public.monthly_competition_settings add constraint monthly_competition_settings_scoring_version_check check(scoring_version in(1,2,3));
alter table public.monthly_competition_days add column independence_points numeric(4,1);

-- Keep v2 history/corrections on their original formula; normal active-month
-- refresh, reconciliation and finalization reuse the existing narrow boundary.
alter function proplet_private.rebuild_monthly_quality_v2(date,date) rename to rebuild_monthly_quality_original_v2;
create function proplet_private.rebuild_monthly_quality_v2(p_month date,p_day date default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare version integer;n integer;
begin
 select coalesce((select scoring_version from public.monthly_competition_rounds where month=p_month),
  (select scoring_version from public.monthly_competition_settings where singleton)) into version;
 if version<>3 then return proplet_private.rebuild_monthly_quality_original_v2(p_month,p_day);end if;
 delete from public.monthly_competition_days where month=p_month and (p_day is null or daily_date=p_day);
 with evidence as (
 select e.player_id,e.daily_date,e.result_id,e.command_id,e.run_id,e.confirmed_at,e.clean,e.verified_time_ms,
  greatest(e.hints,case when (case when pr.completed_at=r.completed_at then r.max_hint_level else pr.max_hint_level end)>0 then 1 else 0 end) hints
 from proplet_private.monthly_daily_evidence_v2(p_month) e
 join public.puzzle_runs pr on pr.id=e.run_id join public.results r on r.id=e.result_id
 where p_day is null or e.daily_date=p_day
 ),cohort as (
 select *,count(verified_time_ms) over(partition by daily_date) cohort_count,
 rank() over(partition by daily_date order by verified_time_ms nulls last)-1 speed_rank from evidence
 ),scored as (
 select *,case when verified_time_ms is null then 0::numeric when cohort_count<=1 then 10::numeric
 else 20::numeric*(1-speed_rank::numeric/(cohort_count-1)) end speed from cohort
 ) insert into public.monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at,
 scoring_version,clean,hints,verified_time_ms,completion_points,clean_points,hint_points,speed_points,independence_points)
 select p_month,player_id,daily_date,result_id,command_id,run_id,round(55+greatest(25-5*hints,0)+speed,1),confirmed_at,
 3,clean,hints,verified_time_ms,55,0,0,round(speed,1),greatest(25-5*hints,0) from scored;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function proplet_private.rebuild_monthly_quality_v2(date,date),proplet_private.rebuild_monthly_quality_original_v2(date,date)
 from public,anon,authenticated,service_role;

-- Existing finalizer/correction locking, audit and persisted draw stay intact.
-- Only the version recorded for the resulting snapshot/receipt becomes dynamic.
do $version$ declare source text;begin
 source:=pg_get_functiondef('public.proplet_finalize_monthly_competition_v1()'::regprocedure);
 if position('values(m,v_close,v_now,rows,2)' in source)=0 then raise exception 'MONTHLY_FINALIZER_VERSION_BOUNDARY_CHANGED';end if;
 execute replace(source,'values(m,v_close,v_now,rows,2)','values(m,v_close,v_now,rows,cfg.scoring_version)');
 source:=pg_get_functiondef('proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text)'::regprocedure);
 if position($old$'scoringVersion',2$old$ in source)=0 then raise exception 'MONTHLY_CORRECTION_VERSION_BOUNDARY_CHANGED';end if;
 execute replace(source,$old$'scoringVersion',2$old$,$new$'scoringVersion',rd.scoring_version$new$);
 source:=pg_get_functiondef('public.proplet_activate_monthly_quality_v2()'::regprocedure);
 if position('update public.monthly_competition_settings set scoring_version=2' in source)=0 then raise exception 'MONTHLY_ACTIVATION_VERSION_BOUNDARY_CHANGED';end if;
 execute replace(source,'update public.monthly_competition_settings set scoring_version=2',
  'if cfg.scoring_version>2 then return jsonb_build_object(''scoringVersion'',cfg.scoring_version,''reconciledMonths'',0,''enabled'',cfg.enabled);end if; update public.monthly_competition_settings set scoring_version=2');
end $version$;

alter function public.proplet_monthly_state_v1(uuid,date) rename to proplet_monthly_state_quality_v2;
create function public.proplet_monthly_state_v1(p_player_id uuid default null,p_month date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare s jsonb;m date;version integer;days jsonb;
begin
 s:=public.proplet_monthly_state_quality_v2(p_player_id,p_month);
 if not coalesce((s->>'enabled')::boolean,false) then return s;end if;
 m:=(s->>'month')::date;
 select coalesce((select scoring_version from public.monthly_competition_rounds where month=m),
  (select scoring_version from public.monthly_competition_settings where singleton)) into version;
 if version<>3 then return s;end if;
 if p_player_id is not null then
 select coalesce(jsonb_agg(d||jsonb_build_object('independencePoints',l.independence_points) order by d->>'date'),'[]'::jsonb)
 into days from jsonb_array_elements(s#>'{me,days}') d
 join public.monthly_competition_days l on l.month=m and l.player_id=p_player_id and l.daily_date=(d->>'date')::date;
 s:=jsonb_set(s,'{me,days}',days);
 end if;
 return s||jsonb_build_object('scoringVersion',3,'rulesVersion','monthly-independence-v3');
end $$;
revoke all on function public.proplet_monthly_state_v1(uuid,date) from public,anon,authenticated;
grant execute on function public.proplet_monthly_state_v1(uuid,date) to service_role;

create function public.proplet_activate_monthly_independence_v3() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.monthly_competition_settings;m date;n integer:=0;
begin
 select * into cfg from public.monthly_competition_settings where singleton for update;
 update public.monthly_competition_settings set scoring_version=3 where singleton;
 if cfg.enabled and cfg.rules_approved then
 for m in select d::date from generate_series(cfg.launch_month::timestamp,date_trunc('month',public.proplet_monthly_now_v1() at time zone 'Europe/Prague'),interval '1 month') d
 where not exists(select 1 from public.monthly_competition_rounds where month=d::date)
 and ((d+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'>public.proplet_monthly_now_v1() loop
 perform public.proplet_reconcile_monthly_competition_v1(m);n:=n+1;
 end loop;end if;
 return jsonb_build_object('scoringVersion',3,'reconciledMonths',n,'enabled',cfg.enabled);
end $$;
revoke all on function public.proplet_activate_monthly_independence_v3() from public,anon,authenticated;
grant execute on function public.proplet_activate_monthly_independence_v3() to service_role;
commit;
