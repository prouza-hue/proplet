# Aktualizace Proplet na v3.16.1

V3.16.1 obsahuje Free Generation 2 i novou Daily Generation 2. Pokud jsi v3.16 ještě nenasadil, můžeš ji přeskočit a nasadit rovnou tento balíček.

## Databáze

- Pokud už proběhl `SUPABASE_MIGRATION_V3_16.sql`, žádná další SQL migrace není potřeba.
- Pokud v3.16 nasazená nebyla, spusť nejdřív celý `SUPABASE_MIGRATION_V3_16.sql`.

Migrace je aditivní a nemaže staré výsledky.

## Deployment

Nasaď celý cloud balíček v3.16.1, případně nahraď soubory z update balíčku. Kritické jsou:

- `server.py`,
- `data/puzzles.json`,
- `public/puzzles.json`,
- `public/app.js`, `public/styles.css`, `public/index.html`, `public/sw.js`,
- `data/answer_tiers.json`, `data/lexicon_v2.json`, `data/words.txt`.

Soubor `data/legacy_daily_gen1.json` je úplný archiv původních Daily a má zůstat ve zdrojovém deploymentu. Runtime používá kompaktní mapu přímo v `puzzles.json`.

## Kontrola po nasazení

Na `/api/health` ověř:

- `version` = `3.16.1`,
- `freeGeneration` = `2`,
- `dailyGeneration` = `2`,
- `dailyGeneration2From` = `2026-08-13`,
- `vocabularyVersion` = `2`,
- `freeGeneration2Migration` = `true`,
- `database` = `true`.

V patičce má být **Proplet v3.16.1**.

## Rychlý smoke test

1. Otevři dnešní Daily a ověř ID ve formátu `g2-d-*` v síťové komunikaci nebo puzzle datech.
2. Dokonči Daily a zkontroluj 100 XP, streak a týmový leaderboard.
3. Obnov aplikaci a ověř, že se zobrazí dnešní uložený výsledek, nikoli nová hra.
4. Zkontroluj jednu úroveň každé Free obtížnosti a převedený postup.
5. Na `/api/health` potvrď obě generace 2.

## Rollback

Při návratu na v3.16 se nové Daily výsledky v databázi nemažou. Starší server však nezná ID `g2-d-*`, takže během rollbacku nepůjdou nové rozpracované Daily synchronizovat. Proto vrať celý deployment konzistentně a v3.16.1 obnov co nejdříve.
