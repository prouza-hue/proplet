-- Reward every valid new discovery; retain atomic per-player reward-key deduplication.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
CREATE OR REPLACE FUNCTION public.proplet_claim_word_discovery(p_player_id uuid, p_puzzle_id text, p_word text)
 RETURNS TABLE(newly_granted boolean, awarded_points integer, reason text, reward_key text, board_xp integer, daily_xp integer, total_discovery_xp integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reward_key text;
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
$function$
;
revoke all on function public.proplet_claim_word_discovery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.proplet_claim_word_discovery(uuid,text,text) to service_role;
comment on function public.proplet_claim_word_discovery(uuid,text,text) is 'One XP per distinct valid puzzle/word discovery, without board or daily caps; service-only and idempotent.';
commit;
