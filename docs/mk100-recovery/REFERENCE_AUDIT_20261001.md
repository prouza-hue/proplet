# Mozkokalypsa: reference a skutečný závěr po jedenáctém slově

Datum 1. 10. 2026. Výchozí předání `a9e5bd9dfde0524312fd610118f3bcbcedc16ee8`.
Čtené zdroje: `HANDOVER_WORK.md`, `ZADANI_100_DESEK.md`, obě evaluace v tomto
adresáři, nezměněné banky `data/playtests/mozkokalypsa-v2.json` a
`mozkokalypsa-v3.json`, dokončený pracovní Lexikon v3 a výrobní nástroje.
Banky, slovník ani produkční data tento audit nemění.

## Co ukázal rozbor referencí

Skutečné III je `mk3w2-01…08`. Starší `mk3v3-*` není hraná edice III.
II a III mají stejný rozměr, 14 slov, délkový profil 5/6/6/6/7/7/7/7/8/8/8/8/8/9
a úplné pokrytí 100 polí bez sdílení buněk. Prostorové promíchání se ve III
zvýšilo, ale naměřený konec zrychlil: stejný panel sedmi hráčů 15,7 % → 10,8 %
času na poslední tři slova. Údaj není hodnocením nové kandidátní stovky.

Výrobní `tools/mozkokalypsa_lab.py::residual_metrics` hodnotí začátek a zbytky
po odstranění 3 a 7 slov. **Po odstranění 11 slov nehodnotí nic.** Následná
interwoven výroba navíc preferuje axisReentries/crossContacts celé mřížky
před tímto původním skóre. Zvyšování těchto hodnot proto není doloženým
řešením problému poslední trojice.

Přes všech 364 možných trojic zbylých cest na každé referenční desce:

| Reference | Medián sousedství různých slov | Medián nekonsekutivních dotyků uvnitř cest | Podíl jednotlivých cest tvořících izolovaný prostý řetízek |
|---|---:|---:|---:|
| mk2-09 | 2 | 4,5 | 7,42 % |
| mk2-10 | 2 | 7 | 0 % |
| mk3w2-01 | 2 | 4 | 5,13 % |
| mk3w2-02 | 2 | 4 | 0 % |
| mk3w2-03 | 2 | 4 | 7,42 % |
| mk3w2-04 | 2 | 4 | 2,56 % |
| mk3w2-05 | 2 | 4 | 7,14 % |
| mk3w2-06 | 2 | 4 | 1,92 % |
| mk3w2-07 | 2 | 4 | 0 % |
| mk3w2-08 | 2 | 4 | 8,79 % |

Dotyk uvnitř jedné cesty znamená pravoúhlé sousedství jejích dvou buněk,
které nejsou po sobě v odpovědní cestě. Prostý izolovaný řetízek je samostatná
komponenta právě jednoho slova, jejíž buňky mají stupeň nejvýše 2. Cesta s
vlastními dotyky sem nepatří. V žádné referenci nezůstane trojice složená ze
tří takových řetízků; tento hrubý indikátor tedy sám nezachycuje rychlé
dočištění známé z telemetrie. Konkrétní písmena jsou nezbytná.

`mk2-09` je kombinace běžné konstrukce a nápadného lexikálního momentu:
EROTOMAN byl poslední u 6/8 hráčů, medián intervalu 38,2 s. Z toho nelze
odvodit obecně lepší geometrii. `mk2-10` má výrazně více vnitřních dotyků
zbytkových cest a žádný prostý izolovaný řetízek; je rozumným konstrukčním
vodítkem. Ani tato korelace v několika referencích není důkazem kauzálního
účinku nebo univerzálně těžkého konce.

## Nový pracovní nástroj

`tools/gen6/mk100_endgame.py` hodnotí skutečný zbytek po 11 slovech. Funkce:

```python
endgame_metrics(board, solver.prefixes, catalog.entries,
                exhaustive=False, seed=20261001, random_orders=6)
```

Tři odlišné hypotézy pořadí: jednodušší geometrie napřed; známější redakční
tiery napřed; kombinace tieru, počtu zatáček a délky. Šest dalších pevných
pseudonáhodných pořadí slouží jen k citlivostní kontrole. Uniformní pořadí
neoznačujeme za plausibilní lidský model. Záznam uchovává celé pořadí a
konkrétní zbylá slova; nevystačí s jedním vyhovujícím autorským koncem.

Každý zbytek se změří na **nezkrácené zmrazené rozpoznávací množině**:
platné prefixy délky 2–4 mimo správné cílové začátky, alternativní větve
na správných počátcích a kolize počátečních písmen. Současně se doloží
komponenty, samostatné řetízky, vnitřní dotyky a sousedství různých slov.
Volba `exhaustive=True` dokládá všech 364 posledních trojic.

Výběrové skóre používá 40 % minima tří hypotéz, 40 % jejich mediánu a
20 % dolního kvartilu citlivostních pořadí; za prosté izolované řetízky
se penalizuje. Jde o deklarovaný pracovní proxy, nikoli o predikci sekund,
náročnosti nebo zábavnosti. Maximální skóre nepřebíjí jazykovou redakci.
Jednoznačnost musí nezávisle prokázat úplný solver.

Úplný běh 1. 10. proběhl na novém snapshotu `content/gen6/mozkokalypsa-100/recognition-words.txt`:
103 836 slov; SHA-256 bajtů `5d747a525609f648296297850223f3b01a8e628f75e1ca6ec9e1da9d919002f7`;
solverový digest seřazených slov `eaf808cd425024e1f84df62498abb8f7de9a39257b70dc0d069ac6f4d0cd05c1`.
Snapshot byl následně potvrzen jako bajtově totožný se samostatně rekonstruovaným
`full_words()`, včetně připnutého úplného runtime wordfreq fondu a variant.
Všech deset referencí má doloženo 364 trojic (celkem 3 640 konkrétních zbytků):

| Reference | Prefixový tlak: dolní kvartil všech trojic | Medián všech trojic | Minimum tří hypotéz | Výběrový proxy | Naměřené tempo závěru |
|---|---:|---:|---:|---:|---:|
| mk2-09 | 15,25 | 21,88 | 28,17 | 27,51 | 1,35× |
| mk2-10 | 20,17 | 24,42 | 22,00 | 23,42 | 1,38× |
| mk3w2-01 | 13,83 | 19,21 | 11,42 | 19,91 | 0,36× |
| mk3w2-02 | 14,58 | 18,92 | 22,00 | 30,67 | 0,33× |
| mk3w2-03 | 17,65 | 21,71 | 18,00 | 23,55 | 0,54× |
| mk3w2-04 | 15,58 | 21,75 | 12,17 | 18,13 | 0,23× |
| mk3w2-05 | 11,92 | 16,54 | 11,83 | 11,96 | 0,60× |
| mk3w2-06 | 16,25 | 20,50 | 17,33 | 26,44 | 0,24× |
| mk3w2-07 | 13,33 | 16,79 | 14,67 | 16,18 | 0,59× |
| mk3w2-08 | 11,42 | 14,75 | 11,67 | 13,85 | 0,42× |

Naměřené tempo je pouze historická telemetrie z evaluací: průměr času na
poslední slovo vůči prvním jedenácti. II je panel osmi dokončivších, III sedmi;
tabulka slouží ke kontrole metriky vůči referencím, ne k čistému kauzálnímu
srovnání stejných lidí. Statické hodnoty jsou novým offline výpočtem.

**Proxy selhává jako samostatný prediktor lidského závěru:** III/02 a III/06
dosahují vysokého výběrového skóre, přesto mají v historické hře velmi rychlé
dočištění. II/10 má nejsilnější dolní kvartil a medián napříč všemi trojicemi,
což je odolnější konstrukční vodítko než nejlepší autorský konec. Nic z toho
nesmí být označeno za vyřešený nebo hráči ověřený těžký závěr. Pro cílenou
pětinu nové série kombinujeme více řádů, exhaustive robustnost, písmena,
geometrii a redakční posouzení; účinek se musí ověřit hraním.

Výstup uvádí také počet odlišných trojic jednotlivých hypotéz. Stejná poslední
trojice v několika pojmenovaných pořadích není vydávána za několik odlišných
konstrukčních důkazů. Referenční III/05 má dva odlišné plausibilní zbytky,
ostatní reference tři; citlivostní pořadí přidávají další zbytky.

Kontroly nástroje: úplnost 364 trojic; každý simulovaný průchod obsahuje
všech 14 slov právě jednou; každá poslední trojice má tři odlišné indexy;
prázdná množina prefixů nevytváří falešné prefixy; oddělení prostých
samostatných řetízků od složených cest s vlastními dotyky.

## HŘEBELEC a redakční rozhodnutí

HŘEBELEC (`L3-W2-0300`) je v nezměněném Lexikonu v3 schválený cílový výraz
tieru C. Individuální uložená evidence dokládá lemma a slovní druh v
Wikidata Lexemes a výslovnou synonymní zmínku v extrakci českého hesla
„hřeben“. Evidence má stupeň `lexical-context`: **není tvrzena samostatná
slovníková definice ani úplná pádová tabulka**. Výklad a gramatické údaje
jsou původní redakční úsudek, nikoli důkaz z uvedené synonymní zmínky.

Dodatečně 1. 10. otevřený veřejný dodavatelský popis
[Ketris — Hřebelec spirálový oboustranný](https://www.ketris.cz/hrebelec-spiralovy-oboustranny_z931/)
potvrzuje současné oborové užití pro pomůcku se zuby vhodnou zejména pro
koně. Pokusy otevřít přesné hledání SSJČ/IJP skončily chybou načtení; žádné
nové normativní slovníkové potvrzení z nich netvrdíme. Reálné oborové užití
neznamená běžnou znalost mezi hráči.

Produktově je to dobrý kandidát pro jediné vědomě méně běžné slovo, nikoli
výchozí „běžná čeština“ ani povinná rarita. V nové stovce není důvod znovu
vynucovat jeho použití. Nevyřazujeme ho z lexikonu a historickou desku 02
nepřepisujeme. Pokud ho nový kandidát použije, nesmí se tím maskovat
konstrukční závěr a souběh s dalšími úzce oborovými slovy vyžaduje konkrétní
výjimku v redakčním záznamu.

Stejný princip platí pro kritiku CITERY/PLOTICE, ŠEROSVITU/DEVĚTSILU/PASTORKU,
LOUBÍ/DRTINY a ODDENKU. Jsou to konkrétní podněty od malé části panelu,
ne konsenzus o neplatných slovech. III/03 má silný pozitivní průměr a silnou
polarizaci jednoho hráče současně. V hlavní stovce omezujeme **kumulaci**:
nejvýše jeden vědomě raritní nebo úzce odborný výraz v běžné hlavní desce,
bez mechanického přeznačení každého méně banálního českého slova na raritu.

## Stav a otevřená hypotéza

Geometrický i prefixový rozbor referencí a nástroj jsou dokončeny. Strojový záznam
`reference-audit.json` obsahuje přesný plný rozpoznávací snapshot, hash každého
vstupu i všech 3 640 zbytků; statické původní seznamy 26 190/26 893 položek nebyly
použity jako úplný fond.
Nová kandidátní série zůstává bez naměřeného lidského potvrzení závěrů.
Test, účty, odměny a produkční připojení se neaktivují.
