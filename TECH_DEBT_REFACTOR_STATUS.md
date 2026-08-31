# Technical debt refactor status

- Sprint: 10 — Frontend core: API client a scoped storage
- Branch: `refactor/s10-frontend-core`
- Base SHA: `d7252e4d3679dbf5e1ebecf154f840b7fd807000` (aktuální produkční `main`, Proplet v4.01.39)
- Current HEAD: characterization commit se vytváří
- Stav: characterization
- Zamýšlená změna chování: žádná; HTTP kontrakty, localStorage klíče, guest/account scoping, load order a UI zůstávají stejné.
- Změněné soubory: characterization test + current manifest; runtime zatím beze změny.
- Hotové kroky: ověřen aktuální main a uzavření Sprintů 08B/09; zmapován existující `api()`, scoped state/queue storage a guest adoption.
- Zbývající kroky: přidat `public/app/core/api-client.js` a `storage.js`; přesměrovat pouze kryté adaptéry v `app.js`; doplnit asset/load-order kontrakt; current gate + browser preview.
- Testy PASS: čeká na characterization CI.
- Testy FAIL / nespouštěné: žádné známé; preview/browser zatím nespouštěno.
- Nově nalezená rizika: přímé `fetch()` cesty pro release probe, PWA/puzzle boot, push config, Tajenku a client-error mají odlišné cache/header/keepalive kontrakty a v tomto sprintu se nebudou násilně sjednocovat.
- Bezpečný bod pokračování: tento characterization commit na Sprint 10 branchi.
- Další povolený sprint: Sprint 11A pouze po zeleném a uzavřeném Sprintu 10; uživatel výslovně povolil navázání bloků 1→2 bez merge do main.

## Předchozí uzavřený stav

- Sprint: 09 — Ranking a admin query boundaries
- Branch: `refactor/s09-ranking-query-bounds`
- Base SHA: `e6c6204` (`origin/main`; Sprint 08B aplikace na main, atomická DB migrace/rollout zůstávají samostatně vypnuté)
- Stav: DOKONČENO a nasazeno na `main`; produkční migrace, verify i post-deploy kontrola prošly
- Zamýšlená změna chování: žádná změna pravidel pořadí, tie-breaků, anonymizace, UX ani indexů. Mění se pouze hranice čtení: agregace a first-run redukce probíhají v databázi, metadata se načítají jen pro dotčené entity a kompatibilní PostgREST fallback je puzzle/challenge-scoped s tvrdým limitem.
- Změněné soubory: `backend/rankings.py`, bounded query transport v `backend/db.py`, ranking/admin adaptéry v `server.py`, aditivní migrace `SUPABASE_MIGRATION_V4_01_39_QUERY_BOUNDS.sql`, read-only verify, migrační manifest a současné/golden testy.
- Baseline před Sprintem 09:
  - `/api/rankings/xp`: 1 aggregate RPC, poté celé tabulky `players` a `leagues`; při RPC chybě celý `results`, `account_rewards` a `streak_rescues`.
  - `/api/rankings/daily`: všechny `players`, `leagues` a `team_memberships` plus puzzle-scoped runs.
  - legacy `/api/leaderboard`: `player_stats()` třikrát čte data pro každého člena a poté načte celé `results`; databázové dotazy rostly jako `3N + 3`.
  - admin overview/users: 6, respektive 5 celotabulkových přenosů do aplikace; další admin seznamy a quality agregace používaly neohraničený `db_select_all`.
- Výsledek Sprintu 09:
  - XP používá existující aggregate RPC a entity-scoped hráče/týmy; neexistuje full-scan fallback.
  - Daily/Free globální pořadí používá `proplet_ranking_runs_v1`; fallback čte jen jeden puzzle/challenge a při překročení 5 000 řádků selže uzavřeně místo tichého ořezu.
  - legacy týmový leaderboard používá 4 bulk dotazy nezávisle na počtu členů; `player_stats()` dostává přednačtené family-scoped řádky.
  - Liga týmů čte jen veřejné týmy, jejich členy a sedm konkrétních Daily challenge keys.
  - admin overview/users používají po jednom service-role-only RPC; users jsou filtrováni a stránkováni v PostgreSQL. Ostatní admin/quality čtení mají explicitní 7/24/30denní okna nebo tvrdé přenosové limity. V produkčním `server.py` nezůstalo žádné volání `db_select_all` mimo kompatibilní definici helperu.
- Golden chování: první standardní dokončení zůstává autoritativní; pozdější rychlejší replay výsledek nezlepší; calm run se nezapočítá; shodné viditelné skóre používá competition ranking `1, 1, 3`; public opt-in jméno zůstává veřejné a private/NULL identita zůstává deterministický alias; Daily dokončené po půlnoci zůstává u challenge data z `challenge_key`.
- Izolované DB ověření: bezplatný testovací projekt bez produkčních dat, po ověření znovu pozastavený; migrace PASS, tři funkce jsou `STABLE SECURITY INVOKER`, execute má jen `service_role`, `anon` a `authenticated` jsou zamítnuté. Fixture ověřil replay/calm/cross-midnight pravidla a admin payload/filter. `EXPLAIN ANALYZE` pro first-run dotaz použil existující `puzzle_runs_competitive_rank_idx`, vrátil 2 řádky za přibližně 0,65 ms; žádný index nebyl přidán ani změněn.
- Testy PASS: current gate 33/33, assety 72/72, syntax 209/209; migration manifest 42/42; query-count kontrakt ověřuje konstantní 4 bulk dotazy pro tým o 2 i 25 členech.
- Publikace a preview: otestovaný strom `dd146106b707c195f5540bd50a783d826688b7d4` byl publikován v GitHub commitu `7c44b86e`; finální preview deployment `dpl_5TKVEHX3UVz54RHBrtJH2kmv3Y4F` přešel do `READY` a byl uživatelsky schválen.
- Produkční rollout: migrace `20260831082509_v4_01_39_query_bounds` byla aplikována před aplikací. Verify potvrdil tři `STABLE SECURITY INVOKER` funkce, fixní prázdný `search_path`, `EXECUTE` pouze pro `service_role` a úspěšné smoke volání všech RPC. Ranking plán používá existující `puzzle_runs_competitive_rank_idx`. Aplikační commit `7e477c84` byl fast-forwardem nasazen na `main`; produkční Vercel deployment `dpl_CAQbHEscm77yUpiuomBQLbMCPYyt` je `READY`.
- Post-deploy ověření: `https://hrajproplet.cz/` a `/api/health` vracejí 200; produkční `/api/daily-global-leaderboard`, `/api/rankings/daily` a `/api/rankings/xp` vracejí 200 nad novými DB hranicemi. Vercel runtime error scan po vydání je čistý.
- Testy FAIL / nespouštěné: žádné. Security/performance advisors po migraci ukazují pouze dříve existující upozornění mimo rozsah Sprintu 09; migrace nepřidala tabulku, index ani veřejné oprávnění.
- Rollout pořadí: před merge/deploy aplikace aplikovat aditivní v4.01.39 migraci, spustit read-only verify, teprve potom nasadit aplikaci. Ranking endpointy mají bezpečný bounded compatibility fallback; admin overview/users záměrně vyžadují hotovou migraci a nepoužívají full-scan fallback.
- Nově nalezená rizika: hard cap 5 000 ranking runs / entities, 10 000 weekly runs a 20 000 telemetry řádků selže 503, pokud dataset přeroste bezpečnou hranici; jde o měřitelný guard, ne tiché zkrácení. Další navýšení nebo nový index vyžaduje samostatná data a schválení.
- Bezpečný bod pokračování: produkční `main` s aplikačním commitem `7e477c84`, aplikovaná migrace v4.01.39 a ověřený deployment `dpl_CAQbHEscm77yUpiuomBQLbMCPYyt`. Sprint 09 je uzavřený.
- Další povolený sprint: žádný. Sprint 10 nezačínat bez výslovného pokynu.

## Sprint 08B — uzavření produkčního rolloutu

- Stav: UZAVŘENO. Aplikační kód 08B zůstal beze změny; rollout pouze doplnil aditivní databázový kontrakt a zapnul již schválenou atomickou cestu.
- Produkční migrace: `20260831115149_v4_01_38_atomic_result` byla aplikována až po read-only preflightu. Sprint 09 (`20260831082509_v4_01_39_query_bounds`) zůstal přítomný a objekty obou migrací se nekříží.
- Databázový verify: `proplet_submit_result_v1(uuid,text,text,text,jsonb)` je `SECURITY DEFINER` s prázdným `search_path`; `EXECUTE` má pouze `service_role`. Ledger `result_commands` má RLS, `anon` ani `authenticated` jej nemohou číst a `service_role` jej číst může. Po migraci nebyl žádný neúplný ledger záznam.
- Produkční rollback smoke: syntetický hráč a výsledek ověřily první commit, přesný idempotentní retry i jediný zápis do ledgeru/run/result/attempt. Celá transakce následně provedla `ROLLBACK`; kontrola potvrdila, že v produkci nezůstala žádná syntetická stopa.
- Aktivace: nesekretní flag `PROPLET_ATOMIC_RESULT_V1_ENABLED=true` je auditovatelně nastavený ve `vercel.json`. Aktivační commit `68ca43daa22618c0fb3e6980956a948f9ea85e21` byl fast-forwardem publikován na `main`.
- Produkční deployment: `dpl_FEkj3hG2MpgZLL67jBFAMDvJcyQa` je `READY`, bez alias chyby, a obsluhuje `hrajproplet.cz`.
- Post-deploy kontrola: `/`, `/api/health`, `/api/daily-global-leaderboard`, `/api/rankings/daily` a `/api/rankings/xp` vracejí HTTP 200; health hlásí `database=true`. Vercel runtime error scan od vydání je čistý.
- Testy: databázový verify a transakční smoke PASS; JSON konfigurace, Python compile, migrační manifest 42/42 a čtyři současné Node kontrakty PASS. Python aplikační kontrakty nebyly v tomto rollout kroku znovu spuštěny, protože pracovní runtime neměl nainstalovaný `fastapi`; stejný aplikační strom byl již v gatech 08B/09 ověřen a aktivační změna se týká pouze `vercel.json`.
- Advisories: migrace nepřidala kritický nález. `result_commands` je záměrně hlášený jako RLS bez policy, protože tabulka není dostupná klientským rolím; přístup je omezený grantem na `service_role`. Ostatní security/performance nálezy jsou dříve existující a mimo rozsah rolloutu 08B.
- Rollback: změnit pouze `PROPLET_ATOMIC_RESULT_V1_ENABLED` na `false` a znovu nasadit. Aditivní tabulku, vazbu ani již vydané receipts při běžném rollbacku nemaž; funkci odstranit až samostatným schváleným DB rollbackem po vypnutí flagu.
- Bezpečný bod pokračování: produkční `main` s aktivovanou atomickou cestou, aplikovanými migracemi 08B i 09 a ověřeným deploymentem. Sprint 08B je uzavřený; Sprint 10 nezačínat bez výslovného pokynu.
