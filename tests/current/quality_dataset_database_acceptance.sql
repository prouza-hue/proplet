-- Isolated test project / disposable PostgreSQL only. Every fixture rolls back.
begin;
do $qa$
declare
 p uuid:=gen_random_uuid(); stamp timestamptz:=statement_timestamp(); start_at timestamptz;
 prefix text:='QDataQA_'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
 data jsonb; expected jsonb; actual jsonb; i integer; n integer;
 dst_from timestamptz:='2026-07-31 02:36:00+02'; dst_until timestamptz:='2026-10-29 02:36:00+01';
begin
 start_at:=((stamp at time zone 'Europe/Prague')-interval '90 days') at time zone 'Europe/Prague';
 perform set_config('request.headers','{}',true);
 insert into public.players(id,name,family_code,token_hash)
  values(p,prefix,'SOLO_QUALITY_QA',md5(p::text)||md5(prefix||p::text));
 for i in 1..1105 loop
  insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,
    started_at,completed_at,elapsed_ms,wrong_attempts,hints_used,clean_solve,
    first_correct_ms,first_hint_ms,reset_count,resume_count,calm_mode,environment,is_test)
   values(prefix||'-'||i,p,prefix||'-puzzle-'||i,'free:'||prefix||'-'||i,'free','easy',
    stamp-interval '2 hours',stamp-interval '1 hour',50000,2,1,false,2000,3000,1,2,false,'production',false);
 end loop;
 -- First lifetime is outside the window. A recent replay must not replace it.
 insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,started_at,calm_mode,environment,is_test)
 values(prefix||'-history-old',p,prefix||'-history','free:'||prefix||'-history','free','easy',start_at-interval '1 day',false,'production',false),
       (prefix||'-history-replay',p,prefix||'-history','free:'||prefix||'-history','free','easy',stamp-interval '1 hour',false,'production',false),
       (prefix||'-history-calm',p,prefix||'-history','free:'||prefix||'-history','free','easy',stamp-interval '1 hour',true,'production',false),
       (prefix||'-tie-a',p,prefix||'-tie','free:'||prefix||'-tie','free','easy',stamp-interval '1 hour',false,'production',false),
       (prefix||'-tie-b',p,prefix||'-tie','free:'||prefix||'-tie','free','easy',stamp-interval '1 hour',false,'production',false),
       (prefix||'-preview',p,prefix||'-preview','free:'||prefix||'-preview','free','easy',stamp-interval '1 hour',false,'preview',false),
       (prefix||'-test',p,prefix||'-test','free:'||prefix||'-test','free','easy',stamp-interval '1 hour',false,'production',true);
 insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at,calm_mode,environment,is_test)
  values(prefix||'-future-completion',p,prefix||'-future-completion','free:'||prefix||'-future-completion','free','easy',
   stamp-interval '1 hour',stamp+interval '1 day',false,'production',false);
 insert into public.puzzle_feedback(id,player_id,puzzle_id,challenge_key,kind,rating,word,created_at,environment,is_test)
  values(gen_random_uuid(),p,prefix||'-puzzle-1','free:'||prefix||'-1','difficulty',1,null,stamp,'production',false),
        (gen_random_uuid(),p,prefix||'-puzzle-1','free:'||prefix||'-1','word',null,'QA',stamp,'production',false);
 insert into public.hint_events(id,player_id,attempt_id,puzzle_id,challenge_key,hint_level,source,complimentary,created_at,environment,is_test)
  values(gen_random_uuid(),p,prefix||'-1',prefix||'-puzzle-1','free:'||prefix||'-1',2,'manual',true,stamp,'production',false);
 insert into public.helper_events(id,player_id,attempt_id,puzzle_id,challenge_key,event_type,support_mode,idle_ms,created_at,environment,is_test)
  values(gen_random_uuid(),p,prefix||'-1',prefix||'-puzzle-1','free:'||prefix||'-1','offered','older',70000,stamp,'production',false);
 data:=public.proplet_quality_dataset_v1(start_at,stamp);
 if data->>'ok'<>'true' or (data->>'schemaVersion')::integer<>1 then raise exception 'quality dataset unavailable'; end if;
 select count(*) into n from jsonb_array_elements(data->'datasets'->'attempts') a where a->>1=p::text;
 if n<>1108 then raise exception 'quality dataset truncation or cohort change: %',n; end if;
 if exists(select 1 from jsonb_array_elements(data->'datasets'->'attempts') a
   where a->>0 in(prefix||'-history-replay',prefix||'-history-old',prefix||'-tie-b',prefix||'-preview',prefix||'-test')) then
  raise exception 'quality lifetime/replay/environment selection changed';
 end if;
 if not exists(select 1 from jsonb_array_elements(data->'datasets'->'attempts') a where a->>0=prefix||'-history-calm' and (a->>8)::boolean) then
  raise exception 'quality calm cohort merged'; end if;
 if not exists(select 1 from jsonb_array_elements(data->'datasets'->'attempts') a where a->>0=prefix||'-future-completion' and (a->>7)::timestamptz>stamp) then
  raise exception 'transport modified completion cutoff semantics'; end if;
 -- Exact projection equivalence to the old paginated view, including nulls.
 select coalesce(jsonb_agg(jsonb_build_array(id,player_id,anonymous_id,puzzle_id,mode,difficulty,started_at,completed_at,
  calm_mode,elapsed_ms,wrong_attempts,hints_used,clean_solve,first_correct_ms,reset_count,resume_count,first_hint_ms) order by id),'[]'::jsonb)
 into expected from public.analytics_first_attempts where environment in('production','legacy') and not is_test and started_at between start_at and stamp;
 if data->'datasets'->'attempts' is distinct from expected then raise exception 'quality first-lifetime view projection differs'; end if;
 if (data->'counts'->>'attempts')::integer<>jsonb_array_length(expected) then raise exception 'quality completeness count'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(puzzle_id,rating) order by id),'[]'::jsonb) into expected
 from public.puzzle_feedback where environment in('production','legacy') and not is_test and kind='difficulty' and created_at between start_at and stamp;
 if data->'datasets'->'feedback' is distinct from expected then raise exception 'quality ratings projection differs'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(puzzle_id) order by id),'[]'::jsonb) into expected
 from public.puzzle_feedback where environment in('production','legacy') and not is_test and kind='word' and created_at between start_at and stamp;
 if data->'datasets'->'word_feedback' is distinct from expected then raise exception 'quality word feedback projection differs'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(attempt_id,source,complimentary,hint_level) order by id),'[]'::jsonb) into expected
 from public.hint_events where environment in('production','legacy') and not is_test and created_at between start_at and stamp;
 if data->'datasets'->'hint_events' is distinct from expected then raise exception 'quality hints projection differs'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(attempt_id,event_type,idle_ms,support_mode) order by id),'[]'::jsonb) into expected
 from public.helper_events where environment in('production','legacy') and not is_test and created_at between start_at and stamp;
 if data->'datasets'->'helper_events' is distinct from expected then raise exception 'quality helper projection differs'; end if;
 if data->'eventCounts' is distinct from public.proplet_quality_event_counts(start_at,stamp) then raise exception 'quality event actor counts changed'; end if;
 if has_function_privilege('anon','public.proplet_quality_dataset_v1(timestamptz,timestamptz)','execute')
  or has_function_privilege('authenticated','public.proplet_quality_dataset_v1(timestamptz,timestamptz)','execute')
  or not has_function_privilege('service_role','public.proplet_quality_dataset_v1(timestamptz,timestamptz)','execute') then
  raise exception 'quality source privilege leak'; end if;
 if (select prosecdef from pg_proc where oid='public.proplet_quality_dataset_v1(timestamptz,timestamptz)'::regprocedure) then
  raise exception 'quality RPC bypasses caller privileges'; end if;
 data:=public.proplet_quality_dataset_v1(start_at-interval '1 day',stamp);
 if data->>'code'<>'invalid_window' or data ? 'datasets' then raise exception 'quality invalid window produced metrics'; end if;
 if dst_until-dst_from<>interval '90 days 1 hour' then raise exception 'DST fixture interval'; end if;
 data:=public.proplet_quality_dataset_v1(dst_from,dst_until);
 if data->>'ok'<>'true' then raise exception 'valid Prague 90-day DST range refused'; end if;
end;
$qa$;
rollback;
