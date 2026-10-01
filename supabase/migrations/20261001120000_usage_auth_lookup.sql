-- Consolidate legacy-token/session authentication into one API request. This
-- returns the same explicit player fields as server.PLAYER_COLUMNS; callers
-- must keep this function restricted to the server's service-role connection.
create or replace function public.proplet_auth_player_v1(p_token_hash text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  player_record jsonb;
  session_record record;
  auth_time timestamptz := statement_timestamp();
begin
  -- Main-device/legacy tokens take priority and do not expire.
  select to_jsonb(player_fields) into player_record
  from (
    select p.id, p.name, p.family_code, p.token_hash, p.created_at,
           p.password_hash, p.avatar, p.support_mode, p.team_joined_at,
           p.public_rankings, p.email, p.email_verified_at, p.auth_user_id,
           p.google_avatar_url, p.use_google_avatar, p.printshop_welcome_seen_at
    from public.players p
    where p.token_hash = p_token_hash
  ) player_fields;

  if player_record is not null then
    return jsonb_build_object('player', player_record, 'expired', false);
  end if;

  select s.id, s.player_id, s.expires_at, s.last_used_at into session_record
  from public.player_sessions s
  where s.token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('player', null, 'expired', false);
  end if;

  if session_record.expires_at is not null and session_record.expires_at <= auth_time then
    -- Expired sessions must be rejected even if optional cleanup fails.
    begin
      delete from public.player_sessions s where s.id = session_record.id;
    exception when others then
      null;
    end;
    return jsonb_build_object('player', null, 'expired', true);
  end if;

  if session_record.last_used_at is null or session_record.last_used_at < auth_time - interval '24 hours' then
    -- The conditional write also prevents concurrent auth requests from
    -- repeatedly touching an already refreshed last_used_at value.
    begin
      update public.player_sessions s
      set last_used_at = auth_time
      where s.id = session_record.id
        and (s.last_used_at is null or s.last_used_at < auth_time - interval '24 hours');
    exception when others then
      null;
    end;
  end if;

  select to_jsonb(player_fields) into player_record
  from (
    select p.id, p.name, p.family_code, p.token_hash, p.created_at,
           p.password_hash, p.avatar, p.support_mode, p.team_joined_at,
           p.public_rankings, p.email, p.email_verified_at, p.auth_user_id,
           p.google_avatar_url, p.use_google_avatar, p.printshop_welcome_seen_at
    from public.players p
    where p.id = session_record.player_id
  ) player_fields;

  return jsonb_build_object('player', player_record, 'expired', false);
end;
$function$;

revoke all on function public.proplet_auth_player_v1(text) from public;
revoke all on function public.proplet_auth_player_v1(text) from anon;
revoke all on function public.proplet_auth_player_v1(text) from authenticated;
grant execute on function public.proplet_auth_player_v1(text) to service_role;
