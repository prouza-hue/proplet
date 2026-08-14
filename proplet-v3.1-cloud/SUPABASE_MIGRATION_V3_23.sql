-- Proplet v3.23 — Launch Readiness
-- Security rate limits, operational telemetry, support reports and expiring secondary sessions.
-- Safe to run repeatedly. Does not delete gameplay results or XP.

-- 1) Secondary device sessions now have an explicit lifetime.
alter table public.player_sessions add column if not exists expires_at timestamptz;
alter table public.player_sessions add column if not exists last_used_at timestamptz;
update public.player_sessions
set expires_at = greatest(created_at + interval '180 days', now() + interval '30 days')
where expires_at is null;
create index if not exists idx_player_sessions_expires on public.player_sessions (expires_at);

-- 2) Atomic fixed-window rate limiting. Only the backend service role may call it.
create table if not exists public.security_rate_limits (
  scope text not null,
  actor_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, actor_hash, window_start)
);
create index if not exists idx_security_rate_limits_updated on public.security_rate_limits (updated_at);
alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from anon, authenticated;
grant all on table public.security_rate_limits to service_role;

create or replace function public.proplet_rate_limit(
  p_scope text,
  p_actor_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  bucket_ts timestamptz;
  new_hits integer;
begin
  if p_window_seconds < 1 or p_window_seconds > 86400 or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit parameters';
  end if;
  if char_length(coalesce(p_scope, '')) < 1 or char_length(coalesce(p_actor_hash, '')) < 16 then
    raise exception 'invalid rate limit key';
  end if;

  bucket_ts := to_timestamp(floor(extract(epoch from now_ts) / p_window_seconds) * p_window_seconds);

  insert into public.security_rate_limits(scope, actor_hash, window_start, hits, updated_at)
  values (left(p_scope, 80), left(p_actor_hash, 128), bucket_ts, 1, now_ts)
  on conflict (scope, actor_hash, window_start)
  do update set hits = public.security_rate_limits.hits + 1, updated_at = excluded.updated_at
  returning hits into new_hits;

  return query select
    new_hits <= p_limit,
    greatest(p_limit - new_hits, 0),
    bucket_ts + make_interval(secs => p_window_seconds);
end;
$$;
revoke all on function public.proplet_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.proplet_rate_limit(text,text,integer,integer) to service_role;

-- 3) Operational events deliberately contain no raw IP, auth token or exception text.
create table if not exists public.operational_events (
  id uuid primary key,
  event_type text not null check (event_type in ('server_error','client_error','rate_limit')),
  severity text not null default 'warning' check (severity in ('info','warning','error')),
  request_id text,
  route text,
  app_version text,
  actor_kind text check (actor_kind is null or actor_kind in ('player','anonymous','network')),
  code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_operational_events_created on public.operational_events (created_at desc);
create index if not exists idx_operational_events_type_created on public.operational_events (event_type, created_at desc);
alter table public.operational_events enable row level security;
revoke all on table public.operational_events from anon, authenticated;
grant all on table public.operational_events to service_role;

-- 4) General support reports. Identity is either a signed-in player or anonymous installation hash.
create table if not exists public.support_reports (
  id uuid primary key,
  player_id uuid references public.players(id) on delete cascade,
  anonymous_id text,
  category text not null check (category in ('bug','account','privacy','idea','other')),
  message text not null check (char_length(message) between 3 and 1200),
  reply_to text check (reply_to is null or char_length(reply_to) <= 160),
  page text,
  app_version text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  resolution_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint support_reports_identity check ((player_id is not null) <> (anonymous_id is not null))
);
create index if not exists idx_support_reports_status on public.support_reports (status, created_at desc);
create index if not exists idx_support_reports_player on public.support_reports (player_id, created_at desc);
alter table public.support_reports enable row level security;
revoke all on table public.support_reports from anon, authenticated;
grant all on table public.support_reports to service_role;

-- 5) Historical admin actions must not block a former admin from deleting their account.
--    The audit row remains, but its direct player link is anonymized on account deletion.
alter table public.admin_audit_log alter column admin_player_id drop not null;
alter table public.admin_audit_log drop constraint if exists admin_audit_log_admin_player_id_fkey;
alter table public.admin_audit_log
  add constraint admin_audit_log_admin_player_id_fkey
  foreign key (admin_player_id) references public.players(id) on delete set null;

-- 6) Keep the security/operational tables bounded without touching gameplay analytics.
create or replace function public.proplet_launch_housekeeping()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rate_deleted integer := 0;
  ops_deleted integer := 0;
  support_deleted integer := 0;
begin
  delete from public.security_rate_limits where updated_at < now() - interval '2 days';
  get diagnostics rate_deleted = row_count;
  delete from public.operational_events where created_at < now() - interval '30 days';
  get diagnostics ops_deleted = row_count;
  delete from public.support_reports
  where status in ('resolved','dismissed')
    and coalesce(reviewed_at, created_at) < now() - interval '12 months';
  get diagnostics support_deleted = row_count;
  return jsonb_build_object('rateLimitsDeleted', rate_deleted, 'operationalEventsDeleted', ops_deleted, 'supportReportsDeleted', support_deleted);
end;
$$;
revoke all on function public.proplet_launch_housekeeping() from public, anon, authenticated;
grant execute on function public.proplet_launch_housekeeping() to service_role;

comment on table public.security_rate_limits is 'Hashed network/actor fixed-window counters. Never stores raw IP addresses.';
comment on table public.operational_events is 'Sanitized launch reliability/security telemetry without secrets or raw exception messages.';
comment on table public.support_reports is 'User-submitted Proplet support/privacy/bug reports surfaced only in server-protected admin.';
