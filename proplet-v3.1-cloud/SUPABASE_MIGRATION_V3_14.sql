-- Proplet v3.14 — Pomocník + Quality Analytics v2 (kumulativní oprava v3.13)
-- Bezpečné opakované spuštění: používá IF NOT EXISTS všude, kde to PostgreSQL umožňuje.

-- 1) Úroveň podpory hráče
alter table public.players add column if not exists support_mode text not null default 'none';
alter table public.players drop constraint if exists players_support_mode_check;
alter table public.players add constraint players_support_mode_check check (support_mode in ('none','beginner','younger','older'));

-- 2) Checkpoint telemetry pokusu
alter table public.puzzle_attempts add column if not exists first_correct_ms integer;
alter table public.puzzle_attempts add column if not exists first_hint_ms integer;
alter table public.puzzle_attempts add column if not exists reset_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists resume_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists last_found_words integer not null default 0;
alter table public.puzzle_attempts add column if not exists last_activity_at timestamptz;

-- 3) Události Pomocníka
create table if not exists public.helper_events (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    attempt_id text not null,
    puzzle_id text not null,
    challenge_key text not null,
    event_type text not null check (event_type in ('offered','accepted','dismissed')),
    support_mode text not null default 'none' check (support_mode in ('none','beginner','younger','older')),
    elapsed_ms integer not null default 0,
    idle_ms integer not null default 0,
    found_words integer not null default 0,
    total_words integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_helper_events_attempt on public.helper_events (attempt_id, created_at);
create index if not exists idx_helper_events_player on public.helper_events (player_id, created_at);
create index if not exists idx_helper_events_puzzle on public.helper_events (puzzle_id, created_at);
alter table public.helper_events drop constraint if exists helper_events_support_mode_check;
alter table public.helper_events add constraint helper_events_support_mode_check check (support_mode in ('none','beginner','younger','older'));

-- 4) Události nápověd — připravené pro budoucí ekonomiku, zatím bez limitu.
create table if not exists public.hint_events (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    attempt_id text not null,
    puzzle_id text not null,
    challenge_key text not null,
    hint_level integer not null check (hint_level between 1 and 3),
    source text not null check (source in ('manual','helper')),
    support_mode text not null default 'none' check (support_mode in ('none','beginner','younger','older')),
    complimentary boolean not null default false,
    elapsed_ms integer not null default 0,
    found_words integer not null default 0,
    total_words integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_hint_events_attempt on public.hint_events (attempt_id, created_at);
create index if not exists idx_hint_events_player on public.hint_events (player_id, created_at);
create index if not exists idx_hint_events_puzzle on public.hint_events (puzzle_id, created_at);
alter table public.hint_events drop constraint if exists hint_events_support_mode_check;
alter table public.hint_events add constraint hint_events_support_mode_check check (support_mode in ('none','beginner','younger','older'));

-- 5) Týdenní anonymní QA snapshoty pro trendy.
create table if not exists public.quality_snapshots (
    id uuid primary key,
    week_start date not null unique,
    analytics_version integer not null default 2,
    payload jsonb not null,
    created_at timestamptz not null default now()
);
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
