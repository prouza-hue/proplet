# Technical debt refactor status

- Sprint: 06 — Explicitní backend dependencies
- Branch: `refactor/s06-explicit-backend-deps`
- Base SHA: `f69e0ed` (`origin/main`, konsolidované a uživatelem ověřené Sprinty 00–05)
- Current code checkpoint: `b05b8fd` (`refactor: assemble backend feature dependencies explicitly`)
- Stav: hotovo; povinný STOP po samostatném Sprintu 06
- Zamýšlená změna chování: Žádná. Stávající account/auth, push diagnostics, integrity, word recognition, competitive sharing, account bonus, rescue limit a preview auth instalátory jsou sestavené v jednom explicitním assembly pointu ve stejném pořadí. Callbacky/config už se nezískávají přes `inspect.currentframe()`, `f_back`, `f_globals` ani caller globals.
- Změněné soubory: `account_auth.py`, `server.py`, `tests/current/test_s06_backend_dependencies.py`, `tests/current/manifest.json`, tento statusový dokument.
- Hotové kroky: Přidán neměnný `AppServices` objekt s konkrétními callbacky/config; server jej sestavuje jednou při registraci existujících feature installerů. Zachována historická Python kompatibilita přes explicitní převod starého keyword entry pointu bez introspekce. Feature instalátory nadále přijímají fake dependencies pro unit testy. Startup nepřidává žádná síťová ani DB volání.
- API/route kontrakt: Přesný seznam 26 očekávaných installer rout je ověřen s počtem 1 pro každou `(method, path)`. Route snapshot zůstal `3b2f8960d59d9b8588d29e90f1a23cffc539b5476224c99d1fcc3cbd3e8324b0`; OpenAPI snapshot zůstal `b3b70b2206d36b196201f10846da107d3ab43b92373c097984f658cbed351674`.
- Testy PASS: Sprint 06 charakterizační test; current gate 25/25; assety 72/72; Python syntax 197/197; Node syntax 44/44; `git diff --check` PASS.
- Testy FAIL / nespouštěné: Žádné v lokálním ověření. Produkční DB/Supabase schema verification SQL se nespouštěly; Sprint 06 databázi ani schema nemění.
- Nově nalezená rizika: Legacy keyword adapter je záměrně ponechán pro lokální Python callers, ale canonical server assembly používá pouze `AppServices`. `preview_auth_v334.py` dál používá `inspect.signature()` pro dynamické zachování endpointových validací; Sprint 06 odstraňuje pouze frame/caller-global introspekci.
- Bezpečný bod pokračování: Ověřený code checkpoint `b05b8fd`; runtime, API, databáze, content i gameplay se proti povolenému rozsahu behaviorálně nemění.
- Další povolený sprint: 07 — pouze po novém explicitním pokynu uživatele a schválení Sprintu 06 preview.
