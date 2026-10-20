# Ověření administrace účtů a kompatibility klienta

Oprava 4.09.10, `client_release=proplet-v4.09.10-runtime1`, řeší dvě doložené hranice. Nemění účty, výsledky, desky, odměny, onboarding ani rozehraný postup. Vzniká odděleně z main `958706b6286a2dd7099fa8e3ceb097b757b507e7`.

## Administrace

Deset produkčních GET `/api/admin/account-integrity` dne 19. října 20:56:52–20:58:11 UTC skončilo 503 kvůli `Bounded query exceeded table=results max_rows=20000`. Původní implementace stahovala celou historii výsledků, sessions a pushů, přestože potřebovala jen počty pro kandidáty na duplicitní účty.

Nový read-only RPC `proplet_account_integrity_counts` počítá v databázi pouze požadované kandidáty. Používá existující indexy player_id, nejvýše 5000 vstupních ID a jeden JSON výsledek bez PostgREST řádkového limitu. Je SECURITY INVOKER, dostupný jen service_role; HTTP autentizace a kontrola admina zůstávají před dotazem. Nezvyšuje se ani neobchází ochranný limit raw čtení. Neúplný nebo vadný agregát selže otevřeně jako 503, nikoli jako falešné nuly. Jde stále jen o analytický přehled, nikoli slučování či mazání účtů.

Přijímací podmínky: přesný počet 20001 výsledků, správná canonicalizace a původní HTTP schéma; oddělené počty sessions/push bez násobení JOINem a přesahů mezi hráči; 401/403 bez spuštění agregátu; anon/authenticated nemohou spustit RPC; nulový/duplicitní/poškozený výsledek nesmí tiše změnit závěr. Jednotkové HTTP testy jsou v current gate, SQL i propojený HTTP → SQL test v disposable PostgreSQL CI. Syntetické řádky se vracejí zpět rollbackem, nikdy se nevkládají do produkce.

## Progression

Tři hlášení po půlnoci 20. října mají skutečný producer `proplet-v4.09.9-mama1`, nikoli reporter 4.09.8. Podpis `progression(...).dailySpecialResultState is not a function` odpovídá app.js:340 a zobrazení Extra CTA na výsledku Daily. Modul před commitem `cf16817aadfa9cb991630bf99d04aeb62860f6fd` metodu neobsahoval, ale jeho URL zůstala stejná i po změně kontraktu. To dokládá mechanismus nekompatibility; konkrétní bajty z postiženého prohlížeče nemáme.

Nová URL `progression.js?v=progression-compat1` je shodná v HTML a SW. Při starém modulu nový klient úzce doplní chybějící nebo nevolatelnou metodu přes stejný autoritativní `datedSpecial().resultState(iso,getState())`, který používá aktuální modul. Ostatní metody se nemění, aktuální controller se nenahrazuje. Nevyrábí se prázdný stav ani falešné dokončení, neprobíhá reload, reset storage či opakovací smyčka.

Přijímací podmínky: skutečné staré bajty modulu s novým app.js vykreslí výsledek Daily, Extra CTA, Volnou hru i profil na desktopu 1440, mobilu 390 a Foldu 768 px; žádná uncaught výjimka ani vodorovný přesah; totožný účet, postup a aktuální pokus před/po adaptaci. Current test pokrývá i nevolatelnou metodu a zachování funkčního nového controlleru. Browser regresní test zachovává také přesně jednu událost první hry na typ a vazbu na skutečný syntetický attempt. Samostatný profilový test ověřuje skutečný přechod PWA 4.05.3 → nový release bez ztráty účtu/postupu.

## Platformní sběr a následná organická kontrola

Obě skutečná produkční SDK přečtená GET prošla plně zachycenou lokální simulací odeslání bez URL parametrů. Externí browser zápisy byly nulové. Toto není důkaz příjmu organických vitals. Web Analytics má doložené skutečné přijetí; Speed Insights dotazy na jednotlivé metriky byly prázdné a project metadata mají hasData=false, historické dataReceivedAt z 23. srpna. Chybějící enabledAt samo neprokazuje vypnutý základní sběr. [Aktuální cenová dokumentace](https://vercel.com/docs/speed-insights/limits-and-pricing) rozlišuje bezplatný RES a placené jednotlivé metriky Plus. Z prázdných dotazů proto neodvozovat nulovou latenci ani bez dalšího vypnutý sběr. Dashboard nyní vyžaduje přihlášení; žádné automatické přihlášení, upgrade nebo placené zapnutí se neprovádí.

Po READY ověřit přesný deployment/SHA a app/SW/runtime release. Produkční kontrola je pouze read-only: přímé Vercel 5xx, operational_events/client_error se skutečným client_release (reporter a server zvlášť), administrátorský read-only agregát a existující first-game readout. Žádné nové produkční hry, registrace, beacony či chybové sondy. Staré releasy nevydávat za nový podle času requestu. Pro první hry dál platí TELEMETRY-FOLLOWUP-VERIFY.sql včetně sticky assignmentů, raw duplicit, skutečných pokusů a událostí přes půlnoc. Bez přímo doloženého nového vzorku není organický PASS.

Výsledek technických testů, CI, skutečného nasazení a následného organického okna se uvádí odděleně v místním reportu opravy. Krátké nulové okno není plošné potvrzení měření.
