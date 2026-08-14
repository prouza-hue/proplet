# QA — Proplet v3.22.4

## Browser/PWA layout

Chromium render test používá stejnou Fold šířku s výrazně odlišnou výškou, která simuluje browser s chrome lištami vs standalone PWA:

- 654×500 — browser-like portrait,
- 654×749 — PWA-like portrait,
- 749×500 — browser-like landscape,
- 749×654 — PWA-like landscape,
- 1100×800 — desktop kontrola.

Výsledek:

- všechny Fold/tablet varianty pod 1000 px mají stejnou jednosloupcovou strukturu,
- ovládání je pod boardem,
- 10×10 board zůstává uvnitř stage,
- žádný horizontální overflow,
- desktop 1100×800 zachovává pravý ovládací rail.

## Regrese

PASS:

- JS syntax,
- Python syntax,
- CSS parser,
- v3.22.4 package/server,
- v3.22.4 layout unification,
- v3.22.3 exact 2D board fit s extrémním 42px textem,
- dark found-cell/chip contrast min 4.78:1,
- Daily replay,
- 14/14 Daily/Free migration + leaderboard fairness testů,
- Rescue offer,
- focus/visibility pause,
- account nudges 1/4/10,
- optional starter hint.

## Integrita obsahu

`public/puzzles.json` i `data/puzzles.json` mají proti v3.22.3 stejný SHA-256:

`ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23`

`SUPABASE_MIGRATION_V3_21.sql` je proti v3.22.3 bitově stejná:

`739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3`
