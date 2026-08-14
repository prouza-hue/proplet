# QA Proplet v3.21.3

## Cíl

Odstranit orientační blokaci bez regrese ostatních systémů v3.21.

## Statické kontroly

- `node --check public/app.js` — PASS
- `python -m py_compile server.py` — PASS
- blocker DOM `landscapeGameBlocker` — odstraněn
- text `Otoč telefon na výšku` — odstraněn
- `shouldBlockPhoneLandscape` / tablet viewport klasifikace — odstraněny
- `pauseGameClock('landscape')` — odstraněno
- responsive reflow hooky — zachovány

## Chromium viewport render

Testováno s reálným CSS a stejným výpočtem velikosti desky jako `fitGameBoard()`:

- 411×814 telefon portrait — PASS
- 814×411 telefon landscape — PASS
- 654×749 Fold/tablet portrait — PASS
- 749×654 Fold/tablet landscape — PASS

Ve všech stavech je herní stage, deska, Nápověda a Reset viditelný a neexistuje orientační blocker.

## Regrese

PASS:

- starter v3.21 + unikátní exact-cover,
- volitelná starter Nápověda z v3.21.2,
- account nudges 1/4/10,
- Rescue nabídka,
- focus/visibility pause,
- Daily replay,
- Free globální leaderboard,
- 14/14 migration/fairness testů generace 2,
- share metadata,
- win praise.

## Integrita

`data/puzzles.json` SHA-256:

`ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23`

Stejný hash má `public/puzzles.json` a oba soubory jsou beze změny proti v3.21.2.

`SUPABASE_MIGRATION_V3_21.sql` je rovněž beze změny; nový SQL krok není potřeba.

## Nutný post-deploy smoke

Fyzický Fold 7 je finální autorita. Ověřit složený/rozložený stav v obou orientacích a změnu orientace během rozehrané hry. Release záměrně neobsahuje žádný mechanismus, který by mohl orientaci zablokovat.
