-- Owner workspace read models. Additive; no player/account/content mutation.
-- Every function uses caller privileges and is callable only by service_role.
create index if not exists admin_support_status_time on public.support_reports(status,created_at desc,id);
create index if not exists admin_support_player_time on public.support_reports(player_id,created_at desc,id);
create index if not exists admin_feedback_player_time on public.puzzle_feedback(player_id,kind,created_at desc,id);
create index if not exists admin_audit_target_time on public.admin_audit_log(target_id,created_at desc,id);
create index if not exists admin_attempt_player_time on public.puzzle_attempts(player_id,started_at desc);
create index if not exists admin_results_player_time on public.results(player_id,completed_at desc);

-- Shared with proplet_player_stats_v1 below: one authoritative XP definition.
create or replace function public.proplet_account_xp_v1(p_players uuid[])
returns table(player_id uuid,result_xp integer,reward_xp integer,account_bonus_xp integer,
  word_discovery_xp integer,other_reward_xp integer,word_discovery_rewards integer,discovered_words integer)
language sql stable security invoker set search_path='' as $$
 with ids as (select distinct unnest(p_players) id),
 rs as (select r.player_id,coalesce(sum(r.points),0)::integer xp from public.results r
        where r.player_id=any(p_players) group by r.player_id),
 rw as (select r.player_id,
  coalesce(sum(greatest(r.points,0)),0)::integer reward_xp,
  coalesce(sum(greatest(r.points,0)) filter(where reward_key='account_creation_v1'),0)::integer account_bonus_xp,
  coalesce(sum(greatest(r.points,0)) filter(where reward_key like 'word_discovery_v1:%' or reward_key like 'word_discovery_recovery_v1:%'),0)::integer word_discovery_xp,
  coalesce(sum(greatest(r.points,0)) filter(where reward_key<>'account_creation_v1' and reward_key not like 'word_discovery_v1:%' and reward_key not like 'word_discovery_recovery_v1:%'),0)::integer other_reward_xp,
  count(*) filter(where reward_key like 'word_discovery_v1:%')::integer word_discovery_rewards,
  count(distinct nullif(lower(trim(coalesce(reward_word,split_part(reward_key,':',2)))),''))
    filter(where reward_key like 'word_discovery_v1:%')::integer discovered_words
  from public.account_rewards r where r.player_id=any(p_players) group by r.player_id)
 select i.id,coalesce(rs.xp,0),coalesce(rw.reward_xp,0),coalesce(rw.account_bonus_xp,0),
  coalesce(rw.word_discovery_xp,0),coalesce(rw.other_reward_xp,0),coalesce(rw.word_discovery_rewards,0),coalesce(rw.discovered_words,0)
 from ids i left join rs on rs.player_id=i.id left join rw on rw.player_id=i.id;
$$;

create or replace function public.proplet_admin_users_page_v1(
 p_query text default null,p_offset integer default 0,p_limit integer default 60,p_sort text default 'active',p_team text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select p.id,p.name,p.avatar,p.family_code,p.team_joined_at,p.created_at,p.support_mode,
    p.password_hash is not null has_password,p.email,p.email_verified_at is not null email_verified,
    p.auth_user_id is not null google_linked,coalesce(l.name,
      case when p.team_joined_at is null and upper(p.family_code) like 'SOLO\_%' escape '\' then 'Bez týmu' else p.family_code end) team
  from public.players p left join public.leagues l on l.code=upper(trim(p.family_code))
  where (p_team is null or (upper(trim(p.family_code))=p_team and p.team_joined_at is not null))
    and (nullif(trim(p_query),'') is null or p.id::text=lower(p_query)
      or concat_ws(' ',p.name,p.family_code,l.name) ilike '%'||p_query||'%')
 ), ids as (select coalesce(array_agg(id),'{}'::uuid[]) value from filtered),
 active_attempts as (
  select a.player_id,max(coalesce(a.last_activity_at,a.completed_at,a.started_at)) last_active_at
  from public.puzzle_attempts a where p_sort='active' and a.player_id in(select id from filtered) group by a.player_id
 ), active_results as (
  select r.player_id,max(r.completed_at) last_game_at from public.results r
  where p_sort='active' and r.player_id in(select id from filtered) group by r.player_id
 ), ordering_xp as materialized (
  select * from public.proplet_account_xp_v1(case when p_sort='xp' then (select value from ids) else '{}'::uuid[] end)
 ), ordered as (
  select f.*,greatest(a.last_active_at,r.last_game_at) ordering_activity,x.result_xp+x.reward_xp ordering_points
  from filtered f left join active_attempts a on a.player_id=f.id
   left join active_results r on r.player_id=f.id left join ordering_xp x on x.player_id=f.id
 ), page as materialized (
  select o.*,row_number() over(order by
   case when p_sort='name' then lower(name) end asc,
   case when p_sort='xp' then ordering_points end desc nulls last,
   case when p_sort='created' then created_at end desc nulls last,
   case when p_sort='active' then ordering_activity end desc nulls last,id) ordinal
  from ordered o order by ordinal
  limit least(greatest(p_limit,1),200) offset least(greatest(p_offset,0),100000)
 ), page_ids as (select coalesce(array_agg(id),'{}'::uuid[]) value from page),
 xp as materialized (select * from public.proplet_account_xp_v1((select value from page_ids))),
 attempts as (
  select a.player_id,max(coalesce(a.last_activity_at,a.completed_at,a.started_at)) last_active_at,
   (array_agg(a.app_version order by a.started_at desc,a.id desc))[1] app_version
  from public.puzzle_attempts a where a.player_id in(select id from page) group by a.player_id
 ), results as (
  select r.player_id,max(r.completed_at) last_game_at,
   count(*) filter(where r.mode in('daily','free')) completed,
   count(distinct r.daily_date) filter(where r.mode='daily') daily_completed
  from public.results r where r.player_id in(select id from page) group by r.player_id
 ), reports as (
  select f.player_id,count(*) open_word_reports from public.puzzle_feedback f
  where f.player_id in(select id from page) and f.kind='word' and coalesce(f.status,'new') in('new','reviewing') group by f.player_id
 ), user_rows as (
  select p.*,greatest(a.last_active_at,r.last_game_at) last_active_at,r.last_game_at,a.app_version,
   x.result_xp+x.reward_xp points,x.result_xp,x.account_bonus_xp,x.word_discovery_xp,x.other_reward_xp,
   coalesce(r.completed,0) completed,coalesce(r.daily_completed,0) daily_completed,coalesce(w.open_word_reports,0) open_word_reports
  from page p left join xp x on x.player_id=p.id left join attempts a on a.player_id=p.id
  left join results r on r.player_id=p.id left join reports w on w.player_id=p.id
 ) select jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((
  select jsonb_agg(to_jsonb(u)-'ordinal'-'ordering_activity'-'ordering_points' order by u.ordinal) from user_rows u),'[]'::jsonb));
$$;

create or replace function public.proplet_admin_cases_v1(
 p_kind text,p_status text default 'open',p_query text default null,p_category text default null,
 p_player uuid default null,p_id uuid default null,p_offset integer default 0,p_limit integer default 100)
returns jsonb language sql stable security invoker set search_path='' as $$
 with candidates as (
  select s.id,s.player_id,s.status,s.created_at,s.resolution_note,s.reviewed_at,s.reviewed_by,
   to_jsonb(s) body from public.support_reports s where p_kind='support'
  union all
  select f.id,f.player_id,f.status,f.created_at,f.resolution_note,f.reviewed_at,f.reviewed_by,
   to_jsonb(f) body from public.puzzle_feedback f where p_kind='words' and f.kind='word'
 ), filtered as materialized (
  select c.*,jsonb_build_object('id',p.id,'name',p.name,'avatar',p.avatar,'team',coalesce(l.name,p.family_code)) player
  from candidates c left join public.players p on p.id=c.player_id left join public.leagues l on l.code=p.family_code
  where (p_status='all' or (p_status='open' and coalesce(c.status,'new') in('new','reviewing')) or c.status=p_status)
   and (p_player is null or c.player_id=p_player) and (p_id is null or c.id=p_id)
   and (p_category is null or c.body->>'category'=p_category)
   and (p_query is null or concat_ws(' ',c.body->>'word',c.body->>'message',c.body->>'note',c.body->>'puzzle_id',p.name,p.family_code,c.id::text) ilike '%'||p_query||'%')
 ), page as (
  select f.* from filtered f order by f.created_at desc,f.id desc
  limit least(greatest(p_limit,1),300) offset least(greatest(p_offset,0),100000)
 ) select jsonb_build_object('total',(select count(*) from filtered),
  'rows',coalesce((select jsonb_agg(body||jsonb_build_object('player',player)) from page),'[]'::jsonb));
$$;

create or replace function public.proplet_admin_audit_page_v1(
 p_action text default null,p_target text default null,p_from date default null,p_until date default null,
 p_offset integer default 0,p_limit integer default 80)
returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as materialized (
  select a.id,a.action,a.target_type,a.target_id,a.details,a.created_at,p.name admin
  from public.admin_audit_log a left join public.players p on p.id=a.admin_player_id
  where (p_action is null or a.action=p_action) and (p_target is null or a.target_id=p_target)
   and (p_from is null or a.created_at >= p_from::timestamp at time zone 'Europe/Prague')
   and (p_until is null or a.created_at < p_until::timestamp at time zone 'Europe/Prague')
 ), page as (
  select * from filtered order by created_at desc,id desc
  limit least(greatest(p_limit,1),200) offset least(greatest(p_offset,0),100000)
 ) select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb));
$$;

create or replace function public.proplet_admin_player_detail_v1(p_player uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 with u as (select public.proplet_admin_users_page_v1(p_player::text,0,1,'active',null) payload),
 results as (select * from public.results where player_id=p_player order by completed_at desc,id desc limit 30)
 select jsonb_build_object('user',(select payload->'users'->0 from u),
  'stats',public.proplet_player_stats_v1(p_player),
  'sessionCount',(select count(*) from public.player_sessions where player_id=p_player),
  'pushCount',(select count(*) from public.push_subscriptions where player_id=p_player),
  'wordReports',jsonb_build_object('total',(select count(*) from public.puzzle_feedback where player_id=p_player and kind='word'),
    'open',(select count(*) from public.puzzle_feedback where player_id=p_player and kind='word' and status in('new','reviewing'))),
  'recentResults',coalesce((select jsonb_agg(jsonb_build_object('puzzleId',puzzle_id,'mode',mode,'difficulty',difficulty,
   'dailyDate',daily_date,'elapsedMs',best_elapsed_ms,'moves',best_moves,'points',points,'hintsUsed',hints_used,
   'cleanSolve',clean_solve,'completedAt',completed_at)) from results),'[]'::jsonb));
$$;

create or replace function public.proplet_admin_teams_v1(p_query text default null,p_offset integer default 0,p_limit integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
 with teams as materialized (
  select l.code,l.name,count(p.id) members from public.leagues l
   left join public.players p on upper(trim(p.family_code))=l.code and p.team_joined_at is not null
  where p_query is null or concat_ws(' ',l.code,l.name) ilike '%'||p_query||'%' group by l.code,l.name
 ), page as (select * from teams order by members desc,code
  limit least(greatest(p_limit,1),200) offset least(greatest(p_offset,0),100000))
 select jsonb_build_object('total',(select count(*) from teams),'teams',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb));
$$;

create or replace function public.proplet_admin_operations_v1()
returns jsonb language sql stable security invoker set search_path='' as $$
 with scoped as materialized (
  select event_type,app_version,severity,request_id,code,created_at from public.operational_events
  where environment='production' and not is_test and created_at >= statement_timestamp()-interval '7 days'
 ), groups as (
  select event_type "eventType",app_version "appVersion",count(*) count,max(created_at) "lastAt"
  from scoped group by event_type,app_version order by count(*) desc,event_type limit 50
 ), recent as (select event_type "eventType",app_version "appVersion",severity,"request_id" "requestId",code,created_at "createdAt"
  from scoped where event_type in('client_error','server_error','analytics_snapshot_failed','rate_limit') order by created_at desc limit 30)
 select jsonb_build_object('errors',coalesce((select jsonb_agg(to_jsonb(g)) from groups g),'[]'::jsonb),
  'recent',coalesce((select jsonb_agg(to_jsonb(r)) from recent r),'[]'::jsonb));
$$;

-- Only verified runtime provenance is linked across anonymous/account actors.
-- A training event with no flow UUID deliberately cannot acquire one here.
create or replace function public.proplet_admin_activation_dataset_v1(p_days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare payload_result jsonb; n integer;
begin
 if p_days<1 or p_days>90 then raise exception 'INVALID_ANALYTICS_WINDOW'; end if;
 select count(*) into n from public.product_events e
 where e.environment='production' and not e.is_test and e.measurement_version=2 and e.onboarding_version='board-v3-short'
  and e.created_at between statement_timestamp()-make_interval(days=>p_days) and statement_timestamp()
  and e.context->>'first_steps_run_id' is not null;
 if n>20000 then raise exception 'ADMIN_ANALYTICS_SCOPE_TOO_LARGE'; end if;
 with ev as materialized (
  select context->>'first_steps_run_id' AS flow,event_type AS event,created_at AS "at",
   coalesce('p:'||player_id::text,'a:'||anonymous_id) actor
  from public.product_events
  where environment='production' and not is_test and measurement_version=2 and onboarding_version='board-v3-short'
   and created_at between statement_timestamp()-make_interval(days=>p_days) and statement_timestamp()
   and context->>'first_steps_run_id' is not null
   and event_type in('first_board_experiment_assigned','first_board_experiment_started','first_board_experiment_completed',
    'first_steps_v1_offer','first_steps_v1_saved','first_steps_v1_google','first_steps_v1_manual',
    'first_steps_v1_auth_failed','first_steps_v1_auth_cancelled','first_steps_v1_continue')
 ), actors as (select distinct actor from ev where actor is not null),
 activity as (
  select distinct coalesce('p:'||a.player_id::text,'a:'||a.anonymous_id) actor,
   (stamp.value at time zone 'Europe/Prague')::date AS "day"
  from public.puzzle_attempts a cross join lateral unnest(array[a.started_at,a.completed_at,a.last_activity_at]) stamp(value)
  where a.environment='production' and not a.is_test and stamp.value is not null and stamp.value<=statement_timestamp()
   and a.started_at between statement_timestamp()-make_interval(days=>p_days) and statement_timestamp()
   and coalesce('p:'||a.player_id::text,'a:'||a.anonymous_id) in(select actor from actors)
  union
  select distinct coalesce('p:'||e.player_id::text,'a:'||e.anonymous_id),
   (e.created_at at time zone 'Europe/Prague')::date from public.product_events e
  where e.environment='production' and not e.is_test and e.event_type in('app_open','app_session_started')
   and e.created_at between statement_timestamp()-make_interval(days=>p_days) and statement_timestamp()
   and coalesce('p:'||e.player_id::text,'a:'||e.anonymous_id) in(select actor from actors)
 ) select jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by e."at") from ev e),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(to_jsonb(a)) from activity a),'[]'::jsonb),
  'measurementStartedAt',(select min(ev."at") from ev)) into payload_result;
 return payload_result;
end;
$$;

revoke all on function public.proplet_account_xp_v1(uuid[]) from public,anon,authenticated;
revoke all on function public.proplet_admin_users_page_v1(text,integer,integer,text,text) from public,anon,authenticated;
revoke all on function public.proplet_admin_cases_v1(text,text,text,text,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.proplet_admin_audit_page_v1(text,text,date,date,integer,integer) from public,anon,authenticated;
revoke all on function public.proplet_admin_player_detail_v1(uuid) from public,anon,authenticated;
revoke all on function public.proplet_admin_teams_v1(text,integer,integer) from public,anon,authenticated;
revoke all on function public.proplet_admin_operations_v1() from public,anon,authenticated;
revoke all on function public.proplet_admin_activation_dataset_v1(integer) from public,anon,authenticated;
grant execute on function public.proplet_account_xp_v1(uuid[]) to service_role;
grant execute on function public.proplet_admin_users_page_v1(text,integer,integer,text,text) to service_role;
grant execute on function public.proplet_admin_cases_v1(text,text,text,text,uuid,uuid,integer,integer) to service_role;
grant execute on function public.proplet_admin_audit_page_v1(text,text,date,date,integer,integer) to service_role;
grant execute on function public.proplet_admin_player_detail_v1(uuid) to service_role;
grant execute on function public.proplet_admin_teams_v1(text,integer,integer) to service_role;
grant execute on function public.proplet_admin_operations_v1() to service_role;
grant execute on function public.proplet_admin_activation_dataset_v1(integer) to service_role;

-- Preserve all current stats behavior; consume the shared XP aggregate.
CREATE OR REPLACE FUNCTION public.proplet_player_stats_v1(p_player uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with
stamp as (
  select statement_timestamp() as value,
         coalesce((select preview_date from public.daily_specials_policy where singleton and enabled),(statement_timestamp() at time zone 'Europe/Prague')::date) as today
),
normalized_results as (select r.* from public.results r where r.player_id = p_player),
reward_stats as (select * from public.proplet_account_xp_v1(array[p_player])),
result_stats as (
  select
    (select result_xp from reward_stats) as result_xp,
    count(*) filter (where mode in ('daily', 'free'))::integer as total_completed,
    count(distinct daily_date) filter (where mode = 'daily' and daily_date is not null)::integer as daily_completed,
    count(distinct challenge_key) filter (where mode = 'daily_special')::integer as daily_special_completed,
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
    'dailySpecialCompleted', rs.daily_special_completed,
    'dailyChallengeCompleted', rs.daily_completed + rs.daily_special_completed,
    'totalChallengeCompleted', rs.total_completed + rs.daily_special_completed,
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
$function$
;
