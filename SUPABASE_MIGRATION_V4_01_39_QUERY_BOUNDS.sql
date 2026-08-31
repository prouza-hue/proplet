-- Proplet v4.01.39 — Sprint 09 ranking/admin query boundaries
-- Additive, service-role-only read RPCs. No ranking rules or indexes change.

begin;

create or replace function public.proplet_ranking_runs_v1(
  p_mode text,
  p_puzzle_id text,
  p_daily_date date default null
)
returns table (
  id uuid,
  player_id uuid,
  puzzle_id text,
  challenge_key text,
  mode text,
  elapsed_ms integer,
  moves integer,
  hints_used integer,
  wrong_attempts integer,
  clean_solve boolean,
  calm_mode boolean,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
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
      and (
        p_daily_date is null
        or r.challenge_key = 'daily:' || p_daily_date::text
      )
  ) ranked
  where ranked.player_run_number = 1
  order by ranked.completed_at asc, ranked.id asc;
$function$;

create or replace function public.proplet_admin_overview_v1(
  p_now timestamptz,
  p_today date,
  p_primary_daily_id text
)
returns table (payload jsonb)
language sql
stable
security invoker
set search_path = ''
as $function$
  with activity as (
    select player_id, max(activity_at) as activity_at
    from (
      select
        a.player_id,
        coalesce(a.last_activity_at, a.completed_at, a.started_at) as activity_at
      from public.puzzle_attempts a
      union all
      select r.player_id, r.completed_at from public.results r
    ) source
    where player_id is not null and activity_at is not null
    group by player_id
  ),
  version_counts as (
    select coalesce(nullif(a.app_version, ''), 'neznámá') as version, count(*)::bigint as attempts
    from public.puzzle_attempts a
    where a.started_at >= p_now - interval '30 days'
    group by coalesce(nullif(a.app_version, ''), 'neznámá')
    order by attempts desc, version asc
    limit 8
  )
  select jsonb_build_object(
    'generatedAt', p_now,
    'today', p_today,
    'players', jsonb_build_object(
      'total', (select count(*) from public.players),
      'active7', (select count(*) from activity where activity_at >= p_now - interval '7 days'),
      'active30', (select count(*) from activity where activity_at >= p_now - interval '30 days')
    ),
    'games', jsonb_build_object(
      'today', (
        select count(*) from public.puzzle_runs r
        where (r.completed_at at time zone 'Europe/Prague')::date = p_today
      ),
      'last7Days', (
        select count(*) from public.puzzle_runs r
        where r.completed_at >= p_now - interval '7 days'
      )
    ),
    'daily', jsonb_build_object(
      'todayPlayers', (
        select count(distinct r.player_id) from public.results r
        where r.mode = 'daily' and r.daily_date = p_today and r.puzzle_id = p_primary_daily_id
      ),
      'puzzleId', p_primary_daily_id
    ),
    'feedback', jsonb_build_object(
      'openWordReports', (
        select count(*) from public.puzzle_feedback f
        where f.kind = 'word' and coalesce(f.status, 'new') in ('new', 'reviewing')
      ),
      'wordReportsTotal', (select count(*) from public.puzzle_feedback f where f.kind = 'word'),
      'ratingsTotal', (select count(*) from public.puzzle_feedback f where f.kind = 'difficulty'),
      'votes', jsonb_build_object(
        '-1', (select count(*) from public.puzzle_feedback f where f.kind = 'difficulty' and f.rating = -1),
        '0', (select count(*) from public.puzzle_feedback f where f.kind = 'difficulty' and f.rating = 0),
        '1', (select count(*) from public.puzzle_feedback f where f.kind = 'difficulty' and f.rating = 1)
      )
    ),
    'teams', (select count(*) from public.leagues),
    'appVersions', coalesce((
      select jsonb_agg(jsonb_build_object('version', version, 'attempts', attempts) order by attempts desc, version asc)
      from version_counts
    ), '[]'::jsonb)
  ) as payload;
$function$;

create or replace function public.proplet_admin_users_v1(
  p_query text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  id uuid,
  name text,
  avatar text,
  family_code text,
  team text,
  created_at timestamptz,
  last_active_at timestamptz,
  app_version text,
  support_mode text,
  has_password boolean,
  points bigint,
  completed bigint,
  daily_completed bigint,
  open_word_reports bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with attempt_summary as (
    select
      a.player_id,
      max(coalesce(a.last_activity_at, a.completed_at, a.started_at)) as last_active_at,
      (array_agg(a.app_version order by a.started_at desc))[1] as app_version
    from public.puzzle_attempts a
    group by a.player_id
  ),
  result_summary as (
    select
      r.player_id,
      max(r.completed_at) as last_active_at,
      sum(r.points)::bigint as points,
      count(*)::bigint as completed,
      count(distinct r.daily_date) filter (
        where r.mode = 'daily' and r.daily_date is not null
      )::bigint as daily_completed
    from public.results r
    group by r.player_id
  ),
  report_summary as (
    select f.player_id, count(*)::bigint as open_word_reports
    from public.puzzle_feedback f
    where f.kind = 'word'
      and coalesce(f.status, 'new') in ('new', 'reviewing')
    group by f.player_id
  ),
  player_summary as (
    select
      p.id,
      p.name,
      p.avatar,
      case
        when p.team_joined_at is null and upper(btrim(p.family_code)) like 'SOLO\_%' escape '\' then null
        else upper(btrim(p.family_code))
      end as family_code,
      p.created_at,
      p.support_mode,
      (p.password_hash is not null) as has_password,
      greatest(attempts.last_active_at, results.last_active_at) as last_active_at,
      attempts.app_version,
      coalesce(results.points, 0)::bigint as points,
      coalesce(results.completed, 0)::bigint as completed,
      coalesce(results.daily_completed, 0)::bigint as daily_completed,
      coalesce(reports.open_word_reports, 0)::bigint as open_word_reports
    from public.players p
    left join attempt_summary attempts on attempts.player_id = p.id
    left join result_summary results on results.player_id = p.id
    left join report_summary reports on reports.player_id = p.id
  ),
  named as (
    select
      s.*,
      coalesce(l.name, s.family_code, 'Bez týmu') as team
    from player_summary s
    left join public.leagues l on l.code = s.family_code
  ),
  filtered as (
    select n.*
    from named n
    where nullif(btrim(p_query), '') is null
       or concat_ws(' ', n.name, n.team, n.family_code) ilike '%' || btrim(p_query) || '%'
  )
  select
    count(*) over ()::bigint as total_count,
    f.id,
    f.name,
    f.avatar,
    f.family_code,
    f.team,
    f.created_at,
    f.last_active_at,
    f.app_version,
    f.support_mode,
    f.has_password,
    f.points,
    f.completed,
    f.daily_completed,
    f.open_word_reports
  from filtered f
  order by f.last_active_at desc nulls last, f.name asc, f.id asc
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.proplet_ranking_runs_v1(text, text, date) from public, anon, authenticated;
revoke all on function public.proplet_admin_overview_v1(timestamptz, date, text) from public, anon, authenticated;
revoke all on function public.proplet_admin_users_v1(text, integer, integer) from public, anon, authenticated;
grant execute on function public.proplet_ranking_runs_v1(text, text, date) to service_role;
grant execute on function public.proplet_admin_overview_v1(timestamptz, date, text) to service_role;
grant execute on function public.proplet_admin_users_v1(text, integer, integer) to service_role;

comment on function public.proplet_ranking_runs_v1(text, text, date) is
  'Returns one first competitive run per player for one puzzle/date boundary.';
comment on function public.proplet_admin_overview_v1(timestamptz, date, text) is
  'Returns the admin overview as bounded database aggregates instead of raw tables.';
comment on function public.proplet_admin_users_v1(text, integer, integer) is
  'Returns one paginated admin user summary with database-side filtering and aggregation.';

commit;
