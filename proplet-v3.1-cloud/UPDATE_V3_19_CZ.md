# Aktualizace Propletu na v3.19.0

V3.19 vyžaduje jednu krátkou SQL migraci, protože dosavadní databázová pojistka dovolovala čísla Free úrovní pouze 1–100.

## 1. Supabase

V SQL Editoru spusť celý soubor:

`SUPABASE_MIGRATION_V3_19.sql`

Migrace pouze rozšíří povolený rozsah XP slotů na 1–200. Nemaže ani neupravuje existující výsledky, hráče nebo XP a lze ji spustit opakovaně.

## 2. Aplikační soubory

Nahraj obsah `proplet-v3.19.0-update.zip` do kořene existujícího projektu a potvrď přepsání souborů. Pro čisté nasazení použij `proplet-v3.19.0-cloud.zip`.

## 3. Kontrola

Po nasazení otevři `/api/health`. Správný stav obsahuje:

- `version = 3.19.0`,
- `freeGeneration = 2`,
- `freeLevelsPerDifficulty = 200`,
- `adminStatic = true`,
- `freeGeneration2Migration = true`.

Potom obnov aplikaci nebo potvrď nabídnutou aktualizaci PWA. Na obrazovce Free se u každé obtížnosti zobrazí celkem 200 úrovní.

## Návrat zpět

Návrat aplikačních souborů na v3.18.1 je možný bez vracení SQL migrace; rozšířený databázový rozsah starší verzi nevadí. Výsledky případně odehraných úrovní 101–200 nemaž — po opětovném nasazení v3.19 se znovu načtou.
