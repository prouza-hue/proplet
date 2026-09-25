# Mozkokalypsa — druhý playtest

Schválení uživatele 25. 9. 2026: nová ikona, 12 hotových desek, jednorázová TOP 10 podle celkových XP + Pavel + Petra, konec pondělí 28. 9. ve 24:00 Europe/Prague (2026-09-28 22:00 UTC), 200 XP za dokončení A obě hodnocení.

## Obsah a evidence

- Experiment `mozkokalypsa-round2-20260925`; 12 desek `mk2-01` až `mk2-12`, 10×10, 14 slov. Obsah desek je přesná kopie kandidátů z commitu `8d2905043eb954b87c03e3b5c9a015f1a87e8c06`, původní bankHash `5352122e033299a00580ffdc906522718f902d1dc0054dc7db3db76f9e2c272c`. Doplněna pouze provozní metadata a tři rotovaná pořadí (start 1, 5, 9).
- Žádné nové generování. Původní desetideskový pilot ani jeho výsledky se nemění.
- Nová schválená ikona `mozkokalypsa-v2.svg`, zachováno nativní ovládání, Fraunces a Tiskařská dílna.
- Tabulky výsledků a událostí jsou odděleny `experiment_id`; lokální cache má nové jméno.

## Odměna a uzávěrka

- Dokončení samo nepřidá XP. Server ověří všechny cesty; databáze při dokončení znovu ověří pokrytí všech 14 uložených odpovědí.
- Hodnocení vyžaduje náročnost i zábavnost 1–5; poznámka je volitelná. Z přehledu lze otevřít hotovou neohodnocenou desku bez opakování hry.
- Zápis hodnocení a odměny probíhá v jedné transakci. Zámek pokusu, CAS revize a unikátní klíč `mozkokalypsa_v2:mk2-NN` brání opakované odměně. Odměna jde do existujících `account_rewards`, tedy skutečných celkových XP; maximum 2 400 XP na hráče. Nemění pravidla běžných desek, denní sérii ani týmové výsledky.
- Uzávěrku vynucuje backend i databázové `clock_timestamp()`; dlouho otevřená stránka má jednorázový časovač a kontrolu při návratu do popředí. Žádný polling ani závislost uzavření na plánovači.
- Dokončení i hodnocení musí být doručeny serveru před uzávěrkou. Offline fronta po uzávěrce nepřidá výsledky ani XP.
- Migrace začíná s neaktivním experimentem. `MOZKOKALYPSA-ROUND2-ACTIVATE.sql` vybere kohortu pouze jednou, uchová pořadí i XP v okamžiku výběru a deduplikuje explicitně pozvané účty.

## Vyhodnocení před další tvorbou

Sledovat účast (pozvaní / začali / dokončili / ohodnotili), časy a sekundy na slovo, chyby, nápovědy, návraty, resetování, režim Klid, náročnost/zábavnost a konkrétní slovní feedback. Ze sledu událostí porovnat začátek, prostředek a poslední 3 slova, ne pouze celkový čas. Oddělit přerušené hry a neúplné hodnocení; 12 desek téhož hráče není 12 nezávislých respondentů. Vyhodnotit i motivaci XP a výběrové zkreslení TOP 10.

Kategorie kandidátů jsou dosud hypotézy. Výsledky agregovat po desce i po hráči; Pavel i Petra jsou plnohodnotní hodnotitelé. První pilot porovnávat jen u společných hráčů a s vědomím odlišných slov, pořadí a odměn.

Doporučit schválení / cílené opravy / další ověření pro celou sérii. Automatické generování zbývajících desek není součástí tohoto nasazení.

## Pozdější uznání do série

Databáze uchovává stabilní ID a SHA-256 obsahu každé desky, dokončené pokusy a odděleně vyplacenou odměnu. `final_puzzle_id` zůstává NULL do vyhodnocení a schválení směru bez výhrad. Poté lze mapovat stejné desky do finální stovky a převést dokončení bez opakovaného hraní. Samotný převod do ještě neexistující finální série nyní neprobíhá; musí zachovat evidenci již vyplacených 200 XP a zabránit dvojímu vyplacení za stejnou desku.

## Ověření a nasazení

Doplnit finální SHA, deployment, aktivní kohortu a výsledky gates po nasazení. Syntetické zápisy jsou pouze v izolované loopback databázi CI, nikdy pod skutečnými hráči. Vercel QA větev má odpojenou produkční databázi; produkce se znovu sestaví z main.

Migrace `mozkokalypsa_round2_timed_rewards` úspěšně aplikována standardní cestou 25. 9. 2026 ve 22:18 UTC. Ověřeno 12 zaregistrovaných desek, experiment zatím neaktivní, 0 pozvánek. Role anon/authenticated nemají SELECT k nové bance ani EXECUTE k novým RPC; service_role má potřebná práva. RLS bez klientských policies je zde záměrný serverový přístup. Advisor nehlásí nový bezpečnostní problém playtestu; obecné upozornění na vypnutou kontrolu uniklých hesel Supabase Auth není změnou této migrace ([podrobnosti](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Jednorázové vyhodnocení naplánováno na úterý 29. 9. ráno kolem 08:00 Europe/Prague. Uzavření hry není na běhu této úlohy závislé.

## Skutečný produkční stav — 26. 9. 2026, 00:27 Europe/Prague

- PR #144 sloučeno. Produkční SHA `3b2c40a290bd10f3dd3de1df694d3db360858900`.
- Deployment `dpl_5EkMEymSPwUVz47fgzAcFXsEiYbE`, target `production`, stav `READY`, alias https://hrajproplet.cz. Nový build z main, žádné povýšení preview.
- Strom `e56a6a7b7be79d8b1b89f7d9a2a74b256ae37a3f` je identický se stromem otestované větve na SHA `486892188af1edb0bcc2eb8ef3889a9db1c0ae37`.
- `/api/health`: HTTP 200, `ok=true`, `database=true`. Produkční adapter JS, service worker a SVG nové ikony přesně odpovídají nasazeným souborům.
- Anonymní status: `eligible=false`. Produkční QA status: HTTP 403. Náhled větve má `database=false`.
- Aktivace jednou v `2026-09-25 22:26:45.83577 UTC`; dostupnost true, 12 aktivních testerů. Zatím 0 pokusů a 0 odměn nového kola. Původní pilot stále 50/50 dokončeno a 45 hodnocení.
- Kontrola error/fatal logů tohoto deploymentu 22:25–22:27 UTC: žádný odpovídající záznam. Jde o krátkou kontrolu po nasazení, nikoli dlouhodobou provozní záruku.

### Zmrazená kohorta

| Hráč | Výběr | Celkové XP při výběru | Pořadí desek |
|---|---|---:|---:|
| PiettraWal | TOP 1 | 96 447 | 1 |
| Michael | TOP 2 | 92 356 | 2 |
| Ave | TOP 3 | 78 210 | 3 |
| Frau Klein | TOP 4 | 61 369 | 1 |
| Kvasmeister | TOP 5 | 59 469 | 2 |
| BoltKey | TOP 6 | 58 457 | 3 |
| Diss | TOP 7 | 58 372 | 1 |
| Umpalump | TOP 8 | 57 085 | 2 |
| Janak | TOP 9 | 56 522 | 3 |
| MP | TOP 10 | 52 224 | 1 |
| Pavel | explicitně, celkově 12. | 45 213 | 2 |
| Petra | explicitně, celkově 23. | 13 917 | 3 |

Všichni mají roli tester. Žádní pozorovatelé. Pozdější změny žebříčku tuto skupinu nepřepočítávají.

### Doložené testy a omezení

- Aktuální runtime: **107 PASS / 0 FAIL**, asset kontroly 126 PASS, syntax 358 PASS; job `108273123732`.
- Izolovaný přihlášený HTTP → PostgREST → PostgreSQL tok: PASS, job `108273123452`. Skutečné vlastní sessions, odmítnutí nepřihlášeného/nepozvaného hráče, trvalý zápis a obnovení metrik, idempotence, konflikt revizí, neúplné/podvržené dokončení odmítnuto, samotné dokončení 0 XP, chybějící známka odmítnuta, dvě známky 200 XP jednou, opakování i nové hodnocení bez další odměny, databázová uzávěrka. Běžné výsledky, série a postup beze změn.
- Native acceptance: PASS, job `108273123189`, všech 12 dohrání přes nativní herní tok, skutečný pointer vstup, nápověda a Klid, obnovení po reloadu, návrat k neohodnocené desce a odeslání obou známek. Žádné chyby JS, zápisy běžného postupu ani QA zápisy na server.
- Vizuálně prohlédnut mobil 390px ve světlém i tmavém režimu, výsledek s hodnocením a nová ikona; testována též emulace Fold 768px. Nejde o fyzické zařízení.
- Printshop/UI regresní test prošel na `5e2034152b81da4fd74bbc5596fdb3f934a67b75`; následující commity měnily pouze testy a dokumentaci. Onboarding browser gate prošel na finálním kandidátovi.
- Syntetické zápisy proběhly výhradně v izolované CI databázi. Přihlášené hraní skutečného účtu na hostované produkci nebylo předstíráno ani provedeno za hráče. První skutečný produkční zápis bude pocházet od některého z pozvaných hráčů.
- Převod dokončení do finální série je podmíněný vyhodnocením a schválením; nyní je zachována potřebná identita obsahu a evidence, nikoli vytvořena finální série.
