begin;
-- Additive, disabled until explicitly activated. Historical rows stay NULL.
create table public.fair_play_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  daily_from date,
  check (not enabled or daily_from is not null)
);
insert into public.fair_play_policy(singleton) values(true);
create table public.play_sessions (
  actor_key text not null,
  player_id uuid references public.players(id) on delete cascade,
  challenge_key text not null,
  puzzle_id text not null,
  mode text not null check(mode in ('daily','free','tajenka')),
  attempt_id text not null,
  owner_id uuid not null,
  sequence bigint not null default 0,
  progress jsonb not null default '{}'::jsonb,
  elapsed_ms bigint not null default 0 check(elapsed_ms>=0),
  active boolean not null default true,
  verified boolean not null default true,
  finished boolean not null default false,
  last_seen timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  pause_count integer not null default 0,
  takeover_count integer not null default 0,
  primary key(actor_key,challenge_key,puzzle_id)
);
create index play_sessions_player on public.play_sessions(player_id) where player_id is not null;
alter table public.fair_play_policy enable row level security;
alter table public.play_sessions enable row level security;
revoke all on public.fair_play_policy,public.play_sessions from public,anon,authenticated;
grant select,insert,update,delete on public.fair_play_policy,public.play_sessions to service_role;

create function public.proplet_merge_play_progress(a jsonb,b jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb:=coalesce(a,'{}')||coalesce(b,'{}'); k text; words jsonb;
begin
  select coalesce(jsonb_agg(v order by (v->>'answerIndex')::int),'[]') into words
  from (select distinct on ((value->>'answerIndex')::int) value as v
        from jsonb_array_elements(coalesce(a->'found','[]')||coalesce(b->'found','[]'))
        order by (value->>'answerIndex')::int) x;
  r:=jsonb_set(r,'{found}',words);
  foreach k in array array['elapsedMs','moves','hints','wrongAttempts','maxHintLevel'] loop
    r:=jsonb_set(r,array[k],to_jsonb(greatest(coalesce((a->>k)::bigint,0),coalesce((b->>k)::bigint,0))));
  end loop;
  r:=jsonb_set(r,'{moves}',to_jsonb(greatest((r->>'moves')::bigint,jsonb_array_length(words)+(r->>'wrongAttempts')::bigint)));
  r:=jsonb_set(r,'{calmMode}',to_jsonb(coalesce((a->>'calmMode')::boolean,false) or coalesce((b->>'calmMode')::boolean,false)));
  return r;
end $$;

create function public.proplet_play_session_v1(
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
 if s.active and not initial then
   s.elapsed_ms:=s.elapsed_ms+least(gap,45000);
   if gap>45000 then s.verified:=false; end if;
 end if;
 if s.owner_id<>p_owner then
   s.takeover_count:=s.takeover_count+1;
   s.owner_id:=p_owner;
 end if;
 -- A local clock may retain work from offline play but can never reduce server time.
 s.progress:=public.proplet_merge_play_progress(s.progress,p_progress);
 s.elapsed_ms:=greatest(s.elapsed_ms,coalesce((s.progress->>'elapsedMs')::bigint,0));
 if coalesce((p_progress->>'unverified')::boolean,false) or coalesce((p_progress->>'mergedAttempts')::boolean,false) then s.verified:=false; end if;
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

-- Claim an anonymous session without dropping either branch of progress.
create function public.proplet_claim_play_sessions_v1(p_anon text,p_player uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.play_sessions; a text:='p:'||p_player::text;
begin
 for g in select * from public.play_sessions where actor_key=p_anon order by challenge_key,puzzle_id for update loop
   perform pg_advisory_xact_lock(hashtextextended(a||':'||g.challenge_key||':'||g.puzzle_id,0));
   insert into public.play_sessions as target(actor_key,player_id,challenge_key,puzzle_id,mode,attempt_id,owner_id,sequence,progress,elapsed_ms,active,verified,finished,last_seen,created_at)
   values(a,p_player,g.challenge_key,g.puzzle_id,g.mode,g.attempt_id,g.owner_id,g.sequence,g.progress,g.elapsed_ms,g.active,g.verified,g.finished,g.last_seen,g.created_at)
   on conflict(actor_key,challenge_key,puzzle_id) do update set
     progress=case when target.finished then target.progress else public.proplet_merge_play_progress(target.progress,excluded.progress) end,
     elapsed_ms=case when target.finished then target.elapsed_ms else greatest(target.elapsed_ms,excluded.elapsed_ms) end,
     verified=case when target.finished then target.verified else false end;
   delete from public.play_sessions where actor_key=p_anon and challenge_key=g.challenge_key and puzzle_id=g.puzzle_id;
 end loop;
end $$;

alter table public.puzzle_runs add column timing_verified boolean;
alter table public.results add column timing_verified boolean;
create function public.proplet_result_timing_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s public.play_sessions; policy public.fair_play_policy;
begin
 select * into policy from public.fair_play_policy where singleton;
 if not coalesce(policy.enabled,false) then return new; end if;
 -- Apply only to newly inserted Daily results from the announced boundary.
 if new.mode<>'daily' or substring(new.challenge_key from 7)::date<policy.daily_from then return new; end if;
 select * into s from public.play_sessions where player_id=new.player_id and actor_key='p:'||new.player_id::text and challenge_key=new.challenge_key and puzzle_id=new.puzzle_id;
 new.timing_verified:=coalesce(s.finished and s.verified,false);
 if tg_op='UPDATE' and old.timing_verified is false then new.timing_verified:=false; end if;
 if tg_table_name='puzzle_runs' then
   new.timing_verified:=coalesce(new.timing_verified and new.attempt_id=s.attempt_id,false);
   if s.finished and new.attempt_id=s.attempt_id then new.elapsed_ms:=greatest(new.elapsed_ms,s.elapsed_ms); end if;
 else
   if s.finished then new.best_elapsed_ms:=greatest(new.best_elapsed_ms,s.elapsed_ms); end if;
 end if;
 if s.finished then
   new.hints_used:=greatest(new.hints_used,coalesce((s.progress->>'hints')::int,0));
   new.max_hint_level:=greatest(new.max_hint_level,coalesce((s.progress->>'maxHintLevel')::int,0));
   new.calm_mode:=new.calm_mode or coalesce((s.progress->>'calmMode')::boolean,false);
   new.clean_solve:=new.clean_solve and new.hints_used=0 and new.max_hint_level=0;
 end if;
 return new;
end $$;
create trigger puzzle_runs_timing_guard before insert on public.puzzle_runs for each row execute function public.proplet_result_timing_guard();
create trigger results_timing_guard before insert or update on public.results for each row execute function public.proplet_result_timing_guard();
revoke all on function public.proplet_merge_play_progress(jsonb,jsonb),public.proplet_play_session_v1(text,uuid,text,text,text,text,uuid,bigint,text,jsonb),public.proplet_claim_play_sessions_v1(text,uuid),public.proplet_result_timing_guard() from public,anon,authenticated;
grant execute on function public.proplet_merge_play_progress(jsonb,jsonb),public.proplet_play_session_v1(text,uuid,text,text,text,text,uuid,bigint,text,jsonb),public.proplet_claim_play_sessions_v1(text,uuid),public.proplet_result_timing_guard() to service_role;
create or replace function public.proplet_ranking_runs_v1(
  p_mode text,
  p_puzzle_id text,
  p_daily_date date default null
)
returns table (
  id uuid,
  player_id uuid,
  puzzle_id text,
  challenge_key text,
  mode text,
  elapsed_ms integer,
  moves integer,
  hints_used integer,
  wrong_attempts integer,
  clean_solve boolean,
  calm_mode boolean,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    ranked.id,
    ranked.player_id,
    ranked.puzzle_id,
    ranked.challenge_key,
    ranked.mode,
    ranked.elapsed_ms,
    ranked.moves,
    ranked.hints_used,
    ranked.wrong_attempts,
    ranked.clean_solve,
    ranked.calm_mode,
    ranked.completed_at
  from (
    select
      r.*,
      row_number() over (
        partition by r.player_id
        order by r.completed_at asc, r.id asc
      ) as player_run_number
    from public.puzzle_runs r
    where r.mode = p_mode
      and r.puzzle_id = p_puzzle_id
      and r.calm_mode = false
      and r.timing_verified is distinct from false
      and (
        p_daily_date is null
        or r.challenge_key = 'daily:' || p_daily_date::text
      )
  ) ranked
  where ranked.player_run_number = 1
  order by ranked.completed_at asc, ranked.id asc;
$function$;
commit;
