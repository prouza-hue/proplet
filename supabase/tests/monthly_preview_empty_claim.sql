-- Every anonymous source must prevent the no-op shortcut. No gameplay results.
begin;
do $qa$
declare h text:=repeat('a',64); r jsonb; v_id uuid; old_now timestamptz; old_anchor timestamptz; owner uuid:=gen_random_uuid();
  hits_before bigint; counter_rows_before bigint;
begin
  if not exists(select 1 from public.monthly_competition_settings where isolated) then raise exception 'ISOLATED_TEST_REQUIRED'; end if;
  select preview_now,preview_anchor_at into old_now,old_anchor from public.monthly_competition_settings where singleton;
  select count(*),coalesce(sum(hits),0) into counter_rows_before,hits_before from public.security_rate_limits where scope='anonymous_claim';
  perform set_config('request.headers','{}',true);
  begin
    perform public.proplet_monthly_preview_empty_claim_v1(h);
    raise exception 'UNMARKED_PROBE_ACCEPTED';
  exception when insufficient_privilege then null; end;
  perform set_config('request.headers','{"x-proplet-monthly-preview":"codex/monthly-competition-202611"}',true);
  update public.monthly_competition_settings set isolated=false,preview_now=null,preview_anchor_at=null;
  begin
    perform public.proplet_monthly_preview_empty_claim_v1(h);
    raise exception 'NONISOLATED_PROBE_ACCEPTED';
  exception when insufficient_privilege then null; end;
  update public.monthly_competition_settings set isolated=true,preview_now=old_now,preview_anchor_at=old_anchor;
  begin
    perform public.proplet_monthly_preview_empty_claim_v1('invalid');
    raise exception 'INVALID_HASH_ACCEPTED';
  exception when invalid_parameter_value then null; end;
  execute 'set local role anon';
  begin
    perform public.proplet_monthly_preview_empty_claim_v1(h);
    raise exception 'ANON_PROBE_EXECUTED';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role authenticated';
  begin
    perform public.proplet_monthly_preview_empty_claim_v1(h);
    raise exception 'BROWSER_AUTH_PROBE_EXECUTED';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role service_role';
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'true' then raise exception 'EMPTY_PROOF_FAILED'; end if;
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'true' then raise exception 'EMPTY_REPLAY_FAILED'; end if;
  execute 'reset role';

  insert into public.play_sessions(actor_key,challenge_key,puzzle_id,mode,attempt_id,owner_id)
    values('a:'||h,'free:claim-probe','claim-probe','free','claim-probe-attempt',owner);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'SESSION_IGNORED'; end if;
  delete from public.play_sessions where actor_key='a:'||h;
  insert into public.puzzle_attempts(id,puzzle_id,challenge_key,mode,difficulty,anonymous_id)
    values('claim-probe-attempt','claim-probe','free:claim-probe','free','easy',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'ATTEMPT_IGNORED'; end if;
  delete from public.puzzle_attempts where id='claim-probe-attempt';
  v_id:=gen_random_uuid();
  insert into public.helper_events(id,attempt_id,puzzle_id,challenge_key,event_type,anonymous_id)
    values(v_id,'claim-probe-attempt','claim-probe','free:claim-probe','offered',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'HELPER_IGNORED'; end if;
  delete from public.helper_events where helper_events.id=v_id;
  v_id:=gen_random_uuid();
  insert into public.hint_events(id,attempt_id,puzzle_id,challenge_key,hint_level,source,anonymous_id)
    values(v_id,'claim-probe-attempt','claim-probe','free:claim-probe',1,'manual',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'HINT_IGNORED'; end if;
  delete from public.hint_events where hint_events.id=v_id;
  v_id:=gen_random_uuid();
  insert into public.product_events(id,event_type,anonymous_id) values(v_id,'app_session_started',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'PRODUCT_EVENT_IGNORED'; end if;
  delete from public.product_events where product_events.id=v_id;
  v_id:=gen_random_uuid();
  insert into public.puzzle_feedback(id,puzzle_id,challenge_key,kind,anonymous_id)
    values(v_id,'claim-probe','free:claim-probe','difficulty',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'FEEDBACK_IGNORED'; end if;
  delete from public.puzzle_feedback where puzzle_feedback.id=v_id;
  v_id:=gen_random_uuid();
  insert into public.push_subscriptions(id,endpoint,p256dh,auth,anonymous_id)
    values(v_id,'https://invalid.example/claim-probe','test-only','test-only',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'PUSH_SUBSCRIPTION_IGNORED'; end if;
  delete from public.push_subscriptions where push_subscriptions.id=v_id;
  insert into public.push_subscriptions(id,endpoint,p256dh,auth,anonymous_id)
    values(v_id,'https://invalid.example/claim-probe','test-only','test-only',repeat('b',64));
  insert into public.push_delivery_log(id,subscription_id,event_key,category,anonymous_id)
    values(gen_random_uuid(),v_id,'claim-probe','daily',h);
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'false' then raise exception 'PUSH_LOG_IGNORED'; end if;
  delete from public.push_subscriptions where push_subscriptions.id=v_id;
  if public.proplet_monthly_preview_empty_claim_v1(h)->>'empty'<>'true' then raise exception 'CLEANED_SOURCE_NOT_EMPTY'; end if;
  if (select count(*) from public.security_rate_limits where scope='anonymous_claim')<>counter_rows_before
    or (select coalesce(sum(hits),0) from public.security_rate_limits where scope='anonymous_claim')<>hits_before then raise exception 'PROBE_CHANGED_QUOTA'; end if;
end $qa$;
select 'PASS read-only empty claim proof:8 nonempty source types denied shortcut; zero transfers; replay; service-only/marker/isolated guards; quota unchanged' as verification;
rollback;
