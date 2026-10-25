# Cílená oprava modulových kontraktů — 23. 10. 2026

Výchozí main: `9f8ae24bc4dc121e7e554f7aac370fada8c8b16d` (4.09.12).
Opravený klient: `proplet-v4.09.13-module1`.

## Doložená hranice a rozsah

- `PropletTeamVictories?.renderProfile(...)` chránilo jen objekt, nikoli volatelnost metody. Signatura byla zachycena na 4.09.12 (request `029a29ee9d7e1277`, account.js:260:36) i starých 4.09.9.
- Totéž u `PropletGameHints?.closeModal(...)`: requesty `a3de77d7911ef87a` a `a40ac5dfeca6edd7`, 4.09.9, app.js:1230:103. Přesné bajty modulů postižených prohlížečů nejsou dostupné; konkrétní příčina smíšené cache není prokázána.
- Adaptér starých hlášení opravoval hlavičky, nikoli tělo. Proto mohl být známý skutečný producent, ale chybět reporter/source availability. Historická data se nepřeznačují.

## Změna

- Profil ověřuje volatelnost týmové metody. Ostatní ovládání zůstává použitelné, chybějící výhry nejsou vydávány za nulu. Nabídka obnovy používá existující bezpečný update, také při částečném shellu stejné verze; nevynucuje reload během hry, nemaže úložiště ani offline cache. Starý modul odměn není opakovaně spuštěn (vlastní i obsluhy potvrzení odměn).
- Zavření nápovědy má místní DOM/focus fallback. Neplatný controller neúčtuje nápovědu ani nepřepisuje hru. Aktuální modal a controller se používají po aktualizaci; nemění se skórování či pomocník.
- Staré JSON/Request diagnostické POSTy dostanou skutečný producer z běžícího app.js, samostatný reporter release, explicitní dostupnost zdroje a nejvýše tři bezpečné souřadnice. Neznámý producer zůstává neznámý. Bez raw stacků, URL parametrů, druhého listeneru či druhého HTTP zápisu. Ostatní API requesty beze změny. Stejná pole doplňuje fallback bez bootstrap transportu.
- Koordinované release/cache URL pro app, account, hints, team a diagnostiku. Žádná migrace, backfill ani změna účtů/výsledků/experimentu.

## Regresní a následné ověření

`python tools/test_current.py`; `node tools/test_module_contracts_browser.cjs`; původní profile-statistics, client-diagnostics, onboarding/first-steps/first-game/challenger/platform browser gates. Nový browser gate je součástí CI.

Browser: skutečné historické team/hints moduly reprodukují obě původní signatury; oprava a explicitní obnova na desktopu 1280, mobilu 390 a Foldu 673 px. Skutečný service worker 4.09.9 → aktuální klient zachová účet, dokončení i rozehranou hru. Starší 4.05.3 upgrade a chybějící statistics modul dál pokrývá původní gate. Vše pouze na loopback fixture, bez produkčních her, registrací či chybových sond.

Po READY ověřit nasazené SHA, release a cache URL read-only. Organicky sledovat obě původní signatury i `team_victories_contract` / `game_hints_contract`, raw počty a request ID, skutečný client_release odděleně od reporter_release/serveru, source availability/frames a expozici profil/hry. Staré a neznámé klienty oddělit. Technický PASS ani krátké okno bez chyb nejsou důkazem všech skutečných hráčů.
