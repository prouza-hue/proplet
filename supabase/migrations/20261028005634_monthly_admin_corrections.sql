-- Approved 2026-10-28: publication-day completion may synchronize until the
-- 48-hour review close. This records policy, never enables the competition.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
update public.monthly_competition_settings
  set rules_approved=true,late_sync_policy='review-close';
alter table public.monthly_competition_settings alter column rules_approved set default true;
alter table public.monthly_competition_settings alter column late_sync_policy set default 'review-close';
alter table public.monthly_competition_settings add constraint monthly_approved_sync_policy
  check(late_sync_policy is not distinct from 'review-close');
alter table public.monthly_competition_rounds add column revision integer not null default 1 check(revision>=1);

create schema if not exists proplet_private;
revoke all on schema proplet_private from public,anon,authenticated;
grant usage on schema proplet_private to service_role;
create table proplet_private.monthly_corrections (
  id uuid primary key default gen_random_uuid(),
  month date not null references public.monthly_competition_rounds(month),
  idempotency_key text not null,
  request jsonb not null,
  operator_ref text not null,
  reason text not null,
  previous_revision integer not null,
  revision integer not null,
  old_day jsonb,
  new_day jsonb,
  old_standings jsonb not null,
  new_standings jsonb not null,
  old_badges jsonb not null,
  new_badges jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  database_session text not null default session_user,
  unique(month,idempotency_key),unique(month,revision),
  check(revision=previous_revision+1)
);
alter table proplet_private.monthly_corrections enable row level security;
revoke all on proplet_private.monthly_corrections from public,anon,authenticated,service_role;
grant select on proplet_private.monthly_corrections to service_role;

-- The private definer may change only the explicit closed-month correction.
-- Callers retain no direct UPDATE/DELETE rights on closed rounds or badges.
create function proplet_private.correct_monthly_competition_v1(
  p_month date,p_player_id uuid,p_day date,p_expected_revision integer,
  p_idempotency_key text,p_operator_ref text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_round public.monthly_competition_rounds;
  v_existing proplet_private.monthly_corrections;
  v_request jsonb;
  v_candidate record;
  v_old_day jsonb; v_new_day jsonb; v_standings jsonb;
  v_old_badges jsonb; v_new_badges jsonb; v_receipt jsonb;
  v_id uuid:=gen_random_uuid();
begin
  if p_month is null or extract(day from p_month)<>1 or p_day is null
    or date_trunc('month',p_day)::date<>p_month or p_player_id is null
    or p_expected_revision is null or p_expected_revision<1
    or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 160
    or p_operator_ref is null or length(btrim(p_operator_ref)) not between 3 and 160
    or p_reason is null or length(btrim(p_reason)) not between 12 and 2000 then
    raise exception 'MONTHLY_CORRECTION_INVALID' using errcode='22023'; end if;
  v_request:=jsonb_build_object('month',p_month,'playerId',p_player_id,'day',p_day,
    'expectedRevision',p_expected_revision,'idempotencyKey',p_idempotency_key,
    'operatorRef',p_operator_ref,'reason',p_reason);
  perform pg_advisory_xact_lock(hashtextextended('monthly:'||p_month::text,8811));
  select * into v_existing from proplet_private.monthly_corrections
    where month=p_month and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request<>v_request then
      raise exception 'MONTHLY_CORRECTION_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return v_existing.receipt;
  end if;
  select * into v_round from public.monthly_competition_rounds where month=p_month for update;
  if not found then raise exception 'MONTHLY_ROUND_NOT_CLOSED' using errcode='22023'; end if;
  if v_round.revision<>p_expected_revision then
    raise exception 'MONTHLY_CORRECTION_REVISION_CONFLICT' using errcode='40001'; end if;
  if not exists(select 1 from public.players where id=p_player_id) then
    raise exception 'MONTHLY_CORRECTION_PLAYER_NOT_FOUND' using errcode='22023'; end if;
  select to_jsonb(d) into v_old_day from public.monthly_competition_days d
    where player_id=p_player_id and daily_date=p_day;
  select coalesce(jsonb_agg(to_jsonb(b) order by player_id),'[]'::jsonb) into v_old_badges
    from public.monthly_competition_badges b where month=p_month;
  -- Same authoritative evidence/cutoff as ingestion. No caller-supplied score,
  -- no XP/analytics source, and no acceptance of a receipt delivered after close.
  with official as (
    select * from public.results where player_id=p_player_id and daily_date=p_day
      and mode='daily' and challenge_key='daily:'||p_day::text
  ), eligible as (
    select r.id as result_id,pr.id as run_id,rc.id as command_id,rc.committed_at,
      pr.completed_at,pr.hints_used,pr.max_hint_level,
      case when pr.completed_at=r.completed_at then 0 else 1 end as priority,
      case when pr.completed_at=r.completed_at then coalesce(r.hints_used,pr.hints_used) else pr.hints_used end as official_hints,
      case when pr.completed_at=r.completed_at then coalesce(r.max_hint_level,pr.max_hint_level) else pr.max_hint_level end as official_level
    from official r join public.puzzle_runs pr on pr.player_id=r.player_id and pr.puzzle_id=r.puzzle_id
      and pr.challenge_key=r.challenge_key and pr.mode='daily'
    join public.result_commands rc on rc.id=pr.result_command_id and rc.player_id=r.player_id
      and rc.receipt is not null and rc.committed_at is not null
    where (pr.completed_at at time zone 'Europe/Prague')::date=p_day and rc.committed_at<v_round.closes_at
      and (pr.completed_at=r.completed_at or exists(
        select 1 from public.puzzle_runs late join public.result_commands lc on lc.id=late.result_command_id
        where late.player_id=r.player_id and late.puzzle_id=r.puzzle_id and late.challenge_key=r.challenge_key
          and late.mode='daily' and late.completed_at=r.completed_at and lc.receipt is not null
          and lc.committed_at>=v_round.closes_at))
  ) select result_id,run_id,command_id,committed_at,
      case when official_hints=0 and official_level=0 then 120 else 100 end as points
    into v_candidate from eligible order by priority,completed_at,committed_at,run_id limit 1;
  if v_candidate.result_id is null then
    delete from public.monthly_competition_days where player_id=p_player_id and daily_date=p_day;
  else
    insert into public.monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at)
    values(p_month,p_player_id,p_day,v_candidate.result_id,v_candidate.command_id,v_candidate.run_id,
      v_candidate.points,v_candidate.committed_at)
    on conflict(player_id,daily_date) do update set result_id=excluded.result_id,command_id=excluded.command_id,
      run_id=excluded.run_id,points=excluded.points,confirmed_at=excluded.confirmed_at;
  end if;
  select to_jsonb(d) into v_new_day from public.monthly_competition_days d
    where player_id=p_player_id and daily_date=p_day;
  v_standings:=public.proplet_monthly_standings_v1(p_month);
  update public.monthly_competition_rounds set standings=v_standings,revision=revision+1 where month=p_month;
  delete from public.monthly_competition_badges b where month=p_month and not exists(
    select 1 from jsonb_array_elements(v_standings) s where (s->>'playerId')::uuid=b.player_id and (s->>'rank')::int<=3);
  insert into public.monthly_competition_badges(month,player_id,rank,points,shared)
    select p_month,(s->>'playerId')::uuid,(s->>'rank')::int,(s->>'points')::int,
      (select count(*)>1 from jsonb_array_elements(v_standings) x where x->>'rank'=s->>'rank')
    from jsonb_array_elements(v_standings) s where (s->>'rank')::int<=3
    on conflict(month,player_id) do update set rank=excluded.rank,points=excluded.points,shared=excluded.shared;
  select coalesce(jsonb_agg(to_jsonb(b) order by player_id),'[]'::jsonb) into v_new_badges
    from public.monthly_competition_badges b where month=p_month;
  v_receipt:=jsonb_build_object('auditId',v_id,'month',p_month,'previousRevision',v_round.revision,
    'revision',v_round.revision+1,'eligible',v_new_day is not null,'dayPoints',coalesce((v_new_day->>'points')::int,0),
    'participantCount',jsonb_array_length(v_standings),'badgeCount',jsonb_array_length(v_new_badges));
  insert into proplet_private.monthly_corrections(id,month,idempotency_key,request,operator_ref,reason,
    previous_revision,revision,old_day,new_day,old_standings,new_standings,old_badges,new_badges,receipt)
    values(v_id,p_month,p_idempotency_key,v_request,p_operator_ref,p_reason,v_round.revision,v_round.revision+1,
      v_old_day,v_new_day,v_round.standings,v_standings,v_old_badges,v_new_badges,v_receipt);
  return v_receipt;
end $$;
revoke all on function proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function proplet_private.correct_monthly_competition_v1(date,uuid,date,integer,text,text,text) to service_role;

create function public.proplet_correct_monthly_competition_v1(
  p_month date,p_player_id uuid,p_day date,p_expected_revision integer,
  p_idempotency_key text,p_operator_ref text,p_reason text
) returns jsonb language sql security invoker set search_path='' as $$
  select proplet_private.correct_monthly_competition_v1(p_month,p_player_id,p_day,p_expected_revision,
    p_idempotency_key,p_operator_ref,p_reason)
$$;
revoke all on function public.proplet_correct_monthly_competition_v1(date,uuid,date,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function public.proplet_correct_monthly_competition_v1(date,uuid,date,integer,text,text,text) to service_role;

-- Preserve the existing state contract while exposing the reviewed revision.
alter function public.proplet_monthly_state_v1(uuid,date) rename to proplet_monthly_state_base_v1;
create function public.proplet_monthly_state_v1(p_player_id uuid default null,p_month date default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select s || jsonb_build_object('revision',r.revision)
  from public.proplet_monthly_state_base_v1(p_player_id,p_month) s
  left join public.monthly_competition_rounds r on r.month=(s->>'month')::date
$$;
revoke all on function public.proplet_monthly_state_v1(uuid,date) from public,anon,authenticated;
grant execute on function public.proplet_monthly_state_v1(uuid,date) to service_role;
commit;
