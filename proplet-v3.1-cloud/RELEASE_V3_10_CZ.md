# Proplet v3.10 — Úspěchy & férový postup

## Co je nové

- 66 úspěchů v 11 tematických sbírkách.
- Nově odemčené úspěchy se slavnostně ukážou přímo na výsledkové obrazovce.
- Oprava historických mezer v posloupnosti Free úrovní: další hra je vždy nejnižší nedokončená úroveň.
- Starší platně dokončené úrovně mimo pořadí se nemažou; při postupném hraní se automaticky přeskočí.
- Reset maže pouze řešení na ploše. Čas, tahy, chyby a nápovědy pokračují v rámci stejného pokusu.
- Quick Play i karta obtížnosti ukazují skutečné číslo následující/rozehrané úrovně.

## Proč byly některé úrovně dohrané mimo pořadí

Starší verze Propletu (zejména v3.4–v3.5) řadily nabídku volných úloh podle interního `difficultyScore`, nikoli podle `meta.level`. Hráč tak mohl dostat např. úroveň 4 dříve než úroveň 2. Tyto historické výsledky jsou legitimní a zůstávají zachované.

Od v3.10 je zdrojem pravdy pro postup číslo úrovně a vybírá se nejnižší dosud nedokončená úroveň.

## Databáze

v3.10 sama o sobě nepřidává žádnou SQL migraci.

Pokud aktualizuješ přímo z v3.8.1, je stále potřeba jednou spustit `SUPABASE_MIGRATION_V3_9.sql` kvůli avatarům a pravidlu prvního dokončeného pokusu.
