-- Forward-only isolated parity with the official 200-XP Extra writer from
-- 20261020221617_daily_special_xp_200_recovery.sql. Keep current QA-clock fixes;
-- do not replay that file's unrelated word-recovery or historical repair writes.
begin;
do $parity$
declare source text;
begin
  if not exists(select 1 from public.monthly_competition_settings where isolated) then return; end if;
  source:=pg_get_functiondef('public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb)'::regprocedure);
  if position('v_points<>100' in source)=0 then
    if position('v_points := 200;' in source)>0 then return; end if;
    raise exception 'MONTHLY_EXTRA_XP_WRITER_PATCH_BOUNDARY_CHANGED';
  end if;
  source:=replace(source,'v_points<>100','v_points not in (100,200)');
  source:=replace(source,'v_completed_at:=v_session.last_seen;','v_points := 200; v_completed_at:=v_session.last_seen;');
  execute source;
end $parity$;
commit;
