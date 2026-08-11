-- Proplet v3.3 Cloud – čistá instalace nové databáze.
-- Pro již živý Proplet použij raději SUPABASE_MIGRATION_V3_3.sql.

create table if not exists public.players (
    id uuid primary key,
    name text not null check (char_length(name) between 1 and 24),
    family_code text not null check (char_length(family_code) between 2 and 24),
    token_hash text not null unique,
    password_hash text,
    created_at timestamptz not null default now()
);

alter table public.players add column if not exists password_hash text;

create unique index if not exists players_family_name_ci
    on public.players (family_code, lower(name));
create index if not exists idx_players_family
    on public.players (family_code);

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
    mode text not null check (mode in ('daily','free')),
    difficulty text not null,
    daily_date date,
    best_elapsed_ms integer not null check (best_elapsed_ms >= 1000),
    best_moves integer not null check (best_moves >= 1),
    points integer not null check (points >= 0),
    completed_at timestamptz not null default now(),
    unique(player_id, challenge_key)
);

alter table public.results drop constraint if exists results_difficulty_check;
alter table public.results add constraint results_difficulty_check
    check (difficulty in ('easy','medium','hard','hardcore'));

create index if not exists idx_results_player on public.results (player_id);
create index if not exists idx_results_daily on public.results (daily_date, challenge_key);

-- Browser nemá přímý přístup; databázi obsluhuje jen FastAPI backend přes secret key.
alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.results enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.player_sessions from anon, authenticated;
revoke all on table public.results from anon, authenticated;

grant all on table public.players to service_role;
grant all on table public.player_sessions to service_role;
grant all on table public.results to service_role;
