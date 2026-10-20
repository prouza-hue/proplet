-- Read-only, backend-only aggregate for admin duplicate-account diagnostics.
-- One JSON value avoids PostgREST's row cap; input/output remain <= 5000 players.
create or replace function public.proplet_account_integrity_counts(p_players uuid[])
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if p_players is null or cardinality(p_players) > 5000
     or array_position(p_players, null) is not null then
    raise exception using errcode = '22023', message = 'Invalid bounded player list';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'player_id', candidate.id,
      'results', (select count(*) from public.results r where r.player_id = candidate.id),
      'sessions', (select count(*) from public.player_sessions s where s.player_id = candidate.id),
      'pushes', (select count(*) from public.push_subscriptions p where p.player_id = candidate.id)
    ) order by candidate.id), '[]'::jsonb)
    from (select distinct id from unnest(p_players) as ids(id)) candidate
  );
end;
$$;
revoke all on function public.proplet_account_integrity_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.proplet_account_integrity_counts(uuid[]) to service_role;
