# Proplet v3.3 Cloud

Česká slovní logická hra pro Vercel + Supabase.

## v3.3 v kostce
- 50 Easy (6×6)
- 50 Medium (7×8)
- 50 Hard (25× 8×8 + 25× 9×9), výrazně křivější „šnečí“ cesty
- 50 **Mozkožrout** (10×10), dlouhé a silně winding cesty
- 365 Daily — zachované beze změny z v3.2.2
- exact-cover solver + kontrola jednoznačnosti při generování
- postup úrovněmi místo náhodného výběru ve free režimu
- XP level roadmap + streak badges + achievements
- heslové účty a více současně přihlášených zařízení
- cloudový merge dokončených úloh, takže Daily nejde zopakovat ani na druhém zařízení
- offline fronta výsledků, automatická synchronizace a rodinný leaderboard

## Aktualizace stávajícího Propletu
Čti `UPDATE_V3_3_CZ.md`. **Nejdřív spusť `SUPABASE_MIGRATION_V3_3.sql`, potom deployuj kód.**

## Čistá instalace
Použij `SUPABASE_SETUP.sql`, nastav `SUPABASE_URL` a `SUPABASE_SECRET_KEY` ve Vercelu a deployuj celý repozitář.

## Generování puzzle
`python tools/generate_puzzles.py --preserve-existing --free-per-level 50`

Generátor zachová Easy/Medium/Daily, vytvoří novou Hard + Mozkožrout banku a zapíše `public/puzzles.json` i `data/puzzles.json`.

## Herní review
Viz `GAME_REVIEW_V3_3_CZ.md`.
