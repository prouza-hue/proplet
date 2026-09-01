# Technical debt refactor status

- Sprint: 15 — Analytics adapter a event registry
- Branch: `refactor/s15-analytics-adapter`
- Base SHA: `af088886d33d83ce2a2748a1fded6a6d7fffd7cc`
- Characterization HEAD: `c6811bd06820913aa9eae7de2825feefb194d070`
- Stav: **implementation candidate / post-change gate pending**
- Zamýšlená změna chování: žádná.

## Baseline contract

- 132 povolených `/api/product-event` event names.
- Request body pouze `{event_type}`; žádné custom properties ani nová PII.
- Jeden request na event; best-effort failure nesmí blokovat UI/gameplay/navigation.
- Existující navigation/session/impression dedup guards zůstávají.
- Kritická telemetry `attempt/start/checkpoint/finish`, hint/helper, challenge a account-bonus zůstává mimo product analytics.
- Batching, session buffer a změny admin agregací jsou mimo Sprint 15.

## Implementation candidate

- `public/analytics-event-registry.json`: kanonický registry 132 eventů + transport/PII metadata.
- `public/app/analytics.js`: jediný product-event transport adapter; 1 track = 1 POST; caller properties jsou stejně jako baseline ignorovány.
- `backend/analytics.py`: explicitní registry validation + přesně stejný `product_events` row writer.
- `server.py`: HTTP endpoint/signature/rate-limit/actor/error/response zachovány, interně deleguje na analytics service.
- `trackProductEvent()`: zůstává kompatibilní wrapper; při mixed-cache absenci adapteru zachová původní direct request.
- `index.html` + PWA shell: přidán nový adapter asset.
- `docs/ANALYTICS_EVENT_REGISTRY.md`: explicitní PII audit, scope a change protocol.
- `build_quality_report()`, `/api/admin/launch` a historické metriky/agregace se nemění.

## Characterization

- Pre-change PR #104 current-runtime: **GREEN**.
- Golden fixture: `tests/current/s15-product-events-baseline.json`.
- Pre-change server parity: všech 132 eventů accepted, unknown event 400, exact DB row keys.
- Adapter test candidate ověřuje one-request/event, event_type-only payload, preview disable a non-blocking sync/async failure.

## STOP

Post-change current-runtime + diff review + Vercel preview musí být GREEN. Bez explicitního user schválení:
- nemergovat do `main`;
- neměnit event/retention semantics;
- nezapínat batching/agregaci;
- nezačínat Sprint 16.

## Předchozí stav

# Technical debt refactor status

- Sprint: 14 — Canonical content build a generation manifest
- Branch: `refactor/s14-content-pipeline`
- Base SHA: `b8de402ad676b823f72a905289945eff6f6b3e6c`
- Characterization commit: `27f370ba2de3133092d4d3148439da473c85fe6b`
- Implementation commit: `6e55140feb78fa75da2734ef2ee7429a4f473515`
- Stav: **LOCAL GREEN / NEZÁVISLÉ REVIEW CLEAN / PŘED PR**
- Zamýšlená změna chování: žádná; pouze explicitní, bezpečný a reprodukovatelný content build/tooling.
- Změněné oblasti: `content/` manifest + schema, `proplet_content/` model/IO/validator, explicitní build CLI, bezpečné hranice historického generátoru, characterization/pipeline testy, current CI trigger a workflow dokumentace.
- Hotové kroky:
  - ověřen produkční `main`, Vercel deployment a health;
  - zmapován záměrný rozdíl 365 server Daily vs. 366 public Daily;
  - potvrzeno, že jediný public compatibility přírůstek je `g3-d-007`;
  - potvrzen byte-identický in-memory rebuild z `data/puzzles.json` + `data/archive/v3.33.5/puzzles.json.gz`;
  - zafixovány SHA-256, Git blob IDs, byte velikosti a přesná commitová provenance;
  - build bez akce selže; `--check` je read-only; `--output` zapisuje pouze explicitní cestu atomicky a až po ověření vydaného public artefaktu;
  - historický `generate_puzzles.py` nemá implicitní output ani skryté auxiliary zápisy; primary bank se zapisuje poslední;
  - nezávislé review odhalilo fail-closed write-mode blocker; závěrečný re-review po opravách je bez P0/P1.
- Testy PASS: Sprint 14 characterization; Sprint 14 pipeline; canonical builder `--check`; full Current Runtime Gate **50/50**, assets **76/76**, syntax **1081/1081**.
- Testy FAIL / nespouštěné: žádné v autoritativním lokálním gate; generation workflow a generation příkazy záměrně nespouštěny.
- Nově nalezená rizika:
  - nekanonické legacy tooly a jeden stale workflow stále obsahují přímé fixed-path writery vydaných artefaktů; jejich převod je samostatný charakterizovaný řez;
  - explicitní multi-output zápisy jsou jednotlivě atomické, nikoli cross-file transakční; primary bank se proto zapisuje až po auxiliaries;
  - čtyři historické Mozkomor workflow odkazují na odstraněné generation soubory; ve Sprintu 14 se nespouštějí ani neopravují bez samostatně krytého řezu.
- Byte důkaz: `data/puzzles.json` `51370983…`; deterministický public build a vydaný `public/puzzles.json` shodně `09b2f3a4…` / 2 817 259 bytes. Žádný manifest-bound runtime/content artefakt není v diffu.
- Bezpečný bod pokračování: pushnout branch a spustit pouze current-runtime CI; žádný generation workflow, release bind ani merge.
- Další povolený sprint: žádný; Sprint 14 končí review a STOP.

## Předchozí uzavřený stav

- Sprint: 13B — CSS app screens
- Branch: `refactor/s13b-css-app-screens`
- Base SHA: `02606c4b047ce450f02a0fb8e7c1bf4d24c4e908`
- Pre-change characterization: `08757dd233889a8c41a29c98fa85b9f7b8d5c354`
- Runtime consolidation: `9ace662a4911b6aeba6fac4fa601abcc9aee583f`
- Final branch HEAD: `d784e09abfdc350b8aabfafd5e7e7284ffa994b5`
- Merge: `f4e5ed7455b4c09c2e303c7679dc9361dcf663c4` (PR #102)
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Zamýšlená změna chování: žádná.

## Sprint 13B výsledek

- `app-play.css` = původní `home-layout.css` + `today-brand.css`.
- `app-onboarding.css` = původní `onboarding-fit.css` + `onboarding-model-v3328.css`.
- `app-profile-settings.css` = původní `profile-layout-v3330.css` + `settings-ia-v40122.css` + `settings-polish-v40122.css` + `account-auth.css`.
- 8 starých stylesheetů → 3 kanonické ownery; netto **−5 stylesheetů**.
- Cache boundary: `theme-init.js?v=40140-s13b`.
- JS runtime, DOM, gameplay, copy, XP, API, DB, Supabase a content se neměnily.

## Ověření

- Pre-change characterization + 19-case screenshot matrix: GREEN.
- Fixovaný pre-change visual gate: 0,07 % changed pixels / channel delta 8 / geometry 0,25 px.
- Post-change Current Runtime Gate: GREEN.
- Post-change 19-case visual matrix: GREEN.
- Finální branch CI před merge: GREEN.
- PR #102 checks: `current-runtime` SUCCESS, `gen4-contract` SUCCESS, Sprint 13B `current-gate` SUCCESS, `visual-matrix` SUCCESS, Vercel SUCCESS.
- User preview: **SCHVÁLENO**.
- Produkční deployment: `dpl_CSp3HZ6JZUHCBC1NKuWkbbnPgGEU` — **READY**.
- `https://hrajproplet.cz/api/health`: HTTP 200, Proplet `4.01.40`, `ok=true`, `database=true`.
- `/app-play.css?v=40140-s13b`: 200.
- `/app-onboarding.css?v=40140-s13b`: 200.
- `/app-profile-settings.css?v=40140-s13b`: 200.
- Build error scan: čistý.
- Production runtime `error/fatal` scan: žádné záznamy.
- Supabase / DB / content: beze změny.
- Rollback: revert merge commitu `f4e5ed7455b4c09c2e303c7679dc9361dcf663c4`; bez DB/content rollbacku.

## Další krok

Sprint 13B je uzavřen. Další povolený sprint je **Sprint 14 — Canonical content build a generation manifest** na nové větvi z aktuálního produkčního `main`.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 13A — CSS game/results/Fold/responsive
- Branch: `refactor/s13a-css-game`
- Base SHA: `b8d98c35527e6006c0ceaeb4ba4d76e4c06665b8`
- Pre-change characterization: `db4522639a558b7a359dd002a20d5179ea3dc347`
- Final branch/runtime SHA: `5d69e4dedbf17f049adb8905d4dbb2c028f454f1`
- Merge: `69999b85df5f9841e38315683ba89dec10ce7b5d` (PR #101)
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Zamýšlená změna chování: žádná; jediná user-approved preview korekce je sjednocení mobilního rozestupu výsledkových akcí na 7 px.

## Sprint 13A výsledek

- `public/game.css` je kanonický owner pro Fold/tablet + desktop game responsive pravidla.
- `public/results.css` je kanonický owner pro result actions + comparison density + responsive result pravidla.
- `public/desktop-layout-v3330.css` obsahuje už jen app-screen desktop pravidla; 13B scope nebyl rozšířen.
- `public/copy-density-v3327.css` už neobsahuje result comparison pravidla.
- Odstraněny: `game-layout-v3323.css`, `win-actions-v3324.css`, `result-layout-v3330.css`.
- Net počet patch stylesheetů: -1.
- Herních 92× `!important` bylo úmyslně zachováno; bez důkazu nebyl proveden specificity cleanup.
- `styles.css`, DOM, gameplay JS, copy, XP, API, DB, Supabase a content jsou beze změny.
- PWA/cache boundary: `theme-init.js?v=40140-s13a2`; results asset `results.css?v=40140-s13a2`.

## Ověření

- Current Runtime Gate: GREEN.
- Sprint 13A current + visual run `33524941179`: GREEN po rerunu známého Chromium raster noise.
- 14-case browser matrix: GREEN; phone-only schválený action gap kontrakt = 7 px; Fold/desktop beze změny.
- Game consolidation ověřena byte-exaktním přeskupením původních bloků.
- Results consolidation ověřena byte-exaktním přeskupením původních bloků + jediná preview korekce 7 px na telefonu.
- PR #101 checks: `gen4-contract` SUCCESS, `current-runtime` SUCCESS, Vercel SUCCESS.
- User preview: **SCHVÁLENO**.
- Produkce: deployment `dpl_BjfVXVSJzFrCsZxjRGYZ3KjVuZYL` na merge SHA je **READY**.
- `https://hrajproplet.cz/api/health`: HTTP 200, Proplet `4.01.40`, `ok=true`, `database=true`.
- `/game.css?v=40140-s13a`: 200.
- `/results.css?v=40140-s13a2`: 200.
- `/theme-init.js?v=40140-s13a2`: 200; obsahuje nové game/results ownery a žádný odstraněný CSS asset.
- Build error scan: čistý.
- Production runtime `error/fatal` scan: žádné záznamy.
- Supabase / DB / content: beze změny.
- Rollback: revert merge commitu `69999b85df5f9841e38315683ba89dec10ce7b5d`; bez DB/content rollbacku.

## Další krok

Sprint 13A je uzavřen. **Sprint 13B nezačínat bez nového explicitního pokynu uživatele.**

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 12B.3 — rankings orchestration
- Branch: `refactor/s12b3-rankings`
- Base SHA: `3b29f494a2bc02bf6610c84ea0f03e16aba84cfb` (`main`, včetně Gen4 calm-mode contract hotfixu)
- Characterization: `1454b1d8fe49a82b285c9ef01d7afd67a364ec9a`
- Runtime: `bda2869855238d66f53cfd4b2a719add92a9f805`
- Merge: `f454768b843fa2542bb9fbb0ac8975f0381c87d0`
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
- Výsledek:
  - nový `public/app/rankings/rankings.js` vlastní hlavní obrazovku Pořadí, její hráčský/týmový scope, XP období, Daily renderer, privacy a týmovou kartu;
  - `app.js` ponechává tenké kompatibilní adaptéry a jedinou instalaci lifecycle listenerů;
  - all-time top 10 + vlastní pozice je součástí ownera; `ranking-polish.js` už nepřepisuje `fetch` ani `renderXpRanking`;
  - účetní +500 XP používá explicitní behavior-preserving dependency a dál respektuje `accountRewardsIncluded`;
  - anonymní aliasy zůstávají na stejných ranking endpointech; týmové puzzle mini-pořadí se nemění;
  - PWA shell roste vědomě o jediný dependency-free asset, 24→25.
- Ověření:
  - lokální Current Runtime Gate **46/46**, assets **82/82**, syntax **225/225**;
  - lokální Gen4 quality contract **PASS**;
  - vzdálený gate nad finálním PR headem: Current Runtime Gate #43 **SUCCESS** a Gen4 contract #336 **SUCCESS**;
  - preview deployment `dpl_73wfsn5syKgXTeHLrUBAn9XKExRx` je **READY** na přesném runtime SHA;
  - stable alias: `https://proplet-git-refactor-s12b3-rankings-pavel-prouzas-projects.vercel.app/`;
  - health 200: Proplet 4.01.40, `ok=true`, DB true; nový rankings asset vrací 200;
  - browser guest matrix: Daily hráči/týmy, XP hráči/týmy, Dnes/Týden/Celkem, top-10 slice a opakovaná navigace jsou green;
  - build error scan a preview runtime error/fatal/warning scan jsou čisté.
- PR #99: zavřený draft; GitHub ready-for-review konektor znovu selhal na vlastním GraphQL poli.
- PR #100: **MERGED** ze stejného ověřeného head SHA — `https://github.com/prouza-hue/proplet/pull/100`.
- Produkce: deployment `dpl_6tiGJGKnsYKg3CQzyPKVwNXfaksq` je **READY** na merge SHA; `hrajproplet.cz` hlásí 4.01.40, `ok=true`, DB true, nový rankings asset se servíruje a build/runtime error/fatal/warning scan je čistý.
- Supabase: beze změny. Žádná migrace.
- Rollback: revert merge commitu `f454768b843fa2542bb9fbb0ac8975f0381c87d0`. Bez DB/content rollbacku.
- Handover: `PROPLET_HANDOVER_PO_SPRINTU_12B_3.md`.
- Další povolený krok: pouze Sprint 13A — CSS tokens/base + game/results/Fold/responsive na nové větvi z aktuálního produkčního `main`; nejprve characterization + screenshot matrix, bez redesignu a s preview STOP bránou.

## Předchozí uzavřený stav

# Technical debt refactor status

- Sprint: 12B.2 — progression + Daily orchestration
- Branch: `refactor/s12b-daily`
- Base SHA: `b3579b2957dc38cf83798fc05c86546a8949ddf7` (uzavřený produkční Sprint 12B.1)
- Characterization: `417dc8200159a589497186b5065f9e5aa1d89692`
- Runtime: `86263e4aabd71119c2fb33efef2d587ea29dfd7c`
- Merge: `95500f07b95c54b864c4df383464d0793ed5078d`
- Stav: **UZAVŘENO / GREEN / MERGED / PRODUKCE READY**
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
  - přidán test-only kontrakt pro Daily rotaci, active/legacy stav, Free fresh/replay, release CTA a idempotentní ownership guard;
  - vzdálený Current Runtime Gate #38 nad characterization checkpointem je green;
  - `public/app/content/progression.js` vlastní Daily selection, Free progression a fresh release-batch policy;
  - `public/app/content/daily.js` vlastní `renderDaily`, `startDaily` a jediný result-menu observer;
  - `app.js` ponechává tenké kompatibilní adaptéry; `home-layout.js` používá explicitní `afterRender` seam a nepřepisuje `renderDaily` ani nepřidává Daily nav listener;
  - starý `daily-win-menu-v40123.js` je pasivní mixed-cache shim a už se nenačítá; cache boundaries pro `theme-init` a `home-layout` jsou posunuté.
- Testy PASS: lokální Current Runtime Gate **45/45**, assets **81/81**, syntax **224/224**; vzdálený Current Runtime Gate #39 **SUCCESS**.
- Preview:
  - deployment `dpl_9HtA5XyrTtWZg7cCXxAuAVvYJwhF` je **READY** a odpovídá přesně runtime SHA;
  - stable alias: `https://proplet-git-refactor-s12b-daily-pavel-prouzas-projects.vercel.app/`;
  - `/`, `/api/health`, oba content ownery a nový `home-layout` vracejí 200; health hlásí 4.01.40, `ok=true`, DB true;
  - browser fresh-state: Daily homescreen, `Hrát Denní výzvu`, release banner `Hrát novinky`, Free → Daily → Daily stabilní;
  - opakovaná Daily navigace zachovala datum i CTA a nepřidala page console error/warning;
  - preview runtime error/fatal log scan za poslední hodinu je čistý.
- Historický test FAIL / mimo scope: Gen4 workflow padal na `ResultCreate must carry calm_mode`. Šlo o zastaralou statickou kontrolu, která hledala model přímo v `server.py`, ačkoli model i `calm_mode` už správně vlastní `backend/contracts.py`; nešlo o runtime vadu.
- Nově nalezená rizika: PWA shell je na vědomém limitu 24 assetů; mixed-cache cesta je krytá novým query boundary a pasivním shimem. Gen4 kontrolu opravit samostatným test-only hotfixem, aby CI znovu dávalo spolehlivý signál.
- Hotfix checkpoint: na větvi `hotfix/gen4-calm-contract` kontrola Gen4 staticky ověřuje `ResultCreate`, `AttemptStart`, `AttemptCheckpoint` a `AttemptFinishTelemetry` v `backend/contracts.py`; `server.py` zůstává ověřený pro runtime importy a použití `calm_mode`. Runtime, produktová data ani DB se nemění.
- PR #97: **MERGED** — `https://github.com/prouza-hue/proplet/pull/97`; nahrazuje draft #96, který GitHub konektor nedokázal přepnout do ready stavu.
- Produkce: deployment `dpl_2n3uKFk1okdT8ErfJt7vxkrsiLrr` je **READY** na merge SHA; `hrajproplet.cz`, health a oba nové content moduly vracejí 200, DB true a error/fatal scan je čistý.
- Supabase: beze změny. Žádná migrace.
- Rollback: revert merge commitu `95500f07b95c54b864c4df383464d0793ed5078d`; bez DB/content rollbacku.
- Další povolený krok: samostatný test-only hotfix Gen4 kontroly; poté třetí řez Sprintu 12B — `rankings/rankings.js`.

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



