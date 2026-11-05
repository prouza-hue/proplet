begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table proplet_private.patron_first_seen
 add column offer_reservation_id uuid,
 add column offer_reserved_until timestamptz;
grant update(offer_reservation_id,offer_reserved_until)
 on proplet_private.patron_first_seen to service_role;

alter table proplet_private.patron_offer_receipts
 add column visibility_confirmed boolean not null default false;

create or replace function public.proplet_patron_state_v1(p_player uuid,p_claim boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 pr proplet_private.patron_preferences%rowtype;
 t timestamptz; is_patron boolean; recent_offers integer; visible_offers integer; last_shown timestamptz;
 boards integer; days integer; post_boards integer; wait_reason text;
 first_seen timestamptz; news_at timestamptz; anchor_at timestamptz; anchor_source text;
 thanks_pending boolean; contributions jsonb; recurring_status jsonb;
begin
 if p_claim is null then raise exception 'invalid claim' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 t:=clock_timestamp();
 insert into proplet_private.patron_first_seen(player_id,first_seen_at) values(p_player,t)
  on conflict(player_id) do nothing;
 select first_seen_at into first_seen from proplet_private.patron_first_seen where player_id=p_player;
 select claimed_at into news_at from public.release_news_receipts
  where campaign_id='november-2026-release-v1' and player_id=p_player;
 anchor_at:=coalesce(news_at,first_seen);
 anchor_source:=case when news_at is null then 'first_seen' else 'release_news' end;
 select * into pr from proplet_private.patron_preferences where player_id=p_player;
 is_patron:=proplet_private.patron_effective_v1(p_player);
 recurring_status:=proplet_private.patron_recurring_v1(p_player);
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player and thanks_claimed_at is null)
  into thanks_pending;
 select coalesce(jsonb_agg(item order by confirmed_at desc,id desc),'[]'::jsonb) into contributions from (
  select r.confirmed_at,r.id,jsonb_build_object('id',r.id,'amountCzk',r.amount_czk,'frequency',i.frequency,'confirmedAt',r.confirmed_at) item
  from proplet_private.patron_payments r join proplet_private.patron_intents i on i.id=r.intent_id
  where i.player_id=p_player order by r.confirmed_at desc,r.id desc limit 50
 ) own_payments;

 -- Legacy rows remain intact. Only an explicit interaction proves exposure
 -- for an offer issued before the client could confirm viewport visibility.
 select count(*) filter (where shown_at>t-interval '90 days'),count(*),max(shown_at)
  into recent_offers,visible_offers,last_shown
 from proplet_private.patron_offer_receipts
 where player_id=p_player and (visibility_confirmed or outcome in('opened','declined'));

 select count(distinct (mode,challenge_key)),count(distinct active_day) into boards,days from (
  select distinct mode,challenge_key,(completed_at at time zone 'Europe/Prague')::date active_day
  from public.results where player_id=p_player and mode in('daily','daily_special','free','tajenka')
 ) played;
 select count(distinct (mode,challenge_key)) into post_boards from public.results
  where player_id=p_player and mode in('daily','daily_special','free','tajenka') and completed_at>anchor_at;

 wait_reason:=case
  when is_patron then 'patron'
  when coalesce(pr.offers_disabled,false) then 'disabled'
  when exists(
   select 1 from proplet_private.patron_intents i where i.player_id=p_player
   and not exists(select 1 from proplet_private.patron_payments p where p.intent_id=i.id)
  ) then 'payment_pending'
  when t<anchor_at+interval '48 hours' then 'release_wait'
  when news_at is not null and post_boards<2 then 'post_news_boards'
  when boards<5 or days<3 then 'playing_history'
  when recent_offers>=3 then 'offer_limit'
  when visible_offers=1 and last_shown>t-interval '14 days' then 'cooldown'
  when visible_offers>=2 and last_shown>t-interval '30 days' then 'cooldown'
  else null end;

 -- Old PWA clients still send p_claim=true. They cannot verify visibility.
 return jsonb_build_object('ok',true,'enabled',true,'authenticated',true,'patron',is_patron,
 'publicBadge',is_patron and coalesce(pr.public_badge,false),'offersDisabled',coalesce(pr.offers_disabled,false),
 'canOffer',wait_reason is null,'offerCount90d',recent_offers,'displayGranted',false,'receiptId',null,
 'offerWaitReason',wait_reason,'offerAnchorSource',anchor_source,
 'offerAvailableAt',anchor_at+interval '48 hours','postAnchorBoards',post_boards,
 'thanksPending',thanks_pending,'contributions',contributions,
 'badgeType',case when not is_patron then null when recurring_status->>'state' in('current','grace') then 'recurring' else 'supporter' end,
 'recurringStatus',recurring_status);
end;$$;

create function public.proplet_patron_offer_v2(p_player uuid,p_receipt uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 state jsonb; t timestamptz; reservation_id uuid; reserved_until timestamptz;
begin
 -- Holds the same account lock as news, preferences, payment and QR creation.
 state:=public.proplet_patron_state_v1(p_player,false);
 if state->>'ok'<>'true' then return state;end if;
 t:=clock_timestamp();

 if p_receipt is not null and exists(
  select 1 from proplet_private.patron_offer_receipts
  where id=p_receipt and player_id=p_player and visibility_confirmed
 ) then
  return state||jsonb_build_object('displayGranted',true,'receiptId',p_receipt);
 end if;
 if state->>'canOffer'<>'true' then return state;end if;

 select offer_reservation_id,offer_reserved_until into reservation_id,reserved_until
 from proplet_private.patron_first_seen where player_id=p_player;
 if p_receipt is null then
  if reserved_until>t then
   return state||jsonb_build_object('canOffer',false,'offerWaitReason','reserved');
  end if;
  reservation_id:=gen_random_uuid();
  update proplet_private.patron_first_seen
   set offer_reservation_id=reservation_id,offer_reserved_until=t+interval '1 minute'
   where player_id=p_player;
  return state||jsonb_build_object('displayGranted',true,'receiptId',reservation_id);
 end if;

 if p_receipt is distinct from reservation_id or reserved_until<=t then
  return state||jsonb_build_object('offerWaitReason','reservation_expired');
 end if;
 insert into proplet_private.patron_offer_receipts(id,player_id,shown_at,visibility_confirmed)
  values(p_receipt,p_player,t,true);
 update proplet_private.patron_first_seen
  set offer_reservation_id=null,offer_reserved_until=null where player_id=p_player;
 return state||jsonb_build_object('canOffer',false,'displayGranted',true,'receiptId',p_receipt,
  'offerWaitReason',case when (state->>'offerCount90d')::integer=2 then 'offer_limit' else 'cooldown' end,
  'offerCount90d',(state->>'offerCount90d')::integer+1);
end;$$;
revoke all on function public.proplet_patron_offer_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.proplet_patron_offer_v2(uuid,uuid) to service_role;

create or replace function public.proplet_patron_offer_dismiss_v1(p_player uuid,p_receipt uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_action not in('declined','ignored','opened') or p_action is null then raise exception 'invalid outcome' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 update proplet_private.patron_offer_receipts set outcome=p_action,responded_at=clock_timestamp()
 where id=p_receipt and player_id=p_player and outcome='shown'
  and (p_action<>'ignored' or not visibility_confirmed);
 if not found and not exists(select 1 from proplet_private.patron_offer_receipts where id=p_receipt and player_id=p_player) then
  return jsonb_build_object('ok',false,'code','not_found');end if;
 return public.proplet_patron_state_v1(p_player,false);
end;$$;

commit;
