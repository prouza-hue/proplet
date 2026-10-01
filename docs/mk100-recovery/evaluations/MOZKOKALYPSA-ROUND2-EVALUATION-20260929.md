# Mozkokalypsa II — vyhodnocení playtestu

Datum vyhodnocení: 29. 9. 2026  
Experiment: `mozkokalypsa-round2-20260925`  
Datový projekt: Supabase `iopyhluayfszskyqqpuc`  
Výchozí `main`: `731cd4f13f239485a7552ee8542712c47402dcd7`  
Uzávěrka: 28. 9. 2026 22:00 UTC / 24:00 Europe/Prague

## Verdikt

**Směr je potvrzený, ale všech 12 desek zatím nedoporučuji bez výhrad převést do finální série.**

Plná deska 10×10 se 14 slovy je pro Mozkokalypsu správný základ. Druhé kolo bylo proti prvnímu pilotu u společné zkušené trojice výrazně delší, o něco náročnější a zároveň zábavnější. Slabina ale zůstává: u většiny desek se závěr po odkrytí plochy zrychlí. Pouze `mk2-09` a `mk2-10` udržely tempo posledních tří slov na úrovni nebo nad úrovní předchozí části hry.

Pro finální stovku proto doporučuji zachovat dříve navržené vlny **20 přístupnějších / 60 hlavních / 15 výrazných výzev / 5 vrcholů**, ale výběr kandidátů musí vedle celkové délky hodnotit i zbytkovou obtížnost po 11. nalezeném slově, slovní kvalitu a skutečné propletení cest.

## Integrita experimentu

- Databázový čas při kontrole: 29. 9. 2026 06:03 UTC, tedy po uzávěrce.
- Záznam experimentu má `closes_at = 2026-09-28T22:00:00Z`. Konfigurační `active=true` zůstává uložené, ale databázové RPC pro otevření i zápis vyžaduje současně `clock_timestamp() < closes_at`; round 2 je tedy účinně uzavřený.
- Poslední událost i poslední změna pokusu vznikla 28. 9. v 19:34:30 UTC, 2 h 25 min před uzávěrkou.
- Po uzávěrce nevznikla žádná událost, změna pokusu ani odměna.
- Jednorázový snapshot obsahuje přesně 12 hráčů: TOP 10 podle tehdejších celkových XP plus Pavel a Petra. Všichni jsou v roli `tester`; Pavel ani Petra nejsou analyticky vedeni jako pozorovatelé.
- V databázi zůstává přesně 12 původních desek `mk2-01` až `mk2-12`, 12 různých content hashů a všechna pole `final_puzzle_id` jsou NULL.
- Nebyl proveden žádný syntetický zápis, mapování do finální série, generování ani nasazení.

## Účast

| Metrika | Výsledek |
|---|---:|
| Pozvaní hráči | 12 |
| Začali alespoň jednu desku | 10 (83,3 %) |
| Dokončili alespoň jednu desku | 10 (83,3 %) |
| Dokončili všech 12 | 8 (66,7 %) |
| Dokončené a plně ohodnocené desky | 103 / 144 (71,5 %) |
| Hodnocení mezi dokončenými deskami | 103 / 103 (100 %) |

Z TOP 10 začalo a dokončilo celou dvanáctku osm hráčů; Diss a Umpalump nezačali. Pavel dokončil 3 desky a rozehrál čtvrtou, Petra dokončila 4 desky a rozehrála pátou. Jejich dokončené výsledky jsou zahrnuté stejně jako výsledky ostatních. Pro čisté porovnání jednotlivých desek je níže navíc použit vyvážený panel osmi hráčů, kteří odehráli všech 12; jde o ochranu proti chybějícím hodnotám, nikoli o jiný status Pavla nebo Petry.

| Hráč | Výběr | Dokončeno | Medián času | Náročnost | Zábavnost | Chybné pokusy | Návraty |
|---|---|---:|---:|---:|---:|---:|---:|
| PiettraWal | TOP 1 | 12/12 | 2:08 | 3,25 | 4,08 | 16 | 2 |
| Michael | TOP 2 | 12/12 | 4:01 | 3,17 | 4,00 | 24 | 6 |
| Ave | TOP 3 | 12/12 | 2:55 | 2,75 | 4,00 | 44 | 0 |
| Frau Klein | TOP 4 | 12/12 | 3:49 | 4,33 | 2,92 | 27 | 2 |
| Kvasmeister | TOP 5 | 12/12 | 3:18 | 2,75 | 4,33 | 50 | 3 |
| BoltKey | TOP 6 | 12/12 | 3:18 | 3,08 | 3,17 | 61 | 0 |
| Diss | TOP 7 | 0/12 | — | — | — | — | — |
| Umpalump | TOP 8 | 0/12 | — | — | — | — | — |
| Janak | TOP 9 | 12/12 | 3:53 | 4,00 | 4,33 | 39 | 4 |
| MP | TOP 10 | 12/12 | 3:39 | 2,75 | 3,58 | 16 | 1 |
| Pavel | explicitní | 3/12 + 1 rozehraná | 2:53 | 2,67 | 4,00 | 10 | 5 |
| Petra | explicitní | 4/12 + 1 rozehraná | 5:06 | 3,75 | 3,75 | 17 | 0 |

Pavel zůstal na `mk2-08` u 10 ze 14 slov; Petra otevřela `mk2-01`, ale prakticky ji nezačala. Ani jeden z těchto pokusů nedostal XP.

## Souhrn hry

Ze 103 dokončených desek:

- medián času byl **3:19**, průměr 3:41 a průměr 15,8 s na slovo;
- průměrná náročnost byla **3,26 / 5** a zábavnost **3,81 / 5**;
- 89 hodnocení (86,4 %) bylo v pásmu náročnosti 2–4;
- 77 hodnocení (74,8 %) mělo zábavnost 4 nebo 5;
- vzniklo 304 chybných pokusů, průměrně 2,95 na dokončenou desku; 12 desek bylo bez jediného chybného pokusu;
- nápověda byla použita právě jednou: Janak na `mk2-09` po 6:02, přesto desku hodnotil náročností 4 a zábavností 5;
- nebyl použit reset ani Klidný režim;
- telemetry obsahuje 62 událostí odchodu u 29 pokusů a 23 návratů u 21 pokusů. Tyto události mohou zahrnovat běžné skrytí stránky, proto nejsou samy o sobě důkazem frustrace.

Rozložení náročnosti 1–5: **3 / 17 / 44 / 28 / 11**.  
Rozložení zábavnosti 1–5: **0 / 6 / 20 / 65 / 12**.

Délka hry sama o sobě zábavnost nevysvětluje: korelace průměrného času desky se zábavností je prakticky nulová. Cílem proto nemá být prosté prodlužování, ale zajímavé hledání.

## Poslední tři slova

Napříč všemi dokončenými pokusy zabrala poslední tři slova v mediánu 22,5 s a průměrně 16,3 % herního času. Jedno slovo v závěrečné trojici se nacházelo v průměru jen 73 % času potřebného na jedno z prvních jedenácti slov. Závěr tedy celkově stále zrychloval.

Vyvážený panel osmi kompletních hráčů:

| Deska | Medián | Náročnost | Zábavnost | Chyby | Poslední 3 | Podíl času | Tempo posledních 3 vs. prvních 11 |
|---|---:|---:|---:|---:|---:|---:|---:|
| mk2-01 | 3:13 | 3,38 | 4,13 | 2,00 | 0:20 | 12,0 % | 0,42× |
| mk2-02 | 3:24 | 3,38 | 3,75 | 2,75 | 0:21 | 15,7 % | 0,66× |
| mk2-03 | 4:29 | 4,00 | 3,75 | 4,25 | 0:27 | 11,2 % | 0,51× |
| mk2-04 | 3:17 | 3,13 | 3,88 | 3,25 | 0:24 | 16,4 % | 0,76× |
| mk2-05 | 3:12 | 3,13 | 3,75 | 3,13 | 0:29 | 17,4 % | 0,69× |
| mk2-06 | 3:11 | 2,88 | 3,50 | 3,63 | 0:17 | 13,5 % | 0,60× |
| mk2-07 | 2:56 | 3,00 | 3,75 | 2,50 | 0:25 | 16,2 % | 0,76× |
| mk2-08 | 3:21 | 3,38 | 3,88 | 3,00 | 0:18 | 12,6 % | 0,50× |
| mk2-09 | 4:01 | 4,00 | 4,13 | 3,13 | 0:43 | 25,9 % | **1,35×** |
| mk2-10 | 3:38 | 3,38 | 3,75 | 2,25 | 0:23 | 25,5 % | **1,38×** |
| mk2-11 | 4:46 | 3,00 | 3,63 | 3,00 | 0:23 | 12,9 % | 0,53× |
| mk2-12 | 2:01 | 2,50 | 3,75 | 1,75 | 0:16 | 14,1 % | 0,70× |

`mk2-09` je nejsilnější vzor vrcholové desky: vysoká náročnost, vysoká zábavnost a skutečně těžší konec. Slovo **EROTOMAN** bylo poslední u 6 z 8 kompletních hráčů; jeho medián hledání byl 38,2 s. Jeden hráč ho výslovně neznal, Michael napsal, že ho potrápil, ale deska jako celek dosáhla zábavnosti 4,13 a Janak jí dal 5. Výsledek podporuje občasné hravé slovo jako koření, nikoli jejich plošné nasazení.

`mk2-10` je důležitý strukturální vzor: udržel závěr bez stejně polarizujícího slovního triku. Naopak `mk2-03` byl dlouhý a náročný, ale neudržel obtížnost do konce; velká část zátěže vznikla dříve.

## Slovník a kvalitativní feedback

Zazněly tři opakující se typy podnětů:

1. **Opakování známých slov.** PiettraWal upozornila, že opakování napříč hrou mění kreativní hledání v rozpoznávání známého inventáře. Tomu odpovídá i pořadový efekt: u osmi kompletních hráčů klesl medián z 3:54 v prvních čtyřech hraných deskách na 2:58 v posledních čtyřech; náročnost klesla z 3,47 na 2,91 a zábavnost z 3,94 na 3,66. Malý vzorek a rozdílné skupiny nedovolují čistou kauzalitu, ale pro stovku úrovní je to silný argument pro měkkou penalizaci opakování a střídání charakteru.
2. **Cizí a technická slova.** Na `mk2-03` se objevila výhrada k BONVIVÁNOVI a FIREWALLU; na `mk2-11` k SOFTWARE a NINJA. Nejde jen o obtížnost: tato slova snižovala pocit uspokojivého českého luštění.
3. **Málo propletené cesty.** Frau Klein uvedla tento problém u `mk2-03` a `mk2-06`. To je samostatná kvalitativní vada; dlouhý čas ji nenahrazuje.

Pravidlo pro finální banku: **nejvýše jedno vědomě hravé nebo méně běžné slovo na desku**, vždy po lidské kontrole; nekombinovat je na stejné desce s více anglicismy či technickými výrazy. EROTOMAN může být dobrý vrcholový „aha“ moment. BONVIVÁN + FIREWALL nebo SOFTWARE + NINJA je už slovní směs, která část hráčů od hry odpojuje.

## Srovnání s prvním pilotem

Nejčistší srovnání poskytují PiettraWal, Michael a Ave, kteří kompletně dokončili obě kola:

| Metrika | Pilot 1 | Round 2 |
|---|---:|---:|
| Desky | 30 | 36 |
| Medián času | 1:52 | 3:01 |
| Náročnost | 2,64 | 3,06 |
| Zábavnost | 3,72 | 4,03 |
| Chybné pokusy / desku | 2,13 | 2,33 |
| Medián posledních 3 slov | 0:22 | 0:21 |
| Podíl posledních 3 slov | 18,3 % | 16,8 % |

Druhé kolo tedy zvýšilo medián času o 61 %, náročnost o 0,42 bodu a zábavnost o 0,31 bodu. Nezlepšilo ale plošně obtížnost závěru. To potvrzuje základní směr plných desek a zároveň vyvrací představu, že samotná plnost automaticky řeší snadné dočištění.

Odměna 200 XP pravděpodobně pomohla disciplíně: první pilot měl 45 hodnocení z 50 dokončení (90 %), druhé kolo 103 ze 103 (100 %). Současně jde o motivovanou a výkonnostně vybranou skupinu, takže dokončování ani časy nelze přenést na běžnou populaci bez rezervy.

## Doporučení pro finální sérii 100 úrovní

### Skladba

Zachovat:

- **20 přístupnějších** desek pro rozjezd a úlevu, referenčně `mk2-12`;
- **60 hlavních** desek s cílovou náročností zhruba 3–3,5 a zábavností alespoň 3,8, referenčně `mk2-01`, `mk2-04`, `mk2-08`;
- **15 výrazných výzev**, ale bez nahromadění okrajových slov;
- **5 vrcholů**, kde závěr skutečně zůstává těžký, referenčně `mk2-09` a strukturálně `mk2-10`.

Obtížnost dávkovat ve vlnách. Po vrcholu má následovat úleva. Neřadit 100 desek monotónně od snadné k těžké; data ukazují adaptaci i únavu.

### Výběrové metriky generátoru

Vedle platnosti a celkového skóre hodnotit:

- dobu nebo strukturální obtížnost zbytku po 11. slově;
- poměr tempa posledních tří slov k prvním jedenácti;
- počet a kvalitu křížení cest, nikoli jen zaplnění 100 polí;
- slovní pestrost napříč celou sérií s měkkým, nikoli absolutním odstupem;
- penalizaci více cizích, technických či málo známých slov na jedné desce;
- lidskou kontrolu každého vrcholu a každého záměrně neobvyklého slova.

Pro hlavní masu nemá být poměr závěrečného tempa nutně nad 1,0. Smysluplný cíl je, aby přibližně 20 ze 100 desek udrželo nebo zvýšilo obtížnost v závěru; zbytek může přirozeně zrychlovat, ale neměl by se rozpadnout na mechanický úklid.

### Zacházení s 12 hotovými deskami

- **Silní kandidáti pro zachování beze změny po produktovém schválení:** `mk2-01`, `mk2-02`, `mk2-04`, `mk2-05`, `mk2-07`, `mk2-08`, `mk2-09`, `mk2-10`, `mk2-12`.
- **Cílená revize před případným zařazením:** `mk2-03` (BONVIVÁN + FIREWALL, málo propletené, těžkost mimo závěr), `mk2-06` (málo propletené, nižší zábavnost), `mk2-11` (SOFTWARE + NINJA, dlouhá bez odpovídající vnímané náročnosti).
- Všech 12 ID a hashů musí zůstat zachováno jako historie playtestu. Pokud se některá deska obsahově upraví, nesmí se vydávat za tentýž hash.
- Do finální banky nyní nebyla namapována žádná deska a hráčům nebylo přiznáno žádné další XP. Případný převod dokončení musí až po schválení použít stabilní vazbu na původní desku a respektovat již vyplacenou odměnu, aby nevzniklo dvojí plnění.

## Omezení

- 12 pozvaných není reprezentativní vzorek; deset bylo vybráno podle vysokých celkových XP.
- Jedna osoba dodala až 12 opakovaných měření. 103 dokončených desek proto není 103 nezávislých respondentů.
- 200 XP motivovalo dokončení i hodnocení a může podporovat rychlejší postup.
- Tři rotace pořadí snižují, ale neodstraňují vliv učení a únavy.
- Pavel a Petra jsou plnohodnotní hodnotitelé, ale jejich neúplná matice by zkreslila přímé pořadí desek; proto je hlavní board-to-board tabulka vyvážená na osmi kompletních hráčích.
- Kvalitativní poznámky jsou dobrovolné a jejich absence neznamená bezvýhradný souhlas.
