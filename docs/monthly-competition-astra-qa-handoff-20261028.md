# Proplet — předání měsíční soutěže pro QA modelem Astra

Stav k 28. 10. 2026: **skutečný online průchod od dohrání výzvy přes body a uzávěrku po získaný odznak prošel**. Tento dokument je zadání pro nezávislé QA, nikoli autorizace produkčního spuštění.

## Zadání pro Astru

Nezávisle ověř skutečně fungující měsíční soutěž jednotlivců v novém schváleném no-scroll Propletu. Hledej konkrétní chyby v celém toku od hry přes potvrzený výsledek až po pořadí a odznak. Posuď také srozumitelnost a přístupnost mobilního UI. Schválený design ani pravidla znovu nenavrhuj. Nálezy dolož konkrétním postupem, účtem/scénářem, očekávaným a skutečným chováním; odliš blokátor spuštění od drobného vylepšení.

Pracuj pouze v uvedené větvi, jejím preview a izolované testovací databázi. **Neslučuj PR, nenasazuj produkci, neměň produkční databázi ani běžící no-scroll playtest. Neposílej zprávy hráčům ani push notifikace.** Produkční `hrajproplet.cz` není testovací prostředí. Nepoužívej skutečné hráčské účty nebo syntetické výsledky na nich. Nevydávej fixture ani pouhé načtení API za ověření hry.

## Přesný kandidát a prostředí

| Údaj | Stav |
| --- | --- |
| Repozitář | `prouza-hue/proplet` |
| Větev | `codex/monthly-competition-202611` |
| PR | [#221](https://github.com/prouza-hue/proplet/pull/221), neslučovat |
| Aktuální integrační preview | [Otevřít měsíční soutěž](https://proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app/?open=monthly) |
| Ověřený serverový tok | `2d6553de63f3915dce860ca27f5f3700b466c97b`, deployment `dpl_81G6d1QkKGkSAn6L1qjzGKGNVgCa` |
| Aktuální Vercel deployment | `dpl_9KiSoSa3vtGoMkd5TED25znEzWEU`, READY |
| Aktuální aplikační kandidát | `b1c792a14449cd088b8d3d0352c62d803ee4ecd9`; poslední změny opravují pouze klientskou autoritu XP / offline QA, serverový měsíční tok se neměnil |
| Release / PWA cache | `4.10.0` / `monthly-liveqa4` |
| Izolovaný Supabase projekt | `eanzztstmwlamwfdskbf`, `proplet-s08b-atomic-result-test` |
| Produkční Supabase projekt | `iopyhluayfszskyqqpuc` — nesmí se měnit |
| Kontrola před zápisem | `/api/health` musí potvrdit `monthlyPreview.isolated=true`, přesné `databaseRef` a výše uvedenou větev |

V místním Codexu je checkout `C:/Users/prouz/.codex/.chatgpt-projects/g-p-6aac5023adc48191bd66be037edff741/monthly-competition`. Soubory projektu pod `sources/` jsou pouze ke čtení. Cloudový chat nemá automaticky přístup k této složce ani k soukromým místním souborům; potřebné podklady a syntetické přihlášení mu musí uživatel bezpečně zpřístupnit samostatně.

## Závazná soutěžní pravidla

- Počítá se první platné dokončení **základní Denní výzvy v den jejího vydání**: 100 soutěžních bodů a dalších 20 bez nápovědy.
- Skóre tvoří nejlepších 20 dnů kalendářního měsíce; maximum je 2400 bodů. Rychlost ani XP nerozhodují.
- Extra, Tajenka, volná hra, Archiv, trénink a opakování měsíční body nepřidávají. Jejich současné XP a další odměny zůstávají zachované.
- Stejné body znamenají společné místo, například 1–1–3. Není žádný skrytý rozstřel. Každý na místě 1–3 dostane příslušný měsíční odznak, bez XP bonusu.
- Den i měsíc používají **Europe/Prague**, včetně letního času. Listopad končí 1. 12. 2026 v 00:00 CET. Uzávěrka je přesně o 48 hodin později: **3. 12. 2026 00:00 CET** (`2026-12-02T23:00:00Z`).
- Offline výsledek musí být dokončen v den vydání a server jej musí přijmout **před** uzávěrkou. Původní datum dokončení se při synchronizaci nesmí změnit na datum doručení. Doručení přesně na hranici je již mimo okno.
- Do uzávěrky se opravy potvrzených výsledků přepočítají a odmítnuté výsledky vyřadí. Po uzávěrce běžné doručení pořadí ani odznaky nemění. Výjimkou je výslovná administrátorská oprava se zdůvodněním, provozovatelem, očekávanou revizí, idempotentním klíčem a neměnným auditem; bez změny XP.

## Implementace, kterou kontrolovat

Evidence soutěžního dne vychází ze shodného oficiálního výsledku, herního runu a potvrzeného atomického result command. Nevychází z klientského součtu, analytiky nebo XP. SQL počítá nejlepší dvacítku a shody, uzávěrka uchová konečný snapshot a idempotentně přidělí odznaky. Otevřený měsíc má servisní reconciliation pro obnovení evidence; po uzávěrce se používá pouze auditovaná oprava.

Veřejný GET `/api/competition/monthly?month=2026-11` používá stávající přihlášení a anonymizaci pořadí, nevrací UUID soupeřů a má `Cache-Control: no-store`. Zobrazuje první stovku a vlastní výsledek; společné umístění musí zůstat správné i u hráče mimo první stovku.

Měsíční soutěž je čtvrtý pohled v Pořadí: **Výzva / XP / Týdenní soutěž / Měsíční soutěž**. Zachovat Tiskařskou dílnu, Fraunces pro wordmark, stávající významy ikon a fungující herní desku. Dnes se nepřestavuje. Detail pravidel a započtených dnů se otevírá na vyžádání; hlavní pohled ukazuje vlastní místo, body a postup.

## Schválené odměny

Obě skutečné kolekce jsou v `public/rewards/monthly/collections.json`, originální obrázky v `public/rewards/monthly/2026-{11,12}/`. Žádné generické medaile místo těchto ilustrací.

| Kolekce | Místo a postava | Přesná schválená hláška |
| --- | --- | --- |
| Listopad | Král listopadu · kaštan | Korunu mám. Rukavice jsem zase někde nechal. |
| Listopad | Rytíř listopadu · dubový chochol | Příště bych prosil nepromokavé brnění. |
| Listopad | Kníže listopadu · žalud | Na pódium dojdu. Do toho listí už ne. |
| Prosinec | Král prosince · perník | Prosím vystavit. Neochutnávat. |
| Prosinec | Rytíř prosince · vykrajovátko se skořicovým mečem | Letos hlídám cukroví. Zatím chybí šest kousků. |
| Prosinec | Kníže prosince · zvoneček | Cinknu jen jednou. Doma už všichni spí. |

Odkazy po dosazení potvrzeného preview originu: `/?open=monthly`, `/?open=monthly&panel=awards&collection=2026-11`, `/?open=monthly&panel=awards&collection=2026-12`. Náhled kolekce není získaná odměna. Ověř označení „Získáno“, zvětšení, Escape a návrat fokusu, správný měsíc i přepnutí kolekcí.

## Skutečná data, scénáře a QA hodiny

Bez parametru `monthlyScenario` používá měsíční pohled skutečné izolované API. Parametry `monthlyScenario=upcoming|empty|under20|over20|ties|provisional|closed` jsou výslovně označené **čtecí snímky z lokálního SQL testu**; nepoužívat je jako důkaz živého backendu ani získání odznaku. Stejně tak starší screenshoty a historické rollback testy nenahrazují nový celý průchod.

Pro budoucí listopadová a prosincová data existuje chráněný `POST /api/qa/monthly-control`: `status`, `clock`, `finalize`. Dostupnost vyžaduje přesné preview prostředí/větev/testovací DB, zapnuté QA a samostatný secret. Čas musí být s časovou zónou a v povoleném intervalu listopad 2026 až začátek ledna 2027. Server a označené databázové požadavky používají jeden testovací čas; skutečný průběh herní časomíry dál běží. Klientské hlavičky nemohou v produkci tyto hodiny zapnout.

Místní secret je `C:/Users/prouz/.codex/.chatgpt-projects/g-p-6aac5023adc48191bd66be037edff741/monthly-evidence/monthly-qa-control.secret`; **hodnotu nevkládat do dokumentace, veřejného chatu, klienta, trace ani repozitáře**. Není to hráčské heslo. Běžné hraní secret nepotřebuje. Ověřený klientský posun QA času vydrží i restart offline; po více než 24 hodinách bez čerstvých serverových metadat je třeba se nejprve připojit. Produkční čas to nemění. Ovládání hodin používej pouze po koordinaci s ostatními testery; mění společný izolovaný kalendář.

Příklad místního ovládání v PowerShellu, bez vypsání tajné hodnoty:

```powershell
$qaOrigin = 'https://proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app'
$qaSecretPath = 'C:/Users/prouz/.codex/.chatgpt-projects/g-p-6aac5023adc48191bd66be037edff741/monthly-evidence/monthly-qa-control.secret'
$qaHeaders = @{Authorization = 'Bearer ' + (Get-Content -LiteralPath $qaSecretPath -Raw).Trim()}
Invoke-RestMethod -Method Post -Uri "$qaOrigin/api/qa/monthly-control" -Headers $qaHeaders -ContentType 'application/json' -Body '{"action":"status"}'
```

Po dohodě může stejný příkaz místo těla `status` použít `{"action":"clock","now":"2026-12-01T12:00:00+01:00"}` nebo `{"action":"finalize"}`. Změna hodin neodstraňuje výsledky a neotevírá již uzavřené kolo. Secret nepředávej jako globální hlavičku prohlížeče. V produkci tento endpoint není dostupný.

Syntetické hráčské přihlášení a browser session soubory jsou mimo Git v `C:/Users/prouz/.codex/.chatgpt-projects/g-p-6aac5023adc48191bd66be037edff741/monthly-e2e-live-20261028/`: `private-synthetic-accounts.json` a `private-browser-{A,B,C}.json` (v soukromém souboru je i hotový účet D). Jejich obsah není součástí veřejného reportu. Místní Codex může po pověření načíst pouze určený syntetický účet; cloudové Astře musí uživatel bezpečně poskytnout jméno a heslo testovacího účtu samostatně. Neposílat service-role klíč ani celý soubor s tokeny. Čerstvý účet D je skutečně založený a ověřený s nulovým prosincovým skóre.

## Výsledky ověření a konečný stav

Veřejný browser/API E2E má **PASS**. Nešlo o fixture: účty vznikly skutečným UI, řešily dodané oficiální desky přes nativní herní pipeline, odesílaly veřejné API a četly živé pořadí. Žádné vložení bodů do ledgeru ani mock výsledků, pořadí nebo katalogu. Část běhu se bezpečně obnovila po zastavení automatizace; původní důkazy i skutečné účty zůstaly zachované. První skutečný prázdný měsíc je doložen samostatně.

| Účet | Listopad | Skutečný odznak | XP po celém testu |
| --- | --- | --- | --- |
| `MQA-5a3327-A` | 2400 bodů, 23 platných / 20 započtených dnů, společné 1. místo | Král listopadu | 2840 včetně následné prosincové Daily |
| `MQA-5a3327-B` | 2400 bodů, 20 dnů, společné 1. místo | Král listopadu | 2000 |
| `MQA-5a3327-C` | 100 bodů, 1 den, 3. místo | Kníže listopadu | 200; pozdní další Daily přidala běžné XP, nikoli listopadové body |
| `MQA-5a3327-D` | nový prosincový účet | žádný | 0 |

Testovací hodiny běží od **3. 12. 2026 poledne Europe/Prague**. Listopad je uzavřený, prosinec otevřený. A má v prosinci 120 bodů za jednu skutečnou Daily; D má 0 bodů a 0 dnů pro vlastní QA. Hodiny neposouvej bez koordinace, listopad nemaž ani neotevírej kvůli opakování.

Ověřeno: čistá Daily 120, nápověda 100, skutečné opakování a opakované doručení bez dalších bodů; Extra / trénink / volná hra / Archiv / Tajenka bez měsíčních bodů; více než 20 dnů a shody 1–1–3; skutečná offline fronta a zachování původního data; synchronizace před i po 48hodinové uzávěrce; uzávěrka před hranicí 0, po ní 1, opakování 0; skutečné odznaky a vlastnictví po čerstvém přihlášení. XP při přidělení odznaků **A 2740→2740, B 2000→2000, C 100→100**. C až následně získal běžných 100 XP za pozdní Daily, ale jeho měsíční skóre i bronz zůstaly stejné.

Skutečný service worker a úplný restart prohlížeče offline prošly **8/8**: uložená oficiální Daily, všech šest ilustrací a prosincový čas dokončení bez mockování Date. Při reprodukci na Windows používej krátký adresář browser profilu v Temp; příliš dlouhá cesta způsobovala chybu nativního CacheStorage. To není důkaz chyby aplikace. Fyzická OS instalace PWA ani fyzický Fold nebyly testované.

Důkazy v repozitáři:
- `release-evidence/monthly-e2e-20261028/public-e2e-report.json` — skutečné odpovědi, herní události, před/po uzávěrce a vlastnictví; bez hesel/tokenů.
- `release-evidence/monthly-public-e2e-initial-empty.json` — skutečný počáteční prázdný měsíc.
- `release-evidence/monthly-final-isolation-verification.json` — konečná data a zachování původních testovacích záznamů.
- `release-evidence/monthly-e2e-20261028/final-client-authority.json` — finální runtime: skutečných 2840 XP v API i UI, oprava staré lokální 515→15, D stále 0 a listopadový odznak zachován.
- `release-evidence/monthly-e2e-20261028/pwa-cold-summary.json` — skutečný studený offline start.
- `release-evidence/monthly-e2e-20261028/{under20-mobile,best20-fold,earned-king-mobile}.png` — ověřené skutečné UI.

Soukromé přihlášení je pouze lokálně v `C:/Users/prouz/.codex/.chatgpt-projects/g-p-6aac5023adc48191bd66be037edff741/monthly-e2e-live-20261028/private-synthetic-accounts.json`. Nezveřejňovat obsah do PR/reportu. Nový anonymní prohlížeč se může přihlásit jménem a heslem nebo si založit vlastní jasně označený testovací účet; produkční účet sem nepatří.

## Kde navázat v kódu

- `server.py`, `backend/monthly_competition.py`: veřejné pořadí, identita, aktivace a finalizer; `backend/results.py` je atomická hranice potvrzeného výsledku.
- `supabase/migrations/20261028003751_monthly_competition.sql` a `20261028005634_monthly_admin_corrections.sql`: produkční soutěžní evidence, uzávěrka, odznaky a audit. Novější `monthly_preview_*` soubory jsou izolovaná QA/paritní vrstva, nikoli pokyn k plošnému produkčnímu replay.
- `backend/monthly_preview.py`, přesně omezené transportní hlavičky v `backend/db.py` a QA konfigurační kontrola: chráněné testovací hodiny. Hodnota secretu se do browseru neposílá.
- `public/app/monthly/competition.js`, `public/rewards/monthly/collections.json`: živý měsíční pohled a získaná ocenění; kód galerie nesmí náhled vydávat za vlastnictví.
- `tools/test_monthly_competition_e2e.py`: skutečný browser/API průchod, explicitní povolení pouze izolovaných zápisů, oddělený soukromý výstup. Bez neautorizovaného resetu čítačů, skóre či měsíců.

## Doporučené nezávislé QA

1. Před zápisem ověř přesný deployment a izolaci. Bez přihlášení projdi pořadí a kolekce; poté na určeném syntetickém prosincovém účtu dokonči skutečnou Daily a zkontroluj body i dny po obnově stránky a po přihlášení na jiném zařízení.
2. Porovnej čisté řešení a nápovědu, opakování a některý nesoutěžní režim. Měsíční body se nesmí odvíjet od celkového XP ani rychlosti. Narušení současných XP, série, týmů či pozvánek je regresní nález, nikoli nová soutěžní funkce.
3. Zkontroluj vlastní umístění, shody, rozpis nejlepších dnů, počet platných/započtených dnů a maximum. Ověř načítání, chybu, offline stav a přepnutí účtu bez přenosu soukromých dat.
4. Projdi doložený uzavřený listopad, společná ocenění, správnou grafiku a přetrvání získaného odznaku po novém přihlášení. Pro nezávislé testování uzávěrky a offline hrany koordinuj hodiny předem; neměň sdílený testovací čas během jiné rozehrané hry.
5. Ověř 320 a 390 px, zavřený i rozložený Fold v obou orientacích a desktop kolem 1440 px, světlo/tmu. Čtyři záložky musí být zjevně klikatelné, aktivní pohled čitelný, dlouhé názvy bez přetékání. Zkontroluj klávesnici, fokus a detaily ocenění.

## Limity a předání nálezů

Automatický prohlížeč emuluje rozměry; není to fyzický Samsung Fold. Hlavní herní harness blokuje service worker a ověřuje dokončení/frontu v otevřené stránce. Samostatný skutečný service-worker test navíc ověřil úplné ukončení a offline restart prohlížeče, načtení desky i obrázků; samostatně neodesílal další dokončenou hru. Přesnou rovnost s časovou hranicí dokazují deterministické SQL testy; HTTP s běžícími hodinami ověřuje přijetí těsně před a po hranici. Skutečný produkční Vercel cron se v preview automaticky neprovádí; test jej nahrazuje autorizovaným vyvoláním stejného finalizeru.

Prázdný přenos anonymní telemetrie v izolovaném QA má serverový důkaz prázdnosti; skutečný neprázdný přenos má nezměněný limit 12/h. Při opakovaném přihlašování respektovat případné 429 a čekací dobu, nemažte čítače ani lokální příznaky čekajícího přenosu kvůli zelenému testu.

Výstup Astry má uvést testovaný URL/commit, skutečné kroky a rozsah, prioritizované reprodukovatelné nálezy, screenshoty a neověřené části. Bez autorizačního kroku nic nemergovat, neopravovat produkční data ani nespouštět produkční soutěž. Provozní spuštění a rollback jsou samostatně v `docs/monthly-competition-20261028.md` a po uzavření E2E je nutné je aktualizovat podle finální implementace.
