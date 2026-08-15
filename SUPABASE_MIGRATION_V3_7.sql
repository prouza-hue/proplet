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
