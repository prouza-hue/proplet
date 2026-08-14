-- Proplet v3.21 — First Touch & Game Feel
-- Bezpečná, idempotentní migrace. Nic nemaže a nepřepisuje existující výsledky.

begin;

-- Speciální první Proplet je skutečný výsledek s jednorázovou odměnou 10 XP.
-- Neúčastní se Free/Daily leaderboardů ani Quality Analytics.
alter table public.results drop constraint if exists results_mode_check;
alter table public.results add constraint results_mode_check
    check (mode in ('daily','free','starter'));

-- Férovost: účty existující před v3.21 dostanou stejných 10 XP jako nový hráč
-- po dokončení starteru. completed_at je datum vzniku hráče, takže starým účtům
-- migrace nepřihodí body do aktuálního týdne.
insert into public.results (
    id, player_id, puzzle_id, challenge_key, mode, difficulty, daily_date,
    best_elapsed_ms, best_moves, points, hints_used, wrong_attempts,
    max_hint_level, clean_solve, completed_at
)
select
    gen_random_uuid(), p.id, 'starter-v1', 'starter:starter-v1', 'starter', 'easy', null,
    1000, 1, 10, 0, 0, 0, true, coalesce(p.created_at, now())
from public.players p
where not exists (
    select 1 from public.results r
    where r.player_id = p.id and r.challenge_key = 'starter:starter-v1'
);

commit;
