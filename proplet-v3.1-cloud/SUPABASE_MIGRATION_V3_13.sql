-- Proplet v3.13 — Quality Analytics v2 + Pomocník telemetry
-- Spusť jednou v Supabase SQL Editoru PŘED nasazením v3.13.

alter table public.players
  add column if not exists support_mode text not null default 'none';

alter table public.players drop constraint if exists players_support_mode_check;
alter table public.players
  add constraint players_support_mode_check
  check (support_mode in ('none','beginner','younger','older'));

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
create index if not exists idx_helper_events_puzzle on public.helper_events (puzzle_id, created_at);
create index if not exists idx_helper_events_attempt on public.helper_events (attempt_id, created_at);
create index if not exists idx_helper_events_player on public.helper_events (player_id, created_at);

create table if not exists public.hint_events (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    attempt_id text not null,
    puzzle_id text not null,
    challenge_key text not null,
    hint_level integer not null check (hint_level between 1 and 3),
    source text not null default 'manual' check (source in ('manual','helper')),
    support_mode text not null default 'none' check (support_mode in ('none','beginner','younger','older')),
    complimentary boolean not null default false,
    elapsed_ms integer not null default 0,
    found_words integer not null default 0,
    total_words integer not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_hint_events_puzzle on public.hint_events (puzzle_id, created_at);
create index if not exists idx_hint_events_attempt on public.hint_events (attempt_id, created_at);
create index if not exists idx_hint_events_player on public.hint_events (player_id, created_at);

alter table public.helper_events enable row level security;
alter table public.hint_events enable row level security;
revoke all on table public.helper_events from anon, authenticated;
revoke all on table public.hint_events from anon, authenticated;
grant all on table public.helper_events to service_role;
grant all on table public.hint_events to service_role;
