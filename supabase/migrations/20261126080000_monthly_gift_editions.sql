begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Only editions with a complete, verified bundle are registered.
create table proplet_private.gift_editions (
 month_start date primary key check (extract(day from month_start) = 1)
);
insert into proplet_private.gift_editions values ('2026-11-01'), ('2026-12-01');

create table proplet_private.gift_receipts (
 player_id uuid not null references public.players(id) on delete cascade,
 month_start date not null references proplet_private.gift_editions,
 kind text not null check (kind in ('gift','ask')),
 primary key (player_id, month_start, kind)
);
create table proplet_private.gift_boards_completed (
 player_id uuid not null references public.players(id) on delete cascade,
 month_start date not null references proplet_private.gift_editions,
 board smallint not null check (board between 1 and 5),
 primary key (player_id, month_start, board)
);
alter table proplet_private.gift_editions enable row level security;
alter table proplet_private.gift_receipts enable row level security;
alter table proplet_private.gift_boards_completed enable row level security;
revoke all on proplet_private.gift_editions, proplet_private.gift_receipts,
 proplet_private.gift_boards_completed from public, anon, authenticated, service_role;
grant select on proplet_private.gift_editions to service_role;
grant select,insert on proplet_private.gift_receipts,proplet_private.gift_boards_completed to service_role;

create function proplet_private.gift_local_day() returns date
language sql stable security invoker set search_path='' as $$
 select (statement_timestamp() at time zone 'Europe/Prague')::date;
$$;
revoke all on function proplet_private.gift_local_day() from public,anon,authenticated;
grant execute on function proplet_private.gift_local_day() to service_role;

-- The old table remains the authoritative ledger for November, including during
-- rollout when an older backend or a cached client submits a finish.
alter function public.proplet_pet_otisku_v1(uuid,text,integer) rename to proplet_november_gift_ledger_v1;

create function public.proplet_gift_edition_v1(p_player uuid,p_month date,p_action text,p_board integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 day_local date := proplet_private.gift_local_day();
 next_month date := (p_month + interval '1 month')::date;
 first_payment date;
 owned text[];
 current_edition boolean := day_local >= p_month and day_local < next_month;
 eligible boolean;
 pending boolean := false;
 active boolean := false;
 granted boolean := false;
 remaining integer;
 meter jsonb;
 legacy jsonb;
 finished integer[];
 awarded integer := 0;
begin
 if p_action is null or p_action not in ('read','ask','gift','complete')
    or (p_action = 'complete' and (p_board is null or p_board not between 1 and 5))
    or (p_action <> 'complete' and p_board is not null) then
   raise exception 'Invalid gift operation' using errcode='22023';
 end if;
 if not exists(select from proplet_private.gift_editions where month_start=p_month) then
   return jsonb_build_object('ok',false,'code','unknown');
 end if;
 if p_action <> 'read' then
   perform 1 from public.players where id=p_player for update;
   if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 end if;
 select min(coalesce(d.paid_on,(r.confirmed_at at time zone 'Europe/Prague')::date))
 into first_payment from proplet_private.patron_intents i
 join proplet_private.patron_payments r on r.intent_id=i.id
 left join proplet_private.patron_payment_dates d on d.payment_id=r.id
 where i.player_id=p_player;
 select array(select to_char(month_start,'YYYY-MM') from proplet_private.gift_editions
    where month_start <= day_local and first_payment < month_start + interval '1 month'
    order by month_start desc) into owned;
 eligible := to_char(p_month,'YYYY-MM') = any(owned);

 if p_month=date '2026-11-01' then
   legacy := public.proplet_november_gift_ledger_v1(p_player,
      case when not current_edition and p_action in ('ask','gift') then 'read' else p_action end,p_board);
   return legacy || jsonb_build_object('editions', owned)
      || case when not current_edition and p_action <> 'complete' then
         jsonb_build_object('askActive',false,'giftSeen',true,'claimed',false) else '{}'::jsonb end;
 end if;

 select array(select board::integer from proplet_private.gift_boards_completed
   where player_id=p_player and month_start=p_month order by board) into finished;

 if p_action='complete' then
   if not eligible then return jsonb_build_object('ok',false,'code','ineligible'); end if;
   if p_board > cardinality(finished)+1 then return jsonb_build_object('ok',false,'code','locked'); end if;
   if p_board = cardinality(finished)+1 then
     insert into proplet_private.gift_boards_completed values(p_player,p_month,p_board);
     insert into proplet_private.gift_receipts values(p_player,p_month,'gift') on conflict do nothing;
     finished := array_append(finished,p_board);
     awarded := 300;
   end if;
   return jsonb_build_object('ok',true,'awardedXp',awarded,'completed',finished);
 end if;

 if current_edition and day_local >= next_month-7 and first_payment is null then
   -- The very same meter drives the donation screen, including its active goal.
   meter := public.proplet_patron_state_v1(p_player,false);
   pending := exists(select from proplet_private.patron_intents i
     left join proplet_private.patron_automatic_intents a on a.intent_id=i.id
     where i.player_id=p_player and
       (case when a.intent_id is null then i.created_at else a.engaged_at end) > statement_timestamp()-interval '7 days'
       and not exists(select from proplet_private.patron_payments r where r.intent_id=i.id));
   if meter#>>'{monthFunding,month}'=to_char(p_month,'YYYY-MM') then
      remaining := (meter#>>'{monthFunding,remainingCzk}')::integer;
   end if;
   active := coalesce(remaining>0,false) and not pending and (meter->>'offersDisabled')='false'
     and exists(select from public.results where player_id=p_player and mode in ('free','daily','daily_special','tajenka'));
 end if;

 if (p_action='gift' and current_edition and eligible) or (p_action='ask' and active) then
   insert into proplet_private.gift_receipts values(p_player,p_month,p_action) on conflict do nothing;
   granted := found;
 end if;
 return jsonb_build_object('ok',true,'editions',owned,'eligible',eligible,'pending',pending,
   'remainingCzk',remaining,'askActive',active,'claimed',granted,'completed',finished,
   'askSeen',exists(select from proplet_private.gift_receipts where player_id=p_player and month_start=p_month and kind='ask'),
   'giftSeen',not current_edition or exists(select from proplet_private.gift_receipts where player_id=p_player and month_start=p_month and kind='gift'));
end; $$;

create function public.proplet_pet_otisku_v1(p_player uuid,p_action text,p_board integer default null)
returns jsonb language sql security invoker set search_path='' as $$
 select public.proplet_gift_edition_v1(p_player,date '2026-11-01',p_action,p_board);
$$;
revoke all on function public.proplet_pet_otisku_v1(uuid,text,integer),public.proplet_gift_edition_v1(uuid,date,text,integer) from public,anon,authenticated;
grant execute on function public.proplet_pet_otisku_v1(uuid,text,integer),public.proplet_gift_edition_v1(uuid,date,text,integer) to service_role;

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
 select i.id,coalesce(rs.xp,0),coalesce(rw.reward_xp,0)+(coalesce(gift.completed,0)+coalesce(series.boards,0))*300,coalesce(rw.account_bonus_xp,0),
  coalesce(rw.word_discovery_xp,0),coalesce(rw.other_reward_xp,0)+(coalesce(gift.completed,0)+coalesce(series.boards,0))*300,coalesce(rw.word_discovery_rewards,0),coalesce(rw.discovered_words,0)
 from ids i left join rs on rs.player_id=i.id left join rw on rw.player_id=i.id
 left join proplet_private.pet_otisku_progress gift on gift.player_id=i.id
 left join (select c.player_id,count(*)::integer boards from proplet_private.gift_boards_completed c
            where c.player_id=any(p_players) group by c.player_id) series on series.player_id=i.id;
$$;
commit;
