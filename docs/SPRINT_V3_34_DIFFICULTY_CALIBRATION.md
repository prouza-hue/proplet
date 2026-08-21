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
- nejvýše tři prázdné komponenty u 7×7 a pět u řidší 8×8,
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

## Lexikon

Soubor `data/target_generation_exclusions_v334.json` je jediný explicitní source of truth pro budoucí target generation. Nově obsahuje také `LUNOCHOD`. Vyřazení:

- nemění recognition slovník,
- nemaže historická puzzle,
- nezasahuje současnou produkční banku,
- musí být použito při generování Free, Daily i rolling banky.

## Safe release po schválení směru

1. Zmrazit geometry, vocabulary a local-ambiguity guardrails. **Hotovo.**
2. Pozastavit vydání Gen3 rolling banky plánované od 24. 8., pokud nebude nahrazena Gen4.
3. Vygenerovat Free, Daily, rolling, starter a rescue banku.
4. Exact-cover a target-path uniqueness audit 100 % desek.
5. Ověřit exclusions a duplicity napříč všemi bankami.
6. Vytvořit hashovaný metadata katalog a studený archiv původních bank.
7. Doplnit explicitní content lineage do výsledků před odstraněním legacy bodies z runtime.
8. Migration QA: dokončené sloty, XP, historie, rozehrané legacy hry a challenge archive fallback.
9. Preview deploy, smoke test, runtime/build log check.
10. Teprve po explicitním schválení sloučit do `main` a znovu ověřit production health.
