# Proplet v3.3 — nezávislý herní review

## Verdikt

Jádro hry je silné: pravidla pochopíš rychle, ale nalezení globálního řešení vyžaduje plánování. Největší výhoda Propletu je kombinace slovní zásoby a prostorové logiky. Největší riziko je opačné: přidávat další systémy rychleji, než se zlepší samotná kvalita puzzle a čitelnost obtížnosti.

## Co už funguje velmi dobře

1. **Daily + rodinný leaderboard** dává přirozený důvod vracet se každý den.
2. **Jednorázová Daily** drží férovost a vytváří malé napětí.
3. **Barevné cesty** dávají po nalezení slova dobrý pocit postupného „vybarvování“ plochy.
4. **XP, levely, streaky a achievementy** jsou lehká meta-vrstva, která nepřekrývá hlavní hru.
5. **Nepravidelné desky + nový winding generátor** odlišují Proplet od obyčejné osmisměrky/Boggle klonu.

## Co bych zlepšoval dál — v pořadí

### P0 — kalibrace obtížnosti podle skutečných hráčů
Dnes obtížnost odhadujeme z velikosti pole, počtu slov, zatáček a dalších heuristik. To je dobrý start, ale skutečná obtížnost se ukáže až z hraní.

Sbíral bych pro každé puzzle anonymní agregace:
- medián času,
- počet chybných pokusů,
- počet použitých nápověd,
- procento hráčů, kteří úlohu dokončí.

Pak lze automaticky přesouvat outliery nebo problémové puzzle vyřadit. **Tohle má podle mě největší potenciál zvednout kvalitu celé hry.**

### P0 — krátký interaktivní onboarding
První spuštění by mělo dát 20–30sekundovou minidesku, na které hra sama ukáže:
1. spoj sousední písmena,
2. diagonála nefunguje,
3. každé políčko se použije právě jednou,
4. cílem je vybarvit celé pole.

Textový návod je horší než jeden řízený tah prstem.

### P1 — nápovědy ve stupních
Současná nápověda je funkční, ale příliš binární. Lepší by byly tři stupně:
1. **Jemná:** délka + první písmeno,
2. **Směr:** zvýrazní startovní políčko,
3. **Záchrana:** ukáže první 2–3 kroky cesty.

Na výsledku lze zobrazit „čisté řešení“ bez nápovědy. Nedával bych tvrdý XP trest dětem; spíš bonus/odznak za čisté řešení.

### P1 — férovější Daily leaderboard
Čas je jednoduchý, ale hráč s pěti nápovědami dnes může porazit hráče bez nápovědy. Doplnil bych:
- ikonu **✨ čisté řešení**,
- počet nápověd,
- jako tie-breaker chyby/nápovědy až po čase, nebo separátní „clean“ medaili.

### P1 — 10×10 potřebuje režim pro malé displeje
Mozkožrout funguje na mobilu, ale na užším telefonu už jsou dlaždice malé. Pokud testy ukážou chybná gesta, přidal bych volitelný **zoom/pan režim** nebo landscape doporučení. Nedělal bych to preventivně, dokud to reálně nebolí.

### P1 — týdenní rodinná liga
Denní leaderboard je zábavný, ale jeden špatný den hodně váží. Týdenní tabulka by sčítala např. počet dokončených Daily + XP a lépe odměňovala pravidelnost.

Ještě lepší je společný rodinný cíl: **„Když dnes Daily dokončí všichni, rodina získá hvězdu.“** Soutěž i spolupráce zároveň.

### P2 — progres achievementů
U zamčených achievementů ukázat progres typu `3 / 5 Daily` nebo `1 / 3 těžké`. Cíl je pak konkrétnější než šedý odznak.

### P2 — report problematického slova
Ani kurátorovaný český slovník nebude nikdy dokonalý. Na výsledkové obrazovce bych později přidal nenápadné **„Divné slovo?“**. Reporty by šly do admin fronty / blacklistu.

### P2 — aktualizace PWA bez překvapení
Místo čekání na zavření aplikace může frontend po detekci nového service workeru nabídnout:
**„Je připravena nová verze Propletu → Obnovit“**.

### P2 — pauza a pravidlo času
Je dobré explicitně rozhodnout, zda čas běží i při zamknutí telefonu / odchodu z aplikace. Pro Daily bych ho nechal běžet (férovější proti „pauzování na přemýšlení“), ale UI by to mělo říct. Pro volnou hru lze pauzu povolit.

## Co bych teď naopak NEpřidával

- power-upy, bomby, wildcards a podobné mechaniky přímo do mřížky,
- měny, shop, lootboxové odměny,
- příliš mnoho denních úkolů,
- veřejný globální leaderboard.

Proplet stojí na elegantním puzzle. Meta-vrstva má hráče vracet, ne změnit hru v dashboard odměn.

## Doporučený další sprint

1. **Telemetry obtížnosti** (čas / chyby / hints per puzzle).
2. **Interaktivní onboarding**.
3. **Stupňované nápovědy + clean solve**.
4. Teprve potom **týdenní rodinná liga** a další sociální prvky.
