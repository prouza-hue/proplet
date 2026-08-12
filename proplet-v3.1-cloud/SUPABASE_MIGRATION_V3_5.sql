-- Proplet v3.5 Quality — telemetry obtížnosti, feedback hráčů a quality report.
-- Spusť jednou v Supabase SQL Editoru PŘED nasazením v3.5.

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
