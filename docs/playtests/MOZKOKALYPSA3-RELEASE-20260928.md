# Mozkokalypsa III — 48 hodin, stejná kohorta

## Schválení 28. 9. 2026

Pavel výslovně schválil produkční nasazení nativního modulu a osmi propletených desek, návazně na kolo II. Třetí kolo začíná 29. 9. 2026 v 00:00 Europe/Prague (28. 9. 22:00 UTC) a končí 1. 10. v 00:00 (30. 9. 22:00 UTC). Celé úterý a středa, přesně 48 hodin. Kohorta se kopíruje ze skutečných aktivních pozvánek kola II, bez nového výběru podle XP. Odměna zůstává 200 XP až po dohrání a obou hodnoceních; maximálně 1 600 XP na hráče.

## Integrace, ne přepsání preview větví

Základ `1fdc7642dbd44412311a9d0362741a6080cd3521` obsahuje týdenní týmovou soutěž, opravy provenience/měření onboardingu i tříslovného tréninku po registraci (PR154). Nová větev `feat/mozkokalypsa-round3-release` vychází z tohoto main. Před sloučením se main kontroluje znovu; případné novější změny se neztrácejí.

Přenáší se pouze schválený modul z PR155; produkční server, autentizace, cron a CSP zůstávají z aktuálního main. Žádné preview blokování databáze na produkci. Preview této integrační větve má naopak odpojené zděděné Supabase/VAPID/cron přístupy. Žádné syntetické výsledky pod reálnými účty.

Banka `data/playtests/mozkokalypsa-v3.json` je bajtově totožná se schválenou propletenou osmičkou: SHA-256 `c412ad3ccb8dc0a651387046389aff055c34ada15c5cf75398c8440c1ce22410`, obsahový hash `b6bfe8034861ad3cad0d3d9057658b046ea85ef172579229da60ab5dd7cdc42f`. Experiment `mozkokalypsa-round3-interwoven-v2`, ID mk3w2-01 až mk3w2-08. Žádná nová výroba, pořadí pro hráče 1–8, historie kola II zachovaná.

## Časová a účetní hranice

Původní `/api/mozkokalypsa/status` do startu vrací kolo II, po něm kolo III. Nové zápisy III jdou do samostatných `/api/mozkokalypsa3/*` a nových RPC. Původní zápisové endpointy/RPC kola II se nemění. API i SQL ověřují otevření/uzávěrku; třetí kolo se nestane dostupným dříve ani přes přímé URL. Místní stav a fronta jsou odděleny experimentem a účtem, asynchronní odpovědi starého kola nesmějí přepsat nové. Při přechodu funguje jeden časovač a kontrola návratu do popředí, žádný intervalový polling.

SQL migrace nejprve registruje neaktivní experiment, osm neměnných desek a nové RPC. `MOZKOKALYPSA3-ACTIVATE.sql` kopíruje přesně kohortu, kontroluje oba směry shody a aktivuje datumově uzamčený experiment. Dokončení i hodnocení musí dorazit před uzávěrkou. Idempotentní události, CAS revize a unikátní `mozkokalypsa_v3:<boardId>` v account_rewards chrání proti duplicitní odměně. Dokončení samo odměnu nevyplácí.

Odměny jsou skutečné osobní XP. Nevytvářejí záznamy v běžných results, puzzle_runs, streaks nebo free_slot_rewards. Týdenní týmová soutěž počítá herní results, nikoli account_rewards: tyto XP ji nenavyšují. Staré výsledky/odměny/týmové funkce a cron zůstávají beze změny.

UI přebírá schválenou pozvánku „Mozkokalypsa potřetí.“, osm desek a skutečný odpočet. Produkce nezobrazuje ukázkovou uzávěrku ani lokální náhledové XP. Prohlédnutí dohrané desky zachová rozepsané hodnocení a nevytváří nové dokončení. Aktuální app.js je zachován kromě release markeru; HTML a SW mají sladěné asset URL, datová cache se nemaže.

## Ověření a bezpečný návrat

Lokální kontroly hranice startu/uzávěrky a původního adaptéru byly připraveny. Před produkcí musí projít skutečné PostgreSQL testy migrace, souběhu odměn a shody kohort, autentizované HTTP přes PostgREST, nativní browser, aktuální runtime, onboarding a týdenní soutěž. Konkrétní výsledky/commity/deployment se zapisují až po dokončení do release PR.

Rollback aktivace: nastavit pouze `mozkokalypsa_experiments.active=false` pro experiment III. Nemazat pokusy/XP a nevracet starší schéma; aditivní migrace zachovává zpětnou kompatibilitu. Předchozí verzi UI lze vrátit nasazením předchozího main, ale výsledky III se ponechají. Žádná automatická změna ostatních obtížností; Lexikon v3 a společná pestrá cesta následují po vyhodnocení.
