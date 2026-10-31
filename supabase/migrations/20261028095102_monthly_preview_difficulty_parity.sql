-- Exact additive sixth-difficulty constraint definitions from
-- 20261001235400_mozkokalypsa_production.sql, without replaying its obsolete RPC.
-- The restored isolated fixture missed these constraints; no rows are rewritten.
begin;
set local lock_timeout='3s';
do $parity$
begin
  if not exists(select 1 from public.monthly_competition_settings where isolated) then return; end if;
  alter table public.results drop constraint results_difficulty_check;
  alter table public.results add constraint results_difficulty_check
    check(difficulty in ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));
  alter table public.puzzle_attempts drop constraint puzzle_attempts_difficulty_check;
  alter table public.puzzle_attempts add constraint puzzle_attempts_difficulty_check
    check(difficulty in ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));
  alter table public.free_slot_rewards drop constraint free_slot_rewards_difficulty_check;
  alter table public.free_slot_rewards add constraint free_slot_rewards_difficulty_check
    check(difficulty in ('easy','medium','hard','hardcore','mozkomor','mozkokalypsa'));
end $parity$;
commit;
