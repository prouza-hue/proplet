-- Proplet v3.19: Free banka se rozšiřuje ze 100 na 200 slotů v každé obtížnosti.
-- Migrace je idempotentní a nemění ani nemaže dosavadní výsledky či XP.

alter table if exists public.free_slot_rewards
  drop constraint if exists free_slot_rewards_level_check;

alter table if exists public.free_slot_rewards
  add constraint free_slot_rewards_level_check check (level between 1 and 200);

comment on table public.free_slot_rewards is
  'Exactly-once XP claims per player + difficulty + level slot across Free content generations; levels 1–200 since v3.19.';
