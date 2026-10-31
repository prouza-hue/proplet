-- A legacy isolated Extra preview has a fixed October date. The monthly QA
-- branch must use its own server clock without changing that legacy policy row.
begin;
do $patch$
declare source text; boundary text:='select * into v_policy from public.daily_specials_policy where singleton;';
begin
  source:=pg_get_functiondef('public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb)'::regprocedure);
  if position('proplet_monthly_preview_clock_v1' in source)=0 or position(boundary in source)=0 then
    raise exception 'MONTHLY_SPECIAL_PREVIEW_REQUIRES_CURRENT_CLOCK_WRITER'; end if;
  source:=replace(source,boundary,boundary||' if public.proplet_monthly_preview_trusted_v1() then v_policy.preview_date:=null; end if;');
  execute source;
end $patch$;
commit;
