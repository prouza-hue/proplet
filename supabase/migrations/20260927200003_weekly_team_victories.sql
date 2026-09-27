-- Weekly team victories. Additive, disabled until explicit production activation.
-- Cron is installed separately. No gameplay/player/account_rewards rows are changed.
begin;

create table public.team_victory_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  launch_date date not null default date '2026-09-28'
    check (extract(isodow from launch_date) = 1)
);
insert into public.team_victory_settings(singleton) values (true);

create table public.team_victory_rounds (
  week_start date primary key,
  week_end date not null,
  finalized_at timestamptz not null default now(),
  standings jsonb not null default '[]'::jsonb,
  check (week_end = week_start + 7),
  check (extract(isodow from week_start) = 1)
);

create table public.team_victory_awards (
  id uuid primary key default gen_random_uuid(),
  week_start date not null references public.team_victory_rounds(week_start),
  team_code text not null,
  team_name text not null,
  xp bigint not null check (xp > 0),
  total_gold integer not null check (total_gold > 0),
  shared_first boolean not null default false,
  awarded_at timestamptz not null default now(),
  unique (week_start, team_code)
);
create index team_victory_awards_team_week on public.team_victory_awards(team_code, week_start desc);

create table public.team_victory_recipients (
  award_id uuid not null references public.team_victory_awards(id),
  player_id uuid not null references public.players(id) on delete cascade,
  seen_at timestamptz,
  primary key (award_id, player_id)
);
create index team_victory_recipients_player on public.team_victory_recipients(player_id, award_id);

create table public.team_victory_intro_seen (
  player_id uuid primary key references public.players(id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.team_victory_settings enable row level security;
alter table public.team_victory_rounds enable row level security;
alter table public.team_victory_awards enable row level security;
alter table public.team_victory_recipients enable row level security;
alter table public.team_victory_intro_seen enable row level security;
revoke all on public.team_victory_settings, public.team_victory_rounds,
  public.team_victory_awards, public.team_victory_recipients,
  public.team_victory_intro_seen from public, anon, authenticated, service_role;
-- Service role is server-only. Immutable rounds/medals deliberately have no UPDATE/DELETE grant.
grant select on public.team_victory_settings to service_role;
grant select, insert on public.team_victory_rounds, public.team_victory_awards,
  public.team_victory_intro_seen, public.team_victory_recipients to service_role;
grant update (seen_at) on public.team_victory_recipients to service_role;

create or replace function public.proplet_finalize_team_victories_v1()
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
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
    -- Only results.points, never account_rewards (registration/playtest/admin bonuses).
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
$fn$;

create or replace function public.proplet_team_victories_state_v1(p_player_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $fn$
declare
  v_launch date;
  v_team text;
  v_name text;
  v_gold integer;
  v_current date := date_trunc('week', now() at time zone 'Europe/Prague')::date;
  v_seen boolean;
  v_eligible boolean;
  v_competition_eligible boolean := false;
  v_pending jsonb;
  v_history jsonb;
begin
  select launch_date into v_launch from public.team_victory_settings where singleton and enabled;
  if v_launch is null then return jsonb_build_object('enabled', false); end if;
  if not exists(select 1 from public.players where id = p_player_id) then
    return jsonb_build_object('enabled', false);
  end if;
  select upper(btrim(p.family_code)) into v_team from public.players p
    where p.id = p_player_id and nullif(btrim(p.family_code), '') is not null
      and not (p.team_joined_at is null and upper(btrim(p.family_code)) like 'SOLO\_%' escape '\');
  select exists(select 1 from public.leagues l where l.code = v_team and l.public_opt_in = true
    and (l.public_enabled_at is null or l.public_enabled_at <= now())) into v_competition_eligible;
  select exists(select 1 from public.team_victory_intro_seen where player_id = p_player_id) into v_seen;
  select v_team is not null and v_competition_eligible and not v_seen and exists(
    select 1 from public.results r where r.player_id = p_player_id and r.points > 0 and r.calm_mode = false
      and r.completed_at >= (v_launch::timestamp at time zone 'Europe/Prague') and r.completed_at <= now()
  ) into v_eligible;
  if v_team is not null then
    select coalesce(nullif(l.public_name, ''), nullif(l.name, ''), v_team) into v_name from public.leagues l where l.code = v_team;
    v_name := coalesce(v_name, v_team);
    select count(*) into v_gold from public.team_victory_awards where team_code = v_team;
    select jsonb_build_object('id', a.id, 'weekStart', a.week_start, 'weekEnd', a.week_start + 7,
      'teamName', a.team_name, 'totalGold', a.total_gold, 'previousGold', greatest(0, a.total_gold - (
        select count(*) from public.team_victory_awards old
        join public.team_victory_recipients unseen on unseen.award_id = old.id
        where old.team_code = v_team and old.week_start <= a.week_start
          and unseen.player_id = p_player_id and unseen.seen_at is null)),
      'xp', a.xp, 'sharedFirst', a.shared_first) into v_pending
      from public.team_victory_awards a join public.team_victory_recipients r on r.award_id = a.id
      where a.team_code = v_team and r.player_id = p_player_id and r.seen_at is null
      order by a.week_start desc limit 1;
    select coalesce(jsonb_agg(x.payload order by x.week_start desc), '[]'::jsonb) into v_history from (
      select a.week_start, jsonb_build_object('id', a.id, 'weekStart', a.week_start, 'weekEnd', a.week_start + 7,
        'teamName', a.team_name, 'totalGold', a.total_gold, 'xp', a.xp, 'sharedFirst', a.shared_first) as payload
      from public.team_victory_awards a where a.team_code = v_team order by a.week_start desc limit 100
    ) x;
  end if;
  return jsonb_build_object('enabled', true, 'launchDate', v_launch, 'timezone', 'Europe/Prague',
    'currentWeek', jsonb_build_object('start', v_current, 'end', v_current + 7),
    'team', case when v_team is null then null else jsonb_build_object('code', v_team, 'name', v_name, 'totalGold', v_gold,
      'competitionEligible', v_competition_eligible, 'eligibilityReason', case when v_competition_eligible then null else 'private-team' end) end,
    'intro', jsonb_build_object('eligible', v_eligible, 'seen', v_seen),
    'pendingAward', v_pending, 'history', coalesce(v_history, '[]'::jsonb),
    'previousWeekWinner', exists(select 1 from public.team_victory_awards where team_code = v_team and week_start = v_current - 7));
end;
$fn$;

create or replace function public.proplet_team_victories_seen_v1(
  p_player_id uuid, p_kind text, p_award_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = '' as $fn$
declare
  v_count integer;
  v_team text;
  v_launch date;
begin
  select launch_date into v_launch from public.team_victory_settings where singleton and enabled;
  if v_launch is null then return jsonb_build_object('ok', false); end if;
  if p_kind = 'intro' and p_award_id is null then
    -- Check gameplay eligibility even on retries; frontend flags cannot invent XP.
    if not exists(select 1 from public.players p join public.leagues l on l.code = upper(btrim(p.family_code))
      where p.id = p_player_id and l.public_opt_in = true and (l.public_enabled_at is null or l.public_enabled_at <= now())
      and nullif(btrim(p.family_code), '') is not null
      and not (p.team_joined_at is null and upper(btrim(p.family_code)) like 'SOLO\_%' escape '\'))
      or not exists(select 1 from public.results r where r.player_id = p_player_id
        and r.points > 0 and r.calm_mode = false
        and r.completed_at >= (v_launch::timestamp at time zone 'Europe/Prague') and r.completed_at <= now()) then
      return jsonb_build_object('ok', false);
    end if;
    insert into public.team_victory_intro_seen(player_id) values(p_player_id) on conflict do nothing;
    get diagnostics v_count = row_count;
    return jsonb_build_object('ok', true, 'firstSeen', v_count = 1);
  elsif p_kind = 'award' and p_award_id is not null then
    select upper(btrim(family_code)) into v_team from public.players where id = p_player_id;
    if not exists(select 1 from public.team_victory_recipients r
      join public.team_victory_awards a on a.id = r.award_id
      where r.player_id = p_player_id and a.id = p_award_id and a.team_code = v_team) then
      return jsonb_build_object('ok', false);
    end if;
    update public.team_victory_recipients r set seen_at = now()
      from public.team_victory_awards a, public.team_victory_awards selected
      where r.player_id = p_player_id and r.award_id = a.id and selected.id = p_award_id
        and a.team_code = selected.team_code and a.week_start <= selected.week_start and r.seen_at is null;
    get diagnostics v_count = row_count;
    return jsonb_build_object('ok', true, 'firstSeen', v_count > 0);
  end if;
  return jsonb_build_object('ok', false);
end;
$fn$;

revoke all on function public.proplet_finalize_team_victories_v1() from public, anon, authenticated;
revoke all on function public.proplet_team_victories_state_v1(uuid) from public, anon, authenticated;
revoke all on function public.proplet_team_victories_seen_v1(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.proplet_finalize_team_victories_v1() to service_role;
grant execute on function public.proplet_team_victories_state_v1(uuid) to service_role;
grant execute on function public.proplet_team_victories_seen_v1(uuid,text,uuid) to service_role;
comment on function public.proplet_finalize_team_victories_v1() is
  'Cron-only immutable weekly gameplay XP closure, Prague Monday +10min, no backfill before launch. Exact XP ties share first. Zero-XP weeks have no medal.';
commit;
