# Technical debt refactor status

- Sprint: 12B.2 — progression + Daily orchestration
- Branch: `refactor/s12b-daily`
- Base SHA: `b3579b2957dc38cf83798fc05c86546a8949ddf7` (uzavřený produkční Sprint 12B.1)
- Stav: **CHARACTERIZATION CHECKPOINT / BEZ RUNTIME ZMĚN**
- Zamýšlená změna chování: žádná; pouze přesun vlastnictví při zachování výběru, fresh/replay a release CTA.
- Rozsah:
  - `public/app/content/progression.js` + Daily orchestrace;
  - `renderDaily` musí mít po řezu právě jednoho vlastníka;
  - opakovaná navigace nesmí přidat listener, observer ani timeout;
  - rankings a `public/app/rankings/rankings.js` zůstávají za samostatnou STOP bránou.
- Hotové kroky:
  - 12B.1 fast-forward merged do `main` a ověřen na produkci;
  - branch založena z přesného produkčního SHA;
  - načten celý plán Sprintu 12B a audit Finding 3;
  - dokončena nezávislá mapa runtime vlastníků a characterization/browser matrix;
  - přidán test-only kontrakt pro Daily rotaci, active/legacy stav, Free fresh/replay, release CTA a budoucí idempotentní ownership guard.
- Testy PASS: lokální Current Runtime Gate **45/45**, assets **80/80**, syntax **222/222**; vzdálený gate čeká na draft PR.
- Testy FAIL / nespouštěné: runtime dosud nezměněn; browser matrix poběží až nad preview runtime checkpointem.
- Nově nalezená rizika: `home-layout.js` obaluje globální `renderDaily`, `daily-win-menu-v40123.js` přidává samostatný observer a PWA shell je na vědomém limitu 23 assetů; známý historický Gen4 failure `ResultCreate must carry calm_mode` je mimo scope.
- Bezpečný bod pokračování: publikovat test-only checkpoint a vyžádat zelený Current Runtime Gate; teprve potom měnit runtime.
- Produkce/main/Supabase: **beze změny po založení branche**. Žádná migrace.
- Další povolený sprint: žádný před samostatným review a schválením tohoto řezu.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 12B.1 — onboarding a engagement nudges orchestration
- Branch: `refactor/s12b-onboarding`
- Base SHA: `2fe6010889c1a6eb185c45d37577a0a785986782` (uzavřený produkční Sprint 12A.2)
- Characterization: `5a2599afb83dad3b62b298e5e89cf47e5899cb53`
- Runtime: `d6601493f2026f8848e9c023ae89256c76c06fa7`
- QA hardening: `90d0b46b531a4cc6f92ac05f81cf64133714c010`
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Rozsah:
  - pouze `public/app/engagement/onboarding.js` + `public/app/engagement/nudges.js`;
  - starter/helper/install/account/push CTA a jejich lifecycle;
  - Daily orchestration a rankings jsou mimo tento řez a zůstávají za STOP bránou.
- Výsledek:
  - onboarding owner sjednocuje PES/principle model, returning-player cestu, starter copy a starter hint eligibility;
  - nudges owner sjednocuje difficulty observer, install lifecycle a pořadí post-win nabídek return → account → push → install → akce;
  - `app.js` ponechává kompatibilní adaptéry pro existující account/push wrappery;
  - `theme-init.js` už nenačítá čtyři původní engagement patche; nové moduly se načítají před `app.js` a jsou v offline shellu;
  - opakované načtení/instalace zachová jediného ownera, jeden difficulty observer a jednu dvojici install listenerů.
- Ověření:
  - Current Runtime Gate #37: **44 PASS / 0 FAIL**;
  - Assets: **80 PASS / 0 FAIL** (72 lokálních referencí);
  - Syntax: **222 PASS / 0 FAIL**;
  - DOM fixture ověřuje dvojí evaluaci bez duplicitního observeru/listenerů;
  - historický Gen4 workflow dál padá pouze na známém nesouvisejícím `ResultCreate must carry calm_mode`.
- Preview:
  - deployment `dpl_98s8wJepq6T1NXESanpugBcCKd49`: **READY**;
  - stable alias: `https://proplet-git-refactor-s12b-onboarding-pavel-prouzas-projects.vercel.app`;
  - `/`, `/api/health` a oba engagement moduly vracejí 200;
  - health hlásí Proplet 4.01.40, `ok=true`, DB true; HTML i SW odkazují na oba nové ownery.
- PR #95: **MERGED** — `https://github.com/prouza-hue/proplet/pull/95`; fast-forward `main` na `b3579b2957dc38cf83798fc05c86546a8949ddf7`.
- Produkce: deployment `dpl_FMoeX9yV19TqTrMGBBAGjJRtkSBf` je **READY** na `hrajproplet.cz`; `/`, health a oba engagement moduly 200; DB true; error/fatal scan čistý.
- Supabase: beze změny. Žádná migrace.
- Rollback: zavřít PR/resetnout branch na `2fe6010889c1a6eb185c45d37577a0a785986782`; bez DB/content rollbacku.
- Další povolený krok: pouze druhý samostatný řez Sprintu 12B — progression + Daily orchestrace.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 12A.2 — profile/team UI ownership
- Branch: `refactor/s12a2-profile-team-ui`
- Base SHA: `72846baa3c5de28a87051d3e7e2493380963e411` (`main`, uzavřený Sprint 12A.1)
- Characterization: lokální `d48c772`; publikovaný `f17448e7753c602e307855c774bd6edc5071f987`
- Runtime: lokální `8e99f8b`; publikovaný `29f376e0a339ce3cb643831062ab3b22dbc69bac`
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Výsledek:
  - nový `public/app/account/account.js` vlastní profilový renderer, bezpečné Google avatary, týmový seznam, join/new membership, týmový PIN, family-league nastavení a leave;
  - `app.js` ponechává pouze tenké přiřaditelné adaptéry, takže `account-bonus`, `account-conversion` a `copy-density` dál mohou obalit `renderProfile`;
  - dynamické callbacky do `renderProfile` a `openProfileModal` vždy používají aktuální globální binding a neobcházejí později načtené compatibility vrstvy;
  - login submit, anonymous claim, logout, smazání účtu, push/queue cleanup a remote profile sync zůstaly beze změny v `app.js`;
  - žádná změna UI, textů, auth modelu, gameplay, XP, API kontraktů ani DB schématu.
- Ověření:
  - Current Runtime Gate: **43 PASS / 0 FAIL**;
  - Assets: **82 PASS / 0 FAIL** (74 lokálních referencí);
  - Syntax: **220 PASS / 0 FAIL**;
  - executable characterization ověřuje normalizaci team kódu, Google avatar allowlist, join i leave payload/order a cancel větev;
  - nezávislé P0/P1 review: **no blockers**.
- Preview:
  - deployment `dpl_DTk95Nv1og1j7WSuGcTq7APq7Wss`: **READY**, alias error `null`;
  - stable alias: `https://proplet-git-refactor-s12a2-profil-e9d9a5-pavel-prouzas-projects.vercel.app`;
  - `/`, `/api/health`, `/app.js` a `/app/account/account.js` vracejí 200;
  - health hlásí Proplet 4.01.40, `ok=true`, DB true; runtime error/fatal log scan čistý.
- PR: draft #94 — `https://github.com/prouza-hue/proplet/pull/94`.
- Merge/main: fast-forward na `2fe6010889c1a6eb185c45d37577a0a785986782`; PR #94 je automaticky označený jako merged.
- Produkce: deployment `dpl_PZEwHmZFSiDWVVqhbafRot4Bvu5M` je **READY**; `hrajproplet.cz`, health, account modul i CSS `s12a2r2` vracejí 200; DB true; runtime error/fatal scan čistý.
- Supabase: beze změny. Žádná migrace.
- Rollback: zavřít PR/resetnout branch na `72846baa…`; není potřeba DB/content rollback.
- Další povolený krok: pouze první samostatný řez Sprintu 12B — onboarding/nudges.


## Předchozí uzavřený stav

- Sprint: 12A.1 — account session ownership + QA account-isolation hardening
- Branch: `refactor/s12a-account-auth-profile-team`
- Base SHA: `6fb4eab5429fa1839beae35828b46dab349caf37` (`main`, Proplet v4.01.40 po Sprintu 11B.2)
- Characterization commit: lokální `64b5905`; publikovaný `030e3ccc671845af8aba102233a865c556d44ed0`
- Account-session runtime: publikovaný `bf3984557ee58f93631406633bb8c89c0e04abe3`
- Ranking QA fix: publikovaný `c7de0c50b5beaaa7d2fa20dcfbbee1c484db2ad3`
- Tajenka/account-isolation fix: lokální `edcefec`; publikovaný `9077a0195d8c05ac6aa9e4e493ecee28e966acf5`
- Produkční merge: `64f37be0b85a4d5458e7ce99b22e9f4ae12cbe7d`
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Výsledek:
  - `public/app/account/session.js` vlastní načtení, uložení, update, clear, auth headers, přijetí identity a kontrolu stale identity snapshotu;
  - password create/login i OAuth/e-mail/recovery callbacky používají společný session seam a první autoritativní callback adoptuje guest data právě jednou;
  - home ranking cache a in-flight ranking response jsou vázané na konkrétní account session;
  - nový `public/app/account/tajenka-storage.js` vlastní account-scoped Tajenka completion/progress, lossless guest adoption, legacy migraci a serverový merge;
  - dokončená Tajenka se po loginu/reloadu obnoví z autoritativního `/api/progress`; subtilní completed karta se zobrazí bez replay a XP deduplikace se nemění;
  - legacy globální Tajenka se před prvním async boot krokem migruje do neutrálního `guest` scope, nikdy do náhodně přihlášeného účtu;
  - result upload, retry i quarantine jsou po celý request připnuté k zachycenému scope a tokenu; stale account switch nemůže zapsat data do jiného účtu;
  - smazání účtu odstraní i jeho lokální Tajenka scope; logout nepropouští guest data mezi hráči;
  - žádná změna DB schématu, contentu, pravidel XP ani gameplay.
- Finální testy na přesném publikovaném stromu `a6f4275a259c16175e5b3aa2c25a355b1ba1923c`:
  - Current gate: **42 PASS / 0 FAIL**;
  - Assets: **81 PASS / 0 FAIL** (73 lokálních referencí);
  - Syntax: **219 PASS / 0 FAIL**;
  - nezávislé P0/P1 review po třech kolech: **no blockers**.
- Preview:
  - deployment `dpl_7tzcijcL9jEhXC1T1omN4aouPKHU`: **READY**;
  - stable alias: `https://proplet-git-refactor-s12a-account-dc3378-pavel-prouzas-projects.vercel.app`;
  - root, health, `app.js` a nový Tajenka storage asset vracejí 200; nasazené account guardy potvrzeny; runtime error scan čistý.
- PR:
  - draft #92 byl technicky uzavřen, protože GitHub ready-for-review konektor selhal na vlastní GraphQL response field;
  - nedraftový náhradní PR #93 byl ze stejného head SHA standardně sloučen.
- Produkce:
  - deployment `dpl_KbWWBKDi35iHDEEMJHxSQsyLdr5v`: **READY**, alias error `null`;
  - `https://hrajproplet.cz/`, `/api/health`, `app.js` a Tajenka storage asset vracejí 200;
  - health hlásí Proplet 4.01.40 a DB true; nasazené migration/import/auth-snapshot/race guardy potvrzeny; post-deploy runtime error scan čistý.
- Rollback: revert merge commitu `64f37be0…`; žádný DB/content rollback není potřeba.
- Zbývající refaktor scope: profile/team UI ownership a další dělení `app.js` zůstávají samostatný další krok; nezačínat bez nového pokynu.

## Předchozí uzavřený stav

- Sprint: 11B.2 — board, input a hints
- Branch: `refactor/s11b2-game-interaction`
- Base release: `7cad28b12788813f5932ca450f754d6540ed049b` (Proplet v4.01.40); main navíc obsahuje test-only baseline `0013292f…`.
- Runtime implementation: `43943f27c247f92aa638c00742b35f23d79b1a5e`
- Test ownership alignment: `f0f124576a3fff0089c6943f64c0aaaf046979ec`
- Browser-matrix cleanup HEAD: `9c642801025757f34fb9ed67caf0d20f22feebde`
- Stav: **implementace uzavřena / GREEN, čeká na user preview + merge approval**
- Zamýšlená změna chování: žádná.
- Výsledek:
  - nový `public/app/game/board.js` vlastní board grid, 2D fit, cesty a orthogonal neighbour policy;
  - nový `public/app/game/input.js` vlastní pointer drag/backtrack, 6px sampling a touch magnifier;
  - nový `public/app/game/hints.js` vlastní hint copy/policy, target selection a změny hint state;
  - `app.js` zůstává orchestrace submit/result/completion/reset a poskytuje kompatibilní adaptéry;
  - renderer/input/hints jsou napojené na stabilní GameSession z 11B.1;
  - žádný CSS redesign, žádná změna gameplay/XP/API/DB/textů.
- Characterization:
  - commit `2ab1f3e11d06ab8ab411f63f225683c0cd8b9a19`;
  - po v4.01.40 release byl S04 health/config hash legitimně posunut pouze release metadata; branch baseline opraven v `70faaf30211aa4225cfc73e8d77d0491282d8ca7`.
- Current gate na čistém výsledném diffu:
  - **39 PASS / 0 FAIL**;
  - Assets: **79 PASS / 0 FAIL** (71 lokálních referencí);
  - Syntax: **216 PASS / 0 FAIL**;
  - `tests/current/test_s11b2_game_interaction.js`: PASS.
- Browser matrix:
  - temporary workflow run `33431006205`, job `99616059437`: **PASS**;
  - desktop mouse drag: cílové slovo `MŮRA` nalezeno jedním reálným drag tahem;
  - Fold portrait 590×960 / screen 384×832: `tablet-portrait-rail`, portrait, large-touch, overflow 0;
  - Fold touch/magnifier: lupa viditelná při tahu, přesně 9 buněk, po puštění skryta; reálným tahem nalezeno `BLUDIŠTĚ`;
  - board fit na Foldu: 390×390 uvnitř 404×832 stage;
  - hint level 2: hints=1, maxHintLevel=2, cleanSolve=false, 3 zvýrazněné route cells, modal zavřen;
  - žádné page errors.
  - temporary workflow byl po PASS odstraněn; v branchi nezůstává.
- Vercel preview:
  - stable alias: `https://proplet-git-refactor-s11b2-game-i-776120-pavel-prouzas-projects.vercel.app`;
  - nové board/input/hints assety jsou v PWA shellu před `app.js`;
  - PWA shell budget 15→18 pouze kvůli třem malým game modulům.
- Známý nesouvisející check: historický `v3.34 Generation 4 contract` zůstává červený ze stejného starého source-level důvodu; Current Runtime Gate je GREEN.
- Produkce/main/Supabase: **11B.2 beze změny**. Produkce je v4.01.40; draft PR #91.
- Rollback 11B.2: reset branch na release baseline; žádná DB/content migrace.
- Další krok: user preview. Po schválení merge 11B.2; další plánovaný blok je Sprint 12A.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 11B.1 — GameSession state, timer, persistence, pause/resume
- Branch: `refactor/s11b-game-session`
- Base SHA: `ff6bcc3487dd7d02f15234e2d6a64629d3348adc` (produkční main po S10 + S11A)
- Runtime HEAD: `c39edc8c5b2ef9f083e217f618ac93cc5c50bce0`
- Verification/cleanup HEAD: `b56ae3373ca9f3e5bc2feec4960ec3315fafcb49`
- Stav: **implementace uzavřena / GREEN, čeká na user preview + merge approval**
- Zamýšlená změna chování: žádná.
- Změněné runtime soubory:
  - nový `public/app/game/state.js`;
  - `public/app.js`;
  - `public/quality-v334-core-v40114.js`;
  - `public/competitive-sharing-v3331.js`;
  - `public/index.html`, `public/sw.js`;
  - current/legacy regression testy a PWA shell contract.
- Výsledek:
  - GameSession vlastní aktivní session referenci, elapsed clock a timer ID;
  - restore/persistence/pause/resume/rescue autosave jsou explicitní API `PropletGameState`;
  - starý renderer, board, pointer/touch input, magnifier a hints dál pracují přes kompatibilní `window.currentGame` accessor — nejsou součástí 11B.1;
  - `startGame` zůstává jediný bootstrap vlastník a versioned patche jej už nepřepisují;
  - Klidný režim používá session hooky `beforeStart/afterStart/afterPersist`;
  - competitive sharing používá `afterStart` session hook;
  - standardní autosave zůstává 5 s, rescue autosave 1 s; timer cadence zůstává 250/100 ms;
  - pause při hidden/blur/menu dál vyloučí background čas, uloží postup a zruší roztaženou cestu; resume vyžaduje viditelný/fokusovaný game screen;
  - mixed-cache fallback pro základní session/timer/persistence zůstává v `app.js`, ale feature patche už záměrně nemonkey-patchují `startGame`.
- Characterization commit před runtime změnou: `23c1ffc946f3ecbfd192d0c157948ef35d2c562b`.
- Runtime implementace: `df823a8f6f47a140e4367bd63b42e905aa49eec0`; stabilizační runtime commit `c39edc8c5b2ef9f083e217f618ac93cc5c50bce0`.
- Testy PASS na čistém výsledném diffu:
  - Current runtime gate: **38 PASS / 0 FAIL**;
  - Assets: **76 PASS / 0 FAIL** (68 lokálních referencí);
  - Syntax: **213 PASS / 0 FAIL**;
  - `tests/current/test_s11b1_game_session.js`: PASS;
  - `tools/test_v319_focus_pause.js`: PASS.
- Browser verification:
  - jednorázový Playwright/Chrome run `33425648311`, job `99598425734`: **PASS**;
  - start/restore GameSession a `currentGame` accessor PASS;
  - Klidný režim přes hook bez `startGame` wrapperu PASS;
  - pause → frozen elapsed → persisted progress → resume PASS;
  - restart stejné Free úrovně obnovil elapsed i Calm stav;
  - Fold portrait 590×960 / screen API 384×832: `tablet-portrait-rail`, portrait, large-touch, overflow 0.
  - dočasný browser workflow byl po úspěšném runu odstraněn; v branchi nezůstává.
- Vercel preview:
  - deployment `dpl_HgutaAdwjH3kNJUAM7AaecRoitPP`: READY;
  - branch alias: `https://proplet-git-refactor-s11b-game-session-pavel-prouzas-projects.vercel.app`;
  - `/api/health`: HTTP 200, Proplet 4.01.39, DB true;
  - nasazené assety potvrzují `game/state.js`, session delegaci a absenci startGame monkey-patchů.
- PWA shell: budget rozšířen pouze o nový malý `/app/game/state.js` asset (14→15).
- Známý nesouvisející check: historický `v3.34 Generation 4 contract` zůstává červený kvůli starému source-level kontraktu; current runtime gate je GREEN.
- Produkce/main/Supabase: **beze změny**. Draft PR #90.
- Rollback: reset branche na `ff6bcc34…`; žádná DB/content migrace.
- Bezpečný bod pokračování: runtime `c39edc8c…` + verification cleanup `b56ae3373ca9f3e5bc2feec4960ec3315fafcb49` + tento status-only commit.
- Další povolený sprint: **11B.2 až po samostatném user review/approval 11B.1**.

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
