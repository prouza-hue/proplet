# HomeLayout a vazby diagnostiky

Změna vychází z main cc54c0ae6458d0e7a76d11f777ee2e34d717e62d. Připravovaný release je 4.09.14, client_release a nový reporter_release proplet-v4.09.14-diagnostics1. Nejde o potvrzení produkčního nasazení ani organického ověření.

## HomeLayout

renderFree ověřuje volatelnost renderResumeCard. Při chybějícím nebo nevolatelném exportu požádá jednou za dokument o verzovaný recovery modul. Obnova používá jinou URL než bootstrap, aby nesdílela jeho případnou starou in-flight/cache odpověď. Souběžné rendery nezaloží další požadavky; timeout/chyba skončí jedním home_layout_contract hlášením. Ostatní Free ovládání zůstává dostupné.

Starý installed příznak sám neblokuje aktualizaci nekompatibilní fasády. Původní funkční instalace se podruhé neváže; účet, storage, pokus ani postup se nemažou. Obě HomeLayout URL jsou v nové SW cache. Nemění se desky, ekonomika, OAuth ani souběžná práce.

## Kontext chyb

Server používá již rozpoznanou telemetrickou identitu, nikdy actor ID z těla požadavku. Do omezeného metadata JSON přidává reporting_actor_key a context_at=report. Anonymní klíč je existující serverový hash, účtový klíč používá serverem ověřené UUID.

reported_starter_run_id a reported_first_steps_run_id jsou validované UUID deklarované jako kontext okamžiku hlášení. Nepotvrzují místo vzniku asynchronní chyby ani vlastnictví flow. reported_attempt_id zůstává deklarace; pole attempt_id vznikne jen při úspěšné kontrole existujícího pokusu, aktéra, prostředí, testovacího příznaku a případně desky. attempt_link rozlišuje owned / not_owned_or_missing / lookup_unavailable. Nedostupné dohledání nezahodí samotné hlášení chyby.

Globální diagnostický listener používá stejný app kontext jako výslovné hlášení. Producer, reporter a server zůstávají samostatné verze. Neznámý starý producent zůstává legacy; žádné přeznačení historie, backfill ani migrace. Po anonymous claim se identita v JSON zpětně nepřepisuje; chybějící historickou vazbu není dovoleno domýšlet časem. Tokeny, raw ID anonymní instalace, celé stacky ani slova se nepřidávají.

## První vstup v tréninku

starter_v1_input_outcome je diagnostika prvního uzavřeného výsledku vstupu, jednou na starter_run_id: correct / invalid / empty / cancelled. Nejde o každé pointerdown ani samostatný konverzní krok. Rozpracovaná platná série klepnutí zatím výsledek nemá. Pointercancel, reset či přerušení rozpracovaného vstupu může uzavřít cancelled. Následný správný vstup první diagnostický výsledek nepřepíše, ale normálně vyvolá kanonický first_correct.

Tělo product-event zůstává pouze event_type. Enum se přenáší X-Proplet-Starter-Input s neměnnou provenance tréninku, časem a UUID; server ho povolí jen s platným run ID a uloží pouze k nové diagnostické události. Text slova, písmena a surová cesta se neodesílají. Starý input modul bez callbacku funguje dál; nepřítomnost nové diagnostiky u něj není UX odpad.

## Regresní ověření

- Current gate: tests/current/manifest.json zahrnuje nové HTTP i JS kontroly. Soukromí a historická charakterizace byly rozšířeny o schválený aditivní kontrakt, nikoli vypnuty.
- tools/test_module_contracts_browser.cjs: skutečný historický HomeLayout bez exportu; funkční pokračovací karta a zachovaný stav; přesně jeden diagnostický výsledek na run, kontext přímo z transportu. Desktop 1280, mobil 390, Fold 673 px bez vodorovného přesahu.
- Stejný browser test: skutečný service worker 4.09.9 → nový release na všech třech viewports, nezměněný účet/dokončení/rozehraný postup a funkční profil/nápovědy/Free.
- tools/test_first_game_safety_browser.cjs: 13 kontrol reálného klienta na izolovaném loopback serveru, včetně jediné assigned/started/completed/offer události a přímých attempt vazeb. Desktop 1440, mobil 390 a Fold 768 px.
- HTTP test ověřuje účtového i anonymního aktéra, cizí nebo neexistující pokus, nesoulad desky, nedostupné dohledání, chybějící identitu a zachování legacy provenance. JS test pokrývá nevolatelný export, úspěšnou obnovu, timeout i chybový stav bez opakovací smyčky.

Všechny browser/API zápisy jsou syntetické v paměti místního fixture serveru. Žádné produkční hry, registrace, chybové sondy či beacony. Technický PASS nesmí být vydáván za důkaz skutečných hráčů. Po případném nasazení nejprve ověřit přesný READY/SHA/release a pak raw první hry, duplicity, vlastnictví attempt a expozici HomeLayout. Staré klienty a neznámou provenance vykazovat odděleně.
