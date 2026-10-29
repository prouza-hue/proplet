## Why

Administrace neodpovídá dnešnímu Propletu: její výchozí Launch sleduje starý onboarding `board-v2`, zatímco hra používá `board-v3-short`, a běžná podpora hráčů vyžaduje ruční dohledávání. Potřebujeme důvěryhodné provozní centrum, které pomůže určit správný účet, vyřídit hlášení a rozpoznat skutečný problém.

## What Changes

- Nahradit výchozí Launch přehledem „Co potřebuje vyřešit“ a sedmi sekcemi: Přehled, Hráči a týmy, Hlášení, Obsah a kvalita, Provoz, Analytika, Historie.
- Sloučit dostupnost obecné podpory a hlášení slov do jedné sekce s oddělenými podtypy, stavem, filtrováním a archivem; zachovat jejich rozdílné datové modely.
- Zpřístupnit stránkované hledání hráčů včetně přesného UUID, porovnání stejně pojmenovaných účtů a jednotného serverového výpočtu XP. Přidat přehled týmů a členství pouze ke čtení.
- Začlenit obnovu přístupu z PR 118 do detailu konkrétního hráče. Před vydáním opravit asynchronní záměnu detailu a nespoléhání na úspěšné zneplatnění starého challenge. Zachovat současný Google PKCE, link intent a ověření e-mailu providerem.
- Zobrazit existující diagnostiku integrity účtů, push a historii kvality; neslibovat širší pokrytí, než zdroj skutečně poskytuje.
- Pro analytiku navrhnout a ověřit současný funnel od tréninku po potvrzené uložení účtu. Historii `board-v2` zpřístupnit jen jako označený archiv. Nedostupné nebo neověřené měření neprezentovat jako nulu.
- Každá metrika dostane období, jednotku, zdroj, čas aktualizace a stav úplnosti; návraty D1/D7 pouze nad dozrálými kohortami.
- Sjednotit owner-only ochranu všech adminových cest, audit zápisů a přístupné ovládání. Zachovat `/admin.html`, Tiskařskou dílnu a wordmark Fraunces; odstranit eyebrow nadpisy.
- Zvlášť popsat druhou etapu týmových a identitních oprav. První vydání nebude obsahovat automatické slučování účtů, volnou editaci XP ani přepis historických soutěží.

## Capabilities

### New Capabilities

- `admin-workspace`: navigace, přístupnost, stavy a původ dat, přehled provozu, obsah a diagnostika.
- `admin-player-support`: hledání, porovnání účtů, jednotné XP, týmy ke čtení, případy podpory a bezpečná obnova z PR 118.
- `admin-current-analytics`: verzovaný současný funnel, návraty, metodika kvality a oddělení historického měření.

### Modified Capabilities

Žádné existující OpenSpec specifikace nejsou v tomto repozitáři zavedeny. Existující chování je zachyceno v auditu jako výchozí stav.

## Impact

Dotkne se `public/admin.html`, `public/admin.css`, `public/admin.js`, nových modulů adminu, adminových endpointů v `server.py`, `account_auth.py`, příslušných auth/diagnostických installerů, `backend/launch_report.py` a adminových RPC/migrací. Herní UI a pravidla zůstávají samostatné; případné doplnění telemetrie musí být výslovnou součástí změny datového kontraktu.

Výchozí stav ověřen 28.–29. 10. 2026: produkce i `origin/main` `1de738938ff244fc010808daf33aea7def4b6481`, release 4.09.15, deployment `dpl_5Z5Eu9YBNZRRGHSEWJM837jpAVac`. PR 118 je otevřený draft, head `c92e70f41458118f2cea87cb3490105be1e3fdbf`. Podrobný audit: `audit.md`. Návrh schválen uživatelem 29. 10. 2026 k realizaci na samostatné větvi a izolovaném preview. Implementace je ve větvi `codex/admin-modernization`, draft PR 222. Produkční nasazení ani merge na main autorizované nejsou.
