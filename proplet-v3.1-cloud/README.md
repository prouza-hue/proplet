# Proplet v3.4 Cloud

Česká slovní logická hra pro Vercel + Supabase.

## v3.4 v kostce
- 50 Easy (6×6)
- 50 Medium (7×8)
- 50 Hard (25× 8×8 + 25× 9×9), křivější „šnečí“ cesty
- 50 **Mozkožrout** (10×10)
- 365 Daily
- 30 speciálních 6×6 rescue úloh pro záchranu streaku
- exact-cover solver a kontrola jednoznačnosti generovaných úloh
- adaptivní Fold/tablet herní layout bez scrollování během hry
- „Aktuálně“ stále na obrazovce; délky slov v kompaktním vodorovném pásu
- interaktivní onboarding
- 3 úrovně nápovědy + Clean solve
- Daily leaderboard: Clean → počet nápověd → čas → tahy
- streak rescue: jeden vynechaný den, 30 sekund, jeden pokus
- XP level roadmap + streak badges + achievements
- heslové účty a více současně přihlášených zařízení
- offline fronta výsledků a automatická synchronizace
- výraznější Android haptika + testovací tlačítko

## Aktualizace z v3.3
Čti `UPDATE_V3_4_CZ.md`.

**Nejdřív spusť `SUPABASE_MIGRATION_V3_4.sql`, potom deployuj kód.**

## Čistá instalace
Použij aktuální `SUPABASE_SETUP.sql`, nastav ve Vercelu:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

a deployuj celý repozitář.

## Kontrola deploymentu
`/api/health` má vracet mimo jiné:
- `ok: true`
- `database: true`
- `puzzleFile: true`
- `accountMigration: true`
- `featuresMigration: true`

## Generování puzzle
Generátor zapisuje identická data do `public/puzzles.json` i `data/puzzles.json`.

Běžné zachování existujících bank + vytvoření rescue banky:

```bash
python tools/generate_puzzles.py --preserve-existing-all --rescue 30
```

## Haptika
Web používá Android Vibration API. V profilu je přepínač i tlačítko **Otestovat haptiku**. v3.4 používá výraznější pulzy než v3.3.
