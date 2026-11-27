-- Weekly Spojky are game XP. Credit competitions on the server grant date,
-- including when an offline or previously completed board is claimed later.
begin;
set local lock_timeout = '5s';

alter table public.account_rewards add column spojky_team_code text;

create function proplet_private.snapshot_spojky_team_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
    select upper(btrim(p.family_code)) into new.spojky_team_code
    from public.players p
    where p.id = new.player_id and nullif(btrim(p.family_code), '') is not null
      and left(upper(btrim(p.family_code)), 5) <> 'SOLO_'
      and (p.team_joined_at is null or p.team_joined_at <= new.granted_at);
    return new;
end;
$$;
revoke all on function proplet_private.snapshot_spojky_team_v1() from public, anon, authenticated;
grant execute on function proplet_private.snapshot_spojky_team_v1() to service_role;

create trigger snapshot_spojky_team before insert on public.account_rewards
for each row when (new.reward_type = 'spojky')
execute function proplet_private.snapshot_spojky_team_v1();

create index account_rewards_spojky_granted_idx on public.account_rewards(granted_at)
where reward_type = 'spojky';

CREATE OR REPLACE FUNCTION proplet_private.monthly_other_xp_v2(p_month date)
 RETURNS TABLE(player_id uuid, earned_xp bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select credits.player_id, sum(credits.xp)::bigint
 from (
   select pr.player_id,least(greatest(r.points,0),(rc.receipt->>'awardedPoints')::integer) as xp
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
   union all
   select a.player_id, a.points as xp
   from public.account_rewards a
   where a.reward_type = 'spojky'
     and a.granted_at >= (p_month::timestamp at time zone 'Europe/Prague')
     and a.granted_at < ((p_month + interval '1 month') at time zone 'Europe/Prague')
     and a.granted_at <= public.proplet_monthly_now_v1()
 ) credits
 group by credits.player_id
$function$;

CREATE OR REPLACE FUNCTION public.proplet_rankings_xp_aggregate(p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(row_kind text, entity_id text, period_xp bigint, lifetime_xp bigint, badge_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with result_points as (
    select
      r.player_id,
      coalesce(sum(r.points), 0)::bigint as lifetime_xp,
      coalesce(
        sum(r.points) filter (
          where r.calm_mode = false
            and (p_period_start is null or r.completed_at >= p_period_start)
        ),
        0
      )::bigint as period_xp
    from public.results r
    group by r.player_id
  ),
  reward_points as (
    select
      a.player_id,
      coalesce(sum(greatest(a.points, 0)), 0)::bigint as lifetime_xp,
      coalesce(
        sum(greatest(a.points, 0)) filter (
          where p_period_start is null or (a.granted_at >= p_period_start and a.reward_key not like 'referral_v1:%')
        ),
        0
      )::bigint as period_xp
    from public.account_rewards a
    group by a.player_id
  ),
  daily_dates as (
    select r.player_id, r.daily_date as played_date
    from public.results r
    where r.mode = 'daily' and r.daily_date is not null
    union
    select s.player_id, s.missed_date as played_date
    from public.streak_rescues s
    where s.status = 'passed'
  ),
  streak_islands as (
    select
      d.player_id,
      d.played_date - (row_number() over (
        partition by d.player_id order by d.played_date
      ))::integer as island
    from daily_dates d
  ),
  streak_lengths as (
    select i.player_id, count(*)::integer as streak_length
    from streak_islands i
    group by i.player_id, i.island
  ),
  longest_streaks as (
    select s.player_id, max(s.streak_length)::integer as longest_streak
    from streak_lengths s
    group by s.player_id
  ),
  badge_counts as (
    select
      s.player_id,
      (
        (s.longest_streak >= 1)::integer
        + (s.longest_streak >= 3)::integer
        + (s.longest_streak >= 5)::integer
        + (s.longest_streak >= 7)::integer
        + (s.longest_streak >= 10)::integer
        + (s.longest_streak >= 14)::integer
        + (s.longest_streak >= 21)::integer
        + (s.longest_streak >= 30)::integer
        + (s.longest_streak >= 50)::integer
        + (s.longest_streak >= 100)::integer
      )::integer as badge_count
    from longest_streaks s
  ),
  player_totals as (
    select
      coalesce(r.player_id, a.player_id) as player_id,
      (coalesce(r.period_xp, 0) + coalesce(a.period_xp, 0))::bigint as period_xp,
      (coalesce(r.lifetime_xp, 0) + coalesce(a.lifetime_xp, 0))::bigint as lifetime_xp
    from result_points r
    full join reward_points a on a.player_id = r.player_id
  ),
  attributed_team_results as (
    select
      r.points,
      case
        when nullif(btrim(r.team_code_at_completion), '') is not null
          and upper(btrim(r.team_code_at_completion)) not like 'SOLO\_%' escape '\'
          then upper(btrim(r.team_code_at_completion))
        when nullif(btrim(p.family_code), '') is not null
          and not (
            p.team_joined_at is null
            and upper(btrim(p.family_code)) like 'SOLO\_%' escape '\'
          )
          and (p.team_joined_at is null or r.completed_at >= p.team_joined_at)
          then upper(btrim(p.family_code))
        else null
      end as team_code
    from public.results r
    join public.players p on p.id = r.player_id
    where r.calm_mode = false
      and (p_period_start is null or r.completed_at >= p_period_start)
    union all
    select a.points, a.spojky_team_code
    from public.account_rewards a
    where a.reward_type = 'spojky' and a.spojky_team_code is not null
      and (p_period_start is null or a.granted_at >= p_period_start)
  ),
  team_totals as (
    select t.team_code, sum(t.points)::bigint as period_xp
    from attributed_team_results t
    where t.team_code is not null
    group by t.team_code
  )
  select
    'player'::text as row_kind,
    p.player_id::text as entity_id,
    p.period_xp,
    p.lifetime_xp,
    coalesce(b.badge_count, 0)::integer as badge_count
  from player_totals p
  left join badge_counts b on b.player_id = p.player_id

  union all

  select
    'team'::text as row_kind,
    t.team_code::text as entity_id,
    t.period_xp,
    0::bigint as lifetime_xp,
    0::integer as badge_count
  from team_totals t;
$function$;

CREATE OR REPLACE FUNCTION public.proplet_finalize_team_victories_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_launch date;
  v_week date;
  v_current date := date_trunc('week', now() at time zone 'Europe/Prague')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_standings jsonb;
  v_top bigint;
  v_ties integer;
  v_finalized integer := 0;
  v_award record;
begin
  select launch_date into v_launch from public.team_victory_settings where singleton and enabled;
  if v_launch is null then return jsonb_build_object('enabled', false, 'finalized', 0); end if;
  -- Non-blocking transaction lock: concurrent scheduler retries never double-grant.
  if not pg_try_advisory_xact_lock(873912046502::bigint) then
    return jsonb_build_object('enabled', true, 'finalized', 0, 'busy', true);
  end if;
  -- A scheduler outage can catch up at most eight complete weeks per invocation.
  for v_week in
    select d::date from generate_series(v_launch::timestamp, (v_current - 7)::timestamp, interval '7 days') d
    where not exists (select 1 from public.team_victory_rounds r where r.week_start = d::date)
      and ((d::date + 7)::timestamp at time zone 'Europe/Prague') + interval '10 minutes' <= now()
    order by d limit 8
  loop
    v_start := v_week::timestamp at time zone 'Europe/Prague';
    v_end := (v_week + 7)::timestamp at time zone 'Europe/Prague';
    -- Exact existing ranking attribution, bounded to this completed Prague week.
    with attributed as (
      select r.points,
        case
          when nullif(btrim(r.team_code_at_completion), '') is not null
            and upper(btrim(r.team_code_at_completion)) not like 'SOLO\_%' escape '\'
            then upper(btrim(r.team_code_at_completion))
          when nullif(btrim(p.family_code), '') is not null
            and not (p.team_joined_at is null and upper(btrim(p.family_code)) like 'SOLO\_%' escape '\')
            and (p.team_joined_at is null or r.completed_at >= p.team_joined_at)
            then upper(btrim(p.family_code))
          else null
        end as team_code
      from public.results r join public.players p on p.id = r.player_id
      where r.calm_mode = false and r.completed_at >= v_start and r.completed_at < v_end
      union all
      select a.points, a.spojky_team_code
      from public.account_rewards a
      where a.reward_type = 'spojky' and a.spojky_team_code is not null
        and a.granted_at >= v_start and a.granted_at < v_end
    ), totals as (
      select a.team_code, sum(a.points)::bigint as xp from attributed a
      where a.team_code is not null group by a.team_code having sum(a.points) > 0
    ), ranked as (
      select t.team_code, coalesce(nullif(l.public_name, ''), nullif(l.name, ''), t.team_code) as team_name,
        t.xp, rank() over (order by t.xp desc) as rank
      from totals t join public.leagues l on l.code = t.team_code
      where l.public_opt_in = true and (l.public_enabled_at is null or l.public_enabled_at < v_end)
    )
    select coalesce(jsonb_agg(to_jsonb(r) order by r.xp desc, r.team_code), '[]'::jsonb), max(r.xp)
      into v_standings, v_top from ranked r;

    insert into public.team_victory_rounds(week_start, week_end, standings)
      values (v_week, v_week + 7, v_standings);
    select count(*) into v_ties from jsonb_array_elements(v_standings) s
      where (s->>'xp')::bigint = v_top;
    insert into public.team_victory_awards(week_start, team_code, team_name, xp, total_gold, shared_first)
      select v_week, s->>'team_code', s->>'team_name', (s->>'xp')::bigint,
        1 + (select count(*) from public.team_victory_awards a where a.team_code = s->>'team_code'),
        v_ties > 1
      from jsonb_array_elements(v_standings) s where (s->>'xp')::bigint = v_top;
    -- Freeze eligible celebration recipients: membership just before week close.
    -- A new member may view the team's cabinet but cannot claim an old celebration.
    for v_award in select id, team_code from public.team_victory_awards where week_start = v_week loop
      insert into public.team_victory_recipients(award_id, player_id)
        select distinct v_award.id, m.player_id from public.team_memberships m
        join public.players p on p.id = m.player_id
        where upper(btrim(m.team_code)) = v_award.team_code and m.joined_at < v_end
          and (m.left_at is null or m.left_at >= v_end)
        union
        select v_award.id, p.id from public.players p
        where upper(btrim(p.family_code)) = v_award.team_code
          and p.team_joined_at is not null and p.team_joined_at < v_end
          and not exists(select 1 from public.team_memberships m where m.player_id = p.id
            and upper(btrim(m.team_code)) = v_award.team_code)
        on conflict do nothing;
    end loop;
    v_finalized := v_finalized + 1;
  end loop;
  return jsonb_build_object('enabled', true, 'finalized', v_finalized);
end;
$function$;

commit;
