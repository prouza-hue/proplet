-- Proplet v4.01.29 — Mozkomor difficulty
-- Backward-compatible widening of existing difficulty checks. No data rewrite.

begin;

alter table public.results
  drop constraint if exists results_difficulty_check;
alter table public.results
  add constraint results_difficulty_check
  check (difficulty = any (array['easy'::text,'medium'::text,'hard'::text,'hardcore'::text,'mozkomor'::text]));

alter table public.puzzle_attempts
  drop constraint if exists puzzle_attempts_difficulty_check;
alter table public.puzzle_attempts
  add constraint puzzle_attempts_difficulty_check
  check (difficulty = any (array['easy'::text,'medium'::text,'hard'::text,'hardcore'::text,'mozkomor'::text]));

alter table public.free_slot_rewards
  drop constraint if exists free_slot_rewards_difficulty_check;
alter table public.free_slot_rewards
  add constraint free_slot_rewards_difficulty_check
  check (difficulty = any (array['easy'::text,'medium'::text,'hard'::text,'hardcore'::text,'mozkomor'::text]));

commit;
