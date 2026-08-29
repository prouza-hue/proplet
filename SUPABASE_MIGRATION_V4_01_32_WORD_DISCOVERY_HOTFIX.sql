-- Proplet v4.01.32 hotfix — disambiguate word-discovery upsert.
-- The RETURNS TABLE output parameter `reward_key` shadows the table column name
-- inside ON CONFLICT (player_id, reward_key). Naming the existing unique
-- constraint keeps the claim atomic and removes that PL/pgSQL ambiguity.

begin;

create or replace function public.proplet_claim_word_discovery(
  p_player_id uuid,
  p_puzzle_id text,
  p_word text
)
returns table (
  newly_granted boolean,
  awarded_points integer,
  reason text,
  reward_key text,
  board_xp integer,
  daily_xp integer,
  total_discovery_xp integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reward_key text;
  v_board_xp integer;
  v_daily_xp integer;
  v_today date := (timezone('Europe/Prague', now()))::date;
begin
  if p_player_id is null
     or length(trim(coalesce(p_puzzle_id, ''))) not between 2 and 80
     or length(trim(coalesce(p_word, ''))) not between 4 and 24 then
    raise exception 'invalid word discovery claim';
  end if;

  v_reward_key := 'word_discovery_v1:' || trim(p_puzzle_id) || ':' || lower(trim(p_word));

  perform pg_advisory_xact_lock(hashtext('proplet_word_discovery'), hashtext(p_player_id::text));

  if exists (
    select 1 from public.account_rewards ar
    where ar.player_id = p_player_id and ar.reward_key = v_reward_key
  ) then
    reason := 'duplicate';
    newly_granted := false;
    awarded_points := 0;
  else
    select coalesce(sum(ar.points), 0)::integer
      into v_board_xp
    from public.account_rewards ar
    where ar.player_id = p_player_id
      and ar.reward_type = 'word_discovery'
      and ar.puzzle_id = trim(p_puzzle_id);

    select coalesce(sum(ar.points), 0)::integer
      into v_daily_xp
    from public.account_rewards ar
    where ar.player_id = p_player_id
      and ar.reward_type = 'word_discovery'
      and ar.granted_at >= (v_today::timestamp at time zone 'Europe/Prague')
      and ar.granted_at < ((v_today + 1)::timestamp at time zone 'Europe/Prague');

    if v_board_xp >= 5 then
      reason := 'board_limit';
      newly_granted := false;
      awarded_points := 0;
    elsif v_daily_xp >= 20 then
      reason := 'daily_limit';
      newly_granted := false;
      awarded_points := 0;
    else
      insert into public.account_rewards (
        id, player_id, reward_key, points, granted_at, reward_type, puzzle_id, reward_word
      ) values (
        gen_random_uuid(), p_player_id, v_reward_key, 1, now(),
        'word_discovery', trim(p_puzzle_id), lower(trim(p_word))
      )
      on conflict on constraint account_rewards_player_reward_key_unique do nothing;

      get diagnostics awarded_points = row_count;
      newly_granted := awarded_points = 1;
      reason := case when newly_granted then 'granted' else 'duplicate' end;
    end if;
  end if;

  reward_key := v_reward_key;
  select coalesce(sum(ar.points), 0)::integer
    into board_xp
  from public.account_rewards ar
  where ar.player_id = p_player_id
    and ar.reward_type = 'word_discovery'
    and ar.puzzle_id = trim(p_puzzle_id);

  select coalesce(sum(ar.points), 0)::integer
    into daily_xp
  from public.account_rewards ar
  where ar.player_id = p_player_id
    and ar.reward_type = 'word_discovery'
    and ar.granted_at >= (v_today::timestamp at time zone 'Europe/Prague')
    and ar.granted_at < ((v_today + 1)::timestamp at time zone 'Europe/Prague');

  select coalesce(sum(ar.points), 0)::integer
    into total_discovery_xp
  from public.account_rewards ar
  where ar.player_id = p_player_id
    and ar.reward_type = 'word_discovery';

  return next;
end;
$$;

revoke all on function public.proplet_claim_word_discovery(uuid, text, text) from public;
revoke all on function public.proplet_claim_word_discovery(uuid, text, text) from anon, authenticated;
grant execute on function public.proplet_claim_word_discovery(uuid, text, text) to service_role;

comment on function public.proplet_claim_word_discovery(uuid, text, text) is
  'Atomically awards +1 XP for a valid side word, capped at 5 XP per board and 20 XP per Prague day.';

commit;
