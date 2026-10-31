-- Disposable synthetic database only. All fixtures and fault triggers roll back.
begin;
create function public.qa_team_leave_failure() returns trigger language plpgsql as $$
begin
 if current_setting('qa.team_leave_fail',true)=TG_TABLE_NAME then
  raise exception 'qa_team_leave_failure';
 end if;
 return new;
end;
$$;
create trigger qa_leave_player before update on public.players for each row execute function public.qa_team_leave_failure();
create trigger qa_leave_membership before update on public.team_memberships for each row execute function public.qa_team_leave_failure();
do $qa$
declare p uuid:=gen_random_uuid(); other_p uuid:=gen_random_uuid(); old_id uuid:=gen_random_uuid();
 active_id uuid:=gen_random_uuid(); t timestamptz:='2026-10-01T10:00:00Z'; r jsonb; target text;
begin
 insert into public.players(id,name,family_code,token_hash,team_joined_at) values
 (p,'Leave QA','LEAVE_QA',md5(p::text)||md5(p::text),t),
 (other_p,'Leave QA other','LEAVE_QA',md5(other_p::text)||md5(other_p::text),t);
 insert into public.team_memberships(id,player_id,team_code,joined_at,left_at) values
 (old_id,p,'LEAVE_QA',t-interval '2 days',t-interval '1 day'),
 (active_id,p,'LEAVE_QA',t,null),
 (gen_random_uuid(),other_p,'LEAVE_QA',t,null);
 -- Fail both before closing memberships and AFTER closing them, on player write.
 foreach target in array array['team_memberships','players'] loop
  perform set_config('qa.team_leave_fail',target,true);
  begin
   perform public.proplet_team_leave_v1(p,'LEAVE_QA',t,'SOLO_AAAAAAAAAAAA');
   raise exception 'fault injection did not fire';
  exception when raise_exception then
   if sqlerrm<>'qa_team_leave_failure' then raise; end if;
  end;
  if (select left_at from public.team_memberships where id=active_id) is not null
   or (select family_code from public.players where id=p)<>'LEAVE_QA'
   or (select team_joined_at from public.players where id=p) is distinct from t then
   raise exception 'partial leave escaped rollback';
  end if;
 end loop;
 perform set_config('qa.team_leave_fail','',true);
 r:=public.proplet_team_leave_v1(p,'STALE_TEAM',t,'SOLO_AAAAAAAAAAAA');
 if r->>'code'<>'conflict' then raise exception 'stale family accepted'; end if;
 r:=public.proplet_team_leave_v1(p,'LEAVE_QA',t-interval '1 second','SOLO_AAAAAAAAAAAA');
 if r->>'code'<>'conflict' then raise exception 'stale joined timestamp accepted'; end if;
 begin
  perform public.proplet_team_leave_v1(p,'LEAVE_QA',t,'PUBLIC_TEAM');
  raise exception 'invalid solo code accepted';
 exception when invalid_parameter_value then null;
 end;
 if (select left_at from public.team_memberships where id=active_id) is not null then
  raise exception 'validation mutated membership';
 end if;
 r:=public.proplet_team_leave_v1(p,'LEAVE_QA',t,'SOLO_AAAAAAAAAAAA');
 if r->>'ok'<>'true' or r->>'changed'<>'true'
  or (select family_code from public.players where id=p)<>'SOLO_AAAAAAAAAAAA'
  or (select team_joined_at from public.players where id=p) is not null
  or (select left_at from public.team_memberships where id=active_id) is null then
  raise exception 'leave not complete';
 end if;
 if (select left_at from public.team_memberships where id=old_id) is distinct from t-interval '1 day'
  or (select family_code from public.players where id=other_p)<>'LEAVE_QA'
  or not exists(select 1 from public.team_memberships where player_id=other_p and left_at is null) then
  raise exception 'changed history or another player';
 end if;
 r:=public.proplet_team_leave_v1(p,'LEAVE_QA',t,'SOLO_BBBBBBBBBBBB');
 if r->>'ok'<>'true' or r->>'changed'<>'false'
  or (select family_code from public.players where id=p)<>'SOLO_AAAAAAAAAAAA' then
  raise exception 'lost-response retry changed solo state';
 end if;
 -- Legacy public team with no history row still leaves atomically; protect SOLO_* real teams.
 update public.players set family_code='SOLO_REAL_TEAM',team_joined_at=t where id=p;
 r:=public.proplet_team_leave_v1(p,'SOLO_REAL_TEAM',t,'SOLO_CCCCCCCCCCCC');
 if r->>'changed'<>'true' then raise exception 'real SOLO-prefixed team mistaken for solo'; end if;
 r:=public.proplet_team_leave_v1(gen_random_uuid(),'LEAVE_QA',t,'SOLO_AAAAAAAAAAAA');
 if r->>'code'<>'not_found' then raise exception 'missing player accepted'; end if;
 if has_function_privilege('anon','public.proplet_team_leave_v1(uuid,text,timestamptz,text)','execute')
  or has_function_privilege('authenticated','public.proplet_team_leave_v1(uuid,text,timestamptz,text)','execute')
  or not has_function_privilege('service_role','public.proplet_team_leave_v1(uuid,text,timestamptz,text)','execute') then
  raise exception 'leave RPC ACL incorrect';
 end if;
end;
$qa$;
rollback;
