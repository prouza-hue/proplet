-- Proplet v3.7 Cloud – čistá instalace nové databáze.
-- Pro již živý Proplet použij pouze příslušnou migrační SQL pro daný release.

create table if not exists public.players (
    id uuid primary key,
    name text not null check (char_length(name) between 1 and 24),
    family_code text not null check (char_length(family_code) between 2 and 24),
    token_hash text not null unique,
    password_hash text,
    avatar text not null default '🙂',
    created_at timestamptz not null default now()
);

alter table public.players add column if not exists password_hash text;
alter table public.players add column if not exists avatar text not null default '🙂';
alter table public.players add column if not exists team_joined_at timestamptz;

create unique index if not exists players_family_name_ci
    on public.players (family_code, lower(name));
create index if not exists idx_players_family
    on public.players (family_code);
create index if not exists idx_players_team_joined_at
    on public.players (family_code, team_joined_at);

create table if not exists public.player_sessions (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    token_hash text not null unique,
    created_at timestamptz not null default now()
);
create index if not exists idx_player_sessions_player
    on public.player_sessions (player_id);

create table if not exists public.results (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    puzzle_id text not null,
    challenge_key text not null,
    mode text not null check (mode in ('daily','free','starter','tajenka')),
    difficulty text not null,
    daily_date date,
    best_elapsed_ms integer not null check (best_elapsed_ms >= 1000),
    best_moves integer not null check (best_moves >= 1),
    points integer not null check (points >= 0),
    hints_used integer check (hints_used is null or hints_used between 0 and 99),
    clean_solve boolean,
    completed_at timestamptz not null default now(),
    unique(player_id, challenge_key)
);

alter table public.results drop constraint if exists results_difficulty_check;
alter table public.results add constraint results_difficulty_check
    check (difficulty in ('easy','medium','hard','hardcore'));


create table if not exists public.streak_rescues (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    missed_date date not null,
    puzzle_id text not null,
    status text not null check (status in ('started','passed','failed')),
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    elapsed_ms integer,
    unique(player_id, missed_date)
);
create index if not exists idx_streak_rescues_player on public.streak_rescues (player_id, missed_date);

create index if not exists idx_results_player on public.results (player_id);
create index if not exists idx_results_daily on public.results (daily_date, challenge_key);

-- Browser nemá přímý přístup; databázi obsluhuje jen FastAPI backend přes secret key.
alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.results enable row level security;
alter table public.streak_rescues enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.player_sessions from anon, authenticated;
revoke all on table public.results from anon, authenticated;
revoke all on table public.streak_rescues from anon, authenticated;

grant all on table public.players to service_role;
grant all on table public.player_sessions to service_role;
grant all on table public.results to service_role;
grant all on table public.streak_rescues to service_role;

-- v3.5 Quality telemetry
alter table public.results add column if not exists wrong_attempts integer not null default 0;
alter table public.results add column if not exists max_hint_level integer not null default 0;

create table if not exists public.puzzle_attempts (
    id text primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    puzzle_id text not null,
    challenge_key text not null,
    mode text not null check (mode in ('daily','free')),
    difficulty text not null check (difficulty in ('easy','medium','hard','hardcore')),
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    elapsed_ms integer,
    moves integer,
    wrong_attempts integer not null default 0,
    hints_used integer not null default 0,
    max_hint_level integer not null default 0,
    clean_solve boolean,
    app_version text not null default '3.5'
);
create index if not exists idx_puzzle_attempts_puzzle on public.puzzle_attempts (puzzle_id, started_at);
create index if not exists idx_puzzle_attempts_player on public.puzzle_attempts (player_id, started_at);

create table if not exists public.puzzle_feedback (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    puzzle_id text not null,
    challenge_key text not null,
    kind text not null check (kind in ('difficulty','word')),
    rating integer,
    word text,
    note text,
    created_at timestamptz not null default now(),
    unique(player_id, puzzle_id, kind)
);
create index if not exists idx_puzzle_feedback_puzzle on public.puzzle_feedback (puzzle_id, created_at);

alter table public.puzzle_attempts enable row level security;
alter table public.puzzle_feedback enable row level security;
revoke all on table public.puzzle_attempts from anon, authenticated;
revoke all on table public.puzzle_feedback from anon, authenticated;
grant all on table public.puzzle_attempts to service_role;
grant all on table public.puzzle_feedback to service_role;


-- Proplet v3.7 Playtest additions
-- Proplet v3.7 — Playtest polish
-- 1) skutečné rodinné ligy, 2) jednotlivé běhy pro férové žebříčky,
-- 3) Web Push subscriptions pro Denní výzvu.

create table if not exists public.leagues (
    code text primary key,
    name text not null,
    pin_hash text,
    created_at timestamptz not null default now()
);

-- Zachovej všechny současné rodiny jako ligy. Starší ligy nemají PIN;
-- nově vytvořené ligy už PIN mají.
insert into public.leagues (code, name)
select distinct family_code, family_code
from public.players
where family_code is not null and length(trim(family_code)) >= 2
on conflict (code) do nothing;

create table if not exists public.puzzle_runs (
    id uuid primary key,
    attempt_id text unique,
    player_id uuid not null references public.players(id) on delete cascade,
    puzzle_id text not null,
    challenge_key text not null,
    mode text not null,
    difficulty text not null,
    elapsed_ms integer not null,
    moves integer not null,
    hints_used integer not null default 0,
    wrong_attempts integer not null default 0,
    max_hint_level integer not null default 0,
    clean_solve boolean not null default false,
    completed_at timestamptz not null default now()
);
create index if not exists idx_puzzle_runs_puzzle on public.puzzle_runs (puzzle_id, completed_at);
create index if not exists idx_puzzle_runs_player on public.puzzle_runs (player_id, completed_at);
create index if not exists idx_puzzle_runs_challenge on public.puzzle_runs (challenge_key, completed_at);

-- Starší výsledky se stanou jedním výchozím během, aby historie a žebříčky
-- fungovaly i pro úrovně odehrané před v3.7.
insert into public.puzzle_runs (
    id, attempt_id, player_id, puzzle_id, challenge_key, mode, difficulty,
    elapsed_ms, moves, hints_used, wrong_attempts, max_hint_level, clean_solve, completed_at
)
select
    gen_random_uuid(), 'legacy:' || id::text, player_id, puzzle_id, challenge_key, mode, difficulty,
    best_elapsed_ms, best_moves, coalesce(hints_used,0), coalesce(wrong_attempts,0),
    coalesce(max_hint_level,0), coalesce(clean_solve,false), completed_at
from public.results
on conflict (attempt_id) do nothing;

create table if not exists public.push_subscriptions (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_player on public.push_subscriptions (player_id);

alter table public.leagues enable row level security;
alter table public.puzzle_runs enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on table public.leagues from anon, authenticated;
revoke all on table public.puzzle_runs from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
grant all on table public.leagues to service_role;
grant all on table public.puzzle_runs to service_role;
grant all on table public.push_subscriptions to service_role;

-- v3.14 — Pomocník + Quality Analytics v2
alter table public.players add column if not exists support_mode text not null default 'none';
alter table public.puzzle_attempts add column if not exists first_correct_ms integer;
alter table public.puzzle_attempts add column if not exists first_hint_ms integer;
alter table public.puzzle_attempts add column if not exists reset_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists resume_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists last_found_words integer not null default 0;
alter table public.puzzle_attempts add column if not exists last_activity_at timestamptz;

create table if not exists public.helper_events (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    attempt_id text not null,
    puzzle_id text not null,
    challenge_key text not null,
    event_type text not null check (event_type in ('offered','accepted','dismissed')),
    support_mode text not null default 'none',
    elapsed_ms integer not null default 0,
    idle_ms integer not null default 0,
    found_words integer not null default 0,
    total_words integer not null default 0,
    created_at timestamptz not null default now()
);
create table if not exists public.hint_events (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    attempt_id text not null,
    puzzle_id text not null,
    challenge_key text not null,
    hint_level integer not null check (hint_level between 1 and 3),
    source text not null check (source in ('manual','helper')),
    support_mode text not null default 'none',
    complimentary boolean not null default false,
    elapsed_ms integer not null default 0,
    found_words integer not null default 0,
    total_words integer not null default 0,
    created_at timestamptz not null default now()
);
create table if not exists public.quality_snapshots (
    id uuid primary key,
    week_start date not null unique,
    analytics_version integer not null default 2,
    payload jsonb not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_helper_events_attempt on public.helper_events (attempt_id, created_at);
create index if not exists idx_helper_events_puzzle on public.helper_events (puzzle_id, created_at);
create index if not exists idx_hint_events_attempt on public.hint_events (attempt_id, created_at);
create index if not exists idx_hint_events_puzzle on public.hint_events (puzzle_id, created_at);
create index if not exists idx_quality_snapshots_week on public.quality_snapshots (week_start desc);
alter table public.helper_events enable row level security;
alter table public.hint_events enable row level security;
alter table public.quality_snapshots enable row level security;
revoke all on table public.helper_events from anon, authenticated;
revoke all on table public.hint_events from anon, authenticated;
revoke all on table public.quality_snapshots from anon, authenticated;
grant all on table public.helper_events to service_role;
grant all on table public.hint_events to service_role;
grant all on table public.quality_snapshots to service_role;

-- v3.14 constraint hardening (idempotent)
alter table public.players drop constraint if exists players_support_mode_check;
alter table public.players add constraint players_support_mode_check check (support_mode in ('none','beginner','younger','older'));
alter table public.helper_events drop constraint if exists helper_events_support_mode_check;
alter table public.helper_events add constraint helper_events_support_mode_check check (support_mode in ('none','beginner','younger','older'));
alter table public.hint_events drop constraint if exists hint_events_support_mode_check;
alter table public.hint_events add constraint hint_events_support_mode_check check (support_mode in ('none','beginner','younger','older'));

-- v3.15 — anonymní Quality Analytics
alter table public.puzzle_attempts alter column player_id drop not null;
alter table public.puzzle_attempts add column if not exists anonymous_id text;
alter table public.puzzle_attempts drop constraint if exists puzzle_attempts_exactly_one_identity;
alter table public.puzzle_attempts add constraint puzzle_attempts_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_puzzle_attempts_anonymous on public.puzzle_attempts (anonymous_id, started_at);

alter table public.puzzle_feedback alter column player_id drop not null;
alter table public.puzzle_feedback add column if not exists anonymous_id text;
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_exactly_one_identity;
alter table public.puzzle_feedback add constraint puzzle_feedback_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_puzzle_feedback_anonymous on public.puzzle_feedback (anonymous_id, created_at);
create unique index if not exists uq_puzzle_feedback_anonymous_puzzle_kind
  on public.puzzle_feedback (anonymous_id, puzzle_id, kind)
  where anonymous_id is not null;

alter table public.helper_events alter column player_id drop not null;
alter table public.helper_events add column if not exists anonymous_id text;
alter table public.helper_events drop constraint if exists helper_events_exactly_one_identity;
alter table public.helper_events add constraint helper_events_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_helper_events_anonymous on public.helper_events (anonymous_id, created_at);

alter table public.hint_events alter column player_id drop not null;
alter table public.hint_events add column if not exists anonymous_id text;
alter table public.hint_events drop constraint if exists hint_events_exactly_one_identity;
alter table public.hint_events add constraint hint_events_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_hint_events_anonymous on public.hint_events (anonymous_id, created_at);

create table if not exists public.product_events (
  id uuid primary key,
  player_id uuid references public.players(id) on delete cascade,
  anonymous_id text,
  event_type text not null,
  app_version text not null default '3.15',
  created_at timestamptz not null default now(),
  constraint product_events_exactly_one_identity check ((player_id is not null) <> (anonymous_id is not null))
);
create index if not exists idx_product_events_anonymous on public.product_events (anonymous_id, created_at);
create index if not exists idx_product_events_player on public.product_events (player_id, created_at);
create index if not exists idx_product_events_type on public.product_events (event_type, created_at);
alter table public.product_events enable row level security;
revoke all on table public.product_events from anon, authenticated;
grant all on table public.product_events to service_role;

-- v3.16 — jedna ekonomická odměna na slot obtížnost + úroveň
create table if not exists public.free_slot_rewards (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'hardcore')),
  level integer not null check (level between 1 and 200),
  source_puzzle_id text not null,
  content_generation integer not null default 1 check (content_generation >= 1),
  points integer not null default 0 check (points >= 0),
  earned_at timestamptz not null default now(),
  unique (player_id, difficulty, level)
);
create index if not exists free_slot_rewards_player_idx on public.free_slot_rewards (player_id, difficulty, level);
alter table public.free_slot_rewards enable row level security;
revoke all on table public.free_slot_rewards from anon, authenticated;
grant all on table public.free_slot_rewards to service_role;

-- v3.17 — oddělená administrace a fronta hlášení slov
create table if not exists public.admin_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Fresh installs intentionally do not auto-grant admin from a public name/team pair.
-- After creating a trusted player, grant admin explicitly by that player's UUID.

create table if not exists public.admin_audit_log (
  id uuid primary key,
  admin_player_id uuid references public.players(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_admin on public.admin_audit_log (admin_player_id, created_at desc);

alter table public.puzzle_feedback add column if not exists status text not null default 'new';
alter table public.puzzle_feedback add column if not exists resolution_note text;
alter table public.puzzle_feedback add column if not exists reviewed_at timestamptz;
alter table public.puzzle_feedback add column if not exists reviewed_by uuid references public.players(id) on delete set null;
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_status_check;
alter table public.puzzle_feedback add constraint puzzle_feedback_status_check check (status in ('new','reviewing','resolved','dismissed'));
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_player_id_puzzle_id_kind_key;
drop index if exists public.uq_puzzle_feedback_anonymous_puzzle_kind;
create unique index if not exists uq_feedback_player_difficulty on public.puzzle_feedback (player_id, puzzle_id) where player_id is not null and kind = 'difficulty';
create unique index if not exists uq_feedback_anon_difficulty on public.puzzle_feedback (anonymous_id, puzzle_id) where anonymous_id is not null and kind = 'difficulty';
create unique index if not exists uq_feedback_player_word on public.puzzle_feedback (player_id, puzzle_id, lower(coalesce(word, ''))) where player_id is not null and kind = 'word';
create unique index if not exists uq_feedback_anon_word on public.puzzle_feedback (anonymous_id, puzzle_id, lower(coalesce(word, ''))) where anonymous_id is not null and kind = 'word';
create index if not exists idx_puzzle_feedback_status on public.puzzle_feedback (kind, status, created_at desc);

alter table public.admin_accounts enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_accounts from anon, authenticated;
revoke all on table public.admin_audit_log from anon, authenticated;
grant all on table public.admin_accounts to service_role;
grant all on table public.admin_audit_log to service_role;


-- ============================================================
-- Proplet v3.23 clean-install parity
-- ============================================================
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

