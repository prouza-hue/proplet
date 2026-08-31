# Technical debt refactor status

- Sprint: 08B — Atomic `/api/result`: implementace
- Branch: `refactor/s08b-atomic-result`
- Base SHA: `317dee6` (`origin/main`; produkční 4.01.37 se schválenými Sprinty 00–07B a Tajenka result hotfixem)
- Approved contract checkpoint: `de975d4` (schválený Sprint 08A přenesený beze změny runtime)
- Current HEAD: `de975d4`
- Stav: characterization hotová / návrh migrace a adapteru
- Zamýšlená změna chování: `/api/result` má po zapnutí serverového rollout flagu ukládat command ledger, puzzle run, oficiální result, legacy reward claim a vlastněný/offline attempt v jedné idempotentní PostgreSQL transakci. Veřejný request a response kontrakt zůstává kompatibilní. Legacy cesta zůstane pouze jako časově omezený rollback fallback; default produkční chování se v této branchi nezapíná.
- Změněné soubory: schválené non-runtime artefakty 08A, `tests/current/test_s08b_result_adapter_characterization.py`, `tests/current/manifest.json` a tento statusový dokument.
- Hotové kroky: Větev vytvořena z aktuálního `origin/main` po produkčním Tajenka hotfixu; kontrakt 08A přenesen jako samostatný commit. Přečten celý plán, relevantní finding 5, Supabase security/migration guidance a aktuální dokumentace k functions, grants, RLS a preview branching. Baseline current gate PASS 30/30, assety 72/72, syntax 204/204. Read-only otisk živého schématu potvrdil přesné sloupce, constrainty a indexy pěti dotčených tabulek. Před runtime změnou přidán a ověřen characterization test legacy write pořadí, response a `clean_solve` pravidla.
- Zbývající kroky: Znovu ověřit přesné současné schema/constrainty a `/api/result` flow; přidat characterization test adapteru; vytvořit verzovanou migraci, verify a rollback skript + manifest; implementovat `backend/results.py` a rollout adapter; ověřit SQL a rollback pouze proti disposable/preview DB; finální gate, diff review, preview a STOP.
- Testy PASS: baseline current gate 30/30, assety 72/72, syntax 204/204; nový pre-runtime legacy adapter characterization PASS; `git diff --check` PASS.
- Testy FAIL / nespouštěné: žádné. Reálná PostgreSQL/Supabase transakce zatím nebyla spuštěna. Produkční DB a deployment jsou výslovně mimo schválený rozsah.
- Nově nalezená rizika: RPC bude service-role-only `SECURITY DEFINER`; musí mít fixní `search_path`, plně kvalifikované objekty a explicitní revoke od `PUBLIC`, `anon` i `authenticated`. `puzzle_attempts.mode` musí přijmout `starter` a `tajenka`. Globální unique `puzzle_runs.attempt_id` nesmí při cizí kolizi zahodit platný result command.
- Bezpečný bod pokračování: čistý checkpoint `de975d4` na samostatném worktree `proplet-s08b`; žádná DB změna ani runtime editace dosud neproběhla.
- Další povolený sprint: žádný. Sprint 09 nezačínat; 08B končí vlastní produkční bránou a STOP.
