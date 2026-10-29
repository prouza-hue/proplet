-- Case state and its audit are one command. No independent REST mutation may
-- succeed before an audit failure; both tables retain their existing RLS.
create or replace function public.proplet_admin_case_update_v1(
 p_admin uuid,p_kind text,p_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_row jsonb; reviewed timestamptz; reviewer uuid; v_note text;
        details jsonb; target_type text; action text;
begin
 if p_admin is distinct from 'e1740794-d196-48da-a59a-2741eadb8e44'::uuid
  or not exists(select 1 from public.admin_accounts where player_id=p_admin and active is true and role='owner') then
   return jsonb_build_object('ok',false,'code','forbidden');
 end if;
 if p_kind is null or p_kind not in('support','words') or p_status is null
  or p_status not in('new','reviewing','resolved','dismissed') or length(coalesce(p_note,''))>500 then
   return jsonb_build_object('ok',false,'code','invalid');
 end if;
 v_note:=nullif(trim(regexp_replace(coalesce(p_note,''),'[[:space:]]+',' ','g')),'');
 if p_kind='support' then
  select to_jsonb(s) into old_row from public.support_reports s where id=p_id for update;
  target_type:='support_reports';action:='support_report_status';
 else
  select to_jsonb(f) into old_row from public.puzzle_feedback f where id=p_id and kind='word' for update;
  target_type:='puzzle_feedback';action:='word_report_status';
 end if;
 if old_row is null then return jsonb_build_object('ok',false,'code','not_found'); end if;
 if coalesce(old_row->>'status','new')=p_status and old_row->>'resolution_note' is not distinct from v_note then
  return jsonb_build_object('ok',true,'id',p_id,'status',p_status,'resolution_note',v_note,
   'reviewed_at',old_row->'reviewed_at','reviewed_by',old_row->'reviewed_by','changed',false);
 end if;
 if (p_kind='support' and p_status in('resolved','dismissed')) or (p_kind='words' and p_status<>'new') then
  reviewed:=statement_timestamp();reviewer:=p_admin;
 end if;
 if p_kind='support' then
  update public.support_reports set status=p_status,resolution_note=v_note,reviewed_at=reviewed,reviewed_by=reviewer where id=p_id;
 else
  update public.puzzle_feedback set status=p_status,resolution_note=v_note,reviewed_at=reviewed,reviewed_by=reviewer where id=p_id;
 end if;
 details:=jsonb_strip_nulls(jsonb_build_object('from',coalesce(old_row->>'status','new'),'to',p_status,
  'category',old_row->>'category','word',old_row->>'word','puzzleId',old_row->>'puzzle_id',
  'resolutionNote',regexp_replace(coalesce(v_note,''),'[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+','[e-mail]','g')));
 insert into public.admin_audit_log(id,admin_player_id,action,target_type,target_id,details,created_at)
  values(gen_random_uuid(),p_admin,action,target_type,p_id::text,details,statement_timestamp());
 return jsonb_build_object('ok',true,'id',p_id,'status',p_status,'resolution_note',v_note,
  'reviewed_at',reviewed,'reviewed_by',reviewer,'changed',true);
end;
$$;
revoke all on function public.proplet_admin_case_update_v1(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.proplet_admin_case_update_v1(uuid,text,uuid,text,text) to service_role;
