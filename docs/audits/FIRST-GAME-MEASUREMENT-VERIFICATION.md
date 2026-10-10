# Oprava měření první hry a výsledkového okna

Oprava řeší chybějící události první přiřazené hry, mizení výsledkového odznaku a neúplný stav historického výsledku. Nemění onboarding board-v3-short, výchozí g4-e-009, Daily Gen6 ani odměny. Verze opravy je 4.05.3, client_release proplet-v4.05.3-firstgame-telemetry1.

## Doložené příčiny a hranice tvrzení

- Mobilní výsledková lišta mohla obsahovat přesunutý newBadgeBox. Při přepnutí rozložení se odstranila celá lišta i s odznakem. Další dokončení pak četlo classList neexistujícího prvku. Oprava zachovává uzly při zrušení lišty a bezpečně obnoví již chybějící slot.
- showDailyResult vytvářel currentGame bez found a path. Dva skutečné konzumenty, renderGameHUD a updateGameFeel, proto lze na původním kódu reprodukovat s undefined.length. Oprava vytváří úplný výsledkový snapshot označený jako replay.
- Měření první hry záviselo na právě aktuálním stavu úložiště a dokončení bylo emitované až po výsledkovém vykreslení. Oprava připíná flow, variantu, desku, verzi a testovací příznak k rozehrané hře; start a dokončení zaznamená před nepovinnými UI hooky. Připojuje také skutečný attempt_id přes X-Proplet-Run.
- Historické dvě zprávy undefined.length nemají stack ani soubor/řádek. Reprodukce dokazuje opravu uvedených dvou konzumentů, nikoli nezvratné určení zdroje každé staré produkční zprávy. Nulové chyby v krátkém okně nejsou záruka, že všechny možné klientské chyby zmizely.

## Kritéria přijetí

| Oblast | Požadavek | Důkaz |
|---|---|---|
| Původní chyba délky | Na origin/main oba konzumenti historického výsledku selžou; na opravě oba projdou | TEST_SOURCE_REF=origin/main node tests/current/test_first_game_measurement.cjs a totéž bez proměnné |
| Identita událostí | Start i dokončení mají původní first_steps_run_id, správnou variantu/bucket/desku, client_release, onboarding_version a is_test; odkazují na skutečný attempt_id | test_first_game_measurement.cjs a serverem přijaté hlavičky v browser důkazu |
| Počet událostí | Jedno přiřazení, nejvýše jeden start, nejvýše jedno dokončení a jedna zobrazená nabídka na flow; žádná duplicita při opakovaném callbacku | Jednotkové testy a skutečný klient proti izolovanému HTTP serveru |
| Skutečný průchod | Desktop i dotykový mobil: PES/LES/ČAJ → g4-e-009 → dokončení → nabídka účtu | tools/test_first_game_safety_browser.cjs, screenshoty a přijaté události |
| Odznak a historie | Odstraněný slot se obnoví; mobilní lišta při zrušení zachová původní uzel; historický výsledek lze znovu vykreslit bez výjimky | Pět browser kontrol a původní test_result_action_dock.js |
| Registrace | Google, ruční registrace, přihlášení do existujícího účtu, zrušení a opakované ukládání zachovají stejné flow; saved až po ověřené synchronizaci | tools/test_first_steps_browser.cjs |
| Izolace | Replays, jiné desky a cizí flow se nepřičtou k této první hře; testovací události jsou vyloučené z produktu | Jednotkové negativní případy, X-Proplet-Test a SQL environment/is_test |
| Obsah | Žádná změna Daily bank, datových desek, lexikonu, allocatoru ani povolení historických odměn | Git diff proti aktuálnímu main a ověření živých Daily hashů |
| CI | Current runtime, izolovaná databáze, browser workflow a version guard jsou zelené na přesném kandidátním SHA | GitHub Actions před sloučením |
| Produkce | READY deployment se správným SHA/verzí; výslovně testovací anonymní průchod má v Supabase přiřazení/start/dokončení/nabídku se stejným flow a attempt_id, bez 5xx | Post-deploy browser → API → Supabase a přímé HTTP 5xx runtime logy |

Každá položka musí mít konkrétní výsledek. „Test spuštěn“, úspěšný build, izolovaný getter nebo pouhá nepřítomnost chyb nenahrazují ověření celé cesty. Desktop a dotykový mobilní režim Chromium nejsou tvrzení o fyzicky otestovaném Safari na iPhonu.

## Kontrola produkčních dat

Technické průchody musí mít environment='production' AND is_test=true; nesmějí vstoupit do návštěvníků, aktivace, skutečných her ani konverzí manažerského reportu. Organická kontrola používá pouze environment='production' AND is_test=false a explicitně odděluje starý a nový client_release.

U každého autoritativního assignmentu se kontrolují eventy přes first_steps_run_id a skutečný pokus přes context.run_id → puzzle_attempts.id. Současně musí souhlasit puzzle_id a aktér nebo doložený account claim. Pokud event chybí, ale pokus je dokončený, jde o nesoulad měření, ne automaticky UX odpad. Registrace se propojuje výhradně přes first_steps_run_id, nikdy časovým odhadem.

Historický případ z 9. 10. má flow 70367108-9451-4921-b5b3-ff55f4f5db26 a dokončený pokus 160f4246-83ad-4688-8a41-c8b4ed7cfca1 bez experimentálního startu/dokončení. Historii oprava sama nedopisuje a nepřeznačuje. Nesmí se vydávat za případ po nasazení.

## Stav před nasazením

Lokální jednotkové reprodukce a pět browser kontrol prošly. Kompletní CI a produkční databázový průchod jsou samostatné přijímací podmínky, nikoli odvozené závěry z lokálních testů. Konečné SHA, deployment, CI výsledky a produkční run se přiloží k předání opravy.

