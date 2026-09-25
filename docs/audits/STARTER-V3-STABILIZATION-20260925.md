# Stabilizace board-v3-short — 25. 9. 2026

## Ověřený výchozí stav

Main i produkce: `97aed1300e0f6c7a70c9205f047280807b21c951`.
Produkční deployment `dpl_7HGQ33cJKFDJzD5QbjBwd6prgas7`, READY.
Živý app.js i SW: `proplet-v4.02.2-metaacquisition2`.
Backend mapoval vše kromě board-v2 na legacy. Původní skutečný input modul
odesílal jednopísmenný pokus po pointerup; nový test všech tří tap cest na něm
selhal (0 nalezených slov místo 1 po PES). Po opravě tentýž test prochází.

## Rozsah

- `backend/measurement.py`: přesný allowlist dvou známých verzí, fallback legacy.
- `public/app/game/input.js`: pouze starterVersion=3 v mode=starter podporuje tap prefix.
  Cesta vychází z první nenalezené odpovědi; každé další políčko musí odpovídat
  cestě a sousednosti. Platný prefix zůstává zvýrazněný; úplná cesta jde jednou
  do původního submitPath. Chybné, použité či opakované políčko resetuje prefix
  s krátkou instrukcí, první políčko začíná znovu. Drag při pohybu ≥8px nebo
  vstupu do jiné buňky začíná od pointerdown buňky a dál používá původní pravidla.
  Cizí pointer nepřevezme gesto, pointercancel nic neodesílá.
- `public/app.js`: předává pointer identity, cancel, reset při pauze/odchodu/restartu
  a změně viditelnosti modalu. Bez pollingu, jen existující lifecycle a observer
  atributu class modalů. Stav vlastní herní objekt, nepřechází do další desky.
- App/SW release `proplet-v4.02.2-starterinput1`, nový URL input.js a app.js,
  aktualizované release fixtures. Auth, obsah, XP, Meta acquisition i playtest beze změny.
- Testy skutečného inputu, HTTP kontraktu, claimu a rozšířené browser scénáře.

## Read-only audit a historická oprava

Snapshot SQL/JSON vedle tohoto dokumentu: 1 425 product_events, 149 současných
aktérských klíčů, 2026-09-24 21:01:02.973012 UTC až 2026-09-25 07:59:28.147 UTC.
firststeps5: 210 řádků / 20 aktérů; metaacquisition2: 1 215 / 129.
Počty jsou okamžikový stav, ne uzavřená konverzní baseline. Úplný rozpad eventů
je v JSON. Výběr zahrnuje i jiné události těchto klientů; není to počet nováčků.
Žádná produkční data nebyla upravena. Neprovádí se automatická migrace.

Reprodukovatelný návrh backfillu je v `STARTER-V3-BACKFILL-PROPOSAL.sql`:
explicitní produkce, is_test=false, legacy, pouze dvě přesné client_release.
Transakční, idempotentní, kontroluje stejné zachycené ID před/po a rollbackuje.
K provedení je třeba samostatné schválení a změna posledního ROLLBACK na COMMIT.
Serverové account_created bez client_release ani neurčitý legacy se nedotkne.
Před použitím zopakovat read-only dry-run; staré počty nejsou očekávaný počet
budoucího zápisu. Jiné tabulky nejsou tímto návrhem měněny.

## Ověření a vyhodnocení

Přesné příkazy:
- `node tests/current/test_starter_tap_input.cjs`
- `PYTHONPATH=. python tests/current/test_onboarding_provenance.py`
- `PYTHONPATH=. python tests/current/test_starter_measurement.py`
- CI Current runtime gate (manifest včetně release, registry a asset testů).
- `node tools/test_onboarding_activation_browser.cjs` (původní regresní sada).
- `node tools/test_first_steps_browser.cjs` (loopback fixture, žádná živá DB/OAuth).

Browser: desktop drag, touch drag, desktop tap, touch tap, mixed; vždy všechna
slova → g4-e-001 → nabídka → pokračování bez účtu. Navíc chybný/repeated tap,
cancel, reset, modal, navigace, nový run a duplicitní up. Kontrola počtů a pořadí
fází, run_id, auth-at-event, elapsed, absence offer po starteru a přesně jeden
offer po první volné hře. Google/manual/saved ověřují syntetické poskytovatele;
žádný skutečný externí účet se nevytváří. Síť mimo loopback blokovaná; warnings
s request failures uložené v reportu, normální průchody nesmějí mít lokální 5xx.
Výsledky CI, finální SHA, deployment a screenshoty budou v PR.

Po schváleném nasazení read-only zkontrolovat nové non-test starter_v1_* a
first_steps_v1_* podle nového server release; board-v3-short nesmí dál přibývat
jako legacy pro nový client release. Do příchodu přirozených eventů uvést
„zatím bez dat“, nevytvářet syntetickou produkční kohortu. Preview je zápisově
izolované; HTTP contract test prokazuje přesný DB payload.

## Rizika a rollback

Fyzický Fold/telefon a reálný Google OAuth nejsou automatizovanými testy ověřeny.
8px hranice odděluje jitter od dragu; touch emulace pokrývá oba druhy gest.
Rollback inputu: revert tohoto PR s novým společným app/SW markerem; zachovat
serverový allowlist, pokud sám není příčinou incidentu. Nemazat local storage,
hráče či výsledky. Historický backfill není součástí nasazení aplikace.
Produkční nasazení této nové opravy čeká na výslovné schválení.
