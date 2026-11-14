# Přegenerování zbývající denní banky: Lexikon v3 + Gen6

Zadání připraveno 4. 10. 2026. Stav: schválený směr a konkrétní příprava; nové Daily desky v této práci nevznikly a nic se nevydává do produkce. Datum cutoveru a prvního ostrého soutěžního měsíce není určené. Výroba, technické ověření, redakční posouzení a vydání mají samostatné doložitelné stavy.

## Výsledek, který má další úloha dodat

Vyrobit a nezávisle ověřit zcela novou banku pro všechny dosud neotevřené kalendářní sloty aktuálního denního cyklu od dohodnutého cutoveru do jeho konce. Použít celý schválený Lexikon v3 a skutečný výrobní základ Gen6 používaný pro posledních 300 nových volných desek. Zachovat platné dosavadní výsledky, XP, série, historická data, původní desky a identitu výzvy `daily:YYYY-MM-DD`. Není to úloha na nové hromadné schvalování slov ani na přegenerování minulosti.

Banka pro budoucí měsíční soutěž musí zůstat neveřejná do příslušného dne. Nové rozložení nelze znovu přibalit celé do `public/puzzles.json`, browserového JavaScriptu, service workeru nebo veřejného preview se skutečnými budoucími soutěžními deskami.

## Ověřená baseline

Produkční doména hrajproplet.cz je podle kořenové práce tohoto úkolu svázaná s main SHA `a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db`, Vercel READY `dpl_jT3q2z4oRHEdUAgCuAeRPEJm4Jo6`. Před vlastní implementací znovu ověř aktuální produkční SHA, branch a datové prostředí. Tento dokument není zárukou, že nasazení zůstalo beze změny.

Čtením přesných Git blobů bylo ověřeno:

| Zdroj | Ověřený údaj |
|---|---|
| `data/puzzles.json` | Git blob `500522874270670f9f14963474ee07671645654d`; serverová aktivní Daily banka má 365 desek |
| `public/puzzles.json` | Git blob `b0a23e6e4d997df8b595da4c0bbba25ffb5d0838`; veřejná banka má 366 položek |
| Daily runtime | `dailyGeneration=4`, `dailyRotationSize=365`, `dailyGeneration4From=2026-08-24`, `dailyRotationBaseDate=2026-08-24` |
| Přidaná veřejná položka | `g3-d-007` na konci; historická jednodenní kompatibilita pro 23. 8. 2026, nikoli 366. budoucí soutěžní den |
| Současná kadence | Pondělí/úterý Snadná, středa/čtvrtek/pátek Střední, sobota/neděle Těžká |
| Ověřený resolver | `backend/content.py`, Git blob `61cfa90144e150a74cb4acb08b11cb572bd11449` |
| Runtime rozpoznávání | `word_recognition_v3330.py`, Git blob `fb6da85e93384df89a8818bc214e701d26a9a2fc`; odpovídá zdroji připnuté Gen6 frekvenční vrstvy |

Denní UI dnes skutečně vybírá jen aktuální výzvu. To však neznamená, že jsou budoucí desky skryté: veřejný JSON obsahuje i jejich `letters`, `answers` a `path`. Zveřejnění v nabídce a dostupnost dat jsou dvě různé věci. Přegenerování musí nahradit již odhalené budoucí předlohy novými a zároveň změnit způsob distribuce.

## Přesný význam „zbývající“ a počet

Aktuální první průchod cyklem začal 24. 8. 2026 a končí 23. 8. 2027. Počet nových slotů se odvozuje od skutečného cutoveru, nikoli od konce kalendářního roku nebo čísla 366.

`count = 365 - (cutover_date - date(2026, 8, 24)).days`

Vzorec platí pro cutover uvnitř tohoto prvního cyklu. Pro pozdější datum se musí nejprve stanovit nový plán; nelze vrátit záporné počty nebo nepozorovaně znovu použít původní desky.

Příklady spočítané ze skutečné serverové banky, nikoli určené termíny:

| Ilustrační cutover | Nahrazované původní pozice | Nových Daily | Snadná | Střední | Těžká | Poslední datum |
|---|---|---:|---:|---:|---:|---|
| 5. 10. 2026 | `g4-d-043…g4-d-365` | 323 | 93 | 138 | 92 | 23. 8. 2027 |
| 1. 11. 2026 | `g4-d-070…g4-d-365` | 296 | 85 | 126 | 85 | 23. 8. 2027 |

Nejbližší možný cutover je až po dokončení relevantního QA a bezpečném přechodu klientů, vždy na půlnoci Europe/Prague. Nemusí čekat na začátek soutěžního měsíce, pokud bude hotový dříve. První ostrá měsíční soutěž začne prvním dohodnutým celým kalendářním měsícem po ověření pravidel i nové banky. Tento dokument nenastavuje automatizaci ani datum nasazení.

Výrobní rozsah se nejprve sváže se schváleným kalendářem. Pokud práce přejde přes původně plánovaný cutover, již otevřené dny se zmrazí a vyřadí z kandidátního nahrazení. Nepřepsat je novou bankou kvůli dokončení původního počtu. Dočasně vyrobené nepoužité kandidáty lze uložit mimo soutěžní rozpis, nikdy jim zpětně nepřidělovat veřejné datum.

## Autoritativní Lexikon v3 a výrobní základ

Aktuální main obsahuje vydané zmražené banky Gen6, ale neobsahuje celý pracovní Lexikon v3 ani samostatný výrobní strom `tools/gen6`. Proto se nesmí pracovní wrapper označený v2 vydávat za požadovaný kompletní v3 nebo přepsat celý main starou preview větví.

Přesný zdroj lexikonu je dostupný v zachované větvi PR #150 na SHA `553fb3578c958004b831068dfd268dbcb2a423ab`. Stejné lexikální bajty potvrzuje obnovený výrobní balíček z 2. 10. 2026. Převzít konkrétní výrobní soubory a data, nikoli statickou preview Vercel konfiguraci této větve.

| Vstup | Git blob | SHA-256 nebo význam |
|---|---|---|
| `content/lexicon-v3/working/lexicon.json` | `ccd79a80ad39dac43ca7586a126497ebbf994709` | `7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277`; 4 290 hesel, 4 248 způsobilých pro cíle |
| `content/lexicon-v3/working/manifest.json` | `a6d2021994b4aae1fe947e91ddd7a3473e0268a9` | původ a otisky všech vstupů a výstupů |
| `content/lexicon-v3/working/editorial-reviews.json` | `dc18ca511544d74c5383a9be7aaa260d6063b8ed` | všech 1 143 schválených doplnění; 1 142 přijatých, 1 opravené |
| `content/lexicon-v3/working/recognition-words.txt` | `ff27a8928817aead69d2aa0d4d379823e34a9491` | `4c7de2102bd2f09823a946e2b77bd9ca36766cbeb3fae38eed47e97a05a83215` |
| `content/lexicon-v3/working/variant-groups.json` | `133f79b31bbf1e3e8f2dda305277e452f72c0113` | explicitní pravopisné varianty; nevymýšlet automatické stemové rodiny |
| `content/gen6/round3-eight/wordfreq-cs-runtime.txt` | `3208ebc94f17871dd5564e36d8ba01b66d65b0b5` | `bfc1eb49c6959a7ebbfa5ee9beff74e377e55f59e783445f99447ef8a8e34610`; 94 208 záznamů |
| `content/gen6/round3-eight/wordfreq-manifest.json` | `f7fefc62a3b0ee9fd12daac77c296a5620748054` | wordfreq 3.1.1, původní runtime prahy 2.45/2.85 |
| `tools/gen6/recognition_snapshot.py` | `49df846f4e297be3a751fffd279b877b88080ca9` | sestavení plné zmražené kontrolní sady |
| `content/gen5/profiles.json` | `fd19693fa23f26118b48626536fdf94995e0d840` | schválené profily, verze 3 |

V3 `runtime_approved=false` v historickém pracovním manifestu znamená, že celý tento soubor nebyl sám plošně vydán jako runtime lexikon; neznamená odmítnutí schválených hesel. Zásoba již byla použitá ve vydaném Gen6 obsahu. Zachovat 42 historických cílových výluk, individuální posudky i addendum ZÁŠEVKU. Nevytvářet nový seznam 1 143 kandidátů a nezačínat jejich plošné schvalování znovu.

Nejnovější přesný základ výroby pro Snadnou/Střední/Těžkou je v `Proplet_osvezeni_300_20261002.zip`, Library ID `libfile_04d7e9cd428481919a0be079c404a9e8`. Balíček má 32 047 419 bytů a SHA-256 `56ce8b9fe48f85d7180736aa0ba3745b55be53ad3b94ce61da9114721918457d`. Obsahuje:

- `work-free-refresh/BASELINE.json`, `work-free-refresh/SOURCE_INPUTS_VERIFIED.json`, přesný výrobní snapshot pod `work-free-refresh/tools/`;
- `MANIFEST.json` s otisky všech 461 souborů;
- finální banku 300 desek s `contentHash=7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e`;
- původní redakční a nezávislé technické posudky pro každý konkrétní obsah.

Souhrn obnovy je dostupný i na Git SHA `a58de1a10fc854b9da6a4eb8d615de74b8136d92`, větev `work/free-refresh-300-20261002`, soubory `recovery/free-refresh-300-20261002/COMPLETION.json` a `SOURCE_INPUTS_RECOVERED.json`. Jejich reference na výrobní tooling je `75b177320ffaa6726aa62c0f5d84ee04255349b2`; zdroj tehdejšího produkčního obsahu je `5fc234e8e481950a68a25bf77f0103fab936532f`. Rekonstruovaný emergency inventář není náhradou za originální `SOURCE_INPUTS_VERIFIED.json`.

Při nové výrobě zachovat neměnné V3 bajty a původní důkazy. Manifest původního katalogu kontroluje i tehdejší banky, takže použití nad dnešním main může správně skončit odmítnutím změněných vstupů. Řešením je nový výslovný manifest vstupních změn s aktuálními bankami a vysvětlením, nikoli vypnutí guardů nebo dodatečné přepsání staré provenience.

## Adaptér Daily; nepřepisovat generátor

Gen6 není přejmenování původního `generate_daily_v324.py`. Ten je historický nekanonický writer do vydaných puzzle souborů a pro tuto úlohu se přímo nespouští. Stejně tak se na Daily nepřenáší Mozkokalypsa: 10×10, 14 slov, 2A/6B/6C a pool 24 jsou parametry jejího konkrétního osmičkového pilotu.

Převezmi skutečný výrobní vstup pro poslední Gen6 Snadnou/Střední/Těžkou a doplň úzký Daily adaptér:

1. plánování po skutečných pražských kalendářních datech a výběr stejného profilu pro všechny hráče daného dne;
2. datovaný inventář vydaného, rezervovaného a nového obsahu, včetně Daily, všech obtížností, rolling, Tajenky a playtestů;
3. výběr schválených hesel a geometrie z existujícího základu;
4. samostatná přejímka kandidátů, redakční posudek a nezávislý solver;
5. nové stabilní ID desky, datová vazba a manifest; žádný zápis do produkční banky při výrobě;
6. oddělené sestavení neveřejného serverového balíčku a veřejného denního payloadu.

Použij stávající robustní checkpointy, jediného zapisovatele, per-board procesový limit a odmítnutí změněných vstupů. Přijatá deska se při obnovení znovu negeneruje. Číselné seedy, pořadí přijetí, počty pokusů a všechny parametry uložit. Nový kořenový seed je součást konkrétního výrobního plánu; nedomýšlet, že datum tohoto dokumentu je již uzamčeným seedem. Odvozené seedy mohou vycházet z hashe `[rootSeed, bankVersion, dailyDate, difficulty, attempt]`. Selhaná pozice se nepřeskakuje a nepřeklopí do lehčí obtížnosti.

Nástroj nemá implicitní write target. Výstup jen do explicitního kandidátního adresáře mimo vydané banky. Budoucí název modulu/CLI je součást implementace; tento handover netvrdí existenci dosud nenapsaného `tools.gen6.daily`.

## Kalendář, obtížnost a pestrost

Zachovat současnou týdenní kadenci 2/3/2 a kalibrované limity. Měsíční barevnost soutěže mění vizuální identitu, nikoli délkový/obtížnostní profil Daily.

| Profil | Výchozí kalibrované hranice |
|---|---|
| Snadná | 4–5 slov, 20–24 aktivních polí, délky 4–6, jen tier A, nejvýše 3 čtyřpísmenná slova; 75 % 5×5 a 25 % 6×6 podle pořadí snadných slotů; jednoduché cesty |
| Střední | 7×7, 6–7 slov, 30–35 aktivních polí, délky 4–7, tiery A/B; B 25–50 %, nejvýše 3 čtyřpísmenná slova |
| Těžká | 9×9, 8–9 slov, 50–56 aktivních polí, délky 4–9, tiery A/B/C; A nejméně 10 %, B nejméně 45 %, C 20–35 %, nejvýše 2 čtyřpísmenná slova |

Geometrické limity, počet zatáček, izolované mezery, komponenty a ambiguity intervaly převzít ze skutečného připnutého profilu, ne z textového odhadu. Čtvrtá snadná varianta musí navazovat na její skutečný ordinal, ne na den měsíce.

Výrobní plán má před prvním hromadným během uzamknout tyto počáteční kvalitativní podmínky a doložit kapacitu:

- žádná duplicitní celá deska, totožná slovní sestava nebo přesný tvar dvakrát na jedné desce; pravopisné varianty nesmí být v téže desce;
- alespoň 24 intervenujících Daily mezi opakováním přesného cílového slova v novém kalendářním pořadí, napříč obtížnostmi; na počátku zohlednit skutečně otevřené dny před cutoverem;
- nejvýše 3 výskyty přesného slova v nové nahrazující bance jako výchozí cíl navazující na poslední 300-desek výrobu; nejde o zákaz použít slovo, které už někdy bylo ve volné hře;
- historie ostatních režimů je váha čerstvosti, nikoli důkaz osobní expozice nebo neomezený doživotní zákaz běžných slov;
- témata a rodiny řídit známými metadaty, nevynucovat raritu ani nově vzniklou tematickou kvótu na úkor přirozené češtiny;
- měřit podíl nových hesel, délky, témata, opakování a rozměry za celou banku, po obtížnostech a po měsících; nepřenášet naměřený podíl 81.9/75.9/65.9 % z jiné banky jako automatický PASS.

Při prokázaném kapacitním konfliktu nezměkčovat tiery, slovník nebo solver potichu. Ukaž přesný konflikt a navrhni nejmenší změnu výrobního parametru. Čas ani proxy geometrie samy nejsou důkaz lidské obtížnosti.

## Nezávislé technické a redakční přijetí

Pro každou skutečnou kandidátní desku znovu ověřit bez důvěry v generátorová metadata:

- NFC a přesný český zápis; způsobilé heslo V3, zachované výluky, správný tier a délka;
- platné ortogonální sousednosti bez opakování polí v cestě;
- úplné nepřekrývající se pokrytí masky cílovými slovy, bez izolovaných nepoužitých buněk;
- jedinečnost cílových cest a právě jeden úplný rozklad podle pravidel hry;
- kontrolu plnou zmraženou rozpoznávací množinou včetně V3, pravopisných variant, aktuálního overlay a přesné wordfreq vrstvy; předchozí základ má 103 836 zápisů;
- explicitní stavy solveru unique/multiple/no-solution/budget-exhausted; timeout není PASS;
- doložené profily, odstupy, výskyty, historické a nové kolize identit.

Pokud je současné rozpoznávání nebo overlay jiné než ve snapshotu, sestav novou otiskem svázanou sjednocenou množinu a znovu ověř celou novou banku. Nezúžit rozpoznávání bonusových slov jen kvůli snazší jednoznačnosti.

Nezávislý redaktor přečte každou finální slovní sestavu, vrátí nepřirozené, monotónní nebo špatně zařazené kombinace a sváže posudek s přesným contentHash desky. Náhradní sestava se znovu technicky i redakčně přejímá; původní odmítnutá verze zůstává v evidenci. Reprezentativní hraní na Snadné/Střední/Těžké má ověřit, že profil Daily odpovídá očekávání; AI posudek se nesmí označit za lidský playtest.

## Datované identity a přechod starého runtime

Identita účastnické výzvy zůstává `daily:YYYY-MM-DD`, odměna nejvýše jednou za hráče a den. Nová deska dostane nové neměnné `puzzleId` a obsahový otisk; původní `g4-d-NNN` nesmí začít označovat jiná písmena a řešení.

`generatorGeneration=6` je výrobní verze. Nesahat slepě na `freeGeneration`, globální `contentGeneration` nebo `dailyGeneration`. Současný resolver má explicitní větve generací a nelze ho spravit pouhou záměnou čísla 4 za 6.

Doplnit explicitní rozpis `dailyDate → bankVersion → puzzleId → contentHash` s okny platnosti. Oficiální výzva je vybírána serverovým pražským datem. Všechna historická okna a resolver minulosti zůstanou dostupná mimo pole nových aktuálních desek. Čtení historie nesmí záviset na tom, zda se stará deska stále nachází v browserové `daily` array.

Pro dny před cutoverem zachovat původní puzzleId, tělo, validitu synchronizace a již získané XP. Ke změně minulé oficiální desky vůbec nedochází. Rozehraný předchozí den a legitimní offline fronta se dokončí na původním ID a podle dosavadních časových pravidel.

Pro den od cutoveru je oficiální jedině nový schválený date binding. Současné `server.valid_daily_puzzle_ids` má kompatibilitu starší generace i pro data za cutoverem; tuto širokou výjimku nelze prostě přenést na novou soutěž. Stará, již veřejně dostupná budoucí deska nesmí vstoupit do měsíčního pořadí jako alternativa nové výzvy. Rozlišit:
- legitimní historická/offline synchronizace, která patří před nový cutover;
- stale klient, který pro nový den vybral starou budoucí předlohu;
- již uložený výsledek téhož dne, který nesmí dostat druhá XP změnou puzzleId.

Stale klienta před zahájením oficiální nové výzvy synchronizovat na aktuální date binding; nepřepsat mu rozehranou historickou hru. Pokud dokončí neoficiální starou předlohu, nesmí automaticky vzniknout soutěžní bodový záznam. Případná kompatibilní nesoutěžní archivace výsledku musí být výslovná, oddělená od oficiálního pořadí a beze druhé odměny.

Zachovat datové vazby výsledků, streaks a badge pravidla. Nový date schedule je obsahový plán, nikoli operace nad player/results/rewards tabulkami. Měsíční body jsou jiný účet než lifetime XP.

## Serverová distribuce, offline a bezpečné zveřejnění

Nový soukromý zdroj banky smí být v neveřejném repozitáři/serverovém bundle, pokud z něj Vercel nevytvoří veřejný statický asset. Ověřit skutečné routy, build output a sourcemapy. Pouhé přesunutí souboru z `public/` do jiného adresáře není důkaz nepřístupnosti.

Oficiální denní API vrací pouze povolené datum a vybranou desku s verzí/otiskem. Libovolné budoucí datum, odhadnuté puzzleId, seznam celé banky nebo dotaz mimo publikované okno nesmí odhalit budoucí písmena, masku, cíle nebo cesty. Metadata budoucích barev soutěže a kadence mohou být veřejná.

Cache klíče zahrnují pražské datum a bankVersion. CDN a SW nesmějí po půlnoci vracet předchozí den jako dnešní; nesmějí prefetchovat budoucí soutěžní obsah. Aktuální obsah může být lokálně uložen pro obnovení hry. Návrat po půlnoci musí respektovat serverové datum a stále umět dokončit povolenou rozehranou starší hru.

Předlohy použité v veřejném nebo hráčském preview nikdy nezařazovat jako dosud tajné budoucí soutěžní Daily. Pro produktové preview používat vyřazené kalibrační kusy nebo samostatné fixture identity.

Denní hranice se počítají kalendářem Europe/Prague; nezaměnit je za pevné 24h intervaly UTC. 25. 10. 2026 je pražský den s 25 hodinami a 28. 3. 2027 s 23 hodinami. V obou dnech existuje právě jeden `dailyDate` a jeden oficiální slot. Měsíční uzávěrka je interval od místní půlnoci prvního dne měsíce do místní půlnoci prvního dne následujícího měsíce.

Po posledním naplánovaném dni 23. 8. 2027 se banka nesmí potichu modulo cyklem vrátit na již zveřejněnou první novou desku. Navazující cyklus musí mít samostatný schválený plán nebo explicitní chování při chybějícím obsahu.

## Manifest a konkrétní předávané výstupy

Výrobní manifest má obsahovat: sourceMain/prodSHA, toolingSourceSHA, vstupní a kódové SHA-256, lexiconHash, recognitionHash a velikost slovníku, přesný profil, rootSeed a per-board attempt seeds, bankVersion, cutover, koncové datum, časové pásmo, všechny date bindings, hash každé desky a celé banky, stav výroby/solveru/redakce/hraní, explicitní input deltas a preserved-history hashes.

Výstup další úlohy:
1. neprázdný kompletní soukromý kandidátní balíček všech zbývajících slotů, s počtem vypočteným ze skutečného cutoveru;
2. strojový kalendářní manifest a katalog desek/slov;
3. samostatný technický report pro každou desku a redakční report s opravami;
4. souhrn pestrosti podle obtížností i měsíců;
5. Daily adaptér a serverový dated resolver v izolované implementační větvi;
6. integrační důkazy, bezpečný release/rollback postup a jasná hranice mezi kandidátem a nasazením.

Nové Daily body se před ostrou soutěží nemají ocitnout ve veřejném přílohém ZIPu. Pro uživatelské prohlédnutí se předá souhrn a bezpečná ukázka; úplná banka zůstane v odpovídajícím neveřejném prostředí.

## Smysluplné testy přejímky

| Scénář | Nutný výsledek |
|---|---|
| Celý date interval a každý weekday | správný počet a kadence 2/3/2 bez mezer a duplicit |
| Přesná identita minulých dní | všechny předcutoverové bindings a puzzle bodies beze změny |
| Půlnoc cutoveru | jeden oficiální nový binding, žádná stará budoucí alternativa v sezóně |
| Pražský DST říjen/březen | jeden denní slot i v 25h/23h dni |
| Budoucí date/ID/list API | nezveřejní budoucí obsah |
| Statické assety, SW, sourcemapy | neobsahují neveřejnou banku |
| Stale klient, dvě zařízení | oficiální puzzleId svázané s datem a verzí, korektní obnova |
| Historická offline fronta | neztrácí původní výsledek, neopakuje XP |
| Opakovaný/souběžný completion dne | nejvýše jedna XP odměna a jeden první oficiální pokus |
| Nová deska a starý `daily:date` výsledek | změna puzzleId nedá druhá XP a nesmaže streak |
| Poškozená cesta, alternativní rozklad, solver timeout | kandidát odmítnut, žádný falešný PASS |
| Přerušení/obnova výroby a změna vstupu | validní checkpoint, deterministické identity, změněné vstupy odmítnuty |
| Poslední naplánovaný den | žádné nepozorované opakování první desky přes modulo |

Relevantní runtime gate spustit podle aktuálního `tests/current/manifest.json`. Ověřit skutečný tok výběr Daily → oficiální pokus → dokončení → jednorázová XP → denní/soutěžní pořadí → historie/streak. Žádné syntetické výsledky na osobních produkčních účtech. Mobilní šířky/Fold a desktop ověřit v browseru; viewport není test fyzického zařízení.

## Dokončení a otevřené body

Dokument vychází ze skutečně přečteného main, přesných blobů runtime, zdrojových manifestů zachovaného Gen6 preview a aktuálního README distribuovaného výrobního balíčku. Nový generator/adaptér ani banku jsme v této práci nespouštěli. Místní `exec_command` při přípravě vracel `sandbox provisioning failed`; proto zde není přislíben nebo předstírán nový solver/browser PASS.

Před výrobou zbývá: zvolit reálný cutover po QA, obnovit přesný nejnovější výrobní snapshot, svázat současné input deltas a doplnit Daily adaptér. Před ostrou soutěží navíc ověřit serverovou distribuci neveřejných předloh, date binding a pořadí bez druhých XP. Pevné datum prvního měsíce se určí až podle těchto doložených výsledků.
