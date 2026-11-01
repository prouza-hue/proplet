-- PREPARED ONLY. Actual bank dates are recorded explicitly; never inferred
-- from QR instructions or from the administrator's confirmation timestamp.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table proplet_private.patron_payment_dates(
 payment_id uuid primary key references proplet_private.patron_payments(id),
 paid_on date not null check(isfinite(paid_on)),
 recorded_by uuid not null references public.players(id),
 recorded_at timestamptz not null default statement_timestamp()
);
alter table proplet_private.patron_payment_dates enable row level security;
revoke all on proplet_private.patron_payment_dates from public,anon,authenticated,service_role;
grant select,insert on proplet_private.patron_payment_dates to service_role;

-- Internal clock parameter permits deterministic native SQL tests. The public
-- state/ranking APIs always use the current Europe/Prague calendar date.
create function proplet_private.patron_recurring_v1(p_player uuid,
 p_today date default (statement_timestamp() at time zone 'Europe/Prague')::date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare first_day date;last_day date;month_start date;due date;grace_until date;
 grace_days constant integer:=7;status text;
begin
 select min(d.paid_on),max(d.paid_on) into first_day,last_day
 from proplet_private.patron_payments r
 join proplet_private.patron_payment_dates d on d.payment_id=r.id
 join proplet_private.patron_intents i on i.id=r.intent_id
 where i.player_id=p_player and i.frequency='monthly' and d.paid_on<=p_today;
 if first_day is null then
  return jsonb_build_object('state','none','paidThrough',null,'nextDue',null,'graceUntil',null,'graceDays',grace_days);
 end if;
 -- One calendar month after the latest ACTUAL monthly receipt. Count/amount
 -- cannot buy future months. Keep the original day across all monthly intents,
 -- so January 31 -> February 28 -> March 31 never drifts to March 28.
 month_start:=(date_trunc('month',last_day::timestamp)+interval '1 month')::date;
 due:=month_start+least(extract(day from first_day)::integer,
  extract(day from month_start+interval '1 month - 1 day')::integer)-1;
 -- The expected payment may arrive throughout its due day. Seven additional
 -- calendar days follow: Dec 1 due -> grace Dec 2-8 -> blue Dec 9 midnight.
 grace_until:=due+grace_days;
 status:=case when p_today<=due then 'current' when p_today<=grace_until then 'grace' else 'expired' end;
 return jsonb_build_object('state',status,'paidThrough',due-1,'nextDue',due,'graceUntil',grace_until,'graceDays',grace_days);
end $$;
revoke all on function proplet_private.patron_recurring_v1(uuid,date) from public,anon,authenticated;
grant execute on function proplet_private.patron_recurring_v1(uuid,date) to service_role;

create function public.proplet_patron_confirm_v2(p_actor uuid,p_intent uuid,p_reference text,
 p_bank_tx text,p_amount integer,p_currency text,p_account text,p_paid_on date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;r proplet_private.patron_payments%rowtype;existing date;
begin
 if p_paid_on is null or not isfinite(p_paid_on) or p_paid_on>(statement_timestamp() at time zone 'Europe/Prague')::date then
  return jsonb_build_object('ok',false,'code','invalid_paid_on');end if;
 -- v1 retains exact account/amount/VS matching, account locking, bank-ID
 -- idempotence and the financial audit. A failure later rolls all of it back.
 result:=public.proplet_patron_confirm_v1(p_actor,p_intent,p_reference,p_bank_tx,p_amount,p_currency,p_account);
 if not coalesce((result->>'ok')::boolean,false) then return result;end if;
 select * into r from proplet_private.patron_payments where bank_account=p_account and bank_transaction_id=p_bank_tx;
 select paid_on into existing from proplet_private.patron_payment_dates where payment_id=r.id;
 if found and existing<>p_paid_on then
  return jsonb_build_object('ok',false,'code','paid_on_conflict');end if;
 -- A replay may supply an explicitly reviewed missing historical bank date.
 -- This immutable row itself records who supplied that date and when.
 insert into proplet_private.patron_payment_dates(payment_id,paid_on,recorded_by)
 values(r.id,p_paid_on,p_actor) on conflict(payment_id) do nothing;
 return result||jsonb_build_object('paidOn',p_paid_on);
end $$;
revoke all on function public.proplet_patron_confirm_v2(uuid,uuid,text,text,integer,text,text,date) from public,anon,authenticated;
grant execute on function public.proplet_patron_confirm_v2(uuid,uuid,text,text,integer,text,text,date) to service_role;

-- Keep existing offer/thanks/history contracts. The status is computed on read,
-- so expiry needs no scheduled job and can never delete permanent support.
do $patch$ declare source text;old text;
begin
 source:=pg_get_functiondef('public.proplet_patron_state_v1(uuid,boolean)'::regprocedure);
 old:='''thanksPending'',thanks_pending,''contributions'',contributions);';
 if position(old in source)=0 then raise exception 'PATRON_RECURRING_STATE_PATCH_BOUNDARY_CHANGED';end if;
 execute replace(source,old,'''thanksPending'',thanks_pending,''contributions'',contributions,
 ''badgeType'',case when not is_patron then null when proplet_private.patron_recurring_v1(p_player)->>''state'' in(''current'',''grace'') then ''recurring'' else ''supporter'' end,
 ''recurringStatus'',proplet_private.patron_recurring_v1(p_player));');
 source:=pg_get_functiondef('public.proplet_patron_admin_list_v1(integer,integer,text)'::regprocedure);
 old:='''amountCzk'',r.amount_czk,''confirmedAt'',r.confirmed_at,''confirmedBy'',r.confirmed_by';
 if position(old in source)=0 then raise exception 'PATRON_RECURRING_ADMIN_PATCH_BOUNDARY_CHANGED';end if;
 execute replace(source,old,old||',''paidOn'',(select paid_on from proplet_private.patron_payment_dates d where d.payment_id=r.id)');
end $patch$;

-- Add only the opted-in public presentation type; dates and private status
-- never leave the personal state/admin APIs. Preserve the old players list.
create or replace function public.proplet_patron_public_ids_v1(p_players uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare visible_ids uuid[];
begin
 if coalesce(array_length(p_players,1),0)>2000 then raise exception 'too many players' using errcode='22023';end if;
 select coalesce(array_agg(p.id),'{}'::uuid[]) into visible_ids from public.players p
 join proplet_private.patron_preferences pr on pr.player_id=p.id
 where p.id=any(p_players) and pr.public_badge and p.public_rankings is true
 and proplet_private.patron_effective_v1(p.id);
 return jsonb_build_object('players',to_jsonb(visible_ids),'badges',coalesce((
  select jsonb_object_agg(id::text,case when proplet_private.patron_recurring_v1(id)->>'state' in('current','grace') then 'recurring' else 'supporter' end)
  from unnest(visible_ids) id),'{}'::jsonb));
end $$;
commit;
