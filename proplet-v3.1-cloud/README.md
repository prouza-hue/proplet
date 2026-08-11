# Proplet v3.4.2 Cloud

Česká slovní logická hra pro Vercel + Supabase.

## Aktuální obsah
- 50 Easy (6×6)
- 50 Medium (7×8)
- 50 Hard (25× 8×8 + 25× 9×9)
- 50 Mozkožrout (10×10)
- 365 Daily
- 30 rescue 6×6 úloh pro záchranu streaku
- exact-cover solver a unikátní řešení
- onboarding, 3 stupně nápovědy a Clean solve
- XP levely, streaky, achievementy a rodinný leaderboard
- heslové multi-device účty
- Fold/tablet responsive herní layout
- offline fronta výsledků a automatická synchronizace
- **perzistentní rozehrané Free/Daily úlohy**

## Důležitá logika cesty
Cílové slovo se uzná pouze tehdy, když hráč projde jeho konkrétní cestu patřící do unikátního řešení celé plochy. Pokud lze stejný text slova složit jinou cestou, hra tuto alternativní cestu nepřijme a vysvětlí důvod. Tím hráč nemůže přijmout lokálně správné slovo, které by zablokovalo globální řešení.

## Update z v3.4
Viz `UPDATE_V3_4_2_CZ.md`. Pro v3.4 → v3.4.2 není potřeba žádná SQL migrace.

## Starší migrace
- z v3.2.x → nejdřív `SUPABASE_MIGRATION_V3_3.sql`
- z v3.3 → potom `SUPABASE_MIGRATION_V3_4.sql`

## Čistá instalace
Použij `SUPABASE_SETUP.sql`, nastav `SUPABASE_URL` a `SUPABASE_SECRET_KEY` ve Vercelu a deployuj celý repozitář.
