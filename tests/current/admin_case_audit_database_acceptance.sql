-- Isolated test database only. No retained fixture, grant, trigger or mutation.
begin;
create or replace function public.proplet_admin_qa_audit_failure() returns trigger
language plpgsql as $$
begin
 if current_setting('qa.admin_fail_audit',true)='1' then
  raise exception 'admin_qa_audit_failure';
 end if;
 return new;
end;
$$;
create trigger proplet_admin_qa_audit_failure before insert on public.admin_audit_log
 for each row execute function public.proplet_admin_qa_audit_failure();

do $qa$
declare owner_id uuid:='e1740794-d196-48da-a59a-2741eadb8e44'; p uuid:=gen_random_uuid();
 c uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); result jsonb; n integer;
begin
 perform set_config('request.headers','{}',true);
 insert into public.players(id,name,family_code,token_hash)
  values(owner_id,'Admin QA owner','SOLO_ADMIN_AUDIT',md5(owner_id::text)||md5(owner_id::text)) on conflict(id) do nothing;
 insert into public.admin_accounts(player_id,role,active) values(owner_id,'owner',true)
  on conflict(player_id) do update set role='owner',active=true;
 insert into public.players(id,name,family_code,token_hash)
  values(p,'Admin QA target','SOLO_ADMIN_AUDIT',md5(p::text)||md5(p::text));
 insert into public.support_reports(id,player_id,category,message,status)
  values(c,p,'account','Synthetic admin audit transaction','new');
 result:=public.proplet_admin_case_update_v1(p,'support',c,'resolved','Must not apply');
 if result->>'code'<>'forbidden' then raise exception 'case mutation accepted second identity'; end if;
 perform set_config('qa.admin_fail_audit','1',true);
 begin
  perform public.proplet_admin_case_update_v1(owner_id,'support',c,'resolved','Must roll back with failed audit');
  raise exception 'fault injection did not fire';
 exception when raise_exception then
  if sqlerrm<>'admin_qa_audit_failure' then raise; end if;
 end;
 perform set_config('qa.admin_fail_audit','0',true);
 if (select status from public.support_reports where id=c)<>'new'
   or exists(select 1 from public.admin_audit_log where target_id=c::text) then
  raise exception 'case state escaped failed audit transaction';
 end if;
 result:=public.proplet_admin_case_update_v1(owner_id,'support',c,'resolved','Kontakt fixture@example.test');
 if result->>'ok'<>'true' or (select resolution_note from public.support_reports where id=c)<>'Kontakt fixture@example.test'
  or (select status from public.support_reports where id=c)<>'resolved' then raise exception 'case note/status not retained'; end if;
 select count(*) into n from public.admin_audit_log where target_id=c::text;
 if n<>1 or exists(select 1 from public.admin_audit_log where target_id=c::text and details::text like '%fixture@example.test%') then
  raise exception 'case audit missing or leaks mailbox'; end if;
 result:=public.proplet_admin_case_update_v1(owner_id,'support',c,'resolved','Kontakt fixture@example.test');
 if result->>'changed'<>'false' or (select count(*) from public.admin_audit_log where target_id=c::text)<>1 then
  raise exception 'idempotent case update repeated audit'; end if;
 insert into public.puzzle_feedback(id,player_id,puzzle_id,challenge_key,kind,word,status)
  values(w,p,'admin-qa-retired','free:admin-qa-retired','word','QA','new');
 result:=public.proplet_admin_case_update_v1(owner_id,'words',w,'reviewing','Slovo prověřuji');
 if result->>'ok'<>'true' or (select reviewed_by from public.puzzle_feedback where id=w)<>owner_id
  or not exists(select 1 from public.admin_audit_log where target_id=w::text and action='word_report_status') then
  raise exception 'word report transaction'; end if;
 if has_function_privilege('anon','public.proplet_admin_case_update_v1(uuid,text,uuid,text,text)','execute')
  or has_function_privilege('authenticated','public.proplet_admin_case_update_v1(uuid,text,uuid,text,text)','execute') then
  raise exception 'case RPC exposed to client roles'; end if;
end;
$qa$;
rollback;
