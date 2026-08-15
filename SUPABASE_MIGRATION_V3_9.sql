-- Proplet v3.9 — Profiles & Teams + fair first-attempt leaderboards

-- 1) Avatar hráče se synchronizuje mezi zařízeními.
alter table public.players
    add column if not exists avatar text not null default '🙂';

update public.players
set avatar = '🙂'
where avatar is null or length(trim(avatar)) = 0;

-- 2) Volné úrovně: oficiální výsledek je PRVNÍ dokončený pokus, ne osobní rekord.
-- puzzle_runs od v3.7 uchovává jednotlivé běhy. U starších výsledků je vložen legacy běh.
with first_runs as (
    select distinct on (player_id, challenge_key)
        player_id, challenge_key, elapsed_ms, moves, hints_used, wrong_attempts,
        max_hint_level, clean_solve, completed_at
    from public.puzzle_runs
    where mode = 'free'
    order by player_id, challenge_key, completed_at asc, id asc
)
update public.results r
set
    best_elapsed_ms = f.elapsed_ms,
    best_moves = f.moves,
    hints_used = f.hints_used,
    wrong_attempts = f.wrong_attempts,
    max_hint_level = f.max_hint_level,
    clean_solve = f.clean_solve,
    completed_at = f.completed_at
from first_runs f
where r.player_id = f.player_id
  and r.challenge_key = f.challenge_key
  and r.mode = 'free';
