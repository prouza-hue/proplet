-- v4.01.26 P0: atomic push registration and a server-side D7 return cohort.
create or replace function public.proplet_upsert_push_subscription(
  p_endpoint text,
  p_player_id uuid,
  p_anonymous_id text,
  p_p256dh text,
  p_auth text,
  p_user_agent text,
  p_daily_enabled boolean,
  p_content_enabled boolean
)
returns setof public.push_subscriptions
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.push_subscriptions (
    id, endpoint, player_id, anonymous_id, p256dh, auth, user_agent,
    daily_enabled, content_enabled, created_at, updated_at
  ) values (
    gen_random_uuid(), p_endpoint, p_player_id, p_anonymous_id, p_p256dh, p_auth,
    p_user_agent, p_daily_enabled, p_content_enabled, now(), now()
  )
  on conflict (endpoint) do update set
    player_id = excluded.player_id,
    anonymous_id = excluded.anonymous_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    daily_enabled = excluded.daily_enabled,
    content_enabled = excluded.content_enabled,
    updated_at = now()
  returning *;
$$;

revoke all on function public.proplet_upsert_push_subscription(text, uuid, text, text, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.proplet_upsert_push_subscription(text, uuid, text, text, text, text, boolean, boolean) to service_role;

create or replace function public.proplet_push_return_cohort(
  p_inactive_days integer default 3,
  p_min_activation_age_days integer default 7
)
returns table(player_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct s.player_id
  from public.push_subscriptions s
  where s.player_id is not null
    and (s.daily_enabled or s.content_enabled)
    and exists (
      select 1 from public.puzzle_attempts activated
      where activated.player_id = s.player_id
        and activated.completed_at is not null
        and activated.started_at <= now() - make_interval(days => greatest(1, p_min_activation_age_days))
    )
    and not exists (
      select 1 from public.puzzle_attempts recent
      where recent.player_id = s.player_id
        and coalesce(recent.last_activity_at, recent.completed_at, recent.started_at)
          >= now() - make_interval(days => greatest(1, p_inactive_days))
    );
$$;

revoke all on function public.proplet_push_return_cohort(integer, integer) from public, anon, authenticated;
grant execute on function public.proplet_push_return_cohort(integer, integer) to service_role;
