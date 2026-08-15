-- Proplet v3.3 – jednorázová migrace pro stávající Supabase projekt.
-- Spusť CELÝ blok v Supabase > SQL Editor > New query > Run.

-- 1) Heslo hráče. Stávající účty zůstanou přihlášené; heslo si nastaví v aplikaci.
alter table public.players
    add column if not exists password_hash text;

-- 2) Samostatné session tokeny dovolí jednomu hráči být přihlášený na více zařízeních.
create table if not exists public.player_sessions (
    id uuid primary key,
    player_id uuid not null references public.players(id) on delete cascade,
    token_hash text not null unique,
    created_at timestamptz not null default now()
);

create index if not exists idx_player_sessions_player
    on public.player_sessions (player_id);

alter table public.player_sessions enable row level security;
revoke all on table public.player_sessions from anon, authenticated;
grant all on table public.player_sessions to service_role;

-- 3) Nová obtížnost "hardcore" / Mozkožrout.
alter table public.results
    drop constraint if exists results_difficulty_check;

alter table public.results
    add constraint results_difficulty_check
    check (difficulty in ('easy','medium','hard','hardcore'));
