# Proplet v3.5 Quality

Česká slovní logická hra pro Vercel + Supabase.

## Co přináší v3.5
- výrazně viditelnější **Hraj dál** přímo pod Daily + 4 rychlé volby obtížnosti
- po dokončení Daily hlavní CTA **Vybrat další hru**
- telemetry skutečné obtížnosti: start/dokončení, čas, chyby, hinty, Clean
- dobrovolné hodnocení úlohy: **Lehčí / Akorát / Těžší**
- hlášení **Divné slovo?** pro čištění slovníku
- `/api/quality-report` s agregovanými metrikami puzzle
- férový Daily čas: běží i při odchodu do menu; Free se dál pauzuje
- robustnější snímání rychlého tahu prstem pomocí coalesced events + mezivzorkování
- týdenní rodinný leaderboard
- progres i u dosud nezískaných achievementů
- řízená PWA aktualizace s bannerem **Aktualizovat**
- Android/PWA navigace přes History API: systémové Zpět jde o jeden krok, hra → menu; u modalu nejdřív zavře modal

## Stávající obsah
- 50 Easy (6×6)
- 50 Medium (7×8)
- 50 Hard (25× 8×8 + 25× 9×9)
- 50 Mozkožrout (10×10)
- 365 Daily
- 30 rescue 6×6 úloh
- strict unique-solution route logic
- onboarding, 3 stupně nápovědy, Clean solve
- XP, streaky, achievementy, rodinný leaderboard
- heslové multi-device účty
- Fold/tablet responsive layout
- lokální persistentní rozehraná Free/Daily

## Aktualizace z v3.4.x
Viz `UPDATE_V3_5_CZ.md`. Před deployem je nutné jednou spustit `SUPABASE_MIGRATION_V3_5.sql`.

## Čistá instalace
Použij `SUPABASE_SETUP.sql`, nastav `SUPABASE_URL` a `SUPABASE_SECRET_KEY` ve Vercelu a deployuj celý repozitář.
