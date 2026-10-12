-- Additive referral attribution and exactly-once shared rewards.
-- Existing application versions never send the signup header and remain inert.
begin;

create table if not exists public.referral_invites (
  inviter_id uuid primary key references public.players(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{8,80}$'),
  created_at timestamptz not null default statement_timestamp()
);
create table if not exists public.referral_claims (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  invitee_id uuid not null unique references public.players(id) on delete cascade,
  inviter_id uuid not null references public.players(id) on delete cascade,
  code text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  completed_boards integer not null default 0 check (completed_boards between 0 and 5),
  paid_at timestamptz,
  dismissed_at timestamptz,
  check (invitee_id <> inviter_id),
  check (paid_at is null or completed_boards = 5),
  check (dismissed_at is null or paid_at is not null)
);
create index if not exists referral_claims_inviter_idx on public.referral_claims (inviter_id, accepted_at desc);
create table if not exists public.referral_boards (
  claim_id uuid not null references public.referral_claims(id) on delete cascade,
  puzzle_id text not null check (length(puzzle_id) between 1 and 240),
  result_id uuid not null references public.results(id) on delete cascade,
  completed_at timestamptz not null,
  primary key (claim_id, puzzle_id)
);
alter table public.referral_invites enable row level security;
alter table public.referral_claims enable row level security;
alter table public.referral_boards enable row level security;
revoke all on public.referral_invites, public.referral_claims, public.referral_boards from public, anon, authenticated;
grant select, insert, update, delete on public.referral_invites, public.referral_claims, public.referral_boards to service_role;

create or replace function public.proplet_referral_public_v1(p_code text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce((
    select jsonb_build_object('ok',true,'code',i.code,
      'inviter',jsonb_build_object('name',p.name,'avatar',coalesce(p.avatar,'🙂')),
      'rewardXp',1000,'requiredBoards',5)
    from public.referral_invites i join public.players p on p.id=i.inviter_id where i.code=p_code
  ),jsonb_build_object('ok',false));
$$;

create or replace function public.proplet_referral_create_v1(p_player uuid,p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_code text;
begin
  insert into public.referral_invites(inviter_id,code) values(p_player,p_code)
  on conflict(inviter_id) do nothing;
  select code into strict v_code from public.referral_invites where inviter_id=p_player;
  return jsonb_build_object('ok',true,'code',v_code,'url','https://hrajproplet.cz/?invite='||v_code,
    'rewardXp',1000,'requiredBoards',5);
end; $$;

create or replace function public.proplet_referral_signup_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_code text;
  v_inviter uuid;
begin
  v_code:=nullif(v_headers->>'x-proplet-referral-invite','');
  if v_code is null then return new; end if;
  if v_code !~ '^[A-Za-z0-9_-]{8,80}$' then raise exception 'invalid_referral' using errcode='22023'; end if;
  select inviter_id into v_inviter from public.referral_invites where code=v_code;
  if v_inviter is null or v_inviter=new.id then raise exception 'invalid_referral' using errcode='22023'; end if;
  insert into public.referral_claims(invitee_id,inviter_id,code,accepted_at)
  values(new.id,v_inviter,v_code,statement_timestamp());
  return new;
end; $$;
create trigger players_referral_signup after insert on public.players
for each row execute function public.proplet_referral_signup_v1();

create or replace function public.proplet_referral_immutable_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.id,new.invitee_id,new.inviter_id,new.code,new.accepted_at)
    is distinct from (old.id,old.invitee_id,old.inviter_id,old.code,old.accepted_at) then
    raise exception 'referral_attribution_immutable' using errcode='22023';
  end if;
  return new;
end; $$;
create trigger referral_claims_immutable before update on public.referral_claims
for each row execute function public.proplet_referral_immutable_v1();

create or replace function public.proplet_referral_complete_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_claim public.referral_claims%rowtype; v_count integer;
begin
  if new.mode not in ('daily','daily_special','free','tajenka') then return new; end if;
  -- Lock one claim before deduplicating/incrementing, including concurrent fifth/sixth boards.
  select * into v_claim from public.referral_claims where invitee_id=new.player_id for update;
  if not found or v_claim.paid_at is not null or new.completed_at < v_claim.accepted_at then return new; end if;
  insert into public.referral_boards(claim_id,puzzle_id,result_id,completed_at)
  values(v_claim.id,new.puzzle_id,new.id,new.completed_at)
  on conflict(claim_id,puzzle_id) do nothing;
  if not found then return new; end if;
  update public.referral_claims set completed_boards=completed_boards+1 where id=v_claim.id returning completed_boards into v_count;
  if v_count=5 then
    -- Both ledger inserts, paid marker and the result share the caller's transaction.
    insert into public.account_rewards(id,player_id,reward_key,points,granted_at) values
      (pg_catalog.gen_random_uuid(),v_claim.inviter_id,'referral_v1:'||v_claim.id::text||':inviter',1000,statement_timestamp()),
      (pg_catalog.gen_random_uuid(),v_claim.invitee_id,'referral_v1:'||v_claim.id::text||':invitee',1000,statement_timestamp())
    on conflict(player_id,reward_key) do nothing;
    update public.referral_claims set paid_at=statement_timestamp() where id=v_claim.id;
  end if;
  return new;
end; $$;
create trigger results_referral_completed after insert on public.results
for each row execute function public.proplet_referral_complete_v1();

create or replace function public.proplet_referral_status_v1(p_player uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('ok',true,'rewardXp',1000,'requiredBoards',5,
  'invite',(select jsonb_build_object('code',i.code,'url','https://hrajproplet.cz/?invite='||i.code)
    from public.referral_invites i where i.inviter_id=p_player),
  'incoming',(select jsonb_build_object('id',c.id,
    'inviter',jsonb_build_object('name',p.name,'avatar',coalesce(p.avatar,'🙂')),
    'completedBoards',c.completed_boards,'requiredBoards',5,'rewardXp',1000,
    'paid',c.paid_at is not null,'rewardDismissed',c.dismissed_at is not null)
    from public.referral_claims c join public.players p on p.id=c.inviter_id where c.invitee_id=p_player),
  'referrals',coalesce((select jsonb_agg(entry.payload order by entry.accepted_at desc) from (
    select c.accepted_at,jsonb_build_object('id',c.id,'name',p.name,'avatar',coalesce(p.avatar,'🙂'),
      'completedBoards',c.completed_boards,'requiredBoards',5,'rewardXp',1000,'paid',c.paid_at is not null) as payload
    from public.referral_claims c join public.players p on p.id=c.invitee_id
    where c.inviter_id=p_player order by (c.paid_at is not null),c.accepted_at desc limit 100
  ) entry),'[]'::jsonb),
  'referralCount',(select count(*) from public.referral_claims where inviter_id=p_player));
$$;

create or replace function public.proplet_referral_dismiss_v1(p_player uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  update public.referral_claims set dismissed_at=coalesce(dismissed_at,statement_timestamp())
    where invitee_id=p_player and paid_at is not null;
  return jsonb_build_object('ok',true,'dismissed',found);
end; $$;

revoke all on function public.proplet_referral_public_v1(text), public.proplet_referral_create_v1(uuid,text),
  public.proplet_referral_signup_v1(), public.proplet_referral_immutable_v1(), public.proplet_referral_complete_v1(),
  public.proplet_referral_status_v1(uuid), public.proplet_referral_dismiss_v1(uuid) from public, anon, authenticated;
grant execute on function public.proplet_referral_public_v1(text), public.proplet_referral_create_v1(uuid,text),
  public.proplet_referral_signup_v1(), public.proplet_referral_immutable_v1(), public.proplet_referral_complete_v1(),
  public.proplet_referral_status_v1(uuid), public.proplet_referral_dismiss_v1(uuid) to service_role;

-- Referral rewards remain in lifetime XP, outside every timed XP leaderboard.
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
revoke all on function public.proplet_rankings_xp_aggregate(timestamptz) from public, anon, authenticated;
grant execute on function public.proplet_rankings_xp_aggregate(timestamptz) to service_role;
notify pgrst, 'reload schema';
commit;
