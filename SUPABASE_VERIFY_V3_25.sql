-- Proplet v3.25 — ověření XP Economy v2
-- Spusť po SUPABASE_MIGRATION_V3_25.sql.
-- Script nic nemění; skončí chybou, pokud zůstala nekonzistentní kladná Free odměna.

do $$
declare
  bad_results integer := 0;
  bad_claims integer := 0;
begin
  select count(*) into bad_results
  from public.results
  where mode = 'free'
    and points > 0
    and points <> case difficulty
      when 'easy' then 15
      when 'medium' then 25
      when 'hard' then 50
      when 'hardcore' then 100
      else points
    end;

  if bad_results > 0 then
    raise exception 'VERIFY v3.25: % Free result rows have unexpected positive XP', bad_results;
  end if;

  select count(*) into bad_claims
  from public.free_slot_rewards
  where points > 0
    and points <> case difficulty
      when 'easy' then 15
      when 'medium' then 25
      when 'hard' then 50
      when 'hardcore' then 100
      else points
    end;

  if bad_claims > 0 then
    raise exception 'VERIFY v3.25: % free_slot_rewards rows have unexpected positive XP', bad_claims;
  end if;
end
$$;

select jsonb_build_object(
  'verification', 'PASS',
  'version', '3.25.0',
  'starterXp', 10,
  'dailyXp', 100,
  'freeXp', jsonb_build_object('easy',15,'medium',25,'hard',50,'hardcore',100),
  'freeBankXpAt200Each', 38000
) as proplet_v3_25_verify;
