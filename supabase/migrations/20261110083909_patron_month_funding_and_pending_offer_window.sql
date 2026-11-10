-- Bounded reminder suppression and aggregate confirmed monthly funding.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function public.proplet_patron_state_v1(p_player uuid,p_claim boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 pr proplet_private.patron_preferences%rowtype;
 t timestamptz; is_patron boolean; recent_offers integer; visible_offers integer; last_shown timestamptz;
 boards integer; days integer; post_boards integer; wait_reason text;
 first_seen timestamptz; news_at timestamptz; anchor_at timestamptz; anchor_source text;
 thanks_pending boolean; contributions jsonb; recurring_status jsonb;
 month_start date; month_end date; raised_czk bigint;
begin
 if p_claim is null then raise exception 'invalid claim' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 t:=clock_timestamp();
 month_start:=date_trunc('month',t at time zone 'Europe/Prague')::date;
 month_end:=(month_start+interval '1 month')::date;
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

 -- Count bank receipts once, never intents, entitlements or manual badges.
 -- Explicit bank paid_on wins; legacy receipts use Prague confirmation date.
 select coalesce(sum(r.amount_czk),0) into raised_czk
 from proplet_private.patron_payments r
 left join proplet_private.patron_payment_dates d on d.payment_id=r.id
 where coalesce(d.paid_on,(r.confirmed_at at time zone 'Europe/Prague')::date)>=month_start
   and coalesce(d.paid_on,(r.confirmed_at at time zone 'Europe/Prague')::date)<month_end;

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
   -- A QR is not a payment and must not silence reminders indefinitely.
   -- Keep its instructions and idempotency intact, including late transfers.
   and i.created_at>t-interval '7 days'
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
 'monthFunding',jsonb_build_object('month',to_char(month_start,'YYYY-MM'),'raisedCzk',raised_czk,
  'goalCzk',2000,'remainingCzk',greatest(0,2000-raised_czk)),
 'badgeType',case when not is_patron then null when recurring_status->>'state' in('current','grace') then 'recurring' else 'supporter' end,
 'recurringStatus',recurring_status);
end;$$;

-- CREATE OR REPLACE preserves service-role-only execution of this RPC.
commit;
