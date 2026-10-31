-- Reversible QA time controls for the explicitly isolated monthly preview only.
-- Ordinary production and legacy isolated-branch calls retain their real clocks.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.monthly_competition_settings add column preview_anchor_at timestamptz;
alter table public.monthly_competition_settings add constraint monthly_preview_anchor_isolated
  check(preview_anchor_at is null or isolated);

create function public.proplet_monthly_preview_trusted_v1() returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce((nullif(current_setting('request.headers',true),'')::jsonb
      ->>'x-proplet-monthly-preview')='codex/monthly-competition-202611',false)
    and coalesce((select isolated from public.monthly_competition_settings where singleton),false)
$$;
create function public.proplet_monthly_preview_clock_v1() returns timestamptz
language sql volatile security invoker set search_path='' as $$
  select case when public.proplet_monthly_preview_trusted_v1() and preview_now is not null
    then preview_now+case when preview_anchor_at is null then interval '0 seconds'
      else clock_timestamp()-preview_anchor_at end else clock_timestamp() end
  from public.monthly_competition_settings where singleton
$$;
create function public.proplet_monthly_preview_statement_v1() returns timestamptz
language sql stable security invoker set search_path='' as $$
  select case when public.proplet_monthly_preview_trusted_v1()
    then public.proplet_monthly_preview_clock_v1() else statement_timestamp() end
$$;
create or replace function public.proplet_monthly_now_v1() returns timestamptz
language sql stable security invoker set search_path='' as $$
  select case when public.proplet_monthly_preview_trusted_v1()
    then public.proplet_monthly_preview_clock_v1()
    when isolated then coalesce(preview_now,now()) else now() end
  from public.monthly_competition_settings where singleton
$$;

create function public.proplet_monthly_preview_control_v1(p_action text,p_now timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.monthly_competition_settings; result jsonb; stamp timestamptz;
begin
  if not public.proplet_monthly_preview_trusted_v1() then
    raise exception 'MONTHLY_PREVIEW_FORBIDDEN' using errcode='42501'; end if;
  if p_action='clock' then
    if p_now is null or p_now<('2026-11-01 00:00:00 Europe/Prague'::timestamptz)
      or p_now>=('2027-01-05 00:00:00 Europe/Prague'::timestamptz) then
      raise exception 'MONTHLY_PREVIEW_CLOCK_INVALID' using errcode='22023'; end if;
    update public.monthly_competition_settings set preview_now=p_now,preview_anchor_at=clock_timestamp(),
      enabled=true,rules_approved=true,launch_month='2026-11-01' where singleton and isolated;
  elsif p_action='finalize' and p_now is null then
    result:=public.proplet_finalize_monthly_competition_v1();
  elsif p_action<>'status' or p_now is not null then
    raise exception 'MONTHLY_PREVIEW_ACTION_INVALID' using errcode='22023';
  end if;
  select * into cfg from public.monthly_competition_settings where singleton;
  stamp:=public.proplet_monthly_preview_clock_v1();
  return jsonb_build_object('isolated',true,'enabled',cfg.enabled,'qaNow',stamp,
    'qaDate',(stamp at time zone 'Europe/Prague')::date,'anchorAt',cfg.preview_anchor_at,
    'clockActive',cfg.preview_now is not null,'result',result);
end $$;

-- Initial session defaults otherwise use real wall time before the session RPC
-- calculates its first gap. Only the trusted marked request gets logical dates.
create function public.proplet_monthly_preview_session_clock_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if public.proplet_monthly_preview_trusted_v1() then
    new.created_at:=public.proplet_monthly_preview_clock_v1();
    new.last_seen:=new.created_at;
  end if;
  return new;
end $$;
create trigger monthly_preview_session_clock before insert on public.play_sessions
  for each row execute function public.proplet_monthly_preview_session_clock_v1();

-- Extend the *current* writer definitions after the offline-timing migration.
-- Do not replay an earlier atomic implementation over subsequent fixes.
do $patch$
declare signature text; source text; original text; old_preview text;
begin
  foreach signature in array array[
    'public.proplet_submit_result_v1(uuid,text,text,text,jsonb)',
    'public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb)',
    'public.proplet_play_session_v1(text,uuid,text,text,text,text,uuid,bigint,text,jsonb)',
    'public.proplet_player_stats_v1(uuid)',
    'public.proplet_account_snapshot_v1(uuid,timestamp with time zone,integer,jsonb,integer)'
  ] loop
    source:=pg_get_functiondef(signature::regprocedure);
    original:=source;
    if position('proplet_monthly_preview_clock_v1' in source)>0 then
      raise exception 'MONTHLY_PREVIEW_CLOCK_ALREADY_PATCHED %',signature; end if;
    -- Legacy test snapshot functions have an earlier special-only date override.
    -- Keep it untouched for unmarked callers and prefer the QA clock for this branch.
    old_preview:='coalesce((select preview_date from public.daily_specials_policy where singleton and enabled),(statement_timestamp() at time zone ''Europe/Prague'')::date)';
    source:=replace(source,old_preview,
      '(case when public.proplet_monthly_preview_trusted_v1() then (public.proplet_monthly_preview_clock_v1() at time zone ''Europe/Prague'')::date else '||old_preview||' end)');
    source:=replace(source,'pg_catalog.clock_timestamp()','public.proplet_monthly_preview_clock_v1()');
    source:=replace(source,'clock_timestamp()','public.proplet_monthly_preview_clock_v1()');
    source:=replace(source,'pg_catalog.statement_timestamp()','public.proplet_monthly_preview_statement_v1()');
    source:=replace(source,'statement_timestamp()','public.proplet_monthly_preview_statement_v1()');
    if signature='public.proplet_submit_result_v1(uuid,text,text,text,jsonb)' then
      if position('timingUnverified' in source)=0 then
        raise exception 'MONTHLY_PREVIEW_REQUIRES_CURRENT_OFFLINE_WRITER'; end if;
      if position('v_run_attempt_id := coalesce(v_attempt_id, ''result:'' || v_command_id::text);' in source)=0 then
        raise exception 'MONTHLY_PREVIEW_WRITER_PATCH_BOUNDARY_CHANGED'; end if;
      source:=replace(source,'v_run_attempt_id := coalesce(v_attempt_id, ''result:'' || v_command_id::text);',
        'if public.proplet_monthly_preview_trusted_v1() and (p_command->''timingUnverified'') is distinct from ''true''::jsonb then v_completed_at:=public.proplet_monthly_preview_clock_v1(); end if; v_run_attempt_id := coalesce(v_attempt_id, ''result:'' || v_command_id::text);');
    end if;
    if source=original then raise exception 'MONTHLY_PREVIEW_CLOCK_PATCH_MISSING %',signature; end if;
    execute source;
  end loop;
end $patch$;

-- Control is never reachable with an anonymous/browser database key.
revoke all on function public.proplet_monthly_preview_trusted_v1(),public.proplet_monthly_preview_clock_v1(),
  public.proplet_monthly_preview_statement_v1(),public.proplet_monthly_preview_control_v1(text,timestamptz),
  public.proplet_monthly_preview_session_clock_v1() from public,anon,authenticated;
grant execute on function public.proplet_monthly_preview_trusted_v1(),public.proplet_monthly_preview_clock_v1(),
  public.proplet_monthly_preview_statement_v1(),public.proplet_monthly_preview_control_v1(text,timestamptz),
  public.proplet_monthly_preview_session_clock_v1() to service_role;
-- Narrow settings permission is needed only for the protected control RPC.
-- Keep direct settings writes unavailable to the runtime role by using a private
-- definer implementation and a service-only public wrapper.
alter function public.proplet_monthly_preview_control_v1(text,timestamptz) set schema proplet_private;
alter function proplet_private.proplet_monthly_preview_control_v1(text,timestamptz) security definer;
create function public.proplet_monthly_preview_control_v1(p_action text,p_now timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$
  select proplet_private.proplet_monthly_preview_control_v1(p_action,p_now)
$$;
revoke all on function public.proplet_monthly_preview_control_v1(text,timestamptz) from public,anon,authenticated;
grant execute on function public.proplet_monthly_preview_control_v1(text,timestamptz) to service_role;
commit;
