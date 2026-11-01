begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create schema if not exists proplet_private;
revoke all on schema proplet_private from public,anon,authenticated;
grant usage on schema proplet_private to service_role;
create sequence proplet_private.patron_reference_seq minvalue 1000000001 maxvalue 9999999999 start 1000000001 no cycle;
create table proplet_private.patron_intents(
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.players(id),
 request_id uuid not null,
 reference text not null unique default nextval('proplet_private.patron_reference_seq')::text check(reference ~ '^[1-9][0-9]{0,9}$'),
 amount_czk integer not null check(amount_czk between 1 and 100000),
 frequency text not null default 'once' check(frequency in('once','monthly')),
 first_payment_date date,
 currency text not null default 'CZK' check(currency='CZK'),
 recipient_account text not null default '5531840001/5500' check(recipient_account='5531840001/5500'),
 nickname_snapshot text not null,
 message text not null,
 created_at timestamptz not null default now(),
 unique(player_id,request_id),
 check((frequency='once' and first_payment_date is null) or (frequency='monthly' and first_payment_date is not null and isfinite(first_payment_date)))
);
create table proplet_private.patron_payments(
 id uuid primary key default gen_random_uuid(),
 intent_id uuid not null references proplet_private.patron_intents(id),
 bank_account text not null check(bank_account='5531840001/5500'),
 bank_transaction_id text not null check(length(bank_transaction_id) between 1 and 120),
 reference text not null,
 amount_czk integer not null check(amount_czk between 1 and 100000),
 currency text not null check(currency='CZK'),
 confirmed_by uuid not null references public.players(id),
 confirmed_at timestamptz not null default now(),
 unique(bank_account,bank_transaction_id)
);
create table proplet_private.patron_entitlements(
 player_id uuid primary key references public.players(id),
 first_payment_id uuid not null references proplet_private.patron_payments(id),
 granted_at timestamptz not null default now(),
 thanks_claimed_at timestamptz
);
create table proplet_private.patron_preferences(
 player_id uuid primary key references public.players(id),
 public_badge boolean not null default false,
 offers_disabled boolean not null default false
);
-- First authenticated visit to the enabled UI, never a shared deployment date.
-- Immutable per account so reinstalling or switching devices cannot reset it.
create table proplet_private.patron_first_seen(
 player_id uuid primary key references public.players(id),
 first_seen_at timestamptz not null default statement_timestamp()
);
create table proplet_private.patron_offer_receipts(
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.players(id),
 shown_at timestamptz not null default now(),
 outcome text not null default 'shown' check(outcome in('shown','declined','ignored','opened')),
 responded_at timestamptz
);
create index patron_offer_player_time on proplet_private.patron_offer_receipts(player_id,shown_at desc);
create index patron_intents_created on proplet_private.patron_intents(created_at desc);
create index patron_payments_intent on proplet_private.patron_payments(intent_id,confirmed_at);
create table proplet_private.patron_audit(
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.players(id),
 payment_id uuid not null unique references proplet_private.patron_payments(id),
 intent_id uuid not null references proplet_private.patron_intents(id),
 player_id uuid not null references public.players(id),
 action text not null check(action='bank_payment_confirmed'),
 created_at timestamptz not null default now()
);
-- No direct client access. Intents, receipts and audit cannot be updated/deleted
-- by the application role; corrections require a separately reviewed operation.
do $$declare t text;begin
 foreach t in array array['patron_intents','patron_payments','patron_entitlements','patron_preferences','patron_offer_receipts','patron_audit','patron_first_seen'] loop
  execute format('alter table proplet_private.%I enable row level security',t);
  execute format('revoke all on proplet_private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on proplet_private.%I to service_role',t);
 end loop;
end$$;
grant update on proplet_private.patron_preferences,proplet_private.patron_offer_receipts to service_role;
grant update(thanks_claimed_at) on proplet_private.patron_entitlements to service_role;
grant usage,select on sequence proplet_private.patron_reference_seq,proplet_private.patron_audit_id_seq to service_role;

create function public.proplet_patron_intent_json_v1(p_intent uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',i.id,'reference',i.reference,'amountCzk',i.amount_czk,
 'currency',i.currency,'account',i.recipient_account,'nicknameSnapshot',i.nickname_snapshot,'message',i.message,
 'frequency',i.frequency,'firstPaymentDate',i.first_payment_date,
 'createdAt',i.created_at,'status',case when r.n=0 then 'qr_created' else 'confirmed' end,
 'confirmedAt',r.first_at,'lastConfirmedAt',r.last_at,'paymentCount',r.n,'totalConfirmedCzk',r.total)
 from proplet_private.patron_intents i cross join lateral (
  select count(*) n,min(confirmed_at) first_at,max(confirmed_at) last_at,coalesce(sum(amount_czk),0) total
  from proplet_private.patron_payments where intent_id=i.id
 ) r where i.id=p_intent;
$$;

create function public.proplet_patron_intent_v1(p_player uuid,p_request uuid,p_amount integer,p_frequency text default 'once',p_first_payment_date date default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;i proplet_private.patron_intents%rowtype;n text;
begin
 if p_request is null or p_amount is null or p_amount not between 1 and 100000 or p_frequency is null or p_frequency not in('once','monthly') then raise exception 'invalid intent' using errcode='22023';end if;
 select * into p from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select * into i from proplet_private.patron_intents where player_id=p_player and request_id=p_request;
 if found then
  if i.amount_czk<>p_amount or i.frequency<>p_frequency or i.first_payment_date is distinct from p_first_payment_date then return jsonb_build_object('ok',false,'code','idempotency_conflict');end if;
  return jsonb_build_object('ok',true,'intent',public.proplet_patron_intent_json_v1(i.id));
 end if;
 -- Validate only new instructions: retrying an immutable request remains valid
 -- after its original first-payment date has passed. Calendar is Prague's.
 if (p_frequency='once' and p_first_payment_date is not null) or (p_frequency='monthly' and
  (p_first_payment_date is null or not isfinite(p_first_payment_date) or p_first_payment_date<(statement_timestamp() at time zone 'Europe/Prague')::date)) then
  return jsonb_build_object('ok',false,'code','invalid_first_payment_date');end if;
 n:=left(coalesce(nullif(btrim(p.name),''),'Hráč'),80);
 insert into proplet_private.patron_intents(player_id,request_id,amount_czk,frequency,first_payment_date,nickname_snapshot,message)
 values(p_player,p_request,p_amount,p_frequency,p_first_payment_date,n,left(regexp_replace(n,'[[:cntrl:]]','','g'),60-length(' podporuje Proplet'))||' podporuje Proplet') returning * into i;
 return jsonb_build_object('ok',true,'intent',public.proplet_patron_intent_json_v1(i.id));
end;$$;
create function public.proplet_patron_intent_read_v1(p_player uuid,p_intent uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when exists(select 1 from proplet_private.patron_intents where id=p_intent and player_id=p_player)
 then jsonb_build_object('ok',true,'intent',public.proplet_patron_intent_json_v1(p_intent))
 else jsonb_build_object('ok',false,'code','not_found') end;
$$;

-- News and patron claims share the account lock across devices. A newly claimed
-- news receipt supersedes the fallback clock and resets the two-board gate.
create function proplet_private.patron_lock_news_receipt_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.players where id=new.player_id for update;
 return new;
end;$$;
revoke all on function proplet_private.patron_lock_news_receipt_v1() from public,anon,authenticated;
grant execute on function proplet_private.patron_lock_news_receipt_v1() to service_role;
create trigger patron_serialize_news_receipt before insert on public.release_news_receipts
 for each row execute function proplet_private.patron_lock_news_receipt_v1();

create function public.proplet_patron_state_v1(p_player uuid,p_claim boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.players%rowtype;pr proplet_private.patron_preferences%rowtype;
 t timestamptz:=statement_timestamp();is_patron boolean;n integer;last_shown timestamptz;
 boards integer;days integer;post_boards integer;eligible boolean;granted boolean:=false;receipt uuid;
 first_seen timestamptz;news_at timestamptz;anchor_at timestamptz;anchor_source text;wait_reason text;thanks_pending boolean;contributions jsonb;
begin
 if p_claim is null then raise exception 'invalid claim' using errcode='22023';end if;
 select * into p from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 insert into proplet_private.patron_first_seen(player_id,first_seen_at) values(p_player,t)
  on conflict(player_id) do nothing;
 select first_seen_at into first_seen from proplet_private.patron_first_seen where player_id=p_player;
 select claimed_at into news_at from public.release_news_receipts
  where campaign_id='november-2026-release-v1' and player_id=p_player;
 anchor_at:=coalesce(news_at,first_seen);
 anchor_source:=case when news_at is null then 'first_seen' else 'release_news' end;
 select * into pr from proplet_private.patron_preferences where player_id=p_player;
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) into is_patron;
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player and thanks_claimed_at is null) into thanks_pending;
 select coalesce(jsonb_agg(item order by confirmed_at desc,id desc),'[]'::jsonb) into contributions from (
  select r.confirmed_at,r.id,jsonb_build_object('id',r.id,'amountCzk',r.amount_czk,'frequency',i.frequency,'confirmedAt',r.confirmed_at) item
  from proplet_private.patron_payments r join proplet_private.patron_intents i on i.id=r.intent_id
  where i.player_id=p_player order by r.confirmed_at desc,r.id desc limit 50
 ) own_payments;

 select count(*),max(shown_at) into n,last_shown from proplet_private.patron_offer_receipts where player_id=p_player and shown_at>t-interval '90 days';
 -- Completed boards define active playing days, not passive page opens.
 select count(distinct (mode,challenge_key)),count(distinct active_day) into boards,days from (
  select distinct mode,challenge_key,(completed_at at time zone 'Europe/Prague')::date active_day
  from public.results where player_id=p_player and mode in('daily','daily_special','free','tajenka')
 ) played;
 select count(distinct (mode,challenge_key)) into post_boards from public.results
  where player_id=p_player and mode in('daily','daily_special','free','tajenka') and completed_at>anchor_at;
 -- support_mode='younger' is the balanced help preset, not an age signal.
 wait_reason:=case
  when is_patron then 'patron'
  when coalesce(pr.offers_disabled,false) then 'disabled'
  when t<anchor_at+interval '48 hours' then 'release_wait'
  when news_at is not null and post_boards<2 then 'post_news_boards'
  when boards<5 or days<3 then 'playing_history'
  when n>=2 then 'offer_limit'
  when last_shown>t-interval '30 days' then 'cooldown'
  else null end;
 eligible:=wait_reason is null;
 if p_claim and eligible then
  insert into proplet_private.patron_offer_receipts(player_id,shown_at) values(p_player,t) returning id into receipt;
  granted:=true;n:=n+1;eligible:=false;wait_reason:='cooldown';
 end if;
 return jsonb_build_object('ok',true,'enabled',true,'authenticated',true,'patron',is_patron,
 'publicBadge',is_patron and coalesce(pr.public_badge,false),'offersDisabled',coalesce(pr.offers_disabled,false),
 'canOffer',eligible,'offerCount90d',n,'displayGranted',granted,'receiptId',receipt,
 'offerWaitReason',wait_reason,'offerAnchorSource',anchor_source,
 'offerAvailableAt',anchor_at+interval '48 hours','postAnchorBoards',post_boards,
 'thanksPending',thanks_pending,'contributions',contributions);
end;$$;
-- Acknowledgement is account-wide and at most once, independent of public badge.
create function public.proplet_patron_thanks_claim_v1(p_player uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare granted boolean;is_patron boolean;
begin
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 update proplet_private.patron_entitlements set thanks_claimed_at=statement_timestamp()
  where player_id=p_player and thanks_claimed_at is null;
 granted:=found;
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) into is_patron;
 return jsonb_build_object('ok',true,'displayGranted',granted,'patron',is_patron);
end;$$;

create function public.proplet_patron_preferences_v1(p_player uuid,p_public boolean,p_disabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_public is null or p_disabled is null then raise exception 'invalid preferences' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 if p_public and not exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) then
  return jsonb_build_object('ok',false,'code','not_confirmed');end if;
 insert into proplet_private.patron_preferences(player_id,public_badge,offers_disabled)
 values(p_player,p_public,p_disabled) on conflict(player_id) do update set public_badge=excluded.public_badge,offers_disabled=excluded.offers_disabled;
 return public.proplet_patron_state_v1(p_player,false);
end;$$;
create function public.proplet_patron_offer_dismiss_v1(p_player uuid,p_receipt uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_action not in('declined','ignored','opened') or p_action is null then raise exception 'invalid outcome' using errcode='22023';end if;
 update proplet_private.patron_offer_receipts set outcome=p_action,responded_at=statement_timestamp()
 where id=p_receipt and player_id=p_player and outcome='shown';
 if not found and not exists(select 1 from proplet_private.patron_offer_receipts where id=p_receipt and player_id=p_player) then
  return jsonb_build_object('ok',false,'code','not_found');end if;
 return public.proplet_patron_state_v1(p_player,false);
end;$$;

create function public.proplet_patron_confirm_v1(p_actor uuid,p_intent uuid,p_reference text,p_bank_tx text,p_amount integer,p_currency text,p_account text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i proplet_private.patron_intents%rowtype;r proplet_private.patron_payments%rowtype;
begin
 if not exists(select 1 from public.admin_accounts where player_id=p_actor and active and role in('owner','editor')) then
  raise exception 'admin permission required' using errcode='42501';end if;
 select * into i from proplet_private.patron_intents where id=p_intent;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 if i.reference is distinct from p_reference or i.amount_czk is distinct from p_amount or i.currency is distinct from p_currency or i.recipient_account is distinct from p_account
  or p_bank_tx is null or p_bank_tx !~ '^[A-Za-z0-9_.:/-]{1,120}$' then
  return jsonb_build_object('ok',false,'code','payment_mismatch');end if;
 perform 1 from public.players where id=i.player_id for update;
 select * into r from proplet_private.patron_payments where bank_account=p_account and bank_transaction_id=p_bank_tx;
 if found then
  if r.intent_id=i.id then
   return jsonb_build_object('ok',true,'alreadyConfirmed',true,'patron',true,'intent',public.proplet_patron_intent_json_v1(i.id));
  end if;
  return jsonb_build_object('ok',false,'code','bank_transaction_already_used');
 end if;
 if i.frequency='once' and exists(select 1 from proplet_private.patron_payments where intent_id=i.id) then
  return jsonb_build_object('ok',false,'code','already_confirmed_different_receipt');end if;
 begin
  insert into proplet_private.patron_payments(intent_id,bank_account,bank_transaction_id,reference,amount_czk,currency,confirmed_by)
  values(i.id,p_account,p_bank_tx,p_reference,p_amount,p_currency,p_actor) returning * into r;
 exception when unique_violation then return jsonb_build_object('ok',false,'code','bank_transaction_already_used');end;
 insert into proplet_private.patron_entitlements(player_id,first_payment_id) values(i.player_id,r.id) on conflict(player_id) do nothing;
 insert into proplet_private.patron_audit(actor_id,payment_id,intent_id,player_id,action) values(p_actor,r.id,i.id,i.player_id,'bank_payment_confirmed');
 return jsonb_build_object('ok',true,'alreadyConfirmed',false,'patron',true,'intent',public.proplet_patron_intent_json_v1(i.id));
end;$$;
create function public.proplet_patron_admin_list_v1(p_days integer default 7,p_limit integer default 100,p_reference text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare items jsonb;
begin
 if p_days is null or p_days not between 1 and 90 or p_limit is null or p_limit not between 1 and 200 then raise exception 'invalid pagination' using errcode='22023';end if;
 select coalesce(jsonb_agg(row order by created_at desc),'[]'::jsonb) into items from (
  select public.proplet_patron_intent_json_v1(i.id)||jsonb_build_object('playerId',i.player_id,'currentNickname',p.name,
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'bankTransactionId',r.bank_transaction_id,
    'amountCzk',r.amount_czk,'confirmedAt',r.confirmed_at,'confirmedBy',r.confirmed_by) order by r.confirmed_at,r.id)
    from proplet_private.patron_payments r where r.intent_id=i.id),'[]'::jsonb)) row,i.created_at
  from proplet_private.patron_intents i join public.players p on p.id=i.player_id
  where (p_reference is not null and i.reference=p_reference) or (p_reference is null and i.created_at>=statement_timestamp()-make_interval(days=>p_days)) order by i.created_at desc limit p_limit
 ) page;
 return jsonb_build_object('ok',true,'items',items,'days',p_days,'limit',p_limit,'meaning','qr_created_is_not_payment');
end;$$;
create function public.proplet_patron_public_ids_v1(p_players uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(array_length(p_players,1),0)>2000 then raise exception 'too many players' using errcode='22023';end if;
 return jsonb_build_object('players',coalesce((select jsonb_agg(e.player_id) from proplet_private.patron_entitlements e
 join proplet_private.patron_preferences pr on pr.player_id=e.player_id join public.players p on p.id=e.player_id
 where e.player_id=any(p_players) and pr.public_badge and p.public_rankings is true),'[]'::jsonb));
end;$$;

do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'proplet_patron_%_v1' loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end$$;
commit;
