-- Forward-only invariant. Existing completion timestamps are NOT backfilled.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

alter table public.puzzle_attempts add column if not exists completion_received_at timestamptz;
comment on column public.puzzle_attempts.completion_received_at is
 'Server time of the first completion accepted after this guard was installed. NULL on historical completed rows; never a last-sync timestamp.';

create or replace function public.proplet_attempt_completion_guard_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.completed_at is not null then
  new.completed_at:=old.completed_at;
  new.completion_received_at:=old.completion_received_at;
 elsif new.completed_at is not null then
  new.completion_received_at:=statement_timestamp();
 else
  new.completion_received_at:=null;
 end if;
 return new;
end;
$$;
revoke all on function public.proplet_attempt_completion_guard_v1() from public,anon,authenticated;
drop trigger if exists proplet_attempt_completion_guard_v1 on public.puzzle_attempts;
create trigger proplet_attempt_completion_guard_v1 before insert or update on public.puzzle_attempts
 for each row execute function public.proplet_attempt_completion_guard_v1();

-- Patch only the two acceptance-clock expressions in the current atomic writer.
-- Preserve its reviewed timing, reward, monthly, receipt and privilege contracts.
do $patch$
declare source text; needle text; replacement text;
begin
 source:=pg_get_functiondef('public.proplet_submit_result_v1(uuid,text,text,text,jsonb)'::regprocedure);
 needle:='completed_at = pg_catalog.clock_timestamp(),';
 replacement:='completed_at = v_completed_at,';
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then
  raise exception 'ATTEMPT_COMPLETION_WRITER_CHANGED update';
 end if;
 source:=replace(source,needle,replacement);
 needle:='pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp(), v_elapsed_ms, v_moves,';
 replacement:='pg_catalog.clock_timestamp(), v_completed_at, v_elapsed_ms, v_moves,';
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then
  raise exception 'ATTEMPT_COMPLETION_WRITER_CHANGED insert';
 end if;
 execute replace(source,needle,replacement);
end $patch$;
commit;
