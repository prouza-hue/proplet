# Technical debt refactor status

- Sprint: 05 — Content a doménové golden kontrakty
- Branch: `refactor/s05-content-domain-contracts`
- Base SHA: `0971464` (`origin/main`, konsolidované a uživatelem ověřené Sprinty 00–04)
- Current code checkpoint: `024f807` (`fix: execute sprint 05 runtime contracts`)
- Stav: hotovo; povinný STOP po samostatném Sprintu 05
- Zamýšlená změna chování: Žádná. Runtime content lookup a deterministická doménová pravidla byla vyjmuta do `backend/content.py`; HTTP adapter v `server.py` zachovává existující výjimky, routy, JSON i legacy kompatibilitu. Puzzle banky ani generation metadata nebyly regenerovány.
- Změněné soubory: `backend/content.py`, `server.py`, `contracts/domain-golden-v1.json`, `tests/current/test_domain_golden.py`, `tests/current/test_domain_golden.js`, `tests/current/manifest.json`, `tools/test_tajenka_preview.py`, tento statusový dokument.
- Hotové kroky: Přidán čistý content/domain kontrakt pro release date, Free active/rolling/legacy lookup, Daily rotation a historická okna, XP, challenge keys/result metadata, streak, Mozkomor unlock a competition ranking. Serverové funkce používají adaptery nad čistou vrstvou při zachování stávajících loaderů a testovacích monkeypatch seams. Jeden jazykově neutrální fixture skutečně spouští Python implementaci i funkční těla extrahovaná přímo z produkčního `public/app.js`. Sol review odstranil neaktivní Python test definitions, testovou reimplementaci JavaScript pravidel a mrtvou kopii původního Daily resolveru; zachoval i původní fail-closed chování poškozených archivních oken a rychlou Mozkomor compatibility cestu.
- Úmyslný obsahový rozdíl: `data/puzzles.json` a `public/puzzles.json` zůstávají oddělené zdroje s existujícím rozdílem 365 vs. 366 Daily; Sprint 05 jej nemění ani nesjednocuje.
- Zbývající kroky: Žádné ve Sprintu 05. Sprint 06 není započatý; po tomto checkpointu je nutné nejdřív ověřit preview a získat samostatné schválení.
- Testy PASS: Python golden runner 9/9 skupin; Node golden runner proti skutečnému `public/app.js` PASS; finální current gate 24/24, assety 72/72, syntax 196/196; cílené Gen4 archive/progress/rolling a Tajenka kontrakty PASS; před/po snapshoty Daily compatibility, Free active/rolling/legacy lookup a release-gated payloadů jsou proti `origin/main` identické; `git diff --check` PASS.
- Testy FAIL / nespouštěné: Produkční DB ani Supabase schema verification SQL se nespouštěly; Sprint 05 databázi ani schema nemění. Historický samostatný source-extraction test `tools/test_v40118_visible_time_ranking.py` není součástí current gate a po přesunu helperu vyžaduje vlastní namespace import; jeho stejný rank kontrakt pokrývá nový Python/Node golden test i current rank test.
- Nově nalezená rizika: `server.py` stále obsahuje rozsáhlou historickou lookup/orchestration logiku (validace Daily a free-slot summary), která je záměrně ponechána pro zachování compatibility seams. Další extrakce patří do samostatného sprintu. Browser-side Daily branch má zvláštní Gen4 preview/legacy UI flow; v tomto sprintu nebyla měněna.
- Bezpečný bod pokračování: Ověřený code checkpoint `024f807`; tento finální status commit následuje. Runtime, API, databáze ani puzzle obsah se proti povolenému rozsahu behaviorálně nemění.
- Další povolený sprint: 06 — pouze po novém explicitním pokynu uživatele a schválení Sprintu 05 preview.
