# Aktualizace Proplet v3.15 → v3.16

V3.16 obsahuje databázovou migraci i novou puzzle banku. Dodrž následující pořadí.

## 1. Záloha

Před nasazením vytvoř běžnou zálohu databáze a ponech si dosavadní deployment v3.15 pro případný rollback.

## 2. Supabase migrace

V Supabase SQL Editoru spusť celý soubor:

`SUPABASE_MIGRATION_V3_16.sql`

Vznikne tabulka `free_slot_rewards` s unikátním klíčem hráč + obtížnost + číslo úrovně. Tím je XP odměna atomicky chráněná proti dvojímu připsání napříč Gen1 a Gen2 i při souběžné synchronizaci ze dvou zařízení.

Migrace nemaže ani neupravuje staré výsledky.

## 3. Deployment aplikace

Nasaď celý cloud balíček v3.16, případně nahraď soubory z update balíčku. Kritické soubory jsou:

- `server.py`,
- `data/puzzles.json`,
- `public/puzzles.json`,
- `public/app.js`, `public/styles.css`, `public/index.html`, `public/sw.js`,
- `data/answer_tiers.json`, `data/lexicon_v2.json`, `data/words.txt`.

`data/puzzles.json` a `public/puzzles.json` musí zůstat byte-for-byte shodné.

## 4. Kontrola po nasazení

Otevři `/api/health` a ověř:

- `version` je `3.16.0`,
- `freeGeneration` je `2`,
- `vocabularyVersion` je `2`,
- `freeGeneration2Migration` je `true`,
- `database` je `true`.

V patičce aplikace má být **Proplet v3.16**.

## 5. Doporučený smoke test

1. Nový hráč dokončí Free úroveň 1 a dostane běžné XP.
2. Stávající hráč s dokončenou původní úrovní 1 ji uvidí jako **Převedeno**.
3. Hraj dál jej pošle na první nepřevedený slot.
4. Dobrovolně dohraje novou úroveň 1, získá nový čas a Gen2 leaderboard, ale 0 dalších XP.
5. V Postupu zůstane archiv původní banky se starým časem.

## Rollback

Vrácení aplikačního deploymentu na v3.15 je možné bez mazání tabulky `free_slot_rewards`. Tabulka je aditivní a starší verze ji ignoruje. Nové Gen2 výsledky ponech v databázi; při dalším návratu na v3.16 se znovu správně načtou.
