# Proplet v4.02.0 — dokončení technického refactoru

Datum: 2026-09-01

## Co tato verze znamená

v4.02.0 uzavírá technický refactor plán Sprint 00–16.

Nejde o gameplay redesign ani změnu obsahu. Verze označuje nový technický baseline projektu po dokončení:

- backendové modulární hranice a explicitní kontrakty;
- current-runtime test gate a migration manifest;
- frontendové ownery pro game, account, content, engagement, rankings a analytics;
- konsolidované CSS ownery;
- kanonický content build/provenance manifest;
- analytics adapter + event registry;
- ověřený legacy/dead cleanup a aktuální architektonickou dokumentaci.

## Runtime kontrakt

- gameplay, XP ekonomika, puzzle banky a produkční DB schema se tímto release bumpem nemění;
- kanonická verze se posouvá z 4.01.40 na 4.02.0;
- PWA shell cache dostává nový namespace, aby klienti bezpečně převzali nový milestone release;
- existující asset-specific cache query hranice zůstávají beze změny, pokud se příslušný asset v tomto release nemění.

## Bezpečnost

Release branch musí projít:

- `current-runtime`;
- `version-alignment`;
- Vercel preview;
- production `/api/health` a build/runtime error scan po merge.

Detailní historie refactoru je v `TECH_DEBT_REFACTOR_STATUS.md`; aktuální architektura v `docs/ARCHITECTURE.md`.
