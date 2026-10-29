-- Atomic mailbox challenges. Additive, service-only; never grants direct client
-- access. Existing unfinished links lack a trustworthy identity revision and
-- intentionally expire during this migration. Users request a fresh link.
alter table public.players add column if not exists auth_identity_revision bigint not null default 0;

create or replace function public.proplet_identity_revision_v1()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if row(new.email,new.email_verified_at,new.auth_user_id,new.password_hash,new.name,new.family_code)
     is distinct from row(old.email,old.email_verified_at,old.auth_user_id,old.password_hash,old.name,old.family_code) then
    new.auth_identity_revision := old.auth_identity_revision + 1;
  else
    new.auth_identity_revision := old.auth_identity_revision;
  end if;
  return new;
end $$;
drop trigger if exists proplet_identity_revision_v1 on public.players;
create trigger proplet_identity_revision_v1 before update on public.players
  for each row execute function public.proplet_identity_revision_v1();

alter table public.account_auth_challenges
  add column if not exists request_id uuid,
  add column if not exists target_revision bigint,
  add column if not exists delivery_status text not null default 'legacy',
  add column if not exists admin_player_id uuid references public.players(id) on delete restrict,
  add column if not exists reason text,
  add column if not exists delivered_at timestamptz;
update public.account_auth_challenges set used_at = now(), delivery_status = 'superseded'
  where used_at is null and target_revision is null;
create unique index if not exists account_auth_challenges_request_unique
  on public.account_auth_challenges(request_id) where request_id is not null;
create unique index if not exists account_auth_challenges_current_unique
  on public.account_auth_challenges(player_id,purpose) where used_at is null;

create or replace function public.proplet_admin_owner_grant_v1(p_admin uuid)
returns boolean language sql stable security invoker set search_path = pg_catalog, public as $$
  select p_admin = 'e1740794-d196-48da-a59a-2741eadb8e44'::uuid and exists(
    select 1 from public.admin_accounts where player_id=p_admin and active is true and role='owner'
  );
$$;

create or replace function public.proplet_auth_email_mask_v1(p_email text)
returns text language sql immutable security invoker set search_path = pg_catalog as $$
  select case when strpos(p_email,'@')>0 then
    left(split_part(p_email,'@',1),case when length(split_part(p_email,'@',1))<=2 then 1 else 2 end)
    || '***@' || split_part(p_email,'@',2) else null end;
$$;

create or replace function public.proplet_auth_challenge_issue_v1(
  p_player uuid,p_purpose text,p_email text,p_token_hash text,p_request uuid,
  p_expected_revision bigint,p_admin uuid,p_reason text
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_player public.players%rowtype;
  v_old public.account_auth_challenges%rowtype;
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_expiry timestamptz := now()+interval '30 minutes';
  v_reason text;
begin
  if p_admin is not null and not public.proplet_admin_owner_grant_v1(p_admin) then
    return jsonb_build_object('ok',false,'code','forbidden');
  end if;
  if p_purpose not in ('link_email','recover_password') or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_request is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or (p_admin is not null and (p_purpose<>'link_email' or length(trim(coalesce(p_reason,'')))<8)) then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;
  -- One lock order everywhere: player, then challenge. The revision trigger
  -- makes any identity change (including change-then-revert) observable.
  select * into v_player from public.players where id=p_player for update;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into v_old from public.account_auth_challenges where request_id=p_request;
  if found then
    if v_old.player_id<>p_player or v_old.purpose<>p_purpose or v_old.token_hash<>p_token_hash
       or v_old.email<>v_email or v_old.admin_player_id is distinct from p_admin then
      return jsonb_build_object('ok',false,'code','invalid');
    end if;
    if v_old.used_at is not null or v_old.expires_at<=now() then
      return jsonb_build_object('ok',false,'code','invalid');
    end if;
    if v_old.target_revision<>v_player.auth_identity_revision then
      return jsonb_build_object('ok',false,'code','target_changed');
    end if;
    return jsonb_build_object('ok',true,'shouldSend',false,'status',
      case when v_old.delivery_status='sent' then 'pending' else 'sending' end,'expiresAt',v_old.expires_at);
  end if;
  if v_player.auth_identity_revision<>p_expected_revision then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  if p_admin is not null and v_player.email_verified_at is not null and v_player.email is not null then
    if lower(v_player.email)=v_email then
      return jsonb_build_object('ok',true,'alreadyVerified',true,'shouldSend',false,'status','verified');
    end if;
    return jsonb_build_object('ok',false,'code','target_verified');
  end if;
  if p_purpose='recover_password' and (v_player.email_verified_at is null or lower(coalesce(v_player.email,''))<>v_email) then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  if exists(select 1 from public.players where id<>p_player and lower(email)=v_email and email_verified_at is not null) then
    return jsonb_build_object('ok',false,'code','email_conflict');
  end if;
  v_reason := left(regexp_replace(coalesce(p_reason,''),'[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+','[e-mail]','g'),500);
  update public.account_auth_challenges set used_at=now(),delivery_status='superseded'
    where player_id=p_player and purpose=p_purpose and used_at is null;
  insert into public.account_auth_challenges(id,player_id,purpose,email,token_hash,created_at,expires_at,
      request_id,target_revision,delivery_status,admin_player_id,reason)
    values(v_id,p_player,p_purpose,v_email,p_token_hash,now(),v_expiry,
      p_request,p_expected_revision,'sending',p_admin,v_reason);
  if p_admin is not null then
    insert into public.admin_audit_log(id,admin_player_id,action,target_type,target_id,details,created_at)
      values(gen_random_uuid(),p_admin,'legacy_recovery_email_requested','player',p_player::text,
        jsonb_build_object('emailMasked',public.proplet_auth_email_mask_v1(v_email),'reason',v_reason,'requestId',p_request),now());
  end if;
  return jsonb_build_object('ok',true,'shouldSend',true,'status','sending','expiresAt',v_expiry);
end $$;

create or replace function public.proplet_auth_challenge_delivery_v1(p_token_hash text,p_success boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_ch public.account_auth_challenges%rowtype; v_player public.players%rowtype; v_player_id uuid;
begin
  select player_id into v_player_id from public.account_auth_challenges where token_hash=p_token_hash;
  if not found then return jsonb_build_object('ok',false,'code','invalid'); end if;
  select * into v_player from public.players where id=v_player_id for update;
  select * into v_ch from public.account_auth_challenges where token_hash=p_token_hash for update;
  if v_ch.used_at is not null or v_ch.expires_at<=now() then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;
  if v_player.auth_identity_revision<>v_ch.target_revision then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  if v_ch.delivery_status='sent' and p_success then
    return jsonb_build_object('ok',true,'status','pending','expiresAt',v_ch.expires_at);
  end if;
  if v_ch.delivery_status<>'sending' then return jsonb_build_object('ok',false,'code','invalid'); end if;
  update public.account_auth_challenges set delivery_status=case when p_success then 'sent' else 'failed' end,
    delivered_at=case when p_success then now() else null end,
    used_at=case when p_success then null else now() end where id=v_ch.id;
  if v_ch.admin_player_id is not null then
    insert into public.admin_audit_log(id,admin_player_id,action,target_type,target_id,details,created_at)
      values(gen_random_uuid(),v_ch.admin_player_id,
        case when p_success then 'legacy_recovery_email_sent' else 'legacy_recovery_email_delivery_failed' end,
        'player',v_ch.player_id::text,jsonb_build_object('emailMasked',public.proplet_auth_email_mask_v1(v_ch.email),'requestId',v_ch.request_id),now());
  end if;
  return jsonb_build_object('ok',true,'status',case when p_success then 'pending' else 'failed' end,'expiresAt',v_ch.expires_at);
end $$;

create or replace function public.proplet_auth_challenge_check_v1(p_token_hash text,p_purpose text,p_email text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_ch public.account_auth_challenges%rowtype; v_player public.players%rowtype;
begin
  select * into v_ch from public.account_auth_challenges where token_hash=p_token_hash;
  if not found or v_ch.purpose<>p_purpose or v_ch.used_at is not null or v_ch.expires_at<=now() then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;
  if v_ch.delivery_status<>'sent' then return jsonb_build_object('ok',false,'code','not_ready'); end if;
  if v_ch.email<>lower(trim(p_email)) then return jsonb_build_object('ok',false,'code','bad_email'); end if;
  select * into v_player from public.players where id=v_ch.player_id;
  if not found or v_player.auth_identity_revision<>v_ch.target_revision then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  if p_purpose='recover_password' and (v_player.email_verified_at is null or lower(coalesce(v_player.email,''))<>v_ch.email) then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  return jsonb_build_object('ok',true,'playerId',v_ch.player_id);
end $$;

create or replace function public.proplet_auth_challenge_consume_v1(
  p_token_hash text,p_purpose text,p_auth_user uuid,p_email text,p_password_hash text,p_session_token_hash text
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_ch public.account_auth_challenges%rowtype; v_player public.players%rowtype;
        v_player_id uuid; v_already boolean := false;
begin
  if p_auth_user is null or p_purpose not in ('link_email','recover_password') then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;
  select player_id into v_player_id from public.account_auth_challenges where token_hash=p_token_hash;
  if not found then return jsonb_build_object('ok',false,'code','invalid'); end if;
  select * into v_player from public.players where id=v_player_id for update;
  if not found then return jsonb_build_object('ok',false,'code','invalid'); end if;
  select * into v_ch from public.account_auth_challenges where token_hash=p_token_hash for update;
  if v_ch.purpose<>p_purpose or v_ch.used_at is not null or v_ch.expires_at<=now() then
    return jsonb_build_object('ok',false,'code','invalid');
  end if;
  if v_ch.delivery_status<>'sent' then return jsonb_build_object('ok',false,'code','not_ready'); end if;
  if v_ch.email<>lower(trim(p_email)) then return jsonb_build_object('ok',false,'code','bad_email'); end if;
  if v_ch.admin_player_id is not null and not public.proplet_admin_owner_grant_v1(v_ch.admin_player_id) then
    return jsonb_build_object('ok',false,'code','forbidden');
  end if;
  -- Same already-verified mailbox is idempotent: never overwrite its timestamp,
  -- password, Google binding or any newer identity. It still consumes this link.
  v_already := p_purpose='link_email' and v_player.email_verified_at is not null and coalesce(lower(v_player.email)=v_ch.email,false);
  if v_player.auth_identity_revision<>v_ch.target_revision and not v_already then
    return jsonb_build_object('ok',false,'code','target_changed');
  end if;
  if v_ch.admin_player_id is not null and v_player.email_verified_at is not null and not v_already then
    return jsonb_build_object('ok',false,'code','target_verified');
  end if;
  if exists(select 1 from public.players where id<>v_ch.player_id and lower(email)=v_ch.email and email_verified_at is not null) then
    return jsonb_build_object('ok',false,'code','email_conflict');
  end if;
  if p_purpose='recover_password' then
    if v_player.email_verified_at is null or lower(coalesce(v_player.email,''))<>v_ch.email
       or p_password_hash is null or length(p_password_hash)<20 or p_session_token_hash !~ '^[0-9a-f]{64}$' then
      return jsonb_build_object('ok',false,'code','target_changed');
    end if;
    update public.players set password_hash=p_password_hash,token_hash=p_session_token_hash where id=v_ch.player_id;
    delete from public.player_sessions where player_id=v_ch.player_id;
  elsif not v_already then
    update public.players set email=v_ch.email,email_verified_at=now() where id=v_ch.player_id;
  end if;
  update public.account_auth_challenges set used_at=now(),verified_auth_user_id=p_auth_user,
    delivery_status='consumed' where id=v_ch.id;
  if v_ch.admin_player_id is not null then
    insert into public.admin_audit_log(id,admin_player_id,action,target_type,target_id,details,created_at)
      values(gen_random_uuid(),v_ch.admin_player_id,'legacy_recovery_email_verified','player',v_ch.player_id::text,
        jsonb_build_object('emailMasked',public.proplet_auth_email_mask_v1(v_ch.email),
                           'requestId',v_ch.request_id,'alreadyVerified',v_already),now());
  end if;
  return jsonb_build_object('ok',true,'playerId',v_ch.player_id,'alreadyVerified',v_already);
exception when unique_violation then
  -- The unique verified-email index is the final cross-player concurrency
  -- guard. This exception block rolls every preceding write back together.
  return jsonb_build_object('ok',false,'code','email_conflict');
end $$;

create or replace function public.proplet_auth_challenge_status_v1(p_player uuid,p_admin uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_player public.players%rowtype; v_ch public.account_auth_challenges%rowtype;
        v_verified boolean; v_pending boolean; v_status text;
begin
  if not public.proplet_admin_owner_grant_v1(p_admin) then return jsonb_build_object('ok',false,'code','forbidden'); end if;
  select * into v_player from public.players where id=p_player;
  if not found then return jsonb_build_object('ok',false,'code','not_found'); end if;
  select * into v_ch from public.account_auth_challenges where player_id=p_player and purpose='link_email'
    order by created_at desc,id desc limit 1;
  v_verified := v_player.email is not null and v_player.email_verified_at is not null;
  v_pending := coalesce(not v_verified and v_ch.used_at is null and v_ch.expires_at>now()
    and v_ch.target_revision=v_player.auth_identity_revision and v_ch.delivery_status in ('sent','sending'),false);
  v_status := case when v_verified then 'verified' when v_pending and v_ch.delivery_status='sent' then 'pending'
    when v_pending then 'sending' when v_ch.delivery_status='failed' then 'failed' else 'none' end;
  return jsonb_build_object('ok',true,'playerId',p_player,'playerName',v_player.name,
    'verified',v_verified,'emailMasked',case when v_verified then public.proplet_auth_email_mask_v1(v_player.email) else null end,
    'googleLinked',v_player.auth_user_id is not null,'pending',v_pending,'status',v_status,
    'pendingEmailMasked',case when v_pending then public.proplet_auth_email_mask_v1(v_ch.email) else null end,
    'pendingExpiresAt',case when v_pending then v_ch.expires_at else null end);
end $$;

-- No function is a public/anonymous authenticated API. They rely on the
-- server's service credential; SECURITY INVOKER preserves RLS semantics.
revoke all on function public.proplet_identity_revision_v1() from public,anon,authenticated;
revoke all on function public.proplet_admin_owner_grant_v1(uuid) from public,anon,authenticated;
revoke all on function public.proplet_auth_email_mask_v1(text) from public,anon,authenticated;
revoke all on function public.proplet_auth_challenge_issue_v1(uuid,text,text,text,uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.proplet_auth_challenge_delivery_v1(text,boolean) from public,anon,authenticated;
revoke all on function public.proplet_auth_challenge_check_v1(text,text,text) from public,anon,authenticated;
revoke all on function public.proplet_auth_challenge_consume_v1(text,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.proplet_auth_challenge_status_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.proplet_identity_revision_v1() to service_role;
grant execute on function public.proplet_admin_owner_grant_v1(uuid) to service_role;
grant execute on function public.proplet_auth_email_mask_v1(text) to service_role;
grant execute on function public.proplet_auth_challenge_issue_v1(uuid,text,text,text,uuid,bigint,uuid,text) to service_role;
grant execute on function public.proplet_auth_challenge_delivery_v1(text,boolean) to service_role;
grant execute on function public.proplet_auth_challenge_check_v1(text,text,text) to service_role;
grant execute on function public.proplet_auth_challenge_consume_v1(text,text,uuid,text,text,text) to service_role;
grant execute on function public.proplet_auth_challenge_status_v1(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
