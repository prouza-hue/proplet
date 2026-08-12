-- Proplet v3.7 Cloud – čistá instalace nové databáze.
-- Pro již živý Proplet použij pouze příslušnou migrační SQL pro daný release.

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
