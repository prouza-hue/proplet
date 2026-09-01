# PROPLET — HANDOVER PO SPRINTU 12B.3

Datum uzavření: **2026-09-01**

Stav produktu: **Proplet v4.01.40, produkce GREEN**

Účel dokumentu: bezpečné navázání v nové konverzaci před zahájením Sprintu 13.

## 1. Aktuální stav v jedné minutě

- Sprinty **12A.1, 12A.2, 12B.1, 12B.2 a 12B.3** jsou uzavřené, schválené, sloučené do `main` a ověřené na produkci.
- Poslední runtime merge je `f454768b843fa2542bb9fbb0ac8975f0381c87d0` (`merge: Sprint 12B.3 rankings orchestration`).
- Produkční deployment tohoto runtime: `dpl_6tiGJGKnsYKg3CQzyPKVwNXfaksq`, stav `READY`.
- Produkce: `https://hrajproplet.cz/`.
- Health po merge: verze `4.01.40`, `ok=true`, `database=true`.
- Produkce servíruje nový rankings owner `app/rankings/rankings.js?v=40140-s12b3`.
- Build error scan je čistý; production runtime error/fatal/warning scan je čistý.
- Poslední ověřené testy: Current Runtime Gate **46/46**, assets **82/82**, syntax **225/225**.
- Remote gate nad finálním headem PR #100: Current Runtime Gate **#43 SUCCESS**, Gen4 contract **#336 SUCCESS**.
- Supabase/DB/content se ve Sprintech 12A–12B.3 neměnily; není potřeba žádná migrace.
- Další plánovaný krok je **pouze Sprint 13A — CSS game/results/Fold/responsive**. Sprint 13B začít až po samostatném review a STOP bráně 13A.

> Důležité: po runtime SHA může být na `main` už jen následný dokumentační commit s tímto handoverem. Novou větev vždy založit z aktuálního `origin/main`; runtime baseline musí obsahovat `f454768b…`.

## 2. Kanonické zdroje pravdy

V repozitáři:

- `TECH_DEBT_REFACTOR_STATUS.md` — detailní historie řezů, testů, preview a rollbacků.
- `PROPLET_HANDOVER_PO_SPRINTU_12B_3.md` — tento rychlý přenos kontextu.
- `tests/current/manifest.json` — aktuální characterization/runtime gate.
- `public/theme-init.js`, `public/index.html`, `public/sw.js` — loader a PWA/cache hranice.

Původní plán technického dluhu se jmenuje `TECH_DEBT_REFACTOR_PLAN.md`. Pokud v nové konverzaci není dostupný, závazný scope Sprintu 13 je zapsaný i níže v tomto dokumentu; není nutné jej domýšlet.

Před zahájením práce vždy:

```bash
git fetch origin main
git switch main
git merge --ff-only origin/main
git status --short --branch
git log -5 --oneline --decorate
```

Pracovní strom musí být čistý. Novou sprintovou větev založit z přesného aktuálního `main`, ne ze staré preview větve.

## 3. Co bylo dokončeno od Sprintu 11B.2

### Sprint 12A.1 — account session ownership

- Nový `public/app/account/session.js` sjednotil session load/save/update/clear, auth headers, přijetí identity a stale-identity ochranu.
- Home ranking cache i in-flight response jsou vázané na konkrétní účet.
- Nový `public/app/account/tajenka-storage.js` ukládá completion/progress Tajenky account-scoped, umí lossless guest adoption, legacy migraci a serverový merge.
- Opravena produkční vada: dohraná Tajenka se po přihlášení/reloadu znovu nenabízí jako nedokončená; subtle completed karta se načte bez replay. XP deduplikace zůstala zachovaná.
- Žádná změna XP pravidel, gameplay, API ani DB schématu.
- PR #93 byl merge náhradou za technicky problematický draft #92.

### Sprint 12A.2 — profile/team UI ownership

- Nový `public/app/account/account.js` vlastní profilový renderer, avatar allowlist, týmový seznam, join/new membership, PIN, family-league nastavení a leave.
- `app.js` ponechává tenké kompatibilní adaptéry.
- Preview z bezpečnostních důvodů týmová data nemění; hláška „V preview se týmová data z bezpečnostních důvodů nemění“ je zamýšlené chování.
- Uživatelsky schválená drobná čitelnost týmové karty byla upravena bez redesignu.
- PR #94, produkce GREEN.

### Sprint 12B.1 — onboarding a engagement nudges

- `public/app/engagement/onboarding.js` vlastní starter/helper/principle model a returning-player cestu.
- `public/app/engagement/nudges.js` vlastní difficulty observer, install lifecycle a pořadí post-win CTA.
- Odstraněno překrývající se vlastnictví bez změny copy nebo produktu.
- PR #95, produkce GREEN.

### Sprint 12B.2 — progression + Daily orchestration

- `public/app/content/progression.js` vlastní Daily selection, Free progression a fresh/replay release policy.
- `public/app/content/daily.js` vlastní `renderDaily`, `startDaily` a jediný result-menu observer.
- `home-layout.js` používá explicitní `afterRender` seam; starý Daily shim se už nenačítá.
- PR #97, produkce GREEN.

### Gen4 calm-mode contract hotfix

- Pád Gen4 na `ResultCreate must carry calm_mode` nebyl runtime vadou. Šlo o zastaralý statický test, který hledal model v `server.py`, ačkoli jej správně vlastní `backend/contracts.py`.
- Test-only hotfix ověřuje `ResultCreate`, `AttemptStart`, `AttemptCheckpoint` a `AttemptFinishTelemetry` v aktuálním ownerovi a zachovává kontrolu runtime importů v `server.py`.
- Runtime, produktová data a DB se nezměnily.
- PR #98; merge `3b29f494a2bc02bf6610c84ea0f03e16aba84cfb`; Gen4 workflow je znovu GREEN.

### Sprint 12B.3 — rankings orchestration

- Nový `public/app/rankings/rankings.js` vlastní hlavní obrazovku Pořadí, hráčský/týmový scope, XP období, Daily renderer, privacy a týmovou kartu.
- `app.js` má pouze tenké adaptéry a jedinou instalaci lifecycle listenerů.
- `ranking-polish.js` už nepřepisuje `fetch` ani `renderXpRanking`.
- All-time top 10 + vlastní pozice, anonymní aliasy i týmové puzzle mini-pořadí zachovávají původní chování.
- Account bonus +500 XP používá explicitní dependency a respektuje `accountRewardsIncluded`.
- PWA shell vědomě narostl o jediný dependency-free asset z 24 na **25**.
- Schválené preview: `https://proplet-git-refactor-s12b3-rankings-pavel-prouzas-projects.vercel.app/`.
- Draft PR #99 byl zavřen kvůli chybě GitHub ready-for-review konektoru; identický head byl otevřen jako nedraftový PR #100 a úspěšně sloučen.
- PR #100: `https://github.com/prouza-hue/proplet/pull/100`.
- Merge: `f454768b843fa2542bb9fbb0ac8975f0381c87d0`.
- Rollback: revert tohoto merge commitu; bez DB/content rollbacku.

## 4. Známé provozní a workflow zvláštnosti

### GitHub draft PR

Konektor `mark ready for review` opakovaně padá na chybě GraphQL pole `Repository.fullDatabaseId`. Není to chyba aplikace ani větve.

Bezpečný použitý workaround:

1. ověřit, že head SHA je finální a oba workflow jsou GREEN;
2. zavřít pouze draft PR;
3. otevřít nedraftový PR ze stejného head SHA;
4. merge provést s kontrolou očekávaného head SHA;
5. nikdy nepoužívat force push/reset `main`.

### Preview a účtová data

- Preview může používat jiný/omezený kontext pro globální pořadí a blokuje změny týmových dat. Není to produkční regres, pokud je production účetní stav správný.
- U session/rankings/Tajenky vždy testovat přechody guest → login, účet A → logout → účet B a reload. Žádná cache ani completion nesmí protéct mezi účty.

### Lokální prostředí

- Standardní gate: `python tools/test_current.py`.
- Pokud lokální síťový test ruší zděděná proxy, použít `env -u ALL_PROXY -u all_proxy python tools/test_current.py`. Nejde o změnu produktu.

## 5. Sprint 13 — závazný plán

Priorita: **P2**

Velikost/riziko: dvě části M–L, **vysoké vizuální riziko**

Závislost: dokončené JS vertical slices 11–12

Cíl: konsolidovat CSS po obrazovkách, snížit počet patch stylesheetů a `!important`, **bez vizuálního redesignu**.

### Sprint 13A — CSS game/results/Fold/responsive

Větev: `refactor/s13a-css-game`

Jediný povolený scope:

- tokens/base;
- herní obrazovka;
- výsledky;
- Fold layout;
- responsive pravidla související s game/results.

Povinný postup:

1. Z aktuálního produkčního `main` založit samostatnou větev.
2. Před runtime změnou zapsat characterization a vytvořit screenshot matrix reprezentativních viewportů, témat, safe-area a reduced-motion.
3. Zmapovat skutečné pořadí stylesheetů, selektory, specificity a aktuálně vítězící deklarace.
4. Přesouvat pravidla po obrazovce; mazat pouze prokazatelně přepsané nebo duplicitní deklarace.
5. Zachovat specificity tam, kde by její snížení měnilo layout. Cílem není vynutit nulu `!important`.
6. Každý odstraněný stylesheet odstranit také z loaderu a cache/PWA seznamu a nechat projít asset test.
7. Spustit celý current gate, asset i syntax testy a browser/screenshot matrix.
8. Publikovat preview a zastavit na uživatelském review. Bez schválení nemergovat ani nezačínat 13B.

Minimální doporučená screenshot matrix:

- desktop a mobil;
- Fold/úzký portrait i širší responsive stav;
- light a dark, plus ověření `auto` bez přeskoku tématu;
- hra před tahem, rozpracovaná hra, nalezené slovo/hint a výsledek;
- běžný viewport i safe-area simulace;
- standardní motion i `prefers-reduced-motion`.

STOP podmínky 13A:

- žádné nové barvy, mezery, typografie ani responsive redesign;
- žádná změna DOM struktury, gameplay, textů, XP, API nebo DB;
- žádné „úklidové“ mazání bez důkazu z cascade/characterization;
- pixel/DOM rozdíl mimo předem schválenou toleranci je blocker;
- nepřidávat scope 13B.

### Sprint 13B — CSS app screens

Větev až po uzavření 13A: `refactor/s13b-css-app-screens`

Scope:

- Daily a Free;
- profil a nastavení;
- rankings;
- onboarding;
- modály.

Pro 13B platí stejná screenshot, cache/loader, asset a no-redesign pravidla. Jde o samostatné preview, review, STOP a merge rozhodnutí.

## 6. Doporučené rozdělení práce agentů

- **Sol**: orchestrátor, vlastník scope, characterization strategie, rozhodnutí o cascade/specificity, integrace, finální visual diff, GitHub/Vercel a merge.
- **Luna/subagent**: paralelní read-only inventura stylesheetů a loader/cache vazeb, mapa duplicitních selektorů, návrh screenshot matrix nebo nezávislé P0/P1 review.
- Nedovolit více agentům současně editovat stejné CSS/loader soubory. Mechanickou inventuru lze delegovat, vizuálně citlivá rozhodnutí a finální diff zůstávají u Sola.

## 7. Definition of Done pro 13A

- Větev vznikla z aktuálního produkčního `main`.
- Před změnou existuje characterization a baseline screenshot matrix.
- Změna zůstala v přesném scope 13A.
- Vizuální chování game/results/Fold/responsive je zachováno v dohodnuté toleranci.
- Odstraněné soubory nejsou v HTML, theme loaderu, service workeru ani jiném cache seznamu.
- Current Runtime Gate, assets, syntax a relevantní workflow jsou GREEN.
- Preview je `READY`, health je `ok=true`, DB true, build/runtime error scan čistý.
- Uživatel preview výslovně schválil.
- Teprve potom lze merge do `main`, production verify a samostatné rozhodnutí o 13B.

## 8. Doporučený první prompt v nové konverzaci

> Navazuj podle `PROPLET_HANDOVER_PO_SPRINTU_12B_3.md`. Sol je orchestrátor; pokud je to efektivní, deleguj Luně read-only inventuru a nezávislé review. Proveď pouze Sprint 13A na nové větvi z aktuálního produkčního main. Nejprve characterization a screenshot matrix, potom behavior-preserving CSS konsolidaci game/results/Fold/responsive. Bez redesignu, bez změny produktu a bez merge před mým preview schválením.

K tomuto promptu přiložit tento handover. Pokud je dostupný i `TECH_DEBT_REFACTOR_PLAN.md`, použít jej jako původní autoritu; při rozporu zastavit a vyžádat rozhodnutí uživatele.
