# Nezávislý audit převzetí a slovní stovky — 1. 10. 2026

Audit provedl Codex v novém prostředí na výslovné zadání dokončit zaseknutou práci. Níže se odděluje doložený checkpoint od následné výroby finálních mřížek. GitHub a Vercel byly čteny přes připojené pluginy; databáze se nečetla ani neměnila. Posouzení slov je zděděná individuální redakce modelu, nikoli nově provedený lidský test nebo normativní slovníkové potvrzení.

## Vzdálený stav při převzetí

- Původní pracovní větev `preview/mozkokalypsa-100-candidates-20261001` zůstává na `49ac5aabb83abef215164738c53df298e519a016`; předávací větev `docs/mk100-recovery-20261001` na `a9e5bd9dfde0524312fd610118f3bcbcedc16ee8`.
- Novější skutečně ověřený checkpoint je `work/mozkokalypsa-100-resume-20261001`, commit `dc1fd060db70f38f7419f48dc498686faf5e5707`, 1. 10. 2026 16:02:27 Europe/Prague. Je následníkem `a059308b769133dc5f0abce4ca70311da3677dab` (ověřená interní dvanáctka), `4639e415ff9ef0e5dcdac5f52f5436dc17975be9` (rozpoznávání/reference) a `1c77888cd17d83f36b5e2fed5ba76fdc1bd10c32` (obnova).
- Živý main i přesný produkční alias `hrajproplet.cz` byly ověřeny na `174e0fa2a3e8befd0fe01ac8ba7771f4ece25558`; Vercel `dpl_AiLrqzQwahpqrFRwowAn96XYrTQ8`, `READY`, `target=production`. Nasazení zahrnuje auth úsporu z PR #163. Historický SHA `0c597b9` v předání tedy již nebyl aktuální.
- Preview checkpointu `dc1fd060` má deployment `dpl_Ddz2NHQf58vnLbvNbexGAH4idzeK`, READY: https://proplet-7zphgjwe5-pavel-prouzas-projects.vercel.app. Tehdejší `tools/build_mk100_preview.py` však vytvářel jen informační stránku. READY samo nebylo důkazem hraní nebo validace obsahu.
- Vyhledání souvisejících větví a PRů přes výrazy mk100/mozkokalypsa/100 nenalezlo jinou dokončenou stovku nebo nový PR. Na této pracovní větvi bylo při auditu nula Actions běhů; poslední checkpoint neměl žádné workflow runs.

Provenience: [checkpoint dc1fd060](https://github.com/prouza-hue/proplet/commit/dc1fd060db70f38f7419f48dc498686faf5e5707), [main 174e0fa](https://github.com/prouza-hue/proplet/commit/174e0fa2a3e8befd0fe01ac8ba7771f4ece25558), [původní předání](https://github.com/prouza-hue/proplet/issues/146#issuecomment-5929845590). Údaje jsou snapshot při převzetí, nikoli budoucí tvrzení o stále aktuálním vzdáleném stavu.

## Úplné zadání a hranice

Bylo přečteno issue #146, všech šest komentářů včetně [autorizace stovky 5926660159](https://github.com/prouza-hue/proplet/issues/146#issuecomment-5926660159), `HANDOVER_WORK.md` a `ZADANI_100_DESEK.md` z předávacího SHA. Aktuální zadání žádá celých 100 skutečně hratelných kandidátů v poměru 20/60/15/5, vlny a přibližně 20 cílených závěrových pokusů. Dvanáctka je interní mezník, ne konečný výstup. Autorizované jsou výroba, potřebné úpravy pipeline a izolované preview. Produkční vydání, aktivace dalšího testu a změny výsledků, XP, týmů či postupu nejsou autorizované.

Konstrukční základ je 10×10, 14 slov a 100 buněk bez překryvů; výchozí délkový profil je 5/6/6/6/7/7/7/7/8/8/8/8/8/9. Každá finální deska potřebuje platné cesty, shodu slov/písmen, úplné pokrytí, úplný důkaz jednoznačnosti nad relevantní rozpoznávací množinou, reprodukční evidenci a vlastní stabilní identitu. Solverový limit není PASS. Staré banky/ID/hashe se zachovávají. Použití původní osmičky jako automatických osmi kusů nové stovky není zadáno.

Issue #146 původně řešilo opakování známých slov napříč režimy. Neopravňovalo k neomezenému přidávání tvarů nebo rarit. Novější schválený směr i dokončený pracovní Lexikon v3 se zachovávají; zásobník 1 143 návrhů není náhradou dokončeného lexikonu. Absence v jednom frekvenčním zdroji sama není důvodem k odmítnutí slova. Novost vůči bankám se nevydává za osobní historii hráče.

## Obnova jednotlivých redakčních záznamů

Zdrojový archiv `content/gen6/mozkokalypsa-100/checkpoints/lexical-100-20261001.zip` je přesný checkpoint ze vzdálené revize `dc1fd060`. Má 163 156 bajtů a SHA-256 `d5284b13bffb10922d6fa57ca837755c82d2766571a0c80e61941f231b6c59be`.

Před obnovením byly zkontrolovány hashe všech **pěti souborů** manifestu `CHECKPOINT.json` uvnitř ZIPu, bez chyby. Ze ZIPu byly do jejich původního obsahového adresáře obnoveny pouze dva chybějící redakční soubory, beze změny bajtů:

| Soubor | SHA-256 |
|---|---|
| `editorial-review-001-050.json` | `b06cac19f8a9310158605202ea931e9c70f11bfaccd713a7adecffd4ee507a61` |
| `editorial-review-051-100.json` | `fd0c69a18f351d7eabdc53952604dcc3694898e8a0b396263d09cd27a80ef915` |
| Archivní `lexical-plan.json` | `250f240faa037b275df18b8c5e108c30e6a392d1f7ffdd5a00338588b82ac618` |

Aktuální místní `lexical-plan.json` byl navíc načten a porovnán strukturálně s archivním JSON: úplná shoda. Tím se nezaměňuje shodný obsah JSON se shodou původních surových bajtů po změně konců řádků ve Windows.

Obě redakce obsahují dohromady přesně **100 unikátních záznamů pro ordinals 1–100**. U všech bylo nezávisle ověřeno: přesných 14 konkrétních slov, shodný wordsetHash metodou `tools.gen5.catalog.digest(sorted(normalizedWords))`, profil, neprázdný charakter a důvod výběru, seznam rizik a konkrétní poznámky k jednotlivým slovům. Nulové chybějící záznamy, duplicity nebo neshody s lexical-plan. Všech 1 400 pozic zachovává schválenou délkovou skladbu a `target_eligible=true`.

Autorství a meze původních záznamů zůstávají přesné: první padesátka uvádí `Codex editorial_a (AI)`, druhá individuální modelový redakční úsudek. Nejde o měřenou známost, zábavnost nebo lidskou náročnost; nevzniklo nové normativní slovníkové ověření. Historické geometrické poznámky k reprezentantům v1 nejsou schválením nových mřížek v2.

## Nezávisle přepočtená pestrost a kumulace

| Kontrola slovního plánu checkpointu dc1fd060 před dvěma technickými náhradami | Výsledek |
|---|---|
| Desky / cílové výskyty / odlišná slova | 100 / 1 400 / 1 007 |
| Slova použitá jednou / dvakrát / více než dvakrát | 614 / 393 / 0 |
| Nejmenší odstup přesného opakování | 20 pozic; ANGREŠT na 9 a 29 |
| Nejmenší odstup uložené významové rodiny | 9 pozic; STRAŠÁK 14 → STRAŠIDLO 23; žádné porušení prahu 8 |
| Profily | 20 úlevových / 60 hlavních / 15 výzev / 5 vrcholů |
| Každá z pěti vln | 4 / 12 / 3 / 1 |
| Cílené závěrové kandidáty | 20 |
| Tematické štítky v jedné desce | nejméně 9; nejvýše 3 cíle se stejným štítkem |
| Schválená expanze v jedné desce | nejméně 6 slov |
| Explicitně polarizující slova dle individuálních redakcí | 62 desek bez, 37 s jedním, 1 se dvěma |

V hlavních deskách není žádná výjimka nad jeden výslovně označený polarizující výraz. Dva má pouze vrchol 40: MANGOLD a ČEJKA, s konkrétní individuální redakcí. U explicitních pravopisných variant byla ze skupin lexikonu vybrána pouze STŘÍHAT, jednou na 69; obě varianty jedné skupiny se nikde neskládají nebo neopakují. Rodinná kontrola používá uložené redakční rodiny, ne nově vyvozený automatický stemming; podobnosti, které původní rodiny nepopisují, tím nejsou vyčerpány.

HŘEBELEC a kritizované kumulace III byly již cíleně posouzeny v `REFERENCE_AUDIT_20261001.md`. Přijímá se oborové užití, nikoli univerzální hráčská znalost. CITERA/PLOTICE, ŠEROSVIT/DEVĚTSIL/PASTOREK, LOUBÍ/DRTINA a ODDENEK představují výhrady části malého panelu, nikoli konsenzus o neplatnosti. Ani nové redakční štítky nepovyšují každé nebanální české slovo na raritu. Rizika doménových znalostí zůstávají ve všech jednotlivých záznamech výslovná.

Přímý průchod všemi třemi historickými playtestovými bankami našel jedinou shodu: **LAHODNÝ na nové desce 37**, dříve `mk3w2-06`. Jde o přesně přiznanou náhradu problematického samostatného SNĚHOVÁ, nikoli skrytou novost. V celé unii deseti doložených historických/vydaných/rezervovaných zdrojových souborů se opakuje 416 různých slov, v nové sérii na 525 pozicích. Vůči této široké unii je tedy nových 591 zápisů a 875 pozic. Soubory `public/puzzles.json` a `data/puzzles.json` byly při počítání sjednoceny; nejsou dvě nezávislé historie. Unie zahrnuje rezervy i vyřazené historické snapshoty, takže čísla nedokládají skutečnou osobní expozici nebo počet již odehraných slov.

Přepočet uložený v pracovním `work/mk100/remote-lexical-audit.json` obsahuje seznamy zdrojů, přesné překryvy a jednotlivé rarity. Samotný slovní plán a jeho redakční coverage **neprokazují** platnost finálních mřížek, robustní závěr ani hratelnost preview. Tyto důkazy musí vzniknout samostatně a být navázány na konkrétní nové obsahové hashe.

## Co při převzetí nebylo hotové

Samotný checkpoint uváděl nehotovou banku. Ověřená dvanáctka v1 byla uchována, ale její podobná morfologie cest vyžadovala konstrukční rozšíření; nesmí se vydávat za finální v2. Zbývající práce: finální mřížky a výběr celé stovky, nezávislý solver, konkrétní geometrická redakce všech 100, katalog, manifestační evidence a skutečně hratelné izolované preview s ověřeným tokem mobil/Fold/desktop. Emulace zařízení není fyzický test. Výroba pokračuje z doloženého slovního checkpointu, bez opakování hotové hromadné revize Lexikonu.

## Dodatek k dokončeným finálním mřížkám v2

Dodatek je navázán na `bank.contentHash=84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab`. Předchozí části výslovně popisují stav při převzetí. Následná výroba vytvořila 100 skutečných desek; původní checkpoint, původní dvanáctka v1 a oba archivní individuální slovní posudky se zachovaly.

Úplný solver prokázal, že palindromický RADAR nemůže mít právě jednu směrovou cestu: její obrácení čte totéž slovo. Oprava je úzká a doložená v `editorial-amendments-v2.json`: na 16 LASER, na 88 SLOKA, obojí ze schválené zásoby, stejného tieru B a délky 5. Samostatný individuální modelový posudek uvádí celých 14 slov a nový wordsetHash každé změněné desky. Rozpoznávací množina ani neměnný Lexikon se nezmenšily; RADAR zůstává rozpoznávaný. Původní posudky se nepřepisují a nesmějí být samy použity jako souhlas se změněnou sadou.

Nezávislý přepočet finálního plánu potvrdil 100 záznamů a nulovou neshodu slov nebo wordsetHashů po použití těchto dvou výslovných náhrad. Finální plán má **1 008 odlišných slov na 1 400 pozicích: 616 jednou a 392 dvakrát**. Nejmenší odstup přesného opakování zůstává 20, uložené rodiny 9; žádná rodinná mezera pod 8. Profily zůstávají 20/60/15/5, cílených závěrových desek je 20. Individuálně přiznaná znalostní rizika se náhradami nehromadí.

Překryv se třemi starými Mozkokalypsami zůstává pouze LAHODNÝ na 37. Přepočet celé širší historické unie nově dává 417 odlišných sdílených slov / 526 nových pozic; vůči ní je nových 591 zápisů / 874 pozic. Toto číslo nadále zahrnuje rezervované a vyřazené banky a nedokládá osobní historii hraní.

Všechny skutečné mřížky 51–100 byly samostatně prohlédnuty s jejich písmeny, očíslovanými začátky a všemi 14 barevnými cestami. Přímé kontrolní čtení každé cesty nezávisle potvrdilo pravopis cíle, ortogonální návaznost, absenci opakované buňky a přesné pokrytí 100 buněk bez překryvu. Soubor `construction-review-051-100.json` obsahuje **50 jednotlivých posudků** s konkrétními cestami, významovými a konstrukčními riziky, contentHashem a wordsetHashem; všechny jsou přijaty s uvedenými omezeními. To je vizuální redakce modelu, nikoli fyzické hraní nebo měření zábavy a náročnosti.

Redakce odhalila sousední 52/53 se stejnou kanonickou konstrukcí v původním výběru. Kanonizace zahrnuje osm rotací/zrcadlení celé mřížky, každou cestu bez rozlišení směru a pořadí slov. Následná přeselekce z již úplně ověřených poolů problém opravila a zároveň zvýšila pestrost celé stovky. Všech 20 dotčených mřížek ve druhé polovině bylo znovu vykresleno a prohlédnuto; jejich posudky jsou navázané na nové hashe. Úplná banka má nezávisle potvrzeno **62 odlišných kanonických forem, nejmenší odstup opakování 10 a nejvyšší použití jedné formy čtyřikrát**. Nejde tedy o 100 úplně různých tvarových dělení; ani tento přepočet neměří, zda si lidé morfologii osvojí.

`full-verification.json` je navázán na stejný finální bankovní hash a u všech 100 desek uvádí dokončený důkaz `unique` i jedinečné cílové cesty nad 103 836 rozpoznávanými slovy. Vlastní kontrola této redakce přezkoušela konkrétní konzistenci písmen/cest druhé poloviny; úplný solver a nezávislé celobankovní ověření jsou samostatná evidence.

## Závěrové pokusy a jejich skutečné meze

Byly přečteny všechny konkrétní trojice tří plausibilních a šesti citlivostních pořadí u cílených desek 51, 56, 60, 65, 66, 71, 85, 86, 91 a 100, spolu s komponentami zbytku a jednotlivými izolovanými řetízky. Pro změněnou 65 byly načteny nové výsledky na hashi `d65c7ea0e8bf860cf65eaba75f8b41e31d35d98cad2652e352b828402c56665d`; původní čísla se nepřevzala. Její aktuální P25 všech trojic je 13,167, dva různé plausibilní konce dávají dva nebo jeden propojený zbytek a čtyři ze šesti citlivostních konců více komponent.

Finální `endgame-audit-v2.json` se shoduje s hashem banky a konkrétním hashem všech 20 cílených desek. Obsahuje všech **20 × 364 = 7 280 trojic** po nalezení libovolných 11 slov. P25 prefixového tlaku těchto desek je v rozsahu **11,792–18,562; všech 20 je pod referenční mk2-10 s P25 20,167**. Vyšší tlak několika vybraných konců nedokládá odolné ztížení ve všech pořadích, natož lidský účinek. Některé plausibilní hypotézy dávají stejnou trojici a nesmějí se počítat jako nezávislé konstrukční varianty.

Mechanismus se při redakci rozlišuje podle konkrétní evidence: 60, 65 a 86 mají deklarovanou primárně konstrukční hypotézu bez vědomé raritní bariéry. HROUZEK, CEPÍN, KALOUS, PASTINÁK, MELASA, TUŘÍN a KRAJKÁŘKA na příslušných jiných deskách zůstávají výslovná znalostní rizika; nesmějí být vydávána za nově změřenou obtížnost. Vždy se uvádí příslušná konkrétní trojice. Účinek finálního vrcholu i celé cílené pětiny nadále potřebuje lidi.

## Závěrečná kontrola vzdálených hranic

Po finální konstrukční přeselekci byly 1. 10. 2026 přibližně 20:16 UTC znovu čteny [GitHub main](https://github.com/prouza-hue/proplet/tree/main) a přesný Vercel alias `hrajproplet.cz`. Oba zůstávají na **174e0fa2a3e8befd0fe01ac8ba7771f4ece25558**, produkční deployment `dpl_AiLrqzQwahpqrFRwowAn96XYrTQ8`, `READY`, `target=production`, projekt `prj_0XHgnCQhdPS3pPETrxIpoXn0McMG`. Tento audit neprovedl žádnou vzdálenou mutaci ani databázový zápis. Výroba nové banky neaktivovala další playtest ani nezměnila výsledky a postup hráčů.

Reprodukční přepočet finální slovní a tvarové evidence je v pracovním `work/mk100/final-lexical-and-geometry-audit.json`; konkrétní redakční závěry jsou v obsahovém souboru `construction-review-051-100.json`. Neuzavřené otázky lidské známosti, konstrukčního učení a skutečné závěrové náročnosti jsou omezení kandidátů, nikoli skryté technické PASS.
