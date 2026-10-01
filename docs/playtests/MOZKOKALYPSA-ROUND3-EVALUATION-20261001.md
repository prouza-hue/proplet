# Mozkokalypsa III — vyhodnocení playtestu

Datum: 1. 10. 2026. Datový řez ověřen 08:44 Europe/Prague.  
Experiment: `mozkokalypsa-round3-interwoven-v2`. Supabase: `iopyhluayfszskyqqpuc`.  
Start: 29. 9. 2026 00:00; uzávěrka: 1. 10. 2026 00:00 Europe/Prague. Přesně 48 hodin.  
Ověřený main i produkční SHA: `0c597b980821749fa6d397b04716376aea1aa2e0`.  
Produkční deployment: `dpl_9R9ofNzAdQspYpy5BbSk3RZCVLxW`, READY, alias `hrajproplet.cz`.

## Verdikt

**Třetí kolo zlepšilo zážitek většiny vracejících se hráčů a potvrzuje směr osvěžené české slovní zásoby; problém rychlého dočištění závěru však nevyřešilo a některé kombinace slov dál polarizují.**

Ve stejném vyváženém panelu sedmi hráčů vzrostla zábavnost z **3,73 na 4,05**, náročnost z **3,15 na 3,84** a medián času z **3:17 na 3:57** (+20,3 %). Pět hráčů hodnotilo třetí edici lépe, Michael stejně a BoltKey hůře. Jde o pozitivní produktový signál pro celou novou edici, ne o randomizovaný důkaz izolovaného účinku slovníku nebo propletení.

Poslední tři slova se ale ve stejném panelu hledala v mediánu za **19,3 s místo 21,2 s**; jejich podíl času klesl z **15,7 % na 10,8 %**. Žádná z osmi desek v průměrném agregovaném tempu neudržela konec na úrovni prvních jedenácti slov. V kole II to zvládaly `mk2-09` a `mk2-10`. Novost a složitější prostorové promíchání tedy zvýšily obtížnost hlavně dříve v průchodu, nikoli v jeho závěru.

## Integrita experimentu a odměn

- Databázový čas kontroly byl `2026-10-01T06:44:12.149627Z`, tedy po uzávěrce. Uložené `active=true` samo neznamená dostupnost: RPC kola III kontrolují otevření i uzávěrku; nad pokusy navíc existuje časový trigger. Kolo je účinně uzavřené.
- Poslední událost vznikla 30. 9. ve **23:05:09 Europe/Prague**, téměř 55 minut před uzávěrkou. Žádný pokus, jeho aktualizace, událost ani odměna nevznikly mimo schválené okno.
- Pozvánky kola III jsou přesnou kopií 12 pozvánek kola II včetně slotů, aktivity a rolí; symetrický rozdíl je nula. Všichni mají roli `tester`. Pavel i Petra jsou plnohodnotní členové kohorty.
- Všech osm databázových desek `mk3w2-01` až `mk3w2-08` odpovídá odpověďmi, cestami a obsahovými hashi bance na ověřeném main. Osm hashů je unikátních, všechna `final_puzzle_id` jsou NULL.
- **63 oprávněných odměn = 63 × 200 XP = 12 600 XP.** Žádná duplicita, chybějící odměna, odměna navíc, chybná částka ani odměna po uzávěrce. Neúplné pokusy nemají XP. Účetní stav kola II zůstává 103 odměn / 20 600 XP.
- Proběhlo pouze čtení produkčních dat a vytvoření dokumentace. Žádné syntetické hraní, změna hráčských výsledků, mapování do finální banky, výroba desek ani nasazení.

Playtestové odměny jsou osobní XP v `account_rewards`. Podle produkční release dokumentace nezvyšují skóre týdenní týmové soutěže, která čerpá herní `results`; tato analýza znovu neauditovala celý týmový výpočet.

## Účast

| Metrika | Výsledek |
|---|---:|
| Pozvaní | 12 |
| Začali alespoň jednu desku | 9 (75,0 %) |
| Dokončili alespoň jednu | 9 (75,0 %) |
| Dokončili všech osm | 7 (58,3 %) |
| Rozehrané pokusy celkem | 65 |
| Dokončené desky z pozvané kapacity | 63 / 96 (65,6 %) |
| Obě hodnocení mezi dokončenými | 63 / 63 (100 %) |

Sedm kompletních hráčů: PiettraWal, Michael, Ave, Frau Klein, Kvasmeister, BoltKey a MP. Janak dokončil první tři desky a čtvrtou pouze otevřel (0 nalezených slov, 5,8 s). Pavel dokončil první čtyři a na páté našel jedno slovo (12,0 s). Diss, Umpalump a Petra nezačali. Bez dat o důvodu jejich neúčasti ji nelze vydávat za odmítnutí nové edice.

| Hráč | Dokončeno | Medián času | Náročnost | Zábavnost | Chyby | Návraty dokončených |
|---|---|---:|---:|---:|---:|---:|
| PiettraWal | 8/8 | 2:44 | 4,12 | 4,75 | 20 | 2 |
| Michael | 8/8 | 3:48 | 3,12 | 4,00 | 12 | 3 |
| Ave | 8/8 | 6:07 | 4,38 | 4,88 | 100 | 0 |
| Frau Klein | 8/8 | 4:53 | 4,75 | 4,00 | 31 | 1 |
| Kvasmeister | 8/8 | 4:08 | 3,75 | 4,38 | 63 | 4 |
| BoltKey | 8/8 | 4:03 | 3,38 | 2,62 | 74 | 1 |
| Diss | 0/8 | — | — | — | — | — |
| Umpalump | 0/8 | — | — | — | — | — |
| Janak | 3/8 + 1 rozehraná | 6:22 | 4,00 | 4,67 | 25 | 1 |
| MP | 8/8 | 3:20 | 3,38 | 3,75 | 25 | 0 |
| Pavel | 4/8 + 1 rozehraná | 4:08 | 4,50 | 4,50 | 26 | 6 |
| Petra | 0/8 | — | — | — | — | — |

Kolo II mělo deset aktivních hráčů a osm kompletních, III devět aktivních a sedm kompletních. Rozdíl v účasti není čistým ukazatelem úspěšnosti: liší se délka okna, počet desek i dostupnost konkrétních lidí. Ze zahájených pokusů bylo dokončeno 63/65 (96,9 %); jde ale o výběr těch, které motivovaní hráči vůbec otevřeli.

## Souhrn hry

Z 63 dokončených a ohodnocených desek:

- Medián **4:14**, průměr **4:45**, průměrně 20,4 s na slovo.
- Náročnost **3,89 / 5**, zábavnost **4,11 / 5**. Zábavnost 4–5 mělo 50/63 hodnocení (79,4 %); náročnost 4–5 mělo 44/63 (69,8 %).
- **376 chybných pokusů**, průměr 5,97 na dokončení; šest dokončení bylo bez chyby. Počet tahů navíc není samostatný důkaz frustrace.
- **10 použití nápovědy na třech deskách/pokusech**: Pavel na `01` třikrát (první po 5:16), BoltKey na `03` pětkrát (první po 7:54) a Janak na `03` dvakrát (první po 6:48). Jeden člověk tak použil více stupňů nápovědy; nejde o deset nezávislých problémových desek.
- Žádný reset ani Klidný režim.
- **45 událostí odchodu u 24 pokusů** a **18 návratů u 16 pokusů**. Odchod může znamenat běžné skrytí aplikace; bez další evidence ho nelze zaměnit za frustraci.

Rozložení náročnosti 1–5: **0 / 4 / 15 / 28 / 16**.  
Rozložení zábavnosti 1–5: **1 / 2 / 10 / 26 / 24**.

## Desky a poslední tři slova

V hlavní tabulce je stejně jako v kole II použit vyvážený panel: zde sedm lidí, kteří dokončili všech osm. Janakovy a Pavlovy platné výsledky jsou v celkových metrikách; neúplná matice však nemění pořadí desek. Sloupec „Všichni n“ ukazuje velikost plného vzorku; ostatní metriky jsou ze sedmi kompletních.

| Deska | Všichni n | Medián | Náročnost | Zábavnost | Chyby/desku | Poslední 3 | Podíl času | Tempo závěru |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mk3w2-01 | 9 | 5:08 | 4,43 | 4,29 | 6,14 | 0:19 | 9,4 % | 0,36× |
| mk3w2-02 | 9 | 3:35 | 4,29 | 3,86 | 7,57 | 0:19 | 10,2 % | 0,33× |
| mk3w2-03 | 9 | 6:39 | 4,43 | 4,29 | 6,71 | 0:39 | 11,7 % | 0,54× |
| mk3w2-04 | 8 | 3:46 | 3,71 | 3,86 | 7,29 | 0:14 | 7,1 % | 0,23× |
| mk3w2-05 | 7 | 4:08 | 3,71 | 4,00 | 4,86 | 0:34 | 15,3 % | 0,60× |
| mk3w2-06 | 7 | 3:27 | 3,43 | 4,14 | 4,86 | 0:13 | 7,0 % | 0,24× |
| mk3w2-07 | 7 | 2:38 | 3,14 | 3,86 | 4,00 | 0:27 | 15,1 % | 0,59× |
| mk3w2-08 | 7 | 3:36 | 3,57 | 4,14 | 5,00 | 0:20 | 10,8 % | 0,42× |

Tempo závěru = `(součet času posledních 3 / 3) / (součet času prvních 11 / 11)`. Hodnota 1,0 znamená stejný čas na slovo; pod 1,0 závěr zrychluje. Podíl času je průměr individuálních podílů. Tyto dvě agregace se nesmějí zaměňovat. Čas poslední trojice je rozdíl herního `elapsedMs` při 14. a 11. události `correct`, nikoli rozdíl serverových časů.

Celý vzorek III: poslední trojice v mediánu **21,1 s**, průměrný podíl **11,0 %**, tempo **0,41×**. V celém vzorku II byl podíl 16,3 % a tempo 0,73×. Ve stejném sedmičlenném panelu je srovnání 0,69× → 0,40×. Závěr tedy byl krátký nejen relativně k delší hře, ale i v absolutním mediánu.

Relativně nejlépe drží závěr `05` (0,60×) a `07` (0,59×); přesto obě stále zrychlují. `04` a `06` klesají přibližně na čtvrtinu původního tempa. SKALISKO je na `05` poslední u pěti ze sedmi hráčů — užitečný signál k prověření konkrétního zbytku, nikoli důkaz podařeného těžkého konce. Nejtěžší `03` má v panelu medián 6:39 a náročnost 4,43, ale i její konec zrychluje na 0,54×.

## Srovnání stejných hráčů

Stejných sedm plně dokončivších lidí v obou kolech, každý se stejnou vahou v rámci kola:

| Kolo | Dokončení | Medián | Náročnost | Zábavnost | Chyby/desku |
|---|---:|---:|---:|---:|---:|
| II | 84 | 3:17 | 3,15 | 3,73 | 2,83 |
| III | 56 | 3:57 | 3,84 | 4,05 | 5,80 |

Změna: čas **+20,3 %**, náročnost **+0,68 bodu**, zábavnost **+0,33 bodu** a chybné pokusy **2,83 → 5,80**. Toto srovnání je relevantnější než přímé porovnání všech 103 vs. 63 dokončení z rozdílně složených vzorků.

| Hráč | Zábavnost II | Zábavnost III | Rozdíl |
|---|---:|---:|---:|
| Ave | 4,00 | 4,88 | +0,88 |
| BoltKey | 3,17 | 2,62 | -0,54 |
| Frau Klein | 2,92 | 4,00 | +1,08 |
| Kvasmeister | 4,33 | 4,38 | +0,04 |
| MP | 3,58 | 3,75 | +0,17 |
| Michael | 4,00 | 4,00 | +0,00 |
| PiettraWal | 4,08 | 4,75 | +0,67 |

Pět zlepšení, jedna shoda, jedno zhoršení. Největší zlepšení má Frau Klein, která v kole II kritizovala nedostatečné propletení. Nelze ale tvrdit, že příčinou je právě nová struktura: současně se změnila i slovní banka.

Trojice PiettraWal, Michael a Ave kompletně odehrála všechny tři piloty:

| Kolo | Dokončení | Medián | Náročnost | Zábavnost | Chyby/desku |
|---|---:|---:|---:|---:|---:|
| I | 30 | 1:52 | 2,64 | 3,72 | 2,13 |
| II | 36 | 3:01 | 3,06 | 4,03 | 2,33 |
| III | 24 | 4:11 | 3,88 | 4,54 | 5,50 |

V pilotu I měla tato trojice obě hodnocení u 25/30 dokončení; ve II 36/36 a ve III 24/24. Hodnocení nejsou doplňována ani imputována. Časy I a II odpovídají předchozímu reportu; třetí edice posouvá medián vůči II o 38,9 % a zábavnost o 0,51 bodu. Trojice je ještě menší, výkonnostně vybraná skupina, nikoli populační vzorek.

## Slovní zásoba, propletení a kvalitativní feedback

Banky se objektivně liší: II má 168 unikátních slov a III 112; průnik je **nula**. Uvnitř každé banky se žádné slovo neopakuje. To dokládá novost III vůči II, nikoli automaticky novost vůči všem ostatním režimům Propletu nebo osobní historii hráče.

Rozměr 10×10, 14 slov, plnost 100 polí a průměrná délka **7,14 písmene** zůstaly stejné. Shodná je i relativní délková skladba: na každou desku jedno 5písmenné, tři 6písmenná, čtyři 7písmenná, pět 8písmenných a jedno 9písmenné slovo. Michaelova poznámka o kratších slovech je jeho vjem; parametr se mezi bankami nezměnil.

Prostorové promíchání cest skutečně vzrostlo. Pomocná statická měřítka z odpovědních cest:

| Měřítko | II | III |
|---|---:|---:|
| Sousední pravoúhlé dvojice buněk patřící různým slovům | 37,36 % | 42,36 % |
| Plocha nejmenšího obalového obdélníku / počet buněk cesty | 1,232 | 1,388 |

První podíl se počítá ze všech 180 pravoúhlých dvojic plné 10×10 desky a pak průměruje přes desky. Druhé měřítko se průměruje přes 14 cest a následně přes desky. Obě kola mají každé pole právě v jedné cestě; „propletení“ zde znamená sousedství a obalování, ne sdílení buněk. Tyto proxy nejsou validované míry lidské obtížnosti a nevyvracejí rychlý závěr v telemetrii.

Dobrovolných textových poznámek je **12 od čtyř hráčů**: BoltKey šest, PiettraWal čtyři, Michael jedna a Pavel jedna. Výhrady nelze vydávat za většinový konsenzus, ale nelze je ani utopit v průměru.

- **Pestrost má přímou podporu.** PiettraWal na `01` chválí nová slova a na `05` běžnou skladbu; oběma dává zábavnost 5. Michael popisuje novou kombinaci jako těžší, přitom zábavnost jeho celé osmičky zůstává 4,00.
- **Neznámé není automaticky špatné.** PiettraWal nezná HŘEBELEC a MINCÍŘ, přesto příslušným deskám dává 5. Pavel HŘEBELEC označuje za divný, ale desce dává 4. HŘEBELEC má díky dvěma nezávislým zmínkám prioritu pro jazykovou a produktovou kontrolu; tato analýza sama neověřovala jeho slovníkové postavení.
- **Kumulace odbornějších pojmů polarizuje.** BoltKey kritizuje CITERA/PLOTICE na `01`, ŠEROSVIT/DEVĚTSIL/PASTOREK na `03`, LOUBÍ/DRTINA na `04` a ODDENEK na `05`. Jeho zábavnost klesla z 3,17 na 2,63. U `03` dává jedinou jedničku; z dalších šesti panelových hráčů pět dává 5 a jeden 4. Desku tedy nelze označit za všeobecný neúspěch.
- **Psaní feedbacku má tření.** BoltKey na `04` a `05` výslovně píše, že při hodnocení slova nevidí a zapomíná, která mu vadila. Aktuální kód už nabízí „Prohlédnout dohranou desku“ se zpětným návratem k hodnocení. Nejde o potvrzenou chybějící funkci; doporučení je ověřit její viditelnost a případně mít seznam nalezených slov přímo v hodnocení, bez přepínání. Záznamy nedokládají, zda hráč tlačítko přehlédl, nebo měl konkrétní technický problém.

## Pořadí a adaptace

Na rozdíl od tří rotací kola II měli všichni v III pořadí `01–08`. U kompletní sedmičky klesl medián prvních čtyř z **5:06** na **3:31** v posledních čtyřech; náročnost 4,21 → 3,46, zábavnost zůstala téměř stejná (4,07 → 4,04). To může být důsledek učení, snazší druhé poloviny nebo obojího. Pevné pořadí neumožňuje tyto příčiny oddělit. Nevydávám pokles času za únavu ani za čisté zvykání na nový slovník.

## Doporučení pro osm desek a finální stovku

| Deska | Doporučení | Důvod |
|---|---|---|
| `mk3w2-01` | Zachovat charakter výrazné výzvy; cíleně zkontrolovat kumulaci méně známých slov | Panel zábavnost 4,29, šest lidí dává 4–5; CITERA/PLOTICE jednomu vadí. Konec zrychluje. |
| `mk3w2-02` | Prioritní slovní revize | HŘEBELEC zmiňují dva lidé, panel zábavnost 3,86. Posoudit souběh se ŠTOČKEM/JEHELNÍKEM/PROPUSTÍ, nikoli automaticky všechna slova vyřadit. |
| `mk3w2-03` | Zachovat jako silnou náročnou desku po lidské kontrole | Panel náročnost i zábavnost 4,43/4,29; silná polarizace jednoho hráče. Nepoužívat ji jako důkaz těžkého závěru. |
| `mk3w2-04` | Cílená lehká lexikální revize | Prověřit LOUBÍ/DRTINA a současnou skladbu. Závěr je výrazně snadnější. |
| `mk3w2-05` | Zachovat jako kandidáta hlavní série po kontrole slov | Zábavnost 4,00, protichůdný feedback k běžnosti; nejsilnější, stále však rychlejší závěr v III. |
| `mk3w2-06` | Silný vzor hlavní série | Náročnost 3,43, zábavnost 4,14; neznalost MINCÍŘE sama nepoškodila zážitek. |
| `mk3w2-07` | Zachovat jako relativní úlevu | Medián 2:38, náročnost 3,14, zábavnost 3,86. Pořadový efekt brání tvrzení o absolutně nejlehčí konstrukci. |
| `mk3w2-08` | Zachovat jako vzor hlavní série | Náročnost 3,57, zábavnost 4,14; bez textové výhrady, což samo nezaručuje bezvadnost. |

Doporučení skladby **20 přístupnějších / 60 hlavních / 15 výrazných výzev / 5 vrcholů** z kola II zachovávám jako produktový návrh. Třetí kolo dává lepší slovní a prostorové vzory pro hlavní sérii; nedodalo nový prokázaný vzor těžkého konce. Pro ten zůstávají důležitými referencemi `mk2-09` a `mk2-10`.

Další výrobní práce by měla:

1. Zachovat osvěžení slovníku a cíleně revidovat kumulaci méně známých slov, zejména `02` a `04`. Neslevovat zpět k stále stejnému inventáři a zároveň nevydávat odborný český výraz automaticky za běžný.
2. Oddělit celé herní tempo od obtížnosti zbytku po 11. slově. Pro zhruba pětinu finální stovky stále cílit na smysluplný náročnější závěr; samotné větší prostorové promíchání to podle III nezajistí. Návrh není nově aktivovaná výrobní kvóta.
3. Střídat výzvy a úlevy; nezačít finální sérii nahromaděním všech slovně nejnáročnějších desek. Pro další srovnávací měření rozdělit pořadí, aby byly lépe rozlišitelné adaptace a charakter konkrétní desky.
4. Před plošnou aplikací Lexikonu v3 ověřit přístupnou/střední sadu na méně zkušených hráčích. TOP kohorta podporuje vhodnost pro Mozkokalypsu, ne univerzální vhodnost pro všechny obtížnosti.
5. U každé obsahově upravené desky vytvořit novou identitu/hash; historii III i původní odměny zachovat. Případné převody do finální série teprve samostatně schválit a zabránit dvojím XP.

## Metodika, omezení a reprodukce

- Navázáno na [vyhodnocení II](https://github.com/prouza-hue/proplet/blob/docs/mozkokalypsa-round2-evaluation-20260929/docs/playtests/MOZKOKALYPSA-ROUND2-EVALUATION-20260929.md): integrita, účast, všechny platné výsledky, vyvážený panel pro desky, stejní hráči pro mezi-kolové srovnání, herní časy, nápovědy, chyby, poslední trojice, dobrovolné poznámky a účetní kontrola.
- Supabase pokusy tohoto playtestu nemají sloupce `environment`/`is_test`; použito přesné experimentové ID, schválené pozvánky a kontrola uzavřeného časového okna. Nepřenášeny filtry odlišného experimentu první desky.
- Časy jsou klientský herní čas `elapsedMs`, nikoli nástěnná doba od otevření k dokončení. Celkový čas je finální snapshot, konec se odvozuje z jednotlivých událostí `correct`. U všech 63 dokončení přesně 14 takových událostí, bez resetu; timeline odpovídá konečnému pořadí slov. Mezera před nalezením slova není čistým časem hledání pouze tohoto slova.
- Hodnocení jsou poslední uložený feedback každého pokusu. Chybějící hodnocení ani komentáře se nedoplňují. Mediany času v tabulkách jsou zaokrouhlené na celé sekundy, průměry ratingů na dvě místa.
- 63 desek není 63 nezávislých lidí. Velikost hlavního panelu je sedm. Výkonnostní výběr, novost, nápovědy, XP motivace, rozdílné banky i pevné pořadí omezují zobecnění. Výsledek nepředstavuje A/B test ani důkaz retence.
- Srovnání po hráčích chrání před změnou kohorty, ne před změnou obsahu. Neúčast nebo neúplný průchod bez znalosti důvodu nejsou označeny jako frustrace.
- Hlavní agregace, koncová telemetrie, shoda kohorty, časová hranice a účetní párování nezávisle ověřeny přímo v SQL; souhlasí s lokálním výpočtem. [Kontrolní SQL](MOZKOKALYPSA-ROUND3-VERIFICATION-20261001.sql) je pouze SELECT. [Agregované výsledky](MOZKOKALYPSA-ROUND3-METRICS-20261001.json) obsahují odvozené metriky, nikoli surové účty/UUID nebo dump událostí.

## Neměnné otisky a záznam rozhodnutí

Banka `data/playtests/mozkokalypsa-v3.json`: Git blob `52c11b2d8d8cad520938a7bcabee98b5cfbb3909`, SHA-256 `c412ad3ccb8dc0a651387046389aff055c34ada15c5cf75398c8440c1ce22410`, obsahový hash `b6bfe8034861ad3cad0d3d9057658b046ea85ef172579229da60ab5dd7cdc42f`. Bajtový otisk souhlasí s release dokumentací a DB answer/hash kontrolou.

| Deska | Content hash |
|---|---|
| mk3w2-01 | `7d89fa684797b3a3400c85baaa24c7c92f6e41559ed7e488e5cb0dd5eafe86cf` |
| mk3w2-02 | `edab6900f9564a2c28a1724db50bb9e2a239c9f94147732ffdcf6ec9789ad8ac` |
| mk3w2-03 | `288b6bbaf55ae0963632795a418c0e677edd89610eb6ea2ea2fedc7f8a95d41d` |
| mk3w2-04 | `a2e079b63b7dca65b8a75e0632552ba07034ef199abf755e374a910c89a140f2` |
| mk3w2-05 | `a64e95c3cc1c4de71e410e6127ddd4f68716cd81ca3ef71ab05802027e3838a1` |
| mk3w2-06 | `ca78eaa36a34c96e10d46618809ba1c84387a6bcf39a1aedf683f07343ddc50d` |
| mk3w2-07 | `0601746b88abdb6ffaed5aada2296aba910c34f2f56e4d73c19bf0d11adc6bab` |
| mk3w2-08 | `c6ce9bd7030212f953453d597dbe74556ef6d692e62ef84d72ee0ea75b2ab921` |

**1. 10. 2026:** hotové vyhodnocení a nezávislé ověření; pozitivní doporučení k novému směru, cílené výhrady ke slovům a záporný výsledek hypotézy o těžším závěru. Doporučení nejsou nové uživatelské schválení výroby ani produkční nasazení. Otevřené body: revize `02`/`04`, kontrola slovní kumulace vrcholů, skutečná obtížnost zbytku, přístupnost slov při feedbacku a následné ověření méně zkušené kohorty. Stav hry, databáze, osm ID a odměny zůstaly zachované.
