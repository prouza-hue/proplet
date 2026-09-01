# PROPLET — HANDOVER PO SPRINTU 13B

Datum uzavření: **2026-09-01**

Stav produktu: **Proplet v4.01.40, produkce GREEN**

Účel dokumentu: bezpečné navázání v Codexu před zahájením Sprintu 14.

## 1. Aktuální stav v jedné minutě

- Sprinty **12A.1, 12A.2, 12B.1, 12B.2, 12B.3, 13A a 13B** jsou uzavřené, uživatelsky schválené, sloučené do `main` a ověřené na produkci.
- Poslední runtime merge je `f4e5ed7455b4c09c2e303c7679dc9361dcf663c4` (`merge: Sprint 13B CSS consolidation`, PR #102).
- Produkční deployment tohoto runtime: `dpl_CSp3HZ6JZUHCBC1NKuWkbbnPgGEU`, stav `READY`.
- Produkce: `https://hrajproplet.cz/`.
- Health po merge: verze `4.01.40`, `ok=true`, `database=true`.
- Build error scan je čistý; production runtime `error/fatal` scan je čistý.
- Current Runtime Gate, Gen4 contract a Sprint 13B visual/current gates jsou GREEN.
- Supabase/DB/content se ve Sprintech 13A–13B neměnily; není potřeba žádná migrace ani content rollback.
- Další plánovaný krok je **pouze Sprint 14 — Canonical content build a generation manifest**.
- **Sprint 15 ani další práci nezačínat automaticky po 14.** Každý sprint končí samostatným review a STOP bránou.

> Po runtime merge může být na `main` už jen následný dokumentační commit s tímto handoverem/status update. Novou sprintovou větev vždy založit z přesného aktuálního `origin/main`, ne ze staré preview/refactor větve.

## 2. Kanonické zdroje pravdy

V repozitáři:

- `TECH_DEBT_REFACTOR_STATUS.md` — detailní historie řezů, testů, preview a rollbacků.
- `PROPLET_HANDOVER_PO_SPRINTU_13B.md` — tento rychlý přenos kontextu.
- `tests/current/manifest.json` — aktuální characterization/runtime gate.
- `public/theme-init.js`, `public/index.html`, `public/sw.js` — loader a PWA/cache hranice.

Původní autorita pro další sprinty je **`TECH_DEBT_REFACTOR_PLAN.md`**. Pokud je v Codexu dostupný, vždy jej načíst celý spolu s relevantním findingem auditu a aktuálním statusem. Při rozporu mezi plánem, handoverem a live stavem **zastavit a vyžádat rozhodnutí uživatele**.

Před zahájením práce vždy:

```bash
git fetch origin main
git switch main
git merge --ff-only origin/main
git status --short --branch
git log -5 --oneline --decorate
```

Pracovní strom musí být čistý. Potom ověřit:
1. aktuální `main` SHA;
2. poslední commit message;
3. Vercel production deployment `READY`;
4. `GET https://hrajproplet.cz/api/health`;
5. pokud se řeší content tooling, přesné současné content input/output soubory a jejich hashe.

Pokud live realita nesedí s tímto dokumentem, **live stav má přednost** a handover/status se má nejdřív opravit.

## 3. Co bylo dokončeno od Sprintu 12B.3

### Sprint 13A — CSS game/results/Fold/responsive

- Branch: `refactor/s13a-css-game`.
- PR #101, merge `69999b85df5f9841e38315683ba89dec10ce7b5d`.
- Nový `public/game.css` je kanonický owner pro Fold/tablet + desktop game responsive pravidla.
- Nový `public/results.css` je kanonický owner pro result actions + comparison density + responsive result pravidla.
- Odstraněny `game-layout-v3323.css`, `win-actions-v3324.css`, `result-layout-v3330.css`.
- `desktop-layout-v3330.css` zůstal app-screen owner; `copy-density-v3327.css` přišel pouze o result comparison bloky.
- Herních 92× `!important` bylo úmyslně zachováno; nebyl proveden kosmetický specificity cleanup bez důkazu.
- Před změnou vznikla 14-case phone/Fold/desktop + light/dark/auto + safe-area/reduced-motion matrix.
- Preview review našlo jedinou uživatelskou spacing odchylku na výsledkovce; finálně jsou na telefonu oba action gaps sjednocené na **7 px**.
- Final current/visual gates GREEN; produkce po merge GREEN.
- Žádná změna gameplay, DOM, copy, XP, API, DB, Supabase nebo content.

### Sprint 13B — CSS app screens

- Branch: `refactor/s13b-css-app-screens`.
- PR #102, merge `f4e5ed7455b4c09c2e303c7679dc9361dcf663c4`.
- `app-play.css` = `home-layout.css` + `today-brand.css`.
- `app-onboarding.css` = `onboarding-fit.css` + `onboarding-model-v3328.css`.
- `app-profile-settings.css` = `profile-layout-v3330.css` + `settings-ia-v40122.css` + `settings-polish-v40122.css` + `account-auth.css`.
- 8 starých stylesheetů bylo nahrazeno 3 kanonickými ownery; netto **−5 stylesheetů**.
- Tři nové ownery byly ověřeny jako byte-exaktní mechanické složení původních bloků.
- Výslovně nedotčené a proti base byte-identické zůstaly mj. `desktop-layout-v3330.css`, `onboarding-return-v3332.css`, `push-retention-v3329.css`, `ranking-polish.css`, `gesture-guard-v3325.css`, `quality-v334.css`, `quality-hotfix-v334.css`, `game.css`, `results.css`, `challenge-cta-v3333.css`, `competitive-sharing-v3331.css`, `copy-density-v3327.css`.
- Před změnou vznikla 19-case app-screen matrix pro Daily/Free/profile/settings/rankings/onboarding/modals napříč phone/Fold/desktop, themes, safe-area a reduced-motion.
- Pre-change renderer noise byl změřen před runtime editací; finální fixovaný gate byl 0,07 % changed pixels / channel delta 8 / geometry 0,25 px.
- Post-change Current Runtime Gate i 19-case visual matrix GREEN.
- Produkční deployment `dpl_CSp3HZ6JZUHCBC1NKuWkbbnPgGEU` je READY; health `4.01.40 / ok=true / DB=true`, build/runtime scan čistý.
- Žádná změna JS runtime, gameplay, DOM, copy, XP, API, DB, Supabase nebo content.

## 4. Známé provozní a workflow zvláštnosti

### GitHub draft PR

Konektor `mark ready for review` v minulosti opakovaně padal na chybě GraphQL pole `Repository.fullDatabaseId`. Bezpečný workaround:

1. ověřit finální head SHA a GREEN workflow;
2. zavřít pouze draft PR;
3. otevřít nedraftový PR ze stejného head SHA;
4. merge s kontrolou očekávaného head SHA;
5. nikdy force push/reset `main`.

Pokud standardní nedraftový PR funguje, workaround není potřeba.

### Preview a účtová data

- Preview může mít omezený kontext pro globální pořadí a blokovat změny týmových dat; samo o sobě to není produkční regrese.
- U session/rankings/Tajenky při zásahu do souvisejícího runtime vždy chránit guest → login, účet A → logout → účet B a reload izolaci.

### Visual characterization

- Chromium headless umí produkovat drobný raster/antialiasing noise i při nulovém geometrickém driftu.
- Tolerance se musí **změřit a zafixovat před runtime změnou**, nikdy nezvyšovat ex post kvůli nechtěnému diffu.
- Dynamické prvky typu timer se mají ve fixture zmrazit.
- Skutečný geometry/layout/color drift je blocker.

### Lokální prostředí

- Standardní gate: `python tools/test_current.py`.
- Pokud lokální síťový test ruší zděděná proxy: `env -u ALL_PROXY -u all_proxy python tools/test_current.py`.

## 5. Sprint 14 — závazný scope

**Název:** Canonical content build a generation manifest  
**Priorita:** P2  
**Velikost / riziko:** M–L / Medium  
**Branch:** `refactor/s14-content-pipeline`  
**Findingy:** 11, 16

### Cíl

Oddělit build-time vstupy, generované artefakty a runtime content **bez regenerace vydané banky**.

### Povolený rozsah

- Definovat manifest `inputs / outputs / schema / version / hash / provenance`.
- Zavést `proplet_content` pure core postupně; jako první:
  - `models.py`
  - `io.py`
  - `validator.py`
- `tools/generate_puzzles.py` zůstává CLI, ale zápis smí probíhat pouze přes explicitní `--output` a atomic temp → rename.
- Vytvořit `tools/build_runtime_content.py` pro kanonický source → public compatibility artefakt.
- Přesunout inline workflow Python pouze tam, kde je daná část současně krytá testem.

### Akceptace

- Nad současnými vstupy vznikne **byte-identický runtime artefakt**, nebo se sprint zastaví a každý rozdíl se vysvětlí v diff/provenance reportu.
- Validator nedělá implicitní zápisy.
- Generation command bez `--output` nemůže přepsat release banku.
- Žádný generation workflow ani produkční release se ve Sprintu 14 nespouští.
- Žádná vydaná puzzle banka se neregeneruje jen proto, aby „odpovídala novému toolingu“.

### STOP

Pokud reproducible build není byte-identický:
1. vytvořit diff/provenance report;
2. **neregenerovat „správnější“ produkční data**;
3. zastavit a vyžádat rozhodnutí uživatele.

Sprint 14 nesmí přerůst do Sprintu 15 ani do obecného cleanupu generation workflow.

## 6. Doporučené rozdělení práce v Codexu

Doporučený model:

- **Sol = orchestrátor / integrátor**
  - drží scope;
  - čte plán, audit a status;
  - navrhuje characterization;
  - rozhoduje o architektuře, provenance a bezpečnostních hranicích;
  - kontroluje diff;
  - vlastní finální GitHub/Vercel/merge rozhodnutí.
- **Luna nebo jiný subagent = paralelní read-only pomoc**
  - inventura content inputs/outputs;
  - mapa generation entrypointů a workflow inline Pythonu;
  - hash/provenance inventura;
  - nezávislé P0/P1 review;
  - návrh test matrix.
- Nenechat dva agenty současně editovat stejné content/tooling soubory.
- Mechanické a read-only práce lze delegovat; finální integrace a rozhodnutí o byte-identitě zůstává u Sola.

Toto je doporučený model i pro další sprinty: **Codex jako exekuční prostředí, Sol jako šéf dílny**.

## 7. Neměnná pravidla pro další sprinty

1. Jeden sprint = jeden scope. Žádný redesign, gameplay změna ani „úklid při cestě“.
2. Vlastní branch z aktuálního produkčního `main`.
3. Characterization/baseline před runtime editací.
4. Zachovat HTTP kontrakty, localStorage klíče, DOM hooky, texty a load order, pokud sprint výslovně neurčuje jedinou povolenou změnu.
5. Bez výslovného souhlasu uživatele:
   - žádný merge do `main`;
   - žádný produkční deployment;
   - žádná produkční DB migrace;
   - žádná změna produkčních dat;
   - žádný content generation workflow.
6. Každý sprint končí diff review + test report + jasný `STOP`.
7. Při P0 nálezu nerozšiřovat scope — zdokumentovat, zastavit, vyžádat rozhodnutí.
8. Před commitem zkontrolovat, že branch neobsahuje generované banky, secrets, dumpy, `.pyc` ani nesouvisející změny.
9. Při nedostatku času/kreditů nezanechat napůl aplikovaný přesun/migraci; checkpoint musí být bezpečně obnovitelný.

## 8. Doporučený první prompt pro Codex

> Navazuj podle `PROPLET_HANDOVER_PO_SPRINTU_13B.md` a `TECH_DEBT_REFACTOR_PLAN.md`. Sol je orchestrátor; pokud je to efektivní, deleguj subagentům read-only inventuru a nezávislé review. Proveď pouze Sprint 14 — Canonical content build a generation manifest — na nové větvi `refactor/s14-content-pipeline` z aktuálního produkčního `main`. Nejprve ověř live baseline a přesně zmapuj content inputs/outputs/provenance, potom characterization. Runtime/content artefakty nesmí být změněny bez byte-identického důkazu. Nespouštěj žádný generation workflow, neregeneruj vydané banky a nic nemerguj bez mého explicitního schválení. Pokud se plán, handover a live stav rozcházejí, zastav a vyžádej moje rozhodnutí.

K promptu přiložit tento handover a pokud možno i `TECH_DEBT_REFACTOR_PLAN.md`.
