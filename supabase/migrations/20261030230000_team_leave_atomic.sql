-- Server-authenticated identity only. No history rewrite/backfill.
create or replace function public.proplet_team_leave_v1(
 p_player uuid,p_expected_family text,p_expected_joined_at timestamptz,p_new_solo text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_player public.players%rowtype; v_now timestamptz:=statement_timestamp();
begin
 select * into v_player from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
 -- Retry after a committed response was lost: retain the original solo code.
 -- A real historical team named SOLO_* remains a team when joined_at is set.
 if nullif(btrim(v_player.family_code),'') is null
  or (v_player.team_joined_at is null and upper(v_player.family_code) like 'SOLO\_%' escape '\') then
  return jsonb_build_object('ok',true,'changed',false);
 end if;
 if v_player.family_code is distinct from p_expected_family
  or v_player.team_joined_at is distinct from p_expected_joined_at then
  return jsonb_build_object('ok',false,'code','conflict');
 end if;
 if p_new_solo is null or p_new_solo !~ '^SOLO_[0-9A-F]{12}$' then
  raise exception 'invalid solo code' using errcode='22023';
 end if;
 update public.team_memberships set left_at=v_now where player_id=p_player and left_at is null;
 update public.players set family_code=p_new_solo,team_joined_at=null where id=p_player;
 if not found then raise exception 'player transition was not applied'; end if;
 -- Exceptions propagate: PostgreSQL rolls back BOTH updates, including failures
 -- after closing memberships. Never catch and return success on a write error.
 return jsonb_build_object('ok',true,'changed',true);
end;
$$;
revoke all on function public.proplet_team_leave_v1(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.proplet_team_leave_v1(uuid,text,timestamptz,text) to service_role;
