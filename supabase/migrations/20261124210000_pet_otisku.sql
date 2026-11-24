-- Five sequential November gift boards. This private ledger never creates a
-- competition result, account_reward, streak day or word-discovery reward.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table proplet_private.pet_otisku_progress (
 player_id uuid primary key references public.players(id) on delete cascade,
 completed smallint not null default 0 check (completed between 0 and 5),
 gift_seen boolean not null default false,
 ask_seen boolean not null default false
);
alter table proplet_private.pet_otisku_progress enable row level security;
revoke all on proplet_private.pet_otisku_progress from public, anon, authenticated;
grant select, insert, update on proplet_private.pet_otisku_progress to service_role;

create function public.proplet_pet_otisku_v1(p_player uuid, p_action text, p_board integer default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 progress proplet_private.pet_otisku_progress%rowtype;
 eligible boolean;
 pending boolean;
 disabled boolean;
 active boolean;
 claimed boolean := false;
 awarded integer := 0;
 remaining integer;
 local_day date := (statement_timestamp() at time zone 'Europe/Prague')::date;
begin
 if p_action is null or p_action not in ('read','ask','gift','complete')
    or (p_action = 'complete' and (p_board is null or p_board not between 1 and 5))
    or (p_action <> 'complete' and p_board is not null) then
   raise exception 'Invalid gift operation' using errcode='22023';
 end if;
 if p_action <> 'read' then
   perform 1 from public.players where id = p_player for update;
   if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 end if;
 select * into progress from proplet_private.pet_otisku_progress where player_id=p_player;
 -- Bank date matches the funding meter and includes a November transfer confirmed in December.
 select exists (
   select from proplet_private.patron_intents i
   join proplet_private.patron_payments r on r.intent_id=i.id
   left join proplet_private.patron_payment_dates d on d.payment_id=r.id
   where i.player_id=p_player and coalesce(d.paid_on,(r.confirmed_at at time zone 'Europe/Prague')::date)<date '2026-12-01'
 ) into eligible;
 if p_action='complete' then
   if not eligible then return jsonb_build_object('ok',false,'code','ineligible'); end if;
   if p_board > coalesce(progress.completed,0)+1 then
     return jsonb_build_object('ok',false,'code','locked');
   end if;
   if p_board = coalesce(progress.completed,0)+1 then
     insert into proplet_private.pet_otisku_progress(player_id,completed,gift_seen)
     values(p_player,p_board,true) on conflict(player_id) do update set completed=excluded.completed,gift_seen=true
     returning * into progress;
     awarded := 300;
   end if;
   return jsonb_build_object('ok',true,'awardedXp',awarded,'completed',array(select generate_series(1,coalesce(progress.completed,0))));
 end if;

 select exists(select from proplet_private.patron_intents i
   left join proplet_private.patron_automatic_intents a on a.intent_id=i.id
   where i.player_id=p_player and (case when a.intent_id is null then i.created_at else a.engaged_at end)
         >statement_timestamp()-interval '7 days'
   and not exists(select from proplet_private.patron_payments r where r.intent_id=i.id)) into pending;
 select offers_disabled into disabled from proplet_private.patron_preferences where player_id=p_player;
 active := local_day >= date '2026-11-01' and local_day < date '2026-12-01'
   and not eligible and not pending and not coalesce(disabled,false)
   and not proplet_private.patron_effective_v1(p_player);
 if active then
   select greatest(0,2000-coalesce(sum(r.amount_czk),0)) into remaining
   from proplet_private.patron_payments r left join proplet_private.patron_payment_dates d on d.payment_id=r.id
   where coalesce(d.paid_on,(r.confirmed_at at time zone 'Europe/Prague')::date)
         between date '2026-11-01' and date '2026-11-30';
   active := remaining>0;
 end if;
 if (p_action='gift' and eligible and not coalesce(progress.gift_seen,false))
    or (p_action='ask' and active and not coalesce(progress.ask_seen,false)) then
   insert into proplet_private.pet_otisku_progress(player_id,gift_seen,ask_seen)
   values(p_player,p_action='gift',p_action='ask')
   on conflict(player_id) do update set gift_seen=pet_otisku_progress.gift_seen or excluded.gift_seen,
                                       ask_seen=pet_otisku_progress.ask_seen or excluded.ask_seen
   returning * into progress;
   claimed := true;
 end if;
 return jsonb_build_object('ok',true,'eligible',eligible,'pending',pending,'remainingCzk',remaining,
   'askActive',active,'askSeen',coalesce(progress.ask_seen,false),'giftSeen',coalesce(progress.gift_seen,false),
   'claimed',claimed,'completed',array(select generate_series(1,coalesce(progress.completed,0))));
end; $$;
revoke all on function public.proplet_pet_otisku_v1(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.proplet_pet_otisku_v1(uuid,text,integer) to service_role;

-- The personal rank and owner profile share this aggregate. Competitive XP uses its own sources.
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
 select i.id,coalesce(rs.xp,0),coalesce(rw.reward_xp,0)+coalesce(gift.completed,0)*300,coalesce(rw.account_bonus_xp,0),
  coalesce(rw.word_discovery_xp,0),coalesce(rw.other_reward_xp,0)+coalesce(gift.completed,0)*300,coalesce(rw.word_discovery_rewards,0),coalesce(rw.discovered_words,0)
 from ids i left join rs on rs.player_id=i.id left join rw on rw.player_id=i.id
 left join proplet_private.pet_otisku_progress gift on gift.player_id=i.id;
$$;
commit;
