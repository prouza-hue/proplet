begin;
-- Preserve existing verification failures and historical results; only future
-- intervals of anchored sessions gain conservative full-gap accounting.
create or replace function public.proplet_play_session_v1(
 p_actor text,p_player uuid,p_key text,p_puzzle text,p_mode text,p_attempt text,
 p_owner uuid,p_sequence bigint,p_action text,p_progress jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.play_sessions; stamp timestamptz:=clock_timestamp(); gap bigint; initial boolean;
begin
 if p_action not in ('open','pulse','pause','finish') then raise exception 'invalid action'; end if;
 -- Serializes first insertion as well as updates. Actor is derived by the API, never the body.
 perform pg_advisory_xact_lock(hashtextextended(p_actor||':'||p_key||':'||p_puzzle,0));
 select * into s from public.play_sessions where actor_key=p_actor and challenge_key=p_key and puzzle_id=p_puzzle for update;
 initial:=not found;
 if initial then
   if p_action<>'open' then return jsonb_build_object('error','missing'); end if;
   insert into public.play_sessions(actor_key,player_id,challenge_key,puzzle_id,mode,attempt_id,owner_id,progress,elapsed_ms,verified)
   values(p_actor,p_player,p_key,p_puzzle,p_mode,p_attempt,p_owner,p_progress,
     coalesce((p_progress->>'elapsedMs')::bigint,0),
     coalesce((p_progress->>'elapsedMs')::bigint,0)=0 and jsonb_array_length(coalesce(p_progress->'found','[]'))=0)
   returning * into s;
 end if;
 if s.finished then return to_jsonb(s)-'actor_key'-'player_id'; end if;
 gap:=greatest(0,floor(extract(epoch from(stamp-s.last_seen))*1000)::bigint);
 if s.owner_id<>p_owner and p_action<>'open' then return jsonb_build_object('error','ownership'); end if;
 if s.owner_id<>p_owner and s.active and gap<=45000 then return jsonb_build_object('error','busy'); end if;
 if s.owner_id=p_owner and p_sequence<=s.sequence and not initial then return to_jsonb(s)-'actor_key'-'player_id'; end if;
 -- Reconnection pays the entire server wall-clock interval. A locally paused
 -- clock cannot shorten it. An offline resume after an acknowledged pause
 -- conservatively also pays time since that last confirmed server contact.
 if not initial and (s.active or coalesce((p_progress->>'disconnected')::boolean,false)) then
   s.elapsed_ms:=s.elapsed_ms+gap;
 end if;
 if s.owner_id<>p_owner then
   s.takeover_count:=s.takeover_count+1;
   s.owner_id:=p_owner;
 end if;
 -- A local clock may retain work from offline play but can never reduce server time.
 s.progress:=public.proplet_merge_play_progress(s.progress,p_progress);
 s.elapsed_ms:=greatest(s.elapsed_ms,coalesce((s.progress->>'elapsedMs')::bigint,0));
 if coalesce((p_progress->>'unverified')::boolean,false) or coalesce((p_progress->>'mergedAttempts')::boolean,false) then s.verified:=false; end if;
 -- Result storage is int32 milliseconds. Never silently shorten a long run.
 if s.elapsed_ms>2147483647 then return jsonb_build_object('error','duration_limit'); end if;
 s.progress:=jsonb_set(s.progress,'{elapsedMs}',to_jsonb(s.elapsed_ms));
 s.sequence:=p_sequence;s.last_seen:=stamp;
 s.active:=p_action in ('open','pulse');
 if p_action='pause' then s.pause_count:=s.pause_count+1; end if;
 if p_action='finish' then s.finished:=true; end if;
 update public.play_sessions set owner_id=s.owner_id,sequence=s.sequence,progress=s.progress,
 elapsed_ms=s.elapsed_ms,active=s.active,verified=s.verified,finished=s.finished,last_seen=s.last_seen,
 pause_count=s.pause_count,takeover_count=s.takeover_count
 where actor_key=p_actor and challenge_key=p_key and puzzle_id=p_puzzle;
 return to_jsonb(s)-'actor_key'-'player_id';
end $$;

-- Raise only the duration boundary on the installed atomic writers. Keep their
-- current reward, special-binding and preview-clock logic intact.
do $duration_patch$
declare signature text; source text; needle text := 'v_elapsed_ms not between 1000 and 86400000';
begin
 foreach signature in array array[
  'public.proplet_submit_result_v1(uuid,text,text,text,jsonb)',
  'public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb)'
 ] loop
  source:=pg_get_functiondef(signature::regprocedure);
  if (length(source)-length(replace(source,needle,'')))/length(needle) <> 1 then
   raise exception 'DURATION_BOUNDARY_CHANGED %',signature;
  end if;
  execute replace(source,needle,'v_elapsed_ms not between 1000 and 2147483647');
 end loop;
end $duration_patch$;
commit;
