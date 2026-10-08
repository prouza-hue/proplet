# Archiv a měsíční soutěž — revize 8. října 2026

## Účel
Samostatný klikací návrh připravený pro Pavlovo vizuální posouzení. Žádná aktivace Archivu, změna XP, přepnutí hráčů ani vyhlášení měsíce. Ostrý start se bude plánovat až po schválení.

Náhled: /previews/archive-20261008/index.html. Přepínač obrazovek, obě úvodní CTA a tmavý režim jsou v úzkém horním panelu. Profil A přepíná model zkušeného a nového hráče. Čísla výsledků jsou výhradně demonstrační.

## Aktuální stav ověřený 8. října
Produkce hrajproplet.cz: READY, commit 5a08f2c24efec2daedd3dee42f65062ec394c5ef (PR #186). /api/health: 200, databáze dostupná, Postgres RPC transport. Základní počty volné hry 400/400/400/300/150/100.

- #177: draft, open, nezmergováno. Historické odměny, poslední head 01bacf3976c645c3a3d18fff7674debe3e9981bd.
- #178: draft, open, nezmergováno. Původní návrh ze 4. října, head 73fed3a63e2b8851d8f1f2b10014800c4d95ab0a. Tento nový návrh jej vizuálně nahrazuje a vychází z aktuální produkce.
- #179: draft, open, nezmergováno. Obsah a smlouva řešení, head d95d9f4c800f2ca81c3edd49bc5020e6e068c4b0. Před integrací vyřešit rozdíly proti aktuálnímu main.
- #182: merged 7. října. Schválená Daily Gen6 banka 99 dní, 8. 10. 2026–14. 1. 2027. Serverový kalendář, soukromá budoucí zadání, atomické uložení výsledku. Původní 100denní kandidát v #180 není aktuální vydaná banka.
- #183–186 přinesly onboarding a úspory/odolnost Supabase; nový preview se staví na jejich aktuálním základu.
- Historické chyby digest baseline S04/S06 odstranil #182. Nejsou nynějším důvodem blokace.
- Přímé čtení dnešní Daily bez parametrů doplněných Vercel nástrojem je součástí evidence/report.json. Vercel fetch vracel 404, protože endpoint odmítá dodatečné query parametry; samotná tato kontrola není důkaz výpadku. Rozhodující je nezávislý HTTP výsledek v evidenci.

## Vizuální změna
Archiv dostává vlastní ilustraci původních papírových desek, teplou barevnost, velkou typografii Fraunces a klidný přehled čísel. Hlavní nabídka nepřekrývá každou desku odstavcem textu. Čtyři obtížnosti jsou vždy viditelné, v mobilu ve dvou řadách.

Zvlášť zobrazujeme konkrétní odehranou desku (fajfka) a jednou získanou odměnu za historický slot (text XP). Stav nehráno + XP již získány je platný, vysvětlený v detailu. Lze otevřít libovolné číslo, použít filtr, hledání i stránkování.

Na Hrát je Archiv hned před obtížnostmi. Návrh Dnes ponechává denní výzvu, zvýrazní měsíční a týmovou soutěž, tajenku a Archiv. Obtížnosti nahrazuje jediný proklik na Hrát. Název Dnes zatím zachován; přejmenování na Soutěž není podmínka funkčního návrhu.

## Referenční CTA — uložené rozhodnutí
Pavel výslovně označil oznámení **300 nových úrovní Gen6** za požadovanou kvalitu. Zdroj vzoru je skutečný public/refresh-release.css a public/app/content/refresh-release.js z produkce, nikoli volná interpretace.
Povinné principy: Fraunces 750, velký dvouřádkový titulek, Outfit, krémový papír se zeleným a teplým barevným světlem, původní printshop ilustrace, jemné rámečky, pevný spodní stín, jeden výrazný hlavní knoflík, klidná sekundární akce, soustředěné copy.
Archiv: „Dobré desky nestárnou.“ 800 desek / čtyři obtížnosti / volba pořadí / upřímná poznámka k historickému obsahu.
Měsíc: „Nový měsíc. Nová šance.“ Viditelné medaile a stručné principy s rozklikem úplných pravidel.
Při skutečné integraci převzít i chování Gen6 oznámení: návratoví hráči po onboardingu, žádné skládání modalů, označení zhlédnutí po účtu, klidná počáteční práce s focusem. Preview nic nezapisuje a modaly se spouštějí ručně.

## Obsah a odměny — co ještě dokončit
1. #179 má 800 původních G3 desek, po 200 easy/medium/hard/hardcore. Broad solver našel 86 víceznačných desek. Schváleno 64 alternativ, zamítnuto 21, zbývá 15 rozhodnutí na 12 deskách. Schválené celé cesty dávají 864 celých řešení včetně 800 původních. Tyto starší výsledky byly doloženy 4. října; dnes je neopakujeme jako nově spuštěný audit.
2. Uzavřít redakční rozhodnutí nad GAMMA, ŠLAK, HŮRA, FAKE, KALAŠ, NĚMA, SOLE a LHOTY podle dokumentace #179. Původní platná řešení zachovat. Alternativní řešení přijímat jako celé sady slov a cest; nemíchat části různých řešení. Stejnou smlouvu musí používat nápověda i obnovení rozehrané hry.
3. Zapojit tento kontrakt do skutečného klienta/serveru. Alternativní cílová slova nesmějí současně vydělávat objevitelské XP. Neprovádět plošnou změnu současného lexikonu.
4. #177 řeší jednu historickou odměnu unikátním klíčem hráč/obtížnost/úroveň pro G1–3 a databázovou transakcí. G4+ je samostatná odměna. Novější dokončení tedy nezablokuje dosud nevybranou historickou odměnu.
5. Při spuštění nejdřív uzavřený runtime, odvodit/dokončit staré zapisovače, migrace, čerstvá kontrola a sladění ledgeru, teprve následné otevření. Nikdy nezapnout přidělování přes neatomický fallback. Předchozí izolované testy souběhu, rollbacku a opakovaných požadavků prošly; po integraci je nutné cílené ověření nové konkrétní verze.
6. Samostatná oprava 21 záznamů / 12 hráčů / 3 185 XP už byla provedena 4. října. Neprovádět ji znovu. Netýkala se Michaela a PiettraWal.
7. Přehled/deska v tomto návrhu jsou záměrně modelové. Po výběru „Hrát“ se ověří přímý výběr, nespouští se syntetická herní deska. Kompletní hratelnost bude před ostrým otevřením vyžadovat napojení výše.

## Měsíční soutěž — schválený princip a zbývající implementace
Denní výzva se dál publikuje den po dni. Nová bankovní příprava s tím nekoliduje: problémem by bylo vystavení budoucích těl hráčům předem, což vydaná Daily Gen6 řeší soukromým balíkem.
Za první platné dokončení denní desky v den zveřejnění 100 bodů, bez nápovědy +20. Nejlepších 20 dní za kalendářní měsíc; maximum 2 400. Čas řešení nerozhoduje. Stejné body = sdílená příčka (1,1,3). Měsíční odznak pro příčky 1–3, včetně všech remíz, bez XP. Pražský čas. 48 hodin na kontrolu a reklamace před konečným uzavřením.

Zbývá: serverový záznam způsobilosti a nápověd, skórování s idempotencí, výběr nejlepších 20 dnů, řízení hranic měsíců/pozdních zápisů, žebříček, finalizace a reklamace, trvalé přidělení odznaků, soukromí a provozní přehled. Bez dokončení těchto bodů vizuální návrh nepředstavuje hotovou soutěž.

Listopad 2026 je v návrhu pouze vzor barevnosti a copy; nejde o ohlášený termín. Zahájení až prvním celým měsícem po ověření pravidel a banky. Pro každý další měsíc navrhnout schválenou paletu a titul odznaku. Exkluzivita znamená vazbu na daný měsíc a rok, ne umělé omezení počtu vítězů při remízách.

## Ověření tohoto návrhu
Cílená Chromium kontrola 320/390/690/1440 px, čtyř obrazovek, modalů, tmavého režimu, skutečně načtených fontů, filtru, libovolné desky 88, oddělení hraní/XP, Escape a návratu focusu, přetečení. Žádný localStorage ani service worker, žádné zápisy do hráčských dat. Výsledky a obrázky: public/previews/archive-20261008/evidence/.

Po Pavlově schválení návrhu připravit konkrétní integrační a provozní plán otevření Archivu. Měsíční soutěž může pokračovat souběžně samostatně.
