# Mozkokalypsa — vyhodnocení pilotu a návrh série 100 úrovní

Datum: 25. 9. 2026, kontrola kohorty 21:26 CEST. Experiment: mozkokalypsa-20260922-v1.
Zdroj: produkční Supabase iopyhluayfszskyqqpuc, tabulky mozkokalypsa_attempts/events/invites; zmražená banka data/playtests/mozkokalypsa-v1.json a mapování skupin docs/playtests/mozkokalypsa-verification.json.
Bank blob SHA: 6d05e1824110c7d0fcf7d989412312481c9c77b7. Referenční main při uložení reportu: 06de2b6bec2673fa9f0585465042f8d2a3b0dca3.
Rozhodnutí uživatele: zahrnout Pavla běžně mezi ostatní hodnotitele. Role v produkční pozvánce změněna observer → tester a ověřeno 5 aktivních hodnotitelů. Výsledky, pořadí ani herní metriky nebyly přepsány.

## Závěr
Plná deska 10×10 se 14 slovy je podpořený základ nové série. Plné desky získaly lepší hodnocení zábavnosti než dvě kontrolní desky a u původní zkušené trojice prodloužily řešení přibližně na dvojnásobek. Nepodpořený závěr by byl, že současné skóre přetrvávajících alternativ spolehlivě vytváří dramaticky těžší desky nebo zaručuje náročný závěr. To pilot neukázal.

Doporučení: všech 100 úrovní plných, zachovat 14 slov, přidat pestrost slov i rozložení a střídání náročnosti. Současný výběr ze 24 kandidátů používat jako pomocné kritérium, nikoli jako jediný rozhodovací mechanismus. Vzácnější náročné vrcholy jsou slibné, ale ne plošné zvyšování obtížnosti.

## Vzorek a kvalita dat
- 5 lidí × 10 desek = 50 dokončených pokusů; 45 hodnocení obtížnosti a zábavnosti. Chybí 5 hodnocení PiettraWal, nenahrazujeme je nulou.
- 665 událostí správných nálezů (133 slov × 5 hráčů), 50 finish a 2 hint: 717 načtených událostí pro analýzu průběhu.
- Každý pokus má přesný počet správných nálezů odpovídající celé desce. Čas správných nálezů v revizním pořadí nikde neklesá.
- 48/50 dokončení bez zaznamenané nápovědy, 11 zaznamenaných návratů, 0 resetů, 0 použití klidného režimu. Nápovědy použil Pavel na mk26-01 a mk26-08.
- Sčítáme herní čas elapsedMs, nikoli rozdíl kalendářních časů started_at a completed_at. Časovač rozlišuje pauzy, ale neměří pozornost: ponechaná otevřená hra může čas prodloužit.
- Hodnocení náročnosti: 1 Lehká, 2 Spíš lehká, 3 Tak akorát, 4 Těžká, 5 Pořádná výzva. Zábavnost: 1 Nebavila, 2 Spíš nebavila, 3 Ušla, 4 Bavila, 5 Chci další. Čísla jsou pořadová škála; průměry jsou pouze popisné.
- Mapování: mk26-01/02 control (75/74 polí, 11/10 slov), mk26-03 až 06 full (100 polí, 14 slov), mk26-07 až 10 sustained (100 polí, 14 slov).
- Všichni mají v primární analýze stejnou váhu. Pavel je zahrnut, nikoli oddělen. Původní výběr tří dle XP, pozdější přidání Petry a autorství Pavla zůstávají metodickými okolnostmi.
- Pouze 5 lidí a 10 různých desek; 50 pokusů nejsou 50 nezávislí hráči. Skupiny mají jiná konkrétní slova, i když obě plné skupiny mají shodnou délkovou/třídovou skladbu. Tři prokládaná pořadí nejsou dokonale vyvážená randomizace. Nelze oddělit všechny vlivy slov, pořadí, učení a geometrie.
- O retenci přes 100 úrovní a širší populaci tento jednorázový pilot nerozhoduje.

## Výsledky skupin
Medián časů je ze všech pokusů skupiny; sekundy/slovo = medián poměrů čas/počet slov jednotlivých pokusů. Hodnocení je průměr dostupných odpovědí, nikoli imputace chybějících.

| Typ | Pokusy | Medián času | s/slovo | Náročnost | Zábavnost | Hodnocení |
|---|---:|---:|---:|---:|---:|---:|
| control | 10 | 1:21 | 7.84 | 2.33 | 3.33 | 9 |
| full | 20 | 2:19 | 9.93 | 2.79 | 3.79 | 19 |
| sustained | 20 | 2:24 | 10.30 | 3.12 | 3.94 | 17 |

Při stejném vážení hráčů (nejprve průměr hodnocení každého hráče ve skupině, potom průměr pěti hráčů) je zábavnost 3,40 → 3,80 → 3,95. Směr závěru se nemění.
Hodnocení zábavnosti alespoň 4: control 3/9, full 14/19, sustained 12/17. Výběrová skupina sustained zde není lepší než full.
Medián individuálních poměrů mediánů full/control je 1,88; sustained/full 1,10. Nezaměňovat s poměrem společných mediánů, kde sustained/full je 1,037 (~+4 %).

## Rozdíly mezi hráči
| Hráč | Control medián | Full medián | Sustained medián | Průměr zábavnosti C/F/S |
|---|---:|---:|---:|---|
| Ave | 0:54 | 1:43 | 2:06 | 3.00 / 3.25 / 3.50 |
| Michael | 1:17 | 2:25 | 2:23 | 3.00 / 4.25 / 4.25 |
| Pavel | 2:20 | 2:26 | 2:49 | 3.50 / 3.75 / 4.50 |
| Petra | 5:01 | 6:07 | 5:33 | 3.50 / 3.75 / 3.50 |
| PiettraWal | 0:46 | 1:47 | 1:58 | 4.00 / 4.00 / 4.00 |

Full/control u Ave, Michaela a PiettraWal: 1,92× / 1,88× / 2,34×. U Pavla 1,04× a Petry 1,22×. Po zohlednění počtu slov není full pomalejší u všech.
Sustained/full: Ave +22 %, Michael −2 %, Pavel +16 %, Petra −9 %, PiettraWal +10 %. Sustained není pro každého těžší. Petra má v této skupině vyšší průměr času, ale nižší medián kvůli jedné velmi dlouhé desce — právě proto nepoužíváme samotný průměr.

## Přetrvává náročnost až do konce?
Pro každého hráče a desku: t(k) = uložený herní čas k-tého správného nálezu; T = lastCorrectMs.
Podíl druhé poloviny = (T − t(ceil(N/2)))/T. Podíl závěru = (T − t(N−3))/T.
Kontrolní desky mají jiný počet slov; čisté porovnání závěru dává především full proti sustained, obojí N=14.

- Medián podílu času druhé poloviny: full 45,3 %, sustained 44,3 %.
- Medián podílu posledních tří slov: full 14,3 %, sustained 16,5 %. Tři ze čtrnácti slov tvoří 21,4 % jejich počtu.
- Medián času na jedno ze závěrečných tří slov: full 7,4 s, sustained 8,9 s.
- Mírné zpomalení úplného závěru je vidět; celkově trvalou náročnost ve druhé polovině však nemáme doloženou. Nelze tvrdit, že sustained vyřešil efekt snadného dočištění.
- Cílem není násilně prodlužovat poslední slovo. Důležitá je zajímavá střední část, více příležitostí hledat a uspokojivé zakončení.

## Jednotlivé desky
Identifikátory níže jsou interní ID; hráčské pořadové číslo se liší podle přiděleného pořadí.

| ID | Typ | Medián času | Náročnost | Zábavnost | Hodnocení | Skóre generátoru |
|---|---|---:|---:|---:|---:|---:|
| mk26-01 | control | 1:02 | 2.40 | 3.40 | 5 | 23.20 |
| mk26-02 | control | 1:41 | 2.25 | 3.25 | 4 | 25.39 |
| mk26-03 | full | 2:20 | 2.80 | 3.60 | 5 | 32.04 |
| mk26-04 | full | 2:30 | 2.80 | 3.80 | 5 | 24.60 |
| mk26-05 | full | 2:37 | 2.80 | 3.80 | 5 | 24.55 |
| mk26-06 | full | 2:14 | 2.75 | 4.00 | 4 | 27.87 |
| mk26-07 | sustained | 2:22 | 2.80 | 3.80 | 5 | 32.66 |
| mk26-08 | sustained | 2:35 | 3.75 | 4.25 | 4 | 34.83 |
| mk26-09 | sustained | 2:48 | 3.25 | 4.00 | 4 | 34.43 |
| mk26-10 | sustained | 2:23 | 2.75 | 3.75 | 4 | 33.69 |

mk26-08 je užitečný prototyp náročného vrcholu, ne šablona všech úrovní. U původní trojice trvala 1:51–2:35, Pavel 8:39, Petra 13:29. Přesto Pavel hodnotil zábavnost 4 a Petra 5; celkem dostupná hodnocení 4,25/5. Dlouhý čas tu není automatický důkaz frustrace.
Pavel měl před 12. nálezem (KARAMEL) mezeru 161 sekund, v níž požádal o nápovědu; Petra dlouhé mezery rozložené včetně hledání prvního slova. Jde o interval mezi nálezy, nikoli důkaz, že celou dobu hledali právě následně nalezené slovo.
mk26-09 má nejvyšší medián času z desek (2:48), náročnost 3,25 a zábavnost 4,00; vhodný další referenční bod výzvy.
mk26-06 je příklad plynulejšího plného základu (2:14, zábavnost 4,00), ale každý vzor potřebuje více kandidátů a hráčů, ne kopírování geometrie.

## Slovní zpětná vazba
Michael opakovaně pozitivně hodnotil plnou desku a kontrolní desky vnímal jako prázdnější a lehčí. U plné desky mk26-08 popsal silný první dojem a čas okolo 2,5 minuty jako odpovídající nejvyšší kategorii.
Pavel na mk26-04 upozornil na příliš snadné ukrajování slov po prvním nálezu; to souhlasí s potřebou hodnotit reziduální rozložení, nikoli jen vzhled plné desky.
Ave upozornila u mk26-08 na opakování slov. Pilot má ověřeně 133 unikátních cílových slov, takže uvnitř jeho deseti desek se cílová slova neopakují. Komentář může odkazovat na běžnou banku či pocitově stejné motivy; příčinu jsme samostatně neověřili. Neignorovat jej ani jej nevydávat za prokázanou duplicitu v pilotu.

## Doporučené zadání pro 100 úrovní
Následující počty a pravidla jsou návrh na základě směru výsledků, nikoli statisticky odvozené optimum.

### Základ
- 100 plných desek 10×10, 100 využitých polí, výchozích 14 slov. Délky a třídy vyjít z otestovaného profilu (5–9 písmen, 2×A + 6×B + 6×C); variace počtu slov/délek by byla další neověřená změna.
- Každé pole náleží přesně jednomu cílovému slovu; ověřená správnost cest, jednoznačnost cílových cest a úplného řešení vůči verzovanému kontrolnímu lexikonu. Timeout není úspěšné ověření.
- Zachovat ovládání, nápovědu, klidný režim, lupu, Fraunces a Tiskařskou dílnu. Tento report nemění běžná XP, postup, série ani žebříčky.

### Skladba a rytmus
- 20 přístupnějších plných desek: jasnější vstup a plynulejší rozplétání. Nemusí být prázdné, aby nabídly oddech.
- 60 hlavních desek: plná plocha, několik rozpoznatelných vstupů, zajímavá prostřední část.
- 15 výraznějších výzev: více věrohodných odboček i po několika nálezech a různé možné pořadí řešení.
- 5 vrcholů: samostatně ověřené desky, inspirované rozptylem a dobrou zábavností mk26-08/09, nikoli honbou za maximálním časem.
- Rozvrhnout do 10 bloků po 10. Pracovní šablona každého bloku: 2 přístupnější + 6 hlavních + 2 náročnější; v pěti blocích jedna náročnější nahrazena vrcholem. V prvním bloku bez vrcholu.
- Vstup do série plynulý, náročnější desky průběžně prokládat. Po vrcholu přístupnější deska; nedělat dvě dlouhé špičky po sobě ani monotonní schody až k nehratelnosti. Vnitřní pořadí bloků obměňovat.

### Pestrost slov
- Nejprve kapacitní kontrola vhodného slovníku pro 1 400 slovních pozic. Pracovní cíl alespoň 1 000 různých cílových slov, nejvýše 2 výskyty slova a odstup alespoň 20 úrovní; přijatelnost těchto čísel ověřit před generováním.
- Pokud kvalitní slovník nestačí, upravit cíle otevřeně, ne je naplnit neznámými či nepřirozenými slovy.
- Kontrolovat i podobné slovní základy a sousední témata, nejen přesné shody. Penalizovat nadměrný výskyt slov častých v existující bance.
- Obtížnost stavět na hledání cest a rozložení, ne na slovníkové obskurnosti.

### Výběr geometrie
- Současné selectionScore uchovat jako jednu pomocnou metriku. Nevydávat jeho zvýšení za prokázané zvýšení lidské obtížnosti.
- Pro více modelových pořadí odstranit 3, 7 a 10 slov a vyhodnotit zbylé smysluplné odbočky, propojenost zbylých oblastí a kolik slov se stane ihned izolovanými cestami.
- Penalizovat dlouhou řadu automaticky odkrytých slov již po prvním vstupu. Zároveň zamezit tomu, aby náročnost tvořilo jediné neúměrné zaseknutí.
- Nestanovovat z pilotu přesný práh skóre nebo procentní podíl času posledního slova. Propojenost a reziduální obtížnost jsou hypotézy k další kalibraci.

### Přijímací ověření před celou výrobou
Nejdřív připravit menší reprezentativní výběr napříč navrženými kategoriemi (např. 12 nových kandidátů). Generování není součást tohoto vyhodnocení. V lidském ověření sledovat individuální průběhy, nápovědy a zábavnost; technicky nezávisle ověřit jednoznačnost a slovní kvalitu.
Pracovní záměr pro hlavní desky: většina hodnocení náročnosti 3 a zábavnosti 4–5. Vrcholy mohou mířit na 4–5 v náročnosti, ale musí zůstat zábavné. Nejsou to již schválené tvrdé stop/go prahy.
Časy zkušené trojice kolem 1,5–3 minut na většině plných pilotních desek jsou referenční rozsah, nikoli limit pro jiné hráče. Petra a Pavel ukazují potřebu tolerance výrazně odlišných průchodů.
Teprve po kalibraci vyrobit a redakčně prověřit všech 100. Měřit i návraty a dokončování delší série, protože desetideskový pilot neprokazuje dlouhodobou přitažlivost.

## Co bylo provedeno
Vyhodnocení reálných výsledků, ověření průběhu nálezů, zařazení Pavla mezi běžné hodnotitele a uložení reportu se strojově čitelným souhrnem. Žádná deska nebyla přegenerována, herní kód ani produkční deployment se tímto reportem nemění.
