-- Proplet v3.4 – jednorázová migrace pro chytré nápovědy / clean solve a záchranu streaku.
-- Spusť CELÝ blok v Supabase > SQL Editor > New query > Run PŘED deploymentem v3.4.

-- 1) U výsledku ukládáme, zda hráč použil nápovědu.
alter table public.results
    add column if not exists hints_used integer;

alter table public.results
    add column if not exists clean_solve boolean;

alter table public.results
    drop constraint if exists results_hints_used_check;

alter table public.results
    add constraint results_hints_used_check
    check (hints_used is null or hints_used between 0 and 99);

-- Historické výsledky necháváme jako "neznámé" (NULL), ať je zpětně neprávem neoznačíme za clean solve.

-- 2) Jeden zmeškaný den lze jednou zachránit speciálním 30s levelem.
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

create index if not exists idx_streak_rescues_player
    on public.streak_rescues (player_id, missed_date);

alter table public.streak_rescues enable row level security;
revoke all on table public.streak_rescues from anon, authenticated;
grant all on table public.streak_rescues to service_role;
