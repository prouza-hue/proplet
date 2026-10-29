-- Isolated test project / disposable PostgreSQL only. All fixtures roll back.
begin;
do $qa$
declare prefix text:='AdminQA_'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
 p uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); page jsonb; late jsonb; detail jsonb;
 before_xp integer; after_xp integer; i integer; fixture uuid;
begin
 perform set_config('request.headers','{}',true);
 for i in 1..205 loop
  fixture:=gen_random_uuid();
  insert into public.players(id,name,family_code,token_hash)
   values(fixture,prefix||lpad(i::text,3,'0'),'SOLO_ADMIN_QA',md5(fixture::text)||md5(prefix||fixture::text));
 end loop;
 insert into public.players(id,name,family_code,token_hash,email,email_verified_at)
  values(p,prefix||'XP','SOLO_ADMIN_QA',md5(p::text)||md5(prefix||p::text),'fixture-'||p::text||'@example.test',statement_timestamp());
 page:=public.proplet_admin_users_page_v1(prefix,0,200,'name',null);
 late:=public.proplet_admin_users_page_v1(prefix,200,200,'name',null);
 if (page->>'total')::int<>206 or jsonb_array_length(page->'users')<>200
  or (late->>'total')::int<>206 or jsonb_array_length(late->'users')<>6 then raise exception 'admin paging/truncation'; end if;
 if (public.proplet_admin_users_page_v1(prefix,9999,10,'name',null)->>'total')::int<>206 then raise exception 'empty page lost total'; end if;
 page:=public.proplet_admin_users_page_v1(p::text,0,30,'active',null);
 if (page->>'total')::int<>1 or page->'users'->0->>'id'<>p::text then raise exception 'exact UUID lookup'; end if;
 before_xp:=(public.proplet_player_stats_v1(p)->>'points')::int;
 insert into public.account_rewards(id,player_id,reward_key,points)
  values(gen_random_uuid(),p,'word_discovery_recovery_v1:admin-qa',250);
 after_xp:=(public.proplet_player_stats_v1(p)->>'points')::int;
 if after_xp-before_xp<>250 then raise exception 'authoritative recovery bonus delta'; end if;
 page:=public.proplet_admin_users_page_v1(p::text,0,30,'xp',null);
 if (page->'users'->0->>'points')::int<>after_xp
  or (page->'users'->0->>'word_discovery_xp')::int<250 then raise exception 'list/detail XP disagreement'; end if;
 detail:=public.proplet_admin_player_detail_v1(p);
 if (detail->'stats'->>'points')::int<>after_xp or detail->'user'->>'id'<>p::text then raise exception 'detail XP'; end if;
 insert into public.support_reports(id,player_id,category,message,status) values(c,p,'account','QA archived report','resolved');
 page:=public.proplet_admin_cases_v1('support','all',null,null,p,c,0,30);
 if (page->>'total')::int<>1 or page->'rows'->0->'player'->>'id'<>p::text
   or page->'rows'->0->>'status'<>'resolved' then raise exception 'resolved support/link unavailable'; end if;
 page:=public.proplet_admin_cases_v1('support','open',null,null,p,c,0,30);
 if (page->>'total')::int<>0 then raise exception 'open includes resolved'; end if;
 insert into public.admin_audit_log(id,admin_player_id,action,target_type,target_id,details)
  values(gen_random_uuid(),p,'admin_qa_action','players',p::text,'{"result":"pending"}');
 page:=public.proplet_admin_audit_page_v1('admin_qa_action',p::text,null,null,0,30);
 if (page->>'total')::int<>1 then raise exception 'filtered audit total'; end if;
 if has_function_privilege('anon','public.proplet_account_xp_v1(uuid[])','execute')
   or has_function_privilege('authenticated','public.proplet_admin_users_page_v1(text,integer,integer,text,text)','execute')
   or not has_function_privilege('service_role','public.proplet_admin_cases_v1(text,text,text,text,uuid,uuid,integer,integer)','execute')
 then raise exception 'admin RPC privileges'; end if;
end;
$qa$;
rollback;
