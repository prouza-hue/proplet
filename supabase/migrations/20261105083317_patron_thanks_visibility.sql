alter table proplet_private.patron_entitlements
 add column thanks_visibility_claimed_at timestamptz;

-- A row that stores only the offer preference has no badge choice yet.
alter table proplet_private.patron_preferences
 alter column public_badge drop not null,
 alter column public_badge drop default;

grant update(thanks_visibility_claimed_at) on proplet_private.patron_entitlements to service_role;

-- Keep old clients on the original receipt. Only the new dialog can claim the replay.
create function public.proplet_patron_thanks_visibility_v1(p_player uuid,p_claim boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare pending boolean; granted boolean:=false; default_public boolean;
begin
 if p_claim then
  -- Serialize claims with each other and with changes to the player's preferences.
  perform 1 from public.players where id=p_player for update;
 end if;
 select e.thanks_visibility_claimed_at is null and
        (e.thanks_claimed_at is null or (pr.public_badge is null and p.public_rankings is true)),
        coalesce(pr.public_badge,true)
 into pending,default_public
 from proplet_private.patron_entitlements e
 join public.players p on p.id=e.player_id
 left join proplet_private.patron_preferences pr on pr.player_id=e.player_id
 where e.player_id=p_player;

 if p_claim and pending then
  update proplet_private.patron_entitlements
  set thanks_visibility_claimed_at=statement_timestamp(),
      thanks_claimed_at=coalesce(thanks_claimed_at,statement_timestamp())
  where player_id=p_player and thanks_visibility_claimed_at is null;
  granted:=found;
 end if;
 return jsonb_build_object('thanksPending',coalesce(pending,false) and not granted,
   'displayGranted',granted,'defaultPublicBadge',coalesce(default_public,false));
end;$$;

revoke all on function public.proplet_patron_thanks_visibility_v1(uuid,boolean) from public,anon,authenticated;
grant execute on function public.proplet_patron_thanks_visibility_v1(uuid,boolean) to service_role;

-- Allow callers to update either preference without overwriting the other.
create or replace function public.proplet_patron_preferences_v1(p_player uuid,p_public boolean,p_disabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_public is null and p_disabled is null then raise exception 'invalid preferences' using errcode='22023';end if;
 perform 1 from public.players where id=p_player for update;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 if p_public and not proplet_private.patron_effective_v1(p_player) then
  return jsonb_build_object('ok',false,'code','not_confirmed');end if;
 insert into proplet_private.patron_preferences(player_id,public_badge,offers_disabled)
 values(p_player,p_public,coalesce(p_disabled,false))
 on conflict(player_id) do update set
  public_badge=coalesce(p_public,patron_preferences.public_badge),
  offers_disabled=coalesce(p_disabled,patron_preferences.offers_disabled);
 return public.proplet_patron_state_v1(p_player,false);
end;$$;
