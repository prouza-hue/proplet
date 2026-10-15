-- Read-only production function definitions captured on 2026-10-15.
-- These existing routines are acceptance references, not a new migration.
CREATE OR REPLACE FUNCTION public.proplet_ranking_runs_v1(p_mode text, p_puzzle_id text, p_daily_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, player_id uuid, puzzle_id text, challenge_key text, mode text, elapsed_ms integer, moves integer, hints_used integer, wrong_attempts integer, clean_solve boolean, calm_mode boolean, completed_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    ranked.id,
    ranked.player_id,
    ranked.puzzle_id,
    ranked.challenge_key,
    ranked.mode,
    ranked.elapsed_ms,
    ranked.moves,
    ranked.hints_used,
    ranked.wrong_attempts,
    ranked.clean_solve,
    ranked.calm_mode,
    ranked.completed_at
  from (
    select
      r.*,
      row_number() over (
        partition by r.player_id
        order by r.completed_at asc, r.id asc
      ) as player_run_number
    from public.puzzle_runs r
    where r.mode = p_mode
      and r.puzzle_id = p_puzzle_id
      and r.calm_mode = false
      and r.timing_verified is distinct from false
      and (
        p_daily_date is null
        or r.challenge_key = 'daily:' || p_daily_date::text
      )
  ) ranked
  where ranked.player_run_number = 1
  order by ranked.completed_at asc, ranked.id asc;
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

