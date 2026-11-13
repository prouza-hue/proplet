-- One commissioned avatar, permanently selectable by its addressed player only.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table proplet_private.patron_personal_gifts
 add column delivery_avatar text,
 add column delivery_status text check(delivery_status in ('pending','later','equipped')),
 add column delivered_at timestamptz;
update proplet_private.patron_personal_gifts
set delivery_avatar='datel-zdenek',delivery_status='pending'
where player_id='449e0545-26f8-4e37-b023-c06eeec9f307' and gift_id='zdenek-personal-badge-20261112';

-- The players table is writable by the application role: enforce ownership even
-- for direct writes, alternate routes and changes to the player primary key.
create function proplet_private.guard_personal_avatar_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if btrim(new.avatar)='datel-zdenek' and new.id<>'449e0545-26f8-4e37-b023-c06eeec9f307'::uuid then
  raise exception 'personal avatar belongs to another player' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function proplet_private.guard_personal_avatar_v1() from public,anon,authenticated;
grant execute on function proplet_private.guard_personal_avatar_v1() to service_role;
create trigger guard_personal_avatar before insert or update of avatar,id on public.players
 for each row execute function proplet_private.guard_personal_avatar_v1();

create function public.proplet_patron_gift_v2(p_player uuid,p_action text,p_answer text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g proplet_private.patron_personal_gifts%rowtype;result jsonb;equipped jsonb;
begin
 if p_action in ('equip','delivery_later') then
  if p_player<>'449e0545-26f8-4e37-b023-c06eeec9f307'::uuid or p_answer is not null then
   return jsonb_build_object('ok',false,'code','not_available');end if;
  perform 1 from public.players where id=p_player for update;
  select * into g from proplet_private.patron_personal_gifts where player_id=p_player for update;
  if not found or g.delivery_avatar is distinct from 'datel-zdenek' or g.delivery_status is null then
   return jsonb_build_object('ok',false,'code','not_available');end if;
  if p_action='equip' then
   update public.players set avatar=g.delivery_avatar,use_google_avatar=false where id=p_player;
   update proplet_private.patron_personal_gifts set delivery_status='equipped',
    delivered_at=coalesce(delivered_at,statement_timestamp()) where player_id=p_player;
   select jsonb_build_object('avatar',avatar,'useGoogleAvatar',use_google_avatar,'googleAvatarUrl',google_avatar_url)
    into equipped from public.players where id=p_player;
  elsif g.delivery_status='pending' then
   update proplet_private.patron_personal_gifts set delivery_status='later' where player_id=p_player;
  end if;
  result:=public.proplet_patron_gift_v1(p_player,'read',null);
 else
  result:=public.proplet_patron_gift_v1(p_player,p_action,p_answer);
 end if;
 if not coalesce((result->>'ok')::boolean,false) then return result;end if;
 select * into g from proplet_private.patron_personal_gifts where player_id=p_player;
 if p_player='449e0545-26f8-4e37-b023-c06eeec9f307'::uuid and g.delivery_avatar='datel-zdenek' then
  result:=jsonb_set(result,'{gift}',(result->'gift')||jsonb_build_object('pending',false,'delivery',jsonb_build_object(
   'pending',g.delivery_status='pending','avatar',g.delivery_avatar,'status',g.delivery_status,'deliveredAt',g.delivered_at)));
 end if;
 return result||coalesce(equipped,'{}'::jsonb);
end $$;
revoke all on function public.proplet_patron_gift_v2(uuid,text,text) from public,anon,authenticated;
grant execute on function public.proplet_patron_gift_v2(uuid,text,text) to service_role;
commit;
