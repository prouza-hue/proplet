# Technical debt refactor status

- Sprint: 11B.1 — GameSession state, timer, persistence, pause/resume
- Branch: `refactor/s11b-game-session`
- Base SHA: `ff6bcc3487dd7d02f15234e2d6a64629d3348adc` (produkční main po S10 + S11A)
- Current HEAD: implementation pending
- Stav: implementation
- Zamýšlená změna chování: žádná.
- Změněné soubory: test/status pouze.
- Hotové kroky:
  - scope ověřen proti `TECH_DEBT_REFACTOR_PLAN.md`;
  - inventář současného `currentGame`, timeru, restore/save a pause/resume lifecycle;
  - nalezeny dva runtime přepisy `startGame`: Klidný režim a competitive sharing;
  - nalezen jeden runtime přepis `saveGameProgress`: Klidný režim.
- Zbývající kroky:
  - current gate nad implementací;
  - browser/Fold/visibility smoke + Vercel preview;
  - opravit pouze prokázané regrese a uzavřít 11B.1.
- Testy PASS: characterization gate na nezměněném runtime = GREEN; nový characterization test i povýšený focus/pause regression prošly.
- Testy FAIL / nespouštěné: první runtime gate odhalil pouze syntax chybu v mechanicky upraveném quality wrapperu a příliš přísný source-regex v novém testu; oba body jsou v tomto commitu opraveny, další gate čeká.
- Nově nalezená rizika:
  - starý renderer/input přímo mutuje objekt session; B.1 proto nesmí přesouvat board/input/hints;
  - mixed PWA cache vyžaduje kompatibilní globální `currentGame` accessor a timer/persistence fallback v `app.js`; versioned feature patche už záměrně nesmějí přepisovat `startGame`;
  - calm payload závisí na přesném pořadí start hooku vůči attempt telemetry.
- Bezpečný bod pokračování: `ff6bcc3487dd7d02f15234e2d6a64629d3348adc`.
- Další povolený sprint: pouze 11B.2 po samostatném GREEN ověření 11B.1.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 11A — Gameplay completion vertical slice
- Branch: `refactor/s11a-game-completion`
- Base SHA: `66081c664a0120cdb37b4344ce6d7beff9169c4c` (uzavřený Sprint 10 status HEAD)
- Runtime HEAD: `e1b089d39e460190ebfd7d0cbfd5d4d73e8a415e`
- Stav: **implementace uzavřena / GREEN, čeká na user preview + pozdější merge approval**
- Zamýšlená změna chování: žádná.
- Výsledek:
  - nový `public/app/core/completion-pipeline.js` je jediný explicitní registry/executor completion hooků;
  - `finishGame` vlastní before/after completion fáze a dál drží původní pořadí persistence → queue → telemetry → win UI → async sync/leaderboard;
  - `copy-density-v3327.js` registruje before hook s prioritou 10 pro reset `comparison-loaded`;
  - `quality-v334-core-v40114.js` registruje after hook s prioritou 20 pro Klidný režim;
  - `competitive-sharing-v3331.js` registruje after hook s prioritou 30 pro shared result UI a `shared_daily_completed`;
  - všechny tři feature vrstvy zachovávají legacy wrapper fallback, pokud běží proti staršímu `app.js` / chybějícímu completion core v rozhozené PWA cache.
- Characterization commit před runtime změnou: `5b63360e75e466af55f61ef1da4f3ca56b7fa0ed`.
- Runtime commit: `e1b089d39e460190ebfd7d0cbfd5d4d73e8a415e`.
- Testy PASS:
  - Current runtime gate: **36 PASS / 0 FAIL**;
  - Assets: **75 PASS / 0 FAIL** (67 lokálních referencí);
  - Syntax: **212 PASS / 0 FAIL**;
  - `tests/current/test_s11a_completion_characterization.js`: PASS;
  - `tools/test_v40114_share_runtime.js`: PASS na nové hook cestě;
  - completion core unit test: priorita, before/after order a idempotentní registrace PASS.
- Vercel preview:
  - deployment `dpl_55vLwweKeyscYBa7uYgnftxKHaJ6`: READY;
  - branch alias: `https://proplet-git-refactor-s11a-game-co-bc2649-pavel-prouzas-projects.vercel.app`;
  - `/api/health`: HTTP 200, Proplet 4.01.39, `ok=true`, DB true;
  - HTTP smoke potvrzuje nový completion asset, before/after runner v `app.js` a hook cestu ve všech třech feature vrstvách.
- PWA shell: budget se zvýšil pouze o nový malý completion core (13→14); heavy/lazy asset pravidla zůstala beze změny.
- Známý nesouvisející check: historický `v3.34 Generation 4 contract` zůstává červený ze stejného důvodu jako před Sprintem 11A; current runtime gate je GREEN.
- Produkce/main/Supabase: **beze změny**. Draft PR #89.
- Rollback: reset branche na `66081c66…`; žádná DB/content migrace.
- Bezpečný bod pokračování: runtime `e1b089d39e460190ebfd7d0cbfd5d4d73e8a415e` + tento status-only commit.
- Další krok: user preview; po schválení lze řešit merge pořadí Sprint 10 → 11A nebo pokračovat dalším plánovaným refaktor sprintem na navazující branchi.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 10 — Frontend core: API client a scoped storage
- Branch: `refactor/s10-frontend-core`
- Base SHA: `d7252e4d3679dbf5e1ebecf154f840b7fd807000` (produkční `main`, Proplet v4.01.39)
- Runtime HEAD: `6467a809a7fa9ac79353960dafea00158683ef16`
- Stav: **uzavřeno / GREEN, čeká na pozdější merge approval**
- Zamýšlená změna chování: žádná; HTTP kontrakty, scoped localStorage, guest/account adoption, UI a produkční data beze změny.
- Runtime změny:
  - nový `public/app/core/api-client.js` s explicitními závislostmi a zachovanými auth/anonymous/preview hlavičkami, 12s timeoutem, JSON/error mappingem a `no-store`;
  - nový `public/app/core/storage.js` pro scoped state/queue, legacy migraci a guest adoption;
  - `app.js` používá kompatibilní adaptéry a ponechává legacy fallbacky;
  - speciální přímé fetch cesty (PWA/puzzle boot, release probe, push config, Tajenka, client-error) zůstaly záměrně mimo generický klient;
  - nové core assety se načítají před `result-queue.js` a `app.js` a jsou v PWA shell cache.
- Characterization před runtime změnou: `b3730adc884a40658a4fc2961d6fc22cf749bda1`.
- Testy PASS na runtime HEAD:
  - Current runtime gate: **34 PASS / 0 FAIL**;
  - Assets: **74 PASS / 0 FAIL** (66 lokálních referencí);
  - Syntax: **211 PASS / 0 FAIL**;
  - targeted Sprint 10 Node kontrakt PASS;
  - Vercel preview deployment `dpl_ASSCcLndm4sSpUqAfQQaPyZRBdFh` READY;
  - stabilní branch preview `/api/health`: HTTP 200, `version=4.01.39`, `ok=true`, DB true.
- Test maintenance během Sprintu 10:
  - PWA shell budget byl explicitně rozšířen pouze o 2 malé core skripty (11→13);
  - staré Sprint 04/06 hash baseline driftovaly po legitimních backendových změnách; OpenAPI byl znovu zamčen na version-normalized baseline `b3b70b2206d36b196201f10846da107d3ab43b92373c097984f658cbed351674`;
  - config/health/push fixture byl znovu zamčen na současný produkční kontrakt `12d98531db21a43038f0e9f5d24088ac4e65be04f78a4632a0b0430b60b3ba35`.
- Známý nesouvisející check: historický workflow `v3.34 Generation 4 contract` zůstává červený kvůli zastaralému source-level očekávání modelů přímo v `server.py` po dřívějším backend refaktoru. Není součástí current runtime gate ani Sprintu 10 a runtime S10 nemění.
- Produkce/main/Supabase: **beze změny**. PR #88 zůstává draft.
- Rollback: reset/uzavření branch na base `d7252e4d…`; žádná DB migrace ani content rollback nejsou potřeba.
- Bezpečný bod pokračování: runtime HEAD `6467a809…` + tento status-only commit.
- Další povolený sprint: **11A — Gameplay completion vertical slice**, explicitně povolen uživatelem jako navazující blok 2.

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




