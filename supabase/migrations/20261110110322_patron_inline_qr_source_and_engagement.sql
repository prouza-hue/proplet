-- Automatic payable QR is an exposure, never implied payment interest.
-- Existing intents, bank references, ledger rows and confirmations stay immutable.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table proplet_private.patron_automatic_intents(
 intent_id uuid primary key references proplet_private.patron_intents(id),
 receipt_id uuid not null unique references proplet_private.patron_offer_receipts(id),
 prepared_at timestamptz not null default clock_timestamp(),
 engaged_at timestamptz,
 engagement_action text check(engagement_action in('saved','copied')),
 check((engaged_at is null)=(engagement_action is null))
);
alter table proplet_private.patron_automatic_intents enable row level security;
revoke all on proplet_private.patron_automatic_intents from public,anon,authenticated,service_role;
grant select,insert on proplet_private.patron_automatic_intents to service_role;
grant update(engaged_at,engagement_action) on proplet_private.patron_automatic_intents to service_role;

create or replace function public.proplet_patron_intent_json_v1(p_intent uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',i.id,'reference',i.reference,'amountCzk',i.amount_czk,
 'currency',i.currency,'account',i.recipient_account,'nicknameSnapshot',i.nickname_snapshot,'message',i.message,
 'frequency',i.frequency,'firstPaymentDate',i.first_payment_date,
 'createdAt',i.created_at,'status',case when r.n=0 then 'qr_created' else 'confirmed' end,
 'confirmedAt',r.first_at,'lastConfirmedAt',r.last_at,'paymentCount',r.n,'totalConfirmedCzk',r.total,
 'source',case when a.intent_id is null then 'manual' else 'automatic_offer' end,
 'offerShownAt',o.shown_at,'engagedAt',a.engaged_at,'engagementAction',a.engagement_action)
 from proplet_private.patron_intents i
 left join proplet_private.patron_automatic_intents a on a.intent_id=i.id
 left join proplet_private.patron_offer_receipts o on o.id=a.receipt_id
 cross join lateral (
  select count(*) n,min(confirmed_at) first_at,max(confirmed_at) last_at,coalesce(sum(amount_czk),0) total
  from proplet_private.patron_payments where intent_id=i.id
 ) r where i.id=p_intent;
$$;

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
   select 1 from proplet_private.patron_intents i
   left join proplet_private.patron_automatic_intents a on a.intent_id=i.id
   where i.player_id=p_player
   -- Unengaged automatic QR is not interest. Explicit preparations retain
   -- their creation clock; successful automatic save/copy starts its own clock.
   and case when a.intent_id is null then i.created_at else a.engaged_at end>t-interval '7 days'
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


create function public.proplet_patron_offer_qr_v1(p_player uuid,p_receipt uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare state jsonb;receipt proplet_private.patron_offer_receipts%rowtype;intent_id uuid;value jsonb;
begin
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select * into receipt from proplet_private.patron_offer_receipts
  where id=p_receipt and player_id=p_player and visibility_confirmed;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select a.intent_id into intent_id from proplet_private.patron_automatic_intents a where a.receipt_id=p_receipt;
 -- A retry is read-only and returns the same instructions even after expiry,
 -- engagement or payment. Expiry/latest checks below guard all new creations.
 if found then return jsonb_build_object('ok',true,'intent',public.proplet_patron_intent_json_v1(intent_id));end if;
 if receipt.outcome<>'shown' or receipt.shown_at<=clock_timestamp()-interval '15 minutes'
  or exists(select 1 from proplet_private.patron_offer_receipts o where o.player_id=p_player
   and o.visibility_confirmed and o.shown_at>receipt.shown_at) then
  return jsonb_build_object('ok',false,'code','offer_expired');end if;
 state:=public.proplet_patron_state_v1(p_player,false);
 -- This very receipt causes cooldown/limit; every other gate still applies.
 if not coalesce((state->>'canOffer')::boolean,false)
  and coalesce(state->>'offerWaitReason','') not in('cooldown','offer_limit') then
  return jsonb_build_object('ok',false,'code','offer_ineligible');end if;
 value:=public.proplet_patron_intent_v1(p_player,gen_random_uuid(),129,'once',null);
 if not coalesce((value->>'ok')::boolean,false) then return value;end if;
 intent_id:=(value->'intent'->>'id')::uuid;
 insert into proplet_private.patron_automatic_intents(intent_id,receipt_id) values(intent_id,p_receipt);
 return jsonb_build_object('ok',true,'intent',public.proplet_patron_intent_json_v1(intent_id));
end;$$;
revoke all on function public.proplet_patron_offer_qr_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.proplet_patron_offer_qr_v1(uuid,uuid) to service_role;

create function public.proplet_patron_offer_engage_v1(p_player uuid,p_intent uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare engaged timestamptz;
begin
 if p_action is null or p_action not in('saved','copied') then raise exception 'invalid engagement' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select a.engaged_at into engaged from proplet_private.patron_automatic_intents a
 join proplet_private.patron_intents i on i.id=a.intent_id
 where a.intent_id=p_intent and i.player_id=p_player;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 if engaged is null then
  engaged:=clock_timestamp();
  update proplet_private.patron_automatic_intents set engaged_at=engaged,engagement_action=p_action where intent_id=p_intent;
 end if;
 return public.proplet_patron_state_v1(p_player,false)||jsonb_build_object('engagedAt',engaged);
end;$$;
revoke all on function public.proplet_patron_offer_engage_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.proplet_patron_offer_engage_v1(uuid,uuid,text) to service_role;

create or replace function public.proplet_patron_admin_list_v1(p_days integer default 7,p_limit integer default 100,p_reference text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare items jsonb;summary jsonb;
begin
 if p_days is null or p_days not between 1 and 90 or p_limit is null or p_limit not between 1 and 200 then raise exception 'invalid pagination' using errcode='22023';end if;
 select coalesce(jsonb_agg(row order by created_at desc),'[]'::jsonb) into items from (
  select public.proplet_patron_intent_json_v1(i.id)||jsonb_build_object('playerId',i.player_id,'currentNickname',p.name,
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'bankTransactionId',r.bank_transaction_id,
    'amountCzk',r.amount_czk,'confirmedAt',r.confirmed_at,'confirmedBy',r.confirmed_by,
    'paidOn',(select paid_on from proplet_private.patron_payment_dates d where d.payment_id=r.id)) order by r.confirmed_at,r.id)
    from proplet_private.patron_payments r where r.intent_id=i.id),'[]'::jsonb)) row,i.created_at
  from proplet_private.patron_intents i join public.players p on p.id=i.player_id
  where (p_reference is not null and i.reference=p_reference) or (p_reference is null and i.created_at>=statement_timestamp()-make_interval(days=>p_days)) order by i.created_at desc limit p_limit
 ) page;
 -- Counts cover the requested creation period before pagination. OfferShownAt
 -- proves the reminder card, not that its QR was fetched/rendered successfully.
 select jsonb_build_object(
  'manualPreparations',count(*) filter(where a.intent_id is null),
  'automaticPrepared',count(*) filter(where a.intent_id is not null),
  'automaticOfferShown',count(*) filter(where a.intent_id is not null and o.visibility_confirmed),
  'automaticEngaged',count(*) filter(where a.engaged_at is not null),
  'activeInterest',count(*) filter(where a.intent_id is null or a.engaged_at is not null),
  'confirmedIntents',count(*) filter(where exists(select 1 from proplet_private.patron_payments r where r.intent_id=i.id))) into summary
 from proplet_private.patron_intents i
 left join proplet_private.patron_automatic_intents a on a.intent_id=i.id
 left join proplet_private.patron_offer_receipts o on o.id=a.receipt_id
 where (p_reference is not null and i.reference=p_reference) or (p_reference is null and i.created_at>=statement_timestamp()-make_interval(days=>p_days));
 return jsonb_build_object('ok',true,'items',items,'summary',summary,'days',p_days,'limit',p_limit,'meaning','automatic_qr_is_not_interest_or_payment');
end;$$;
commit;
