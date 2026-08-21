# Proplet v3.34 — Generation 4 difficulty calibration

## Rozhodnutí

Směr Generation 4 byl 21. 8. 2026 po kratší kalibraci V3 schválen product ownerem. Produkční `data/puzzles.json`, postup, XP ani leaderboard se v této větvi stále nemění: následuje produkční kandidát, archivní migrace, preview rehearsal a až potom samostatně schválený release.

Po schválení Gen4 se podle zmrazených profilů nepřegenerují jen Free úrovně. Povinný rozsah je:

1. Free banky,
2. denní výzvy,
3. rolling content banka.

Povinný rozsah byl rozšířen také o starter/onboarding, rescue obsah a všechny zdroje nových challenge odkazů. Každá banka musí projít stejnými lexikálními exclusions, exact-cover auditem a migračním QA.

## Co ukázal V2 playtest

Vyhodnoceno bylo 50 dokončených Středních a 40 Těžkých od Pavla, Petry, slaytany, Jakuba a Anety. Pavelovy dříve zaslané výsledky jsou v souhrnu zahrnuté.

| Obtížnost | N | Průměr | Medián | P75 | P90 | Průměr pokusů |
|---|---:|---:|---:|---:|---:|---:|
| Střední | 50 | 2:24.1 | 1:55.1 | 3:02.9 | 4:24.7 | 11.9 |
| Těžká | 40 | 3:07.7 | 2:56.6 | 3:41.2 | 4:50.9 | 17.5 |

Čas a počet pokusů spolu znatelně souvisejí (`r ≈ 0,66`), takže přestřelené desky nejsou jen pomalé čtení — vedou i k více chybným hypotézám.

### Player-normalized obtížnost jednotlivých desek

Poměr nad 1 znamená, že deska byla proti osobnímu mediánu daného testera těžší.

| Střední | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 | #9 | #10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Faktor | 1.83 | 1.04 | 0.90 | 1.12 | 0.61 | 1.72 | 0.88 | 0.67 | 0.84 | 1.31 |

| Těžká | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 | #9 | #10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Faktor | 0.76 | 1.07 | 1.15 | 0.81 | 0.92 | 0.99 | 0.78 | 1.70 | 0.75 | 1.14 |

Z toho plyne:

- Střední #1 a #6 jsou jasně přestřelené; #10 je horní varování.
- Střední #2 a #7 mají vysoký rozptyl a fungují jako accessibility trap pro část lidí.
- Střední #3, #5, #8 a #9 jsou použitelné spodní/střední kotvy; #4 je rozumná horní kotva.
- Těžká #8 je jasný reject. #2, #3 a #10 mohou sloužit jako horní Hard kotvy, ne jako výchozí úroveň.
- Absence nápovědy zvedá absolutní časy, ale nevysvětluje opakující se relativní pořadí problémových desek.

## Revidované principy designu úrovní

### Společné invarianty Gen4

- Žádný návrat k jedné globální Hamiltonovské cestě rozsekané na slova.
- Nezávisle packované cesty, nulová endpoint → other-start chainability.
- Každý target má právě jednu legitimní cestu.
- Celá deska projde širokým exact-cover solverem s jediným řešením.
- Obtížnost se řídí samostatně slovníkem, hustotou desky, křivostí a lokální nejednoznačností.
- Editorial exclusions platí pouze pro budoucí target generation; recognition slovník zůstává široký.

### Střední

V2 přidala správný princip nezávislých cest, ale současně příliš mnoho vizuální práce: velká 8×8 plocha a moc šnekovitých tvarů. V3 proto zavádí:

- 7–8 cílových slov místo 8–9,
- střídání kompaktní 7×7 a řidší 8×8 desky s výraznějšími výkusy,
- nejvýše **2** cesty s `curlRun >= 2`,
- žádnou cestu s `curlRun > 2`,
- průměr zatáček zhruba 0,9–2,35 podle varianty,
- u 7×7 žádné osamocené jednobuňkové díry; u řidší 8×8 nejvýše jedna,
- nejvýše čtyři prázdné komponenty u 7×7 a pět u řidší 8×8,
- převážně Tier A/B; slovník nemá zachraňovat nebo sabotovat geometrii.

Výkus není jen libovolná díra. Musí desku členit do čitelných oblastí; fragmentované jednotlivé zuby jsou zakázané.

### Těžká

Hard má zůstat náročný, ale nesmí od první úrovně fungovat jako Mozkožrout. V3 bridge profil používá:

- 9×9, ale jen 50–56 aktivních buněk,
- 8–9 slov,
- nižší křivost než V2 Hard,
- nejvýše 5 šnekovitých cest a `curlRun <= 3`,
- omezený interval průměrných zatáček 1,8–3,35,
- Tier A/B/C s C jako koření, ne jako dominantní zdroj frustrace.

Pro full generation je vedle křivosti nutné přidat metriku lokální nejednoznačnosti (počet lákavých prefixů a falešných startů). Těžká #8 ukázala, že samotný počet šneků neumí vysvětlit všechny extrémy.

### Snadná a Mozkožrout

- Snadná zůstává rychlá a čitelná; Gen4 invarianty mohou odstranit nucené handoffy, ale nesmí zničit onboardingový rytmus.
- Mozkožrout zůstává skutečný extrém a nebude odvozován z Hard pouhým přidáním buněk. Musí mít vlastní winding a lexikální profil.

## V3 playtest: 6 Medium + 4 Hard

Delší sada snížila návratnost testerů. V3 je záměrně deset úrovní a ukládá dokončené výsledky do `localStorage`, takže ji lze rozdělit do více návštěv na stejném zařízení.

### Experimentální matice

| Úrovně | Profil | Co ověřují |
|---|---|---|
| Medium #1, #3, #5 | compact 7×7 | zda menší vizuální pole sníží čas a falešné pokusy |
| Medium #2, #4, #6 | cutout 8×8 | zda nižší hustota a souvislé výkusy zachovají čitelnost i na větší ploše |
| Hard #1–#4 | bridge 9×9 | zda Hard naváže na Medium bez outlieru typu V2 #8 |

Pořadí Medium variant se střídá, aby se vliv učení nepletl s velikostí desky.

### Výsledek V3

Pět testerů dokončilo všech 30 Medium měření. U Hard jsou čtyři kompletní sady a jedna samostatná úroveň, celkem 17 výsledků.

| Obtížnost | N | Průměr | Medián | P75 | Průměr pokusů |
|---|---:|---:|---:|---:|---:|
| Střední | 30 | 1:14.7 | 1:10.0 | 1:36.1 | 9.5 |
| Těžká | 17 | 2:33.4 | 2:05.8 | 3:08.3 | 11.7 |
| Těžká, čtyři kompletní sady | 16 | 2:16.8 | 2:02.9 | 2:48.2 | 11.6 |

Proti V2 klesl medián Medium o 39 % a Hard o 29 %. U všech čtyř kompletních hráčů byl osobní medián Hard o 53–125 % výše než Medium; typický poměr je 1,91×. Kvalitativně byla V3 opakovaně hodnocena jako zábavnější a méně trestající.

| Úroveň | Medián | Rozhodnutí |
|---|---:|---|
| Medium #1 | 1:07.0 | lehčí Medium |
| Medium #2 | 1:28.0 | core Medium |
| Medium #3 | 0:36.0 | onboarding / relief, ne core |
| Medium #4 | 1:18.9 | core Medium |
| Medium #5 | 1:13.1 | použitelná s vyšší individuální variací |
| Medium #6 | 1:31.5 | horní Medium kotva |
| Hard #1 | 2:41.5 | dobrá obtížnost, accessibility trap pro část hráčů |
| Hard #2 | 1:06.4 | příliš lehká pro core Hard |
| Hard #3 | 2:14.6 | horní Hard kotva |
| Hard #4 | 2:03.7 | nejstabilnější core Hard kotva |

Kompaktní 7×7 Medium mělo medián 0:48, cutout 8×8 medián 1:28. Obě varianty zůstávají, ale nejsou zaměnitelné: compact bude přibližně 25–30 % banky, soustředěný na začátek a relief úrovně. Cutout 8×8 tvoří hlavní Medium profil.

### Vyhodnocení approval gate

Absolutní časy jsou bez nápovědy horní odhad. Pro schválení profilu chceme současně:

- Medium typicky přibližně 60–120 s; jednotlivá horní kotva může být delší, ale ne opakované 5+ minutové zdi,
- Hard uvnitř hráče zřetelně nad Medium, typicky přibližně 120–210 s,
- medián Hard alespoň zhruba o 30 % nad mediánem Medium, bez skoku k Mozkožroutu,
- žádný opakující se levelový outlier s player-normalized faktorem nad 1,5,
- kompaktní i cutout Medium musí být subjektivně čitelné; výhra jen jedné varianty je validní výsledek, ne důvod je uměle míchat,
- kvalitativní feedback nesmí opakovat „moc velká deska / moc šneků“.

Gate prošel. Malý vzorek není vydáván za statistickou jistotu, ale společně s kvalitativním feedbackem a výrazným posunem proti V2 je dostatečný ke zmrazení směru. Další velký veřejný playtest se před masovou generací neplánuje.

### Lokální nejednoznačnost

Nový audit `gen4-local-ambiguity-v1` počítá krátké slovníkové prefixy na nevracejících se cestách, odečítá legitimní prefixy targetů a zvýrazňuje alternativní větve přímo u target startů. Na V3 správně seřadil Hard #2 jako nejlehčí (`6.833`), Hard #4 jako core (`7.306`) a Hard #3 jako nejvyšší lokální tlak (`11.167`). Metrika je ranking signal, nikoli převodník na sekundy; používá se společně s velikostí desky, křivostí a slovníkem.

Source of truth finálních profilů je `data/gen4_profiles_v334.json`.

Tvrdé ambiguity intervaly jsou kalibrovány pouze pro Medium a Hard, kde máme lidská data. U Easy a Hardcore se metrika povinně měří a reportuje, ale široký bezpečnostní interval se nevydává za lidsky ověřený časový prediktor. Starter a rescue používají prověřenou 6×6 Easy geometrii; jejich lehkost zajišťuje Tier A slovník a nižší strop lokální nejednoznačnosti, nikoli oslabení uniqueness testu.

## Úplné pokrytí aktivního obsahu

Release candidate musí obsahovat přesně **1 261** nových Gen4 desek:

| Banka | Skladba | Počet |
|---|---|---:|
| Starter | onboarding | 1 |
| Rescue | streak rescue | 30 |
| Free | 4 × 200 | 800 |
| Daily | 105 Easy + 156 Medium + 104 Hard | 365 |
| Rolling | 17 Easy + 16 Medium + 16 Hard + 16 Hardcore | 65 |

Assembler zachová stabilní Free sloty 1–200, denní rytmus 2× Easy / 3× Medium / 2× Hard a třináct pětilevelových rolling dropů. Rolling kandidát zůstává `releaseEnabled: false`, bez aktivačního data, dokud Pavel neschválí finální preview a konkrétní release datum.

Původní návrh jednotného dvanáctideskového cooldownu byl při full-bank auditu zamítnut jako matematicky nesplnitelný: Free Easy má 200 desek a nejčastější target 42 výskytů, zatímco cooldown 12 dovoluje maximálně 16. Gen4 proto používá explicitní kontrakt podle způsobu spotřeby a šířky slovníku:

| Sekvence | Předchozí desky bez opakování targetu |
|---|---:|
| Free Easy / Rescue | 3 |
| Free Medium | 8 |
| Free Hard / Hardcore | 12 |
| Daily | 5 |
| Rolling | celý pětiúrovňový týdenní drop |

Spacing se kontroluje při společném sestavení shardů a podruhé nezávislým strict validátorem. Nejde o změkčení uniqueness: každá jednotlivá deska nadále musí mít právě jedno široce ověřené exact-cover řešení.

### Výsledek úplné generace

Pozastavený kandidát obsahuje všech **1 261** desek. Strict validator ověřil přesné počty, cesty, pokrytí masky, endpoint adjacency, profily, exclusions, cooldowny, globálně unikátní ID i board hashe; výsledek je 0 chyb. Runtime část má 1 196 desek a oddělená Rolling rezerva 65. `LUNOCHOD` ani `FRISBEE` se v žádném targetu nevyskytují.

Nezávisle přepočtená lokální nejednoznačnost potvrzuje gradaci:

| Profil | N | Medián | P75 | Maximum |
|---|---:|---:|---:|---:|
| Easy | 305 | 7,46 | 9,00 | 15,00 |
| Medium compact | 104 | 7,68 | 8,43 | 10,14 |
| Medium cutout | 252 | 8,06 | 9,22 | 11,71 |
| Hard bridge | 304 | 10,17 | 11,06 | 13,25 |
| Hardcore | 200 | 14,58 | 17,01 | 26,58 |
| Rescue | 30 | 6,18 | 6,60 | 7,71 |

## Archiv bez starého hratelného obsahu

Runtime po přechodu nesmí obsahovat `legacyFree`, `legacyDaily` ani `previousDaily`. Archiv má tři vrstvy:

1. **Neměnný cold source** — přesná stará těla zůstanou obnovitelná z Git commit/blobs a kontrolních SHA-256, ale nebudou doručována hráčům.
2. **Nehratelný metadata katalog** — hash obsahu, původní ID, generace, banka, obtížnost, slot, rozměry a počet targetů; bez písmen, odpovědí a cest.
3. **Historické statistiky** — výsledky, runs a attempts dostanou `content_key` a lineage. Nejednoznačně znovupoužité legacy ID se nesmí označit jako exact.

Vygenerovaný katalog má 4 594 unikátních obsahových hashů a 4 599 kontextů. Nemá pole `letters`, `answers`, `path` ani `mask`. Cold source ukazuje na produkční commit `a1904574324c714526a5303f6584f3174a789f8e` a přesné Git bloby `data/puzzles.json` / `data/rolling_content_v1.json`; gzip kopie mají samostatné SHA-256.

Starý challenge odkaz se po cutoveru nebude snažit otevřít odstraněnou desku. Vrátí archivní souhrn/tombstone; historický výkon a leaderboardové statistiky zůstanou zachované. Nové challenge odkazy smějí vznikat jen z aktivních Gen4 zdrojů.

## Lexikon

Soubor `data/target_generation_exclusions_v334.json` je jediný explicitní source of truth pro budoucí target generation. Nově obsahuje také `LUNOCHOD`. Vyřazení:

- nemění recognition slovník,
- nemaže historická puzzle,
- nezasahuje současnou produkční banku,
- musí být použito při generování Free, Daily i rolling banky.

## Safe release po schválení směru

1. Zmrazit geometry, vocabulary a local-ambiguity guardrails. **Hotovo.**
2. Pozastavit vydání Gen3 rolling banky plánované od 24. 8., pokud nebude nahrazena Gen4.
3. Vygenerovat Free, Daily, rolling, starter a rescue banku. **Hotovo v pozastaveném kandidátu.**
4. Exact-cover a target-path uniqueness audit 100 % desek. **Hotovo, 1 261/1 261.**
5. Ověřit exclusions, cooldowny a duplicity napříč všemi bankami. **Hotovo, 0 chyb.**
6. Vytvořit hashovaný metadata katalog a studený archiv původních bank. **Hotovo jako release artifact; zatím neaplikováno do produkce.**
7. Doplnit explicitní content lineage do výsledků před odstraněním legacy bodies z runtime.
8. Migration QA: dokončené sloty, XP, historie, rozehrané legacy hry a challenge archive fallback.
9. Preview deploy, smoke test, runtime/build log check.
10. Teprve po explicitním schválení sloučit do `main` a znovu ověřit production health.
