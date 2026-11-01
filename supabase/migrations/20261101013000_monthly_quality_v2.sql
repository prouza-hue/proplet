-- Monthly quality rules approved 2026-11-01. Forward-only; no gameplay XP writes.
-- Open November is rebuilt from owned atomic receipts; closed v1 snapshots survive.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
alter table public.monthly_competition_settings add column scoring_version integer not null default 1 check(scoring_version in(1,2));
alter table public.monthly_competition_days drop constraint monthly_competition_days_points_check;
alter table public.monthly_competition_days alter column points type numeric(6,1);
alter table public.monthly_competition_days add constraint monthly_competition_days_points_check check(points between 0 and 120);
alter table public.monthly_competition_days add column scoring_version integer not null default 1;
alter table public.monthly_competition_days add column clean boolean not null default false;
alter table public.monthly_competition_days add column hints integer not null default 0;
alter table public.monthly_competition_days add column verified_time_ms bigint;
alter table public.monthly_competition_days add column completion_points numeric(4,1) not null default 0;
alter table public.monthly_competition_days add column clean_points numeric(4,1) not null default 0;
alter table public.monthly_competition_days add column hint_points numeric(4,1) not null default 0;
alter table public.monthly_competition_days add column speed_points numeric(4,1) not null default 0;
alter table public.monthly_competition_rounds add column scoring_version integer not null default 1;
alter table public.monthly_competition_badges drop constraint monthly_competition_badges_points_check;
alter table public.monthly_competition_badges alter column points type numeric(7,1);
alter table public.monthly_competition_badges add constraint monthly_competition_badges_points_check check(points between 0 and 2500);

-- The seed is created once under the existing month lock. It is audit evidence,
-- never a display ordering by account age/name. Corrections reuse the same seed.
create table proplet_private.monthly_draws (
 month date primary key, seed uuid not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 method text not null default 'md5-seed-player-v1' check(method='md5-seed-player-v1')
);
alter table proplet_private.monthly_draws enable row level security;
revoke all on proplet_private.monthly_draws from public,anon,authenticated,service_role;
grant select on proplet_private.monthly_draws to service_role;

alter function public.proplet_monthly_refresh_day_v1(uuid,date) rename to proplet_monthly_refresh_day_basic_v1;
alter function public.proplet_reconcile_monthly_competition_v1(date) rename to proplet_reconcile_monthly_competition_basic_v1;
alter function public.proplet_monthly_standings_v1(date) rename to proplet_monthly_standings_basic_v1;
alter function public.proplet_finalize_monthly_competition_v1() rename to proplet_finalize_monthly_competition_basic_v1;
alter function proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text) rename to correct_monthly_competition_basic_v1;
-- Legacy receipts remain integer-shaped after the additive numeric day column.
do $legacy_numeric$ declare source text;begin
 source:=pg_get_functiondef('proplet_private.correct_monthly_competition_basic_v1(date,uuid,date,integer,text,text,text)'::regprocedure);
 if position($cast$(v_new_day->>'points')::int$cast$ in source)=0 then raise exception 'MONTHLY_LEGACY_NUMERIC_BOUNDARY_CHANGED';end if;
 source:=replace(source,$cast$(v_new_day->>'points')::int$cast$,$cast$(v_new_day->>'points')::numeric::integer$cast$);
 execute source;
end $legacy_numeric$;


-- Current official first completion, or its accepted predecessor when a later
-- after-cutoff offline delivery replaced the gameplay result. No new day cutoff.
create function proplet_private.monthly_daily_evidence_v2(p_month date)
returns table(player_id uuid,daily_date date,result_id uuid,command_id uuid,run_id uuid,
 confirmed_at timestamptz,clean boolean,hints integer,verified_time_ms bigint)
language sql stable security invoker set search_path='' as $$
 with eligible as (
 select r.player_id,r.daily_date,r.id result_id,rc.id command_id,pr.id run_id,rc.committed_at confirmed_at,
  case when pr.completed_at=r.completed_at then r.clean_solve else pr.clean_solve end
    and case when pr.completed_at=r.completed_at then r.hints_used else pr.hints_used end=0
    and case when pr.completed_at=r.completed_at then r.max_hint_level else pr.max_hint_level end=0 as clean,
  greatest(0,case when pr.completed_at=r.completed_at then r.hints_used else pr.hints_used end) hints,
  case when pr.timing_verified is true and pr.elapsed_ms>0
    and (pr.completed_at<>r.completed_at or r.timing_verified is true) then pr.elapsed_ms::bigint end verified_time_ms,
  case when pr.completed_at=r.completed_at then 0 else 1 end priority,pr.completed_at
 from public.results r join public.puzzle_runs pr on pr.player_id=r.player_id and pr.puzzle_id=r.puzzle_id
  and pr.challenge_key=r.challenge_key and pr.mode='daily'
 join public.result_commands rc on rc.id=pr.result_command_id and rc.player_id=r.player_id
  and rc.receipt is not null and rc.committed_at is not null
 where r.mode='daily' and r.daily_date>=p_month and r.daily_date<(p_month+interval '1 month')::date
  and r.challenge_key='daily:'||r.daily_date::text
  and (pr.completed_at at time zone 'Europe/Prague')::date=r.daily_date
  and pr.completed_at<=public.proplet_monthly_now_v1()
  and not coalesce(case when pr.completed_at=r.completed_at then r.calm_mode else pr.calm_mode end,false)
  and rc.committed_at<((p_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'
  and (pr.completed_at=r.completed_at or exists(
   select 1 from public.puzzle_runs late join public.result_commands lc on lc.id=late.result_command_id
    and lc.player_id=r.player_id where late.player_id=r.player_id and late.puzzle_id=r.puzzle_id
    and late.challenge_key=r.challenge_key and late.mode='daily' and late.completed_at=r.completed_at
    and lc.receipt is not null and lc.committed_at>=((p_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'))
 ) select distinct on(player_id,daily_date) player_id,daily_date,result_id,command_id,run_id,
 confirmed_at,coalesce(clean,false),hints,verified_time_ms from eligible
 order by player_id,daily_date,priority,completed_at,confirmed_at,run_id
$$;

-- Rebuild all same-day cohorts. Singleton verified time gets the canonical 10;
-- equal verified times receive the same best-position percentile. Unverified
-- times do not enter the speed cohort and receive zero speed points.
create function proplet_private.rebuild_monthly_quality_v2(p_month date,p_day date default null) returns integer
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.monthly_competition_days where month=p_month and (p_day is null or daily_date=p_day);
 with evidence as (select * from proplet_private.monthly_daily_evidence_v2(p_month) where p_day is null or daily_date=p_day),
 cohort as (select *,count(verified_time_ms) over(partition by daily_date) cohort_count,
  rank() over(partition by daily_date order by verified_time_ms nulls last)-1 speed_rank from evidence),
 scored as (select *,case when verified_time_ms is null then 0::numeric when cohort_count<=1 then 10::numeric
  else 20::numeric*(1-speed_rank::numeric/(cohort_count-1)) end speed from cohort)
 insert into public.monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at,
 scoring_version,clean,hints,verified_time_ms,completion_points,clean_points,hint_points,speed_points)
 select p_month,player_id,daily_date,result_id,command_id,run_id,
 round(55+case when clean then 15 else 0 end+greatest(10-3*hints,0)+speed,1),confirmed_at,
 2,clean,hints,verified_time_ms,55,case when clean then 15 else 0 end,greatest(10-3*hints,0),round(speed,1)
 from scored;
 get diagnostics n=row_count;
 return n;
end $$;

create or replace function public.proplet_monthly_refresh_day_v1(p_player uuid,p_day date) returns void
language plpgsql security definer set search_path='' as $$
declare cfg public.monthly_competition_settings; m date:=date_trunc('month',p_day)::date;
begin
 select * into cfg from public.monthly_competition_settings where singleton;
 if cfg.scoring_version=1 then perform public.proplet_monthly_refresh_day_basic_v1(p_player,p_day);return;end if;
 if p_day is null or not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null or m<cfg.launch_month then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('monthly:'||m::text,8811));
 if exists(select 1 from public.monthly_competition_rounds where month=m)
  or public.proplet_monthly_now_v1()>=((m+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours' then return;end if;
 perform proplet_private.rebuild_monthly_quality_v2(m,p_day);
end $$;
create or replace function public.proplet_reconcile_monthly_competition_v1(p_month date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.monthly_competition_settings;n integer;
begin
 select * into cfg from public.monthly_competition_settings where singleton;
 if cfg.scoring_version=1 then return public.proplet_reconcile_monthly_competition_basic_v1(p_month);end if;
 if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null then return jsonb_build_object('enabled',false,'reconciled',0);end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<cfg.launch_month then raise exception 'MONTHLY_MONTH_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('monthly:'||p_month::text,8811));
 if exists(select 1 from public.monthly_competition_rounds where month=p_month)
  or public.proplet_monthly_now_v1()>=((p_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'
 then raise exception 'MONTHLY_RECONCILIATION_DEADLINE_PASSED' using errcode='22023';end if;
 n:=proplet_private.rebuild_monthly_quality_v2(p_month);
 return jsonb_build_object('enabled',true,'reconciled',n);
end $$;

-- Only genuinely awarded game XP, never lifetime account totals. The first
-- receipt owns the credit; repeats/replays/transferred historical slots award 0.
create function proplet_private.monthly_other_xp_v2(p_month date)
returns table(player_id uuid,earned_xp bigint)
language sql stable security invoker set search_path='' as $$
 select pr.player_id,sum(least(greatest(r.points,0),(rc.receipt->>'awardedPoints')::integer))::bigint
 from public.puzzle_runs pr join public.result_commands rc on rc.id=pr.result_command_id and rc.player_id=pr.player_id
 join public.results r on r.player_id=pr.player_id and r.challenge_key=pr.challenge_key and r.puzzle_id=pr.puzzle_id and r.mode=pr.mode
 where pr.mode in('free','tajenka','daily_special')
  and (pr.completed_at at time zone 'Europe/Prague')::date>=p_month
  and (pr.completed_at at time zone 'Europe/Prague')::date<(p_month+interval '1 month')::date
  and pr.completed_at<=public.proplet_monthly_now_v1()
  and rc.committed_at<((p_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'
  and rc.receipt->'firstCompletion'='true'::jsonb
  and coalesce(rc.receipt->'transferredSlot','false'::jsonb)<>'true'::jsonb
  and (rc.receipt->>'awardedPoints')::integer>0 and r.points>0
 group by pr.player_id
$$;

create function public.proplet_monthly_standings_v1(p_month date) returns jsonb
language sql stable security invoker set search_path='' as $$
 with ordered as (
 select d.*,row_number() over(partition by player_id order by points desc,clean desc,hints,verified_time_ms nulls last,daily_date) n
 from public.monthly_competition_days d where month=p_month
 ), daily as (
 select player_id,sum(points) filter(where n<=20) daily_points,count(*)::integer valid_days,least(20,count(*))::integer counted_days,
 count(*) filter(where n<=20 and clean)::integer clean_count,coalesce(sum(hints) filter(where n<=20),0)::integer hint_count,
 count(*) filter(where n<=20 and verified_time_ms is null)::integer unverified_days,
 sum(verified_time_ms) filter(where n<=20) verified_time from ordered group by player_id
 ), xp as (select * from proplet_private.monthly_other_xp_v2(p_month)),
 totals as (
 select coalesce(d.player_id,x.player_id) player_id,coalesce(daily_points,0) daily_points,
 least(500,round(coalesce(earned_xp,0)::numeric/12,1)) other_points,coalesce(earned_xp,0) earned_xp,
 coalesce(valid_days,0) valid_days,coalesce(counted_days,0) counted_days,coalesce(clean_count,0) clean_count,
 coalesce(hint_count,0) hint_count,coalesce(unverified_days,0) unverified_days,
 case when coalesce(unverified_days,0)=0 then coalesce(verified_time,0) end verified_time
 from daily d full join xp x using(player_id)
 ), qualities as (select *,daily_points+other_points points from totals),
 ranked as (
 select q.*,rank() over(order by points desc,daily_points desc,clean_count desc,hint_count,verified_time nulls last)::integer quality_rank,
 count(*) over(partition by points,daily_points,clean_count,hint_count,verified_time) equal_count,
 row_number() over(order by points desc,daily_points desc,clean_count desc,hint_count,verified_time nulls last,
 md5(coalesce((select seed::text from proplet_private.monthly_draws where month=p_month),'')||q.player_id::text))::integer drawn_rank,
 exists(select 1 from proplet_private.monthly_draws where month=p_month) drawn from qualities q
 ), explained as (
 select r.*,coalesce(
 case when lag(points) over w=points then lag(to_jsonb(r)) over w end,
 case when lead(points) over w=points then lead(to_jsonb(r)) over w end,
 lag(to_jsonb(r)) over w,lead(to_jsonb(r)) over w) competitor from ranked r
 window w as(order by case when drawn then drawn_rank else quality_rank end,player_id)
 )
 select coalesce(jsonb_agg(jsonb_build_object('playerId',player_id,'points',points,
 'rank',case when drawn then drawn_rank else quality_rank end,'dailyPoints',daily_points,'otherPoints',other_points,
 'otherEarnedXp',earned_xp,'otherCreditedXp',least(6000,earned_xp),'validDays',valid_days,'countedDays',counted_days,
 'cleanCount',clean_count,'hintCount',hint_count,'verifiedTimeMs',verified_time,'unverifiedDays',unverified_days,
 'drawPending',not drawn and equal_count>1,'tieBreakReason',case
 when equal_count>1 then case when drawn then 'draw' else 'pendingDraw' end
 when competitor is null or points is distinct from (competitor->>'points')::numeric then 'points'
 when daily_points is distinct from (competitor->>'daily_points')::numeric then 'dailyPoints'
 when clean_count is distinct from (competitor->>'clean_count')::integer then 'cleanCount'
 when hint_count is distinct from (competitor->>'hint_count')::integer then 'hintCount'
 else 'verifiedTime' end)
 order by case when drawn then drawn_rank else quality_rank end,player_id),'[]'::jsonb) from explained
$$;

create function public.proplet_finalize_monthly_competition_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.monthly_competition_settings;v_now timestamptz;m date;v_close timestamptz;rows jsonb;n integer:=0;
begin
 select * into cfg from public.monthly_competition_settings where singleton;
 if cfg.scoring_version=1 then return public.proplet_finalize_monthly_competition_basic_v1();end if;
 if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null then return jsonb_build_object('enabled',false,'finalized',0);end if;
 v_now:=public.proplet_monthly_now_v1();
 for m in select d::date from generate_series(cfg.launch_month::timestamp,date_trunc('month',v_now at time zone 'Europe/Prague'),interval '1 month') d
 where not exists(select 1 from public.monthly_competition_rounds r where r.month=d::date)
 and ((d+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'<=v_now order by d limit 12 loop
 perform pg_advisory_xact_lock(hashtextextended('monthly:'||m::text,8811));
 if exists(select 1 from public.monthly_competition_rounds where month=m) then continue;end if;
 v_close:=((m+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours';
 perform proplet_private.rebuild_monthly_quality_v2(m);
 insert into proplet_private.monthly_draws(month) values(m) on conflict(month) do nothing;
 rows:=public.proplet_monthly_standings_v1(m);
 insert into public.monthly_competition_rounds(month,closes_at,finalized_at,standings,scoring_version) values(m,v_close,v_now,rows,2);
 insert into public.monthly_competition_badges(month,player_id,rank,points,shared,awarded_at)
 select m,(s->>'playerId')::uuid,(s->>'rank')::integer,(s->>'points')::numeric,false,v_now from jsonb_array_elements(rows) s where (s->>'rank')::int<=3;
 n:=n+1;
 end loop;
 return jsonb_build_object('enabled',true,'finalized',n);
end $$;

-- Keep historical closed-month scoring and correction behavior versioned.
alter function public.proplet_monthly_standings_v1(date) rename to proplet_monthly_standings_quality_v2;
create function public.proplet_monthly_standings_v1(p_month date) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from public.monthly_competition_rounds where month=p_month and scoring_version=1)
 or (not exists(select 1 from public.monthly_competition_rounds where month=p_month) and (select scoring_version=1 from public.monthly_competition_settings where singleton))
 then public.proplet_monthly_standings_basic_v1(p_month) else public.proplet_monthly_standings_quality_v2(p_month) end
$$;

create function proplet_private.correct_monthly_competition_v1(
 p_month date,p_player_id uuid,p_day date,p_expected_revision integer,p_idempotency_key text,p_operator_ref text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare rd public.monthly_competition_rounds; existing proplet_private.monthly_corrections;req jsonb;
 old_day jsonb;new_day jsonb;old_badges jsonb;new_badges jsonb;rows jsonb;receipt jsonb;aid uuid:=gen_random_uuid();
begin
 if p_month is null or extract(day from p_month)<>1 or p_day is null or date_trunc('month',p_day)::date<>p_month
 or p_player_id is null or p_expected_revision is null or p_expected_revision<1
 or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 160
 or p_operator_ref is null or length(btrim(p_operator_ref)) not between 3 and 160
 or p_reason is null or length(btrim(p_reason)) not between 12 and 2000 then
 raise exception 'MONTHLY_CORRECTION_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('monthly:'||p_month::text,8811));
 select * into rd from public.monthly_competition_rounds where month=p_month for update;
 if not found then raise exception 'MONTHLY_ROUND_NOT_CLOSED' using errcode='22023';end if;
 if rd.scoring_version=1 then return proplet_private.correct_monthly_competition_basic_v1(p_month,p_player_id,p_day,p_expected_revision,p_idempotency_key,p_operator_ref,p_reason);end if;
 req:=jsonb_build_object('month',p_month,'playerId',p_player_id,'day',p_day,'expectedRevision',p_expected_revision,
 'idempotencyKey',p_idempotency_key,'operatorRef',p_operator_ref,'reason',p_reason);
 select * into existing from proplet_private.monthly_corrections where month=p_month and idempotency_key=p_idempotency_key;
 if found then
 if existing.request<>req then raise exception 'MONTHLY_CORRECTION_IDEMPOTENCY_CONFLICT' using errcode='22023';end if;
 return existing.receipt;end if;
 if rd.revision<>p_expected_revision then raise exception 'MONTHLY_CORRECTION_REVISION_CONFLICT' using errcode='40001';end if;
 if not exists(select 1 from public.players where id=p_player_id) then raise exception 'MONTHLY_CORRECTION_PLAYER_NOT_FOUND' using errcode='22023';end if;
 select to_jsonb(d) into old_day from public.monthly_competition_days d where player_id=p_player_id and daily_date=p_day;
 select coalesce(jsonb_agg(to_jsonb(b) order by player_id),'[]'::jsonb) into old_badges from public.monthly_competition_badges b where month=p_month;
 -- Every accepted cohort is recomputed, so removing one timed result adjusts
 -- its peers too. Seed is preserved; audit contains both complete snapshots.
 perform proplet_private.rebuild_monthly_quality_v2(p_month);
 select to_jsonb(d) into new_day from public.monthly_competition_days d where player_id=p_player_id and daily_date=p_day;
 rows:=public.proplet_monthly_standings_v1(p_month);
 update public.monthly_competition_rounds set standings=rows,revision=revision+1 where month=p_month;
 delete from public.monthly_competition_badges where month=p_month;
 insert into public.monthly_competition_badges(month,player_id,rank,points,shared)
 select p_month,(s->>'playerId')::uuid,(s->>'rank')::int,(s->>'points')::numeric,false
 from jsonb_array_elements(rows) s where (s->>'rank')::int<=3;
 select coalesce(jsonb_agg(to_jsonb(b) order by player_id),'[]'::jsonb) into new_badges from public.monthly_competition_badges b where month=p_month;
 receipt:=jsonb_build_object('auditId',aid,'month',p_month,'previousRevision',rd.revision,'revision',rd.revision+1,
 'eligible',new_day is not null,'dayPoints',coalesce((new_day->>'points')::numeric,0),
 'participantCount',jsonb_array_length(rows),'badgeCount',jsonb_array_length(new_badges),'scoringVersion',2,
 'drawSeed',(select seed from proplet_private.monthly_draws where month=p_month));
 insert into proplet_private.monthly_corrections(id,month,idempotency_key,request,operator_ref,reason,previous_revision,revision,
 old_day,new_day,old_standings,new_standings,old_badges,new_badges,receipt)
 values(aid,p_month,p_idempotency_key,req,p_operator_ref,p_reason,rd.revision,rd.revision+1,
 old_day,new_day,rd.standings,rows,old_badges,new_badges,receipt);
 return receipt;
end $$;

alter function public.proplet_monthly_state_v1(uuid,date) rename to proplet_monthly_state_previous_v1;
create function public.proplet_monthly_state_v1(p_player_id uuid default null,p_month date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare s jsonb;m date;rd public.monthly_competition_rounds;days jsonb;mine jsonb;
begin
 s:=public.proplet_monthly_state_previous_v1(p_player_id,p_month);
 if not coalesce((s->>'enabled')::boolean,false) then return s;end if;
 m:=(s->>'month')::date;
 select * into rd from public.monthly_competition_rounds where month=m;
 if (found and rd.scoring_version=1) or (rd.month is null and (select scoring_version=1 from public.monthly_competition_settings where singleton)) then return s||jsonb_build_object('scoringVersion',1,'rulesVersion','monthly-basic-v1');end if;
 with ordered as (
 select d.*,row_number() over(order by points desc,clean desc,hints,verified_time_ms nulls last,daily_date) n
 from public.monthly_competition_days d where month=m and player_id=p_player_id
 ) select coalesce(jsonb_agg(jsonb_build_object('date',daily_date,'points',points,'clean',clean,'hints',hints,
 'counted',n<=20,'verifiedTimeMs',verified_time_ms,'completionPoints',completion_points,'cleanPoints',clean_points,
 'hintPoints',hint_points,'speedPoints',speed_points,'provisional',rd.month is null) order by daily_date),'[]'::jsonb) into days from ordered;
 select r into mine from jsonb_array_elements(s->'standings') r where r->>'playerId'=p_player_id::text;
 if p_player_id is not null then
 mine:=coalesce(mine,jsonb_build_object('playerId',p_player_id,'rank',null,'points',0,'dailyPoints',0,'otherPoints',0,
 'otherEarnedXp',0,'otherCreditedXp',0,'validDays',0,'countedDays',0,'cleanCount',0,'hintCount',0,'unverifiedDays',0,
 'verifiedTimeMs',null,'drawPending',false,'tieBreakReason',null))||jsonb_build_object('days',days);end if;
 return s||jsonb_build_object('me',mine,'scoringVersion',2,'rulesVersion','monthly-quality-v2',
 'endsAt',((s->>'endDate')::date::timestamp at time zone 'Europe/Prague'),'scoring',jsonb_build_object('dailyMax',2000,'otherMax',500,'totalMax',2500,'dailyLimit',20,'xpPerPoint',12,'otherXpCap',6000));
end $$;

-- Only explicit public boundaries may mutate competition state. Private rebuild
-- has no runtime execute grant, including no unaudited closed-month bypass.
revoke all on function proplet_private.monthly_daily_evidence_v2(date),proplet_private.rebuild_monthly_quality_v2(date,date),
 proplet_private.monthly_other_xp_v2(date) from public,anon,authenticated,service_role;
grant execute on function proplet_private.monthly_other_xp_v2(date) to service_role;
revoke all on function public.proplet_monthly_standings_quality_v2(date),public.proplet_monthly_standings_v1(date),
 public.proplet_finalize_monthly_competition_v1(),public.proplet_monthly_state_v1(uuid,date),
 proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.proplet_monthly_standings_quality_v2(date),public.proplet_monthly_standings_v1(date),
 public.proplet_finalize_monthly_competition_v1(),public.proplet_monthly_state_v1(uuid,date),
 proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text) to service_role;
-- The migration is dormant: production keeps v1 until the new client/backend
-- is deployed and this explicit activation boundary is invoked. It preserves
-- gameplay XP, production enablement, closed rounds and release-news receipts.
create function public.proplet_activate_monthly_quality_v2() returns jsonb
language plpgsql security definer set search_path='' as $$
declare m date;cfg public.monthly_competition_settings;n integer:=0;
begin
 select * into cfg from public.monthly_competition_settings where singleton for update;
 update public.monthly_competition_settings set scoring_version=2 where singleton;
 if cfg.enabled and cfg.rules_approved then
 for m in select d::date from generate_series(cfg.launch_month::timestamp,date_trunc('month',public.proplet_monthly_now_v1() at time zone 'Europe/Prague'),interval '1 month') d
 where not exists(select 1 from public.monthly_competition_rounds where month=d::date)
 and ((d+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'>public.proplet_monthly_now_v1() loop
 perform public.proplet_reconcile_monthly_competition_v1(m);n:=n+1;
 end loop;end if;
 return jsonb_build_object('scoringVersion',2,'reconciledMonths',n,'enabled',cfg.enabled);
end $$;
revoke all on function public.proplet_activate_monthly_quality_v2(),public.proplet_monthly_refresh_day_v1(uuid,date),
 public.proplet_reconcile_monthly_competition_v1(date) from public,anon,authenticated;
grant execute on function public.proplet_activate_monthly_quality_v2(),public.proplet_monthly_refresh_day_v1(uuid,date),
 public.proplet_reconcile_monthly_competition_v1(date) to service_role;
revoke all on function public.proplet_monthly_refresh_day_basic_v1(uuid,date),public.proplet_reconcile_monthly_competition_basic_v1(date),
 public.proplet_finalize_monthly_competition_basic_v1(),proplet_private.correct_monthly_competition_basic_v1(date,uuid,date,integer,text,text,text)
 from public,anon,authenticated,service_role;
commit;
