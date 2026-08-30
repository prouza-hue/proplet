# Technical debt refactor status

- Sprint: 04 — Backend foundation: config, contracts, DB transport
- Branch: `refactor/s04-backend-foundation`
- Base SHA: `e8390260d40eda816e1aeedfaa5b41f08d83c765` (`origin/main`, konsolidované a uživatelem ověřené Sprinty 00–03)
- Current HEAD: `4e02135` (`fix: preserve backend extraction parity`)
- Stav: done; povinný STOP po samostatném Sprintu 04
- Zamýšlená změna chování: Žádná. Pouze vyjmout config, Pydantic kontrakty a existující PostgREST/RPC transport ze `server.py` při zachování rout, JSON, status kódů, query shape a deployment importu `server:app`.
- Změněné soubory: `backend/__init__.py`, `backend/config.py`, `backend/contracts.py`, `backend/db.py`, `server.py`, `tests/current/test_s04_backend_foundation.py`, `tests/current/manifest.json`, `tools/test_tajenka_preview.py`, `tools/test_v40126_push_retention_p0.py`, tento statusový dokument.
- Hotové kroky: Ověřen čistý výchozí bod na skutečném `origin/main`; přečten plán Sprintu 04 a auditní Finding 4; zkontrolován aktuální Supabase changelog a Data REST API dokumentace; přidány characterization snapshoty; config, Pydantic kontrakty a PostgREST/RPC transport vyjmuty do `backend/`; v `server.py` zachovány kompatibilní re-exporty a monkeypatch seams. Sol diff review ověřil shodný OpenAPI hash, route inventory a reprezentativní response fixtures před/po; opravil nechtěnou normalizaci Supabase secretu, odstranil falešné source markery a zachoval libovolné názvy PostgREST filtrů.
- Zbývající kroky: Žádné ve Sprintu 04. Nezačínat Sprint 05 bez nového explicitního pokračování.
- Testy PASS: Finální opakovaný current gate 22/22, assety 72/72, syntax 194/194; cílené Sprint 04 characterization, RPC auth, Daily sync, push a Tajenka kontrakty PASS; OpenAPI SHA-256, route inventory i response-fixture SHA-256 přesně shodné s `origin/main`; `git diff --check` PASS.
- Testy FAIL / nespouštěné: Produkční DB ani Supabase schema verification SQL se nespouštěly. Bez `ALL_PROXY=`/`all_proxy=` lokální ověřovací venv nemůže importovat `httpx`, protože nemá `socksio`; nejde o aplikační regresi.
- Nově nalezená rizika: `server.py` globals jsou široce monkeypatchované staršími testy a používány versioned instalátory; kompatibilní wrappery tento kontrakt zachovávají a current gate je pokrývá. Settings jsou immutable pouze při importu procesu; změna env vyžaduje nový proces stejně jako před refaktorem.
- Bezpečný bod pokračování: Ověřený code checkpoint `4e02135`; tento finální status commit následuje. Runtime, API ani databáze se proti povolenému rozsahu behaviorálně nezměnily.
- Další povolený sprint: 05 — Content a doménové golden kontrakty, pouze po novém explicitním pokynu uživatele.
