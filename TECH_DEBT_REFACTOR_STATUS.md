# Technical debt refactor status

- Sprint: 08B — Atomic `/api/result`: implementace
- Branch: `refactor/s08b-atomic-result`
- Base SHA: `317dee6` (`origin/main`; produkční 4.01.37 se schválenými Sprinty 00–07B a Tajenka result hotfixem)
- Approved contract checkpoint: `de975d4` (schválený Sprint 08A přenesený beze změny runtime)
- Pre-runtime characterization checkpoint: `0a0fe8c`
- Stav: implementace i izolované PostgreSQL ověření hotové / čeká preview a produkční bránu
- Zamýšlená změna chování: `/api/result` má po zapnutí serverového rollout flagu ukládat command ledger, puzzle run, oficiální result, legacy reward claim a vlastněný/offline attempt v jedné idempotentní PostgreSQL transakci. Veřejný request a response kontrakt zůstává kompatibilní. Legacy cesta zůstane pouze jako časově omezený rollback fallback; default produkční chování se v této branchi nezapíná.
- Změněné soubory: `backend/results.py`, flag v `backend/config.py`, RPC error mapping v `backend/db.py`, rollout adapter v `server.py`, verzovaná migrace + verify + bezpečný rollback, disposable DB acceptance testy, migrační manifest a současný testovací manifest.
- Hotové kroky: Větev vytvořena z aktuálního `origin/main` po produkčním Tajenka hotfixu; kontrakt 08A přenesen jako samostatný commit. Read-only otisk živého schématu potvrdil přesné sloupce, constrainty a indexy pěti dotčených tabulek. Charakterizována legacy cesta. Implementován deterministický request/command digest, durable replay před content lookupem, service-role-only atomická RPC hranice a výchozí vypnutý rollout flag. Připravena aditivní migrace, read-only verify, audit zachovávající rollback a failure-injection sada pro všech šest transakčních fází. Protože produkční tarif nepodporuje branching, byl po samostatném schválení vytvořen bezplatný dočasný projekt bez produkčních dat. Na něm prošla migrace, verify, exact retry, digest conflict, zamítnutí anon role, šest failure-injection bodů, kontrola nulových zbytků, advisor review, bezpečný rollback, rollback verify a opětovné nasazení. Testovací projekt je po dokončení pozastavený; dostupný konektor neumí projekt smazat.
- Zbývající kroky: Commitnout SQL opravy nalezené reálným PostgreSQL během, pushnout větev, ověřit Vercel preview s výchozím vypnutým flagem a STOP. Produkční migrace, zapnutí flagu i merge na `main` vyžadují samostatné schválení.
- Testy PASS: current gate 32/32, assety 72/72, syntax 207/207; atomic adapter, legacy characterization, kontrakt 08A a migrační manifest PASS; disposable PostgreSQL acceptance a rollback drill PASS.
- Testy FAIL / nespouštěné: žádné. Produkční DB, produkční deployment a rollout flag nebyly změněny.
- Nově nalezená rizika: RPC bude service-role-only `SECURITY DEFINER`; musí mít fixní `search_path`, plně kvalifikované objekty a explicitní revoke od `PUBLIC`, `anon` i `authenticated`. `puzzle_attempts.mode` musí přijmout `starter` a `tajenka`. Globální unique `puzzle_runs.attempt_id` nesmí při cizí kolizi zahodit platný result command.
- Bezpečný bod pokračování: commitnutý Sprint 08B checkpoint na samostatném worktree `proplet-s08b`; produkční DB ani deployment nebyly změněny.
- Další povolený sprint: žádný. Sprint 09 nezačínat; 08B končí vlastní produkční bránou a STOP.
