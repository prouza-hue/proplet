-- Reuse the existing authoritative quota and auth checks in one HTTP call.
-- No cross-request authentication cache, reservation, or rate-limit change.
create or replace function public.proplet_request_guard_v1(
  p_scope text, p_actor_hash text, p_window_seconds integer, p_limit integer,
  p_token_hash text default null
) returns jsonb language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  quota jsonb;
  authenticated jsonb;
  policy jsonb;
begin
  select to_jsonb(r) into quota
  from public.proplet_rate_limit(p_scope, p_actor_hash, p_window_seconds, p_limit) r;
  if quota is null then raise exception 'rate limit result missing'; end if;
  if (quota->>'allowed')::boolean then
    if p_token_hash is not null then
      authenticated := public.proplet_auth_player_v1(p_token_hash);
    end if;
    if p_scope = 'play_session' then
      select jsonb_build_object('enabled', enabled, 'daily_from', daily_from)
      into policy from public.fair_play_policy where singleton is true;
    end if;
  end if;
  return quota || jsonb_build_object('auth', authenticated, 'fairPlay', policy);
end;
$function$;
revoke all on function public.proplet_request_guard_v1(text,text,integer,integer,text) from public, anon, authenticated;
grant execute on function public.proplet_request_guard_v1(text,text,integer,integer,text) to service_role;

-- IDs travel in the POST body rather than long GET URLs that inflate API logs.
create or replace function public.proplet_ranking_context_v1(
  p_player_ids uuid[] default '{}', p_team_codes text[] default '{}',
  p_include_team_members boolean default false
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $function$
declare payload jsonb;
begin
  if cardinality(p_player_ids) > 5000 or cardinality(p_team_codes) > 5000 then
    raise exception 'ranking context transfer limit exceeded';
  end if;
  with codes as (
    select distinct value as code from unnest(p_team_codes) value
    union
    select distinct upper(trim(p.family_code))
    from public.players p where p.id = any(p_player_ids)
      and p.family_code is not null and upper(trim(p.family_code)) not like 'SOLO\_%' escape '\'
  ), selected_players as (
    select p.id,p.name,p.avatar,p.family_code,p.team_joined_at,p.public_rankings
    from public.players p
    where p.id = any(p_player_ids) or (p_include_team_members and p.family_code in (select code from codes))
  ), selected_leagues as (
    select l.code,l.name,l.public_opt_in,l.public_name,l.public_enabled_at
    from public.leagues l where l.code in (select code from codes)
  )
  select jsonb_build_object(
    'players', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb) from selected_players p),
    'leagues', (select coalesce(jsonb_agg(to_jsonb(l) order by l.code), '[]'::jsonb) from selected_leagues l)
  ) into payload;
  if jsonb_array_length(payload->'players') > 5000 then
    raise exception 'ranking context transfer limit exceeded';
  end if;
  return payload;
end;
$function$;
revoke all on function public.proplet_ranking_context_v1(uuid[],text[],boolean) from public, anon, authenticated;
grant execute on function public.proplet_ranking_context_v1(uuid[],text[],boolean) to service_role;

-- One read for exact XP/streak metrics; transfer only distinct Free IDs
-- for the application's content-aware slot adapter, never full result/reward history.
create or replace function public.proplet_player_stats_v1(p_player uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $function$
with
stamp as (
  select statement_timestamp() as value,
         (statement_timestamp() at time zone 'Europe/Prague')::date as today
),
normalized_results as (select r.* from public.results r where r.player_id = p_player),
reward_stats as (
  select
    coalesce(sum(greatest(points, 0)), 0)::integer as reward_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key = 'account_creation_v1'), 0)::integer as account_bonus_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key like 'word_discovery_v1:%'), 0)::integer as word_discovery_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key <> 'account_creation_v1' and reward_key not like 'word_discovery_v1:%'), 0)::integer as other_reward_xp,
    count(*) filter (where reward_key like 'word_discovery_v1:%')::integer as word_discovery_rewards,
    count(distinct nullif(lower(trim(coalesce(reward_word, split_part(reward_key, ':', 2)))), ''))
      filter (where reward_key like 'word_discovery_v1:%')::integer as discovered_words
  from public.account_rewards
  where player_id = p_player
),
result_stats as (
  select
    coalesce(sum(points), 0)::integer as result_xp,
    count(*) filter (where mode in ('daily', 'free'))::integer as total_completed,
    count(distinct daily_date) filter (where mode = 'daily' and daily_date is not null)::integer as daily_completed,
    min(best_elapsed_ms) filter (where mode = 'daily' and daily_date is not null) as best_daily_ms,
    count(*) filter (where mode in ('daily', 'free') and clean_solve is true)::integer as clean_solves,
    count(*) filter (where mode = 'daily' and daily_date is not null and clean_solve is true)::integer as clean_daily,
    count(*) filter (where mode = 'tajenka')::integer as tajenka_completed,
    count(*) filter (where mode = 'free' and difficulty = 'mozkomor')::integer as mozkomor_completed
  from normalized_results
),
effective_dates as (
  select distinct daily_date as value
  from normalized_results
  where mode = 'daily' and daily_date is not null
  union
  select distinct missed_date
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
date_groups as (
  select value,
         value - row_number() over (order by value)::integer as island
  from effective_dates
),
streak_runs as (
  select min(value) as first_day, max(value) as last_day, count(*)::integer as days
  from date_groups
  group by island
),
streak_stats as (
  select
    coalesce(max(anchor.value - first_day + 1) filter (
      where first_day <= anchor.value and last_day >= anchor.value
    ), 0)::integer as current_streak,
    coalesce(max(days), 0)::integer as longest_streak
  from streak_runs
  cross join lateral (
    select case
      when exists (select 1 from effective_dates where value = (select today from stamp)) then (select today from stamp)
      when exists (select 1 from effective_dates where value = (select today - 1 from stamp)) then (select today - 1 from stamp)
    end as value
  ) anchor
),
rescue_stats as (
  select count(distinct missed_date)::integer as rescued_days
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
stats_payload as (
  select jsonb_build_object(
    'points', rs.result_xp + rw.reward_xp,
    'resultXp', rs.result_xp,
    'xpAuthoritative', true,
    'rewardXp', rw.reward_xp,
    'accountBonusXp', rw.account_bonus_xp,
    'wordDiscoveryXp', rw.word_discovery_xp,
    'otherRewardXp', rw.other_reward_xp,
    'wordDiscoveryRewards', rw.word_discovery_rewards,
    'discoveredWords', rw.discovered_words,
    'accountRewardsIncluded', true,
    'totalCompleted', rs.total_completed,
    'dailyCompleted', rs.daily_completed,
    'freeHistoryCompleted', (select jsonb_object_agg(d.difficulty, (select count(*) from normalized_results nr where nr.mode = 'free' and nr.difficulty = d.difficulty)) from (values ('easy'),('medium'),('hard'),('hardcore'),('mozkomor'),('mozkokalypsa')) d(difficulty)),
    'currentStreak', ss.current_streak,
    'longestStreak', ss.longest_streak,
    'bestDailyMs', rs.best_daily_ms,
    'cleanSolves', rs.clean_solves,
    'cleanDaily', rs.clean_daily,
    'tajenkaCompleted', rs.tajenka_completed,
    'mozkomorCompleted', rs.mozkomor_completed,
    'rescuedDays', rc.rescued_days,
    'gen4RewardPolicy', 'per-board',
    'gen4RewardRepairXp', 0,
    'gen4ReturnBonusXp', 0,
    'gen4ReturnBonusAwardedNow', 0,
    'freeResults', (select coalesce(jsonb_agg(jsonb_build_array(f.puzzle_id, f.difficulty) order by f.puzzle_id, f.difficulty), '[]'::jsonb) from (select distinct puzzle_id, difficulty from normalized_results where mode = 'free') f)
  ) as stats
  from result_stats rs
  cross join reward_stats rw
  cross join streak_stats ss
  cross join rescue_stats rc
)
select stats from stats_payload;
$function$;
revoke all on function public.proplet_player_stats_v1(uuid) from public, anon, authenticated;
grant execute on function public.proplet_player_stats_v1(uuid) to service_role;

