-- Keep prepared QR amounts immutable; explicitly reviewed overpayments are receipts.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table proplet_private.patron_audit
 add column expected_amount_czk integer,
 add column higher_amount_approved boolean not null default false;

create function public.proplet_patron_confirm_v3(p_actor uuid,p_intent uuid,p_reference text,
 p_bank_tx text,p_amount integer,p_currency text,p_account text,p_paid_on date,
 p_allow_higher_amount boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i proplet_private.patron_intents%rowtype;r proplet_private.patron_payments%rowtype;existing date;
begin
 if not exists(select 1 from public.admin_accounts where player_id=p_actor and active and role in('owner','editor')) then
  raise exception 'admin permission required' using errcode='42501';end if;
 if p_paid_on is null or not isfinite(p_paid_on) or p_paid_on>(statement_timestamp() at time zone 'Europe/Prague')::date then
  return jsonb_build_object('ok',false,'code','invalid_paid_on');end if;
 select * into i from proplet_private.patron_intents where id=p_intent;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 if i.reference is distinct from p_reference or i.currency is distinct from p_currency or i.recipient_account is distinct from p_account
  or p_bank_tx is null or p_bank_tx !~ '^[A-Za-z0-9_.:/-]{1,120}$'
  or p_amount is null or p_amount not between 1 and 100000 or p_amount<i.amount_czk then
  return jsonb_build_object('ok',false,'code','payment_mismatch');end if;
 if p_amount>i.amount_czk and p_allow_higher_amount is distinct from true then
  return jsonb_build_object('ok',false,'code','higher_amount_confirmation_required');end if;
 -- Serialize all receipts for this player, including replays and monthly payments.
 perform 1 from public.players where id=i.player_id for update;
 select * into r from proplet_private.patron_payments where bank_account=p_account and bank_transaction_id=p_bank_tx;
 if found then
  if r.intent_id<>i.id then return jsonb_build_object('ok',false,'code','bank_transaction_already_used');end if;
  if r.amount_czk is distinct from p_amount or r.reference is distinct from p_reference or r.currency is distinct from p_currency then
   return jsonb_build_object('ok',false,'code','payment_mismatch');end if;
  select paid_on into existing from proplet_private.patron_payment_dates where payment_id=r.id;
  if found and existing<>p_paid_on then return jsonb_build_object('ok',false,'code','paid_on_conflict');end if;
  -- Match v2: a replay can supply a missing historical bank date, never overwrite it.
  insert into proplet_private.patron_payment_dates(payment_id,paid_on,recorded_by)
  values(r.id,p_paid_on,p_actor) on conflict(payment_id) do nothing;
  return jsonb_build_object('ok',true,'alreadyConfirmed',true,'patron',true,'intent',public.proplet_patron_intent_json_v1(i.id),'paidOn',p_paid_on);
 end if;
 if i.frequency='once' and exists(select 1 from proplet_private.patron_payments where intent_id=i.id) then
  return jsonb_build_object('ok',false,'code','already_confirmed_different_receipt');end if;
 begin
  insert into proplet_private.patron_payments(intent_id,bank_account,bank_transaction_id,reference,amount_czk,currency,confirmed_by)
  values(i.id,p_account,p_bank_tx,p_reference,p_amount,p_currency,p_actor) returning * into r;
 exception when unique_violation then return jsonb_build_object('ok',false,'code','bank_transaction_already_used');end;
 insert into proplet_private.patron_payment_dates(payment_id,paid_on,recorded_by) values(r.id,p_paid_on,p_actor);
 insert into proplet_private.patron_entitlements(player_id,first_payment_id) values(i.player_id,r.id) on conflict(player_id) do nothing;
 insert into proplet_private.patron_audit(actor_id,payment_id,intent_id,player_id,action,expected_amount_czk,higher_amount_approved)
 values(p_actor,r.id,i.id,i.player_id,'bank_payment_confirmed',i.amount_czk,p_amount>i.amount_czk);
 return jsonb_build_object('ok',true,'alreadyConfirmed',false,'patron',true,'intent',public.proplet_patron_intent_json_v1(i.id),'paidOn',p_paid_on);
end $$;
revoke all on function public.proplet_patron_confirm_v3(uuid,uuid,text,text,integer,text,text,date,boolean) from public,anon,authenticated;
grant execute on function public.proplet_patron_confirm_v3(uuid,uuid,text,text,integer,text,text,date,boolean) to service_role;
commit;
