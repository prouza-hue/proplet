-- Monthly individual competition. Prepared only; production activation is separate.
-- No XP/account_rewards changes. No cron installed by this migration.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table public.monthly_competition_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  rules_approved boolean not null default false,
  launch_month date not null default date '2026-11-01' check(extract(day from launch_month)=1),
  -- NULL intentionally blocks scoring until the outstanding fairness decision.
  late_sync_policy text check(late_sync_policy in ('month-close','review-close')),
  isolated boolean not null default false,
  preview_now timestamptz,
  check(preview_now is null or isolated)
);
insert into public.monthly_competition_settings(singleton) values(true);

create table public.monthly_competition_days (
  month date not null,
  player_id uuid not null references public.players(id) on delete cascade,
  daily_date date not null,
  result_id uuid not null,
  command_id uuid not null,
  run_id uuid not null,
  points integer not null check(points in (100,120)),
  confirmed_at timestamptz not null,
  primary key(player_id,daily_date),
  check(month=date_trunc('month',daily_date)::date)
);
create index monthly_competition_days_month on public.monthly_competition_days(month,player_id,points desc);

create table public.monthly_competition_rounds (
  month date primary key check(extract(day from month)=1),
  closes_at timestamptz not null,
  finalized_at timestamptz not null,
  standings jsonb not null check(jsonb_typeof(standings)='array')
);
create table public.monthly_competition_badges (
  month date not null references public.monthly_competition_rounds(month),
  player_id uuid not null references public.players(id) on delete cascade,
  rank integer not null check(rank between 1 and 3),
  points integer not null check(points between 100 and 2400),
  shared boolean not null,
  awarded_at timestamptz not null default now(),
  primary key(month,player_id)
);

alter table public.monthly_competition_settings enable row level security;
alter table public.monthly_competition_days enable row level security;
alter table public.monthly_competition_rounds enable row level security;
alter table public.monthly_competition_badges enable row level security;
revoke all on public.monthly_competition_settings,public.monthly_competition_days,
  public.monthly_competition_rounds,public.monthly_competition_badges from public,anon,authenticated,service_role;
grant select on public.monthly_competition_settings,public.monthly_competition_days,
  public.monthly_competition_rounds,public.monthly_competition_badges to service_role;
grant insert,update,delete on public.monthly_competition_days to service_role;
grant insert on public.monthly_competition_rounds,public.monthly_competition_badges to service_role;

create function public.proplet_monthly_now_v1() returns timestamptz
language sql stable security invoker set search_path='' as $$
  select case when isolated then coalesce(preview_now,now()) else now() end
  from public.monthly_competition_settings where singleton
$$;

create function public.proplet_monthly_standings_v1(p_month date) returns jsonb
language sql stable security invoker set search_path='' as $$
  with ordered as (
    select d.*,row_number() over(partition by player_id order by points desc,daily_date) as n
    from public.monthly_competition_days d where month=p_month
  ), totals as (
    select player_id,sum(points) filter(where n<=20)::integer as points,
      count(*)::integer as valid_days,least(20,count(*))::integer as counted_days
    from ordered group by player_id
  ), ranked as (
    select *,rank() over(order by points desc)::integer as place from totals
  )
  select coalesce(jsonb_agg(jsonb_build_object('playerId',player_id,'points',points,
    'rank',place,'validDays',valid_days,'countedDays',counted_days) order by points desc,player_id),'[]'::jsonb)
  from ranked
$$;

-- Re-evaluate one authoritative result. The gameplay transaction calls this only
-- after its durable command receipt exists. A result/analytic/client total alone
-- is insufficient. Replacements keep one ledger row and use the current official
-- first completion, never the fastest repeat.
create function public.proplet_monthly_refresh_day_v1(p_player uuid,p_day date) returns void
language plpgsql security invoker set search_path='' as $$
declare
  cfg public.monthly_competition_settings;
  v_month date:=date_trunc('month',p_day)::date;
  v_end timestamptz:=((date_trunc('month',p_day)+interval '1 month')::timestamp at time zone 'Europe/Prague');
  v_now timestamptz;
  candidate record;
begin
  select * into cfg from public.monthly_competition_settings where singleton;
  if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null or p_day is null
    or v_month<cfg.launch_month then return; end if;
  v_now:=public.proplet_monthly_now_v1();
  perform pg_advisory_xact_lock(hashtextextended('monthly:'||v_month::text,8811));
  if exists(select 1 from public.monthly_competition_rounds where month=v_month)
    or v_now>=v_end+interval '48 hours' then return; end if;

  select r.id as result_id,r.player_id,r.daily_date,pr.id as run_id,rc.id as command_id,
    rc.committed_at,case when coalesce(r.hints_used,pr.hints_used)=0
      and coalesce(r.max_hint_level,pr.max_hint_level)=0 then 120 else 100 end as points
  into candidate
  from public.results r
  join public.puzzle_runs pr on pr.player_id=r.player_id and pr.puzzle_id=r.puzzle_id
    and pr.challenge_key=r.challenge_key and pr.mode='daily' and pr.completed_at=r.completed_at
  join public.result_commands rc on rc.id=pr.result_command_id and rc.player_id=r.player_id
    and rc.receipt is not null and rc.committed_at is not null
  where r.player_id=p_player and r.daily_date=p_day and r.mode='daily'
    and r.challenge_key='daily:'||p_day::text and pr.challenge_key='daily:'||p_day::text
    and (r.completed_at at time zone 'Europe/Prague')::date=p_day
    and r.completed_at<=v_now
    and rc.committed_at < case cfg.late_sync_policy when 'month-close' then v_end else v_end+interval '48 hours' end
  order by rc.committed_at,pr.id limit 1;
  if candidate.result_id is null then
    delete from public.monthly_competition_days where player_id=p_player and daily_date=p_day;
  else
    insert into public.monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at)
    values(v_month,p_player,p_day,candidate.result_id,candidate.command_id,candidate.run_id,candidate.points,candidate.committed_at)
    on conflict(player_id,daily_date) do update set result_id=excluded.result_id,
      command_id=excluded.command_id,run_id=excluded.run_id,points=excluded.points,confirmed_at=excluded.confirmed_at;
  end if;
end $$;

-- Explicit activation/recovery step. Never invent historical state after the
-- review deadline: the current official result may then contain a later edit.
create function public.proplet_reconcile_monthly_competition_v1(p_month date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.monthly_competition_settings; item record; n integer:=0;
begin
  select * into cfg from public.monthly_competition_settings where singleton;
  if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null then
    return jsonb_build_object('enabled',false,'reconciled',0); end if;
  if p_month is null or extract(day from p_month)<>1 or p_month<cfg.launch_month then
    raise exception 'MONTHLY_MONTH_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('monthly:'||p_month::text,8811));
  if exists(select 1 from public.monthly_competition_rounds where month=p_month)
    or public.proplet_monthly_now_v1()>=((p_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours' then
    raise exception 'MONTHLY_RECONCILIATION_DEADLINE_PASSED' using errcode='22023'; end if;
  for item in select player_id,daily_date from public.results
    where mode='daily' and daily_date>=p_month and daily_date<(p_month+interval '1 month')::date
    union select player_id,daily_date from public.monthly_competition_days where month=p_month
  loop
    perform public.proplet_monthly_refresh_day_v1(item.player_id,item.daily_date);
    n:=n+1;
  end loop;
  return jsonb_build_object('enabled',true,'reconciled',n);
end $$;

create function public.proplet_monthly_result_changed_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op<>'INSERT' and old.mode='daily' then
    perform public.proplet_monthly_refresh_day_v1(old.player_id,old.daily_date);
  end if;
  if tg_op<>'DELETE' and new.mode='daily' then
    perform public.proplet_monthly_refresh_day_v1(new.player_id,new.daily_date);
  end if;
  return null;
end $$;
create trigger monthly_result_changed after insert or update or delete on public.results
  for each row execute function public.proplet_monthly_result_changed_v1();

create function public.proplet_monthly_command_committed_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare item record;
begin
  for item in select distinct player_id,substring(challenge_key from 7)::date as daily_date
    from public.puzzle_runs where result_command_id=new.id and mode='daily'
      and challenge_key ~ '^daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  loop
    perform public.proplet_monthly_refresh_day_v1(item.player_id,item.daily_date);
  end loop;
  return null;
end $$;
create trigger monthly_command_committed after update of receipt,committed_at on public.result_commands
  for each row execute function public.proplet_monthly_command_committed_v1();

create function public.proplet_finalize_monthly_competition_v1() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.monthly_competition_settings; v_now timestamptz;
  v_month date; v_close timestamptz; v_standings jsonb; n integer:=0;
begin
  select * into cfg from public.monthly_competition_settings where singleton;
  if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null then
    return jsonb_build_object('enabled',false,'finalized',0); end if;
  v_now:=public.proplet_monthly_now_v1();
  for v_month in select d::date from generate_series(cfg.launch_month::timestamp,
    date_trunc('month',v_now at time zone 'Europe/Prague'),interval '1 month') d
    where not exists(select 1 from public.monthly_competition_rounds r where r.month=d::date)
      and ((d+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours'<=v_now
    order by d limit 12
  loop
    perform pg_advisory_xact_lock(hashtextextended('monthly:'||v_month::text,8811));
    if exists(select 1 from public.monthly_competition_rounds where month=v_month) then continue; end if;
    v_close:=((v_month+interval '1 month') at time zone 'Europe/Prague')+interval '48 hours';
    v_standings:=public.proplet_monthly_standings_v1(v_month);
    insert into public.monthly_competition_rounds(month,closes_at,finalized_at,standings)
      values(v_month,v_close,v_now,v_standings);
    insert into public.monthly_competition_badges(month,player_id,rank,points,shared,awarded_at)
      select v_month,(s->>'playerId')::uuid,(s->>'rank')::integer,(s->>'points')::integer,
        (select count(*)>1 from jsonb_array_elements(v_standings) other where other->>'rank'=s->>'rank'),v_now
      from jsonb_array_elements(v_standings) s where (s->>'rank')::integer<=3
      on conflict(month,player_id) do nothing;
    n:=n+1;
  end loop;
  return jsonb_build_object('enabled',true,'finalized',n);
end $$;

create function public.proplet_monthly_state_v1(p_player_id uuid default null,p_month date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare cfg public.monthly_competition_settings; v_now timestamptz; v_month date; v_end date;
  v_close timestamptz; v_rows jsonb; v_me jsonb; v_days jsonb; v_previous jsonb; v_badges jsonb; v_status text;
begin
  select * into cfg from public.monthly_competition_settings where singleton;
  if not cfg.enabled or not cfg.rules_approved or cfg.late_sync_policy is null then
    return jsonb_build_object('enabled',false,'reason',case when cfg.enabled then 'rules-pending' else 'disabled' end); end if;
  v_now:=public.proplet_monthly_now_v1();
  v_month:=coalesce(p_month,greatest(cfg.launch_month,date_trunc('month',v_now at time zone 'Europe/Prague')::date));
  if extract(day from v_month)<>1 or v_month<cfg.launch_month
    or v_month>(date_trunc('month',v_now at time zone 'Europe/Prague')+interval '1 month')::date then
    raise exception 'MONTHLY_MONTH_INVALID' using errcode='22023'; end if;
  v_end:=(v_month+interval '1 month')::date;
  v_close:=(v_end::timestamp at time zone 'Europe/Prague')+interval '48 hours';
  select standings into v_rows from public.monthly_competition_rounds where month=v_month;
  if v_rows is not null then v_status:='closed';
  elsif v_now<(v_month::timestamp at time zone 'Europe/Prague') then v_status:='upcoming';
  elsif v_now<(v_end::timestamp at time zone 'Europe/Prague') then v_status:='open';
  else v_status:='provisional'; end if;
  v_rows:=coalesce(v_rows,public.proplet_monthly_standings_v1(v_month));
  select s into v_me from jsonb_array_elements(v_rows) s where s->>'playerId'=p_player_id::text;
  with ordered as (
    select daily_date,points,row_number() over(order by points desc,daily_date) as n
    from public.monthly_competition_days where month=v_month and player_id=p_player_id
  ) select coalesce(jsonb_agg(jsonb_build_object('date',daily_date,'points',points,'clean',points=120,'counted',n<=20)
    order by daily_date),'[]'::jsonb) into v_days from ordered;
  if p_player_id is not null then
    v_me:=coalesce(v_me,jsonb_build_object('playerId',p_player_id,'rank',null,'points',0,'validDays',0,'countedDays',0))
      ||jsonb_build_object('days',v_days); end if;
  select coalesce(jsonb_agg(s),'[]'::jsonb) into v_previous from public.monthly_competition_rounds r,
    lateral jsonb_array_elements(r.standings) s where r.month=(v_month-interval '1 month')::date and (s->>'rank')::int<=3;
  select coalesce(jsonb_agg(jsonb_build_object('month',month,'rank',rank,'points',points,'shared',shared) order by month desc),'[]'::jsonb)
    into v_badges from public.monthly_competition_badges where player_id=p_player_id;
  return jsonb_build_object('enabled',true,'month',v_month,'startDate',v_month,'endDate',v_end,
    'closesAt',v_close,'timezone','Europe/Prague','status',v_status,'standings',v_rows,
    'me',v_me,'previousPodium',v_previous,'badges',v_badges,'isolated',cfg.isolated);
end $$;

revoke all on function public.proplet_monthly_now_v1(),public.proplet_monthly_standings_v1(date),
  public.proplet_monthly_refresh_day_v1(uuid,date),public.proplet_monthly_result_changed_v1(),
  public.proplet_monthly_command_committed_v1(),public.proplet_finalize_monthly_competition_v1(),
  public.proplet_monthly_state_v1(uuid,date),public.proplet_reconcile_monthly_competition_v1(date) from public,anon,authenticated;
grant execute on function public.proplet_monthly_now_v1(),public.proplet_monthly_standings_v1(date),
  public.proplet_monthly_refresh_day_v1(uuid,date),public.proplet_monthly_result_changed_v1(),
  public.proplet_monthly_command_committed_v1(),public.proplet_finalize_monthly_competition_v1(),
  public.proplet_monthly_state_v1(uuid,date),public.proplet_reconcile_monthly_competition_v1(date) to service_role;
commit;
