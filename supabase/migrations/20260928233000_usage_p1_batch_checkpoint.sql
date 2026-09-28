-- P1 usage reduction: checkpoint updates become one atomic RPC instead of a
-- read followed by a write. Product-event batching is handled by the API and
-- uses the existing product_events relation.

create or replace function public.proplet_attempt_checkpoint_v1(
  p_attempt_id text,
  p_player uuid,
  p_anonymous_id text,
  p_event_type text,
  p_elapsed_ms integer,
  p_found_words integer,
  p_calm_mode boolean
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  updated boolean := false;
begin
  update public.puzzle_attempts
  set
    last_found_words = greatest(coalesce(last_found_words, 0), greatest(coalesce(p_found_words, 0), 0)),
    last_activity_at = statement_timestamp(),
    calm_mode = case
      when p_calm_mode is null then calm_mode
      else coalesce(calm_mode, false) or p_calm_mode
    end,
    first_correct_ms = case
      when p_event_type = 'correct' then coalesce(first_correct_ms, greatest(coalesce(p_elapsed_ms, 0), 0))
      else first_correct_ms
    end,
    first_hint_ms = case
      when p_event_type = 'hint' then coalesce(first_hint_ms, greatest(coalesce(p_elapsed_ms, 0), 0))
      else first_hint_ms
    end,
    reset_count = coalesce(reset_count, 0) + case when p_event_type = 'reset' then 1 else 0 end,
    resume_count = coalesce(resume_count, 0) + case when p_event_type = 'resume' then 1 else 0 end
  where id = p_attempt_id
    and (
      (p_player is not null and player_id = p_player and anonymous_id is null)
      or
      (p_player is null and p_anonymous_id is not null and player_id is null and anonymous_id = p_anonymous_id)
    )
  returning true into updated;

  return coalesce(updated, false);
end;
$function$;

revoke all on function public.proplet_attempt_checkpoint_v1(text, uuid, text, text, integer, integer, boolean) from public;
revoke all on function public.proplet_attempt_checkpoint_v1(text, uuid, text, text, integer, integer, boolean) from anon;
revoke all on function public.proplet_attempt_checkpoint_v1(text, uuid, text, text, integer, integer, boolean) from authenticated;
grant execute on function public.proplet_attempt_checkpoint_v1(text, uuid, text, text, integer, integer, boolean) to service_role;
