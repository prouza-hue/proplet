-- Proplet v3.25 — XP Economy v2
-- Free XP: Snadná 15 / Střední 25 / Těžká 50 / Mozkožrout 100.
-- Daily zůstává 100 XP, starter 10 XP.
--
-- Spouštěj AŽ po nasazení serveru v3.25. Migrace je idempotentní:
-- pouze dorovná kladné historické Free odměny, které jsou pod novou sazbou.
-- Nulové odměny převedených/replay slotů zůstávají nulové, takže nevzniká dvojí XP.

begin;

-- Oficiální výsledky jsou zdrojem hráčova celkového XP.
update public.results
set points = case difficulty
  when 'easy' then 15
  when 'medium' then 25
  when 'hard' then 50
  when 'hardcore' then 100
  else points
end
where mode = 'free'
  and points > 0
  and points < case difficulty
    when 'easy' then 15
    when 'medium' then 25
    when 'hard' then 50
    when 'hardcore' then 100
    else points
  end;

-- Auditní/konkurenčně bezpečné claimy Free slotů držíme ve stejném ekonomickém tvaru.
-- Řádky s points = 0 reprezentují slot, který už byl historicky odměněn jinde;
-- ty se úmyslně NEMĚNÍ.
update public.free_slot_rewards
set points = case difficulty
  when 'easy' then 15
  when 'medium' then 25
  when 'hard' then 50
  when 'hardcore' then 100
  else points
end
where points > 0
  and points < case difficulty
    when 'easy' then 15
    when 'medium' then 25
    when 'hard' then 50
    when 'hardcore' then 100
    else points
  end;

commit;
