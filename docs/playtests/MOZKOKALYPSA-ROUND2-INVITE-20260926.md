# Mozkokalypsa — výrazně odlišená pozvánka druhého kola

Navazuje na produkční main 3b2c40a290bd10f3dd3de1df694d3db360858900 (PR #144). Uživatel požaduje výrazný redesign pozvánky, nové texty a skutečně běžící odpočet. Schválená ikona v2, experiment, 12 neměnných desek, kohorta, uzávěrka a odměny zůstávají beze změny.

## Změna

Pozvánka má švestkově inkoustový záhlavní blok, měděné označení 02 / Druhé kolo, větší původní schválenou ikonu, novou textaci a CTA, samostatnou časomíru a dvanáctidílný přehled postupu. Odlišuje hotové desky od odeslaných hodnocení a připomíná chybějící hodnocení místo předčasné gratulace. Světlý i tmavý režim a šířky 320–1440 px.

Odpočet používá closesAt + serverNow z existujícího API, přepočet z absolutního času, jeden lokální časovač po sekundě pro pozvánku i přehled desek. Žádný API polling. Při skrytí dokumentu / opuštění stránky se vizuální časovač zastaví, při návratu se ihned dopočítá. Přístupná časomíra má aria-live=off; čtečka není rušena každou sekundu. Uzávěrka zůstává 2026-09-28T22:00:00Z, pondělí 28. 9. ve 24:00 Europe/Prague. Serverové vynucení se nemění.

PWA shell a URL měněných assetů jsou sladěny na mkinvite2 / v5. Normální postup ani offline datová cache se nemažou. Přesně pojmenovaná preview větev feat/mozkokalypsa-round2-invite má odpojené produkční přihlašovací údaje Supabase stejně jako předchozí QA větve.

## Ověření

Lokálně prošly nativní adaptér, obsahové/API testy, PWA startup a nový deterministický test časomíry: posun hodin +7 h, skutečné tikání, nulový polling, opakované rendery, souběžné hodiny, navigace, uspání, přepnutí účtu, chybějící hodnocení, hotový test a přesná expirace. Lokální Chromium je administrativně blokované; skutečné browser ověření proto běží v běžném izolovaném GitHub CI bez produkčních účtů a dat. Rozšířený acceptance workflow uloží skutečné screenshoty osmi variant, test uzávěrky a původní průchod všemi 12 deskami. Výsledky konkrétního CI běhu a nasazení se ověřují před sloučením/následně v deploymentu; tento dokument netvrdí jejich předčasný úspěch.
