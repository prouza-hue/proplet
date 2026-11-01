-- Owner-requested public promotional supporter badge, never a bank payment.
-- No data grant is seeded here. Explicit audited RPC activation is separate.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table proplet_private.patron_manual_badge_events(
 id uuid primary key default gen_random_uuid(),
 ordinal bigint generated always as identity unique,
 request_id uuid not null unique,
 actor_id uuid not null references public.players(id),
 player_id uuid not null references public.players(id),
 action text not null check(action in('grant','revoke')),
 reason text not null check(length(btrim(reason)) between 12 and 500),
 public_requested boolean not null,
 receipt jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index patron_manual_badge_player_latest on proplet_private.patron_manual_badge_events(player_id,ordinal desc);
alter table proplet_private.patron_manual_badge_events enable row level security;
revoke all on proplet_private.patron_manual_badge_events from public,anon,authenticated,service_role;
grant select on proplet_private.patron_manual_badge_events to service_role;
revoke all on sequence proplet_private.patron_manual_badge_events_ordinal_seq from public,anon,authenticated,service_role;

create function proplet_private.patron_effective_v1(p_player uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player)
 or coalesce((select action='grant' from proplet_private.patron_manual_badge_events where player_id=p_player order by ordinal desc limit 1),false)
$$;
revoke all on function proplet_private.patron_effective_v1(uuid) from public,anon,authenticated;
grant execute on function proplet_private.patron_effective_v1(uuid) to service_role;

-- Preserve all financial and offer behavior; only the source of supporter
-- status gains an explicitly separate, non-monetary manual entitlement.
do $patch$ declare source text;fn regprocedure;old text;
begin
 foreach fn in array array['public.proplet_patron_state_v1(uuid,boolean)'::regprocedure,
  'public.proplet_patron_thanks_claim_v1(uuid)'::regprocedure] loop
 source:=pg_get_functiondef(fn);
 old:='select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) into is_patron;';
 if position(old in source)=0 then raise exception 'PATRON_STATUS_PATCH_BOUNDARY_CHANGED: %',fn;end if;
 execute replace(source,old,'select proplet_private.patron_effective_v1(p_player) into is_patron;');
 end loop;
 source:=pg_get_functiondef('public.proplet_patron_preferences_v1(uuid,boolean,boolean)'::regprocedure);
 old:='if p_public and not exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) then';
 if position(old in source)=0 then raise exception 'PATRON_PREFERENCE_PATCH_BOUNDARY_CHANGED';end if;
 execute replace(source,old,'if p_public and not proplet_private.patron_effective_v1(p_player) then');
end $patch$;

create or replace function public.proplet_patron_public_ids_v1(p_players uuid[]) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if coalesce(array_length(p_players,1),0)>2000 then raise exception 'too many players' using errcode='22023';end if;
 return jsonb_build_object('players',coalesce((select jsonb_agg(p.id) from public.players p
 join proplet_private.patron_preferences pr on pr.player_id=p.id
 where p.id=any(p_players) and pr.public_badge and p.public_rankings is true
 and proplet_private.patron_effective_v1(p.id)),'[]'::jsonb));
end $$;

-- Deliberately restricted to the already UUID-bound owner acting on their own
-- account. The server-only caller cannot mint a payment or another user's badge.
create function public.proplet_patron_owner_badge_v1(
 p_actor uuid,p_player uuid,p_request uuid,p_action text,p_reason text,p_public boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior proplet_private.patron_manual_badge_events;event_id uuid:=gen_random_uuid();result jsonb;
 paid boolean;effective boolean;visible boolean;
begin
 if p_actor is distinct from 'e1740794-d196-48da-a59a-2741eadb8e44'::uuid or p_player is distinct from p_actor
 or not exists(select 1 from public.admin_accounts where player_id=p_actor and active and role='owner') then
 raise exception 'PATRON_OWNER_REQUIRED' using errcode='42501';end if;
 if p_request is null or p_action is null or p_action not in('grant','revoke') or p_reason is null
 or length(btrim(p_reason)) not between 12 and 500 or p_public is null or (p_action='revoke' and p_public) then
 raise exception 'PATRON_MANUAL_BADGE_INVALID' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then raise exception 'PATRON_PLAYER_NOT_FOUND' using errcode='22023';end if;
 select * into prior from proplet_private.patron_manual_badge_events where request_id=p_request;
 if found then
 if prior.actor_id<>p_actor or prior.player_id<>p_player or prior.action<>p_action or prior.reason<>btrim(p_reason)
 or prior.public_requested<>p_public then raise exception 'PATRON_MANUAL_IDEMPOTENCY_CONFLICT' using errcode='22023';end if;
 return prior.receipt;end if;
 select exists(select 1 from proplet_private.patron_entitlements where player_id=p_player) into paid;
 effective:=paid or p_action='grant';
 if p_action='grant' then
 insert into proplet_private.patron_preferences(player_id,public_badge) values(p_player,p_public)
 on conflict(player_id) do update set public_badge=excluded.public_badge;
 elsif not paid then
 update proplet_private.patron_preferences set public_badge=false where player_id=p_player;
 end if;
 select effective and coalesce((select public_badge from proplet_private.patron_preferences where player_id=p_player),false)
 and coalesce((select public_rankings from public.players where id=p_player),false) into visible;
 result:=jsonb_build_object('ok',true,'auditId',event_id,'playerId',p_player,'action',p_action,
 'source','owner_promotional_badge','patron',effective,'publicBadge',visible,'paymentCreated',false);
 insert into proplet_private.patron_manual_badge_events(id,request_id,actor_id,player_id,action,reason,public_requested,receipt)
 values(event_id,p_request,p_actor,p_player,p_action,btrim(p_reason),p_public,result);
 return result;
end $$;
revoke all on function public.proplet_patron_owner_badge_v1(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.proplet_patron_owner_badge_v1(uuid,uuid,uuid,text,text,boolean) to service_role;
-- CREATE OR REPLACE keeps the existing service-only public-ID ACL.
commit;
