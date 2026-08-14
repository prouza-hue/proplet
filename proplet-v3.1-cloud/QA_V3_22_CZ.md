# QA Proplet v3.22.0

## Cíl

Ověřit, že dark mode je skutečný vizuální systém přes celý produkt, light mode zůstává funkční a release nevrací žádnou z Fold/orientation regresí.

## Automatické kontroly

PASS:

- `node --check public/app.js`,
- `python -m py_compile server.py`,
- CSS parser `public/styles.css` — 0 chyb,
- CSS parser `public/admin.css` — 0 chyb,
- `tools/test_v322_package.py`,
- `tools/test_v322_server.py`,
- DOM binding contract — všechny používané ID existují,
- tři theme režimy `auto / light / dark`,
- early theme bootstrap před hlavním CSS,
- živá reakce `Automaticky` na systémový color scheme,
- per-device preference,
- dynamický `theme-color`,
- admin theme bootstrap,
- žádné použití CSS `filter: invert()` jako náhrady dark mode,
- orientation blocker zůstává odstraněný.

## Regresní sada

PASS:

- v3.16 migration/fairness suite — 14/14,
- win praise,
- share metadata,
- Daily replay,
- Free globální leaderboard,
- Rescue offer,
- focus/visibility pause,
- account nudges 1 / 4 / 10,
- starter choice / volitelná Nápověda.

## Vizuální kontrola

Manuálně vyrenderovány a zkontrolovány skutečné CSS stavy:

- Dnes — mobil dark,
- Dnes — desktop dark,
- profil + nový přepínač — mobil dark,
- profil + nový přepínač — mobil light,
- rozehraná herní plocha — mobil dark,
- dokončená výsledkovka — mobil dark,
- onboarding Pomocníka — dark,
- Nápověda — dark,
- account/login modal — dark,
- Free difficulty cards — dark.

Nebyl nalezen zbytkový velký bílý povrch v kontrolovaných dark stavech. Light profil zůstal vizuálně konzistentní s v3.21.3.

## Kontrast

Kontrolované dark kombinace:

- hlavní text `#f4f0fa` na `#1b1926`: ~15.4:1,
- muted `#b0a9bd` na `#1b1926`: ~7.6:1,
- purple `#9b8cff` na `#1b1926`: ~6.3:1,
- bílý text na dark primary gradientu: přibližně 5.4:1 → 4.54:1 podle konce gradientu.

## Integrita obsahu

`data/puzzles.json` a `public/puzzles.json`:

`ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23`

`SUPABASE_MIGRATION_V3_21.sql`:

`739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3`

Obojí je beze změny proti v3.21.3. **Žádná `SUPABASE_MIGRATION_V3_22.sql` neexistuje.**

## Post-deploy smoke

Fyzické zařízení zůstává finální autoritou pro PWA a Fold chování. Ověřit zejména theme switching, no-white-flash při opětovném otevření PWA a Fold 7 v obou orientacích bez blokace.
