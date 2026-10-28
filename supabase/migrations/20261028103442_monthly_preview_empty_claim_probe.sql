-- Read-only evidence for an authenticated no-op guest transfer in accelerated QA.
-- Does not acknowledge nonempty transfers, modify quotas, or change production.
begin;
create function public.proplet_monthly_preview_empty_claim_v1(p_anonymous_hash text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare nonempty boolean;
begin
  if not public.proplet_monthly_preview_trusted_v1() then
    raise exception 'MONTHLY_PREVIEW_FORBIDDEN' using errcode='42501'; end if;
  if p_anonymous_hash is null or p_anonymous_hash!~'^[0-9a-f]{64}$' then
    raise exception 'MONTHLY_PREVIEW_ANONYMOUS_HASH_INVALID' using errcode='22023'; end if;
  select exists(select 1 from public.play_sessions where actor_key='a:'||p_anonymous_hash)
    or exists(select 1 from public.puzzle_attempts where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.helper_events where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.hint_events where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.product_events where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.puzzle_feedback where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.push_subscriptions where anonymous_id=p_anonymous_hash)
    or exists(select 1 from public.push_delivery_log where anonymous_id=p_anonymous_hash)
    into nonempty;
  return jsonb_build_object('empty',not nonempty);
end $$;
revoke all on function public.proplet_monthly_preview_empty_claim_v1(text) from public,anon,authenticated;
grant execute on function public.proplet_monthly_preview_empty_claim_v1(text) to service_role;
notify pgrst,'reload schema';
commit;
