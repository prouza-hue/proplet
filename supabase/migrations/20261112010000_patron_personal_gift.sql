begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table proplet_private.patron_personal_gifts (
 player_id uuid primary key references public.players(id),
 gift_id text not null unique,
 status text not null default 'pending' check(status in ('pending','answered','declined')),
 answer text check(length(answer) between 1 and 1000),
 deferred_until timestamptz,
 responded_at timestamptz,
 created_at timestamptz not null default statement_timestamp()
);
alter table proplet_private.patron_personal_gifts enable row level security;
revoke all on proplet_private.patron_personal_gifts from public,anon,authenticated,service_role;
grant select,insert,update on proplet_private.patron_personal_gifts to service_role;
-- This is one personal invitation, not a contribution threshold or public award.
insert into proplet_private.patron_personal_gifts(player_id,gift_id)
select id,'zdenek-personal-badge-20261112' from public.players
where id='449e0545-26f8-4e37-b023-c06eeec9f307';

create function public.proplet_patron_gift_v1(p_player uuid,p_action text,p_answer text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g proplet_private.patron_personal_gifts%rowtype;
begin
 select * into g from proplet_private.patron_personal_gifts where player_id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'gift',null);end if;
 if p_action not in ('read','answer','later','decline') or p_action is null then
  return jsonb_build_object('ok',false,'code','invalid_action');
 end if;
 if p_action='answer' and (p_answer is null or length(btrim(p_answer)) not between 1 and 1000) then
  return jsonb_build_object('ok',false,'code','invalid_answer');
 end if;
 -- Completed choices are immutable; retries return the saved choice.
 if g.status='pending' and p_action<>'read' then
  update proplet_private.patron_personal_gifts set
   status=case p_action when 'answer' then 'answered' when 'decline' then 'declined' else status end,
   answer=case when p_action='answer' then btrim(p_answer) else answer end,
   deferred_until=case when p_action='later' then statement_timestamp()+interval '1 day' else null end,
   responded_at=case when p_action in ('answer','decline') then statement_timestamp() else responded_at end
  where player_id=p_player returning * into g;
 end if;
 return jsonb_build_object('ok',true,'gift',jsonb_build_object('id',g.gift_id,'status',g.status,
  'pending',g.status='pending' and (g.deferred_until is null or g.deferred_until<=statement_timestamp()),'answer',g.answer));
end $$;
revoke all on function public.proplet_patron_gift_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.proplet_patron_gift_v1(uuid,text,text) to service_role;
create function public.proplet_patron_gifts_admin_v1() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
  'nickname',(select name from public.players p where p.id=player_id),'playerId',player_id,'giftId',gift_id,'status',status,'answer',answer,
  'respondedAt',responded_at,'deferredUntil',deferred_until) order by created_at desc),'[]'::jsonb))
 from proplet_private.patron_personal_gifts;
$$;
revoke all on function public.proplet_patron_gifts_admin_v1() from public,anon,authenticated;
grant execute on function public.proplet_patron_gifts_admin_v1() to service_role;
commit;
