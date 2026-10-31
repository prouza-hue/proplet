# Studio Edition — preview pro skutečné hráče

25. 10. 2026. Uživatel výslovně požaduje běžné účty, skutečný postup, serverové funkce a produkční databázi. Tento pokyn nahrazuje předchozí izolovaný režim preview. Není schválením nasazení na hrajproplet.cz.

## Rozsah

- Implementační větev zůstává `codex/studio-edition`; přebírá aktuální produkční opravy `cc54c0a` / v4.09.13 včetně vazby Google OAuth callbacku na konkrétní prohlížeč a záměr přihlášení.
- Adresa: https://proplet-git-codex-studio-edition-pavel-prouzas-projects.vercel.app
- Běžné přihlášení vytváří standardní Proplet session. Výsledky, XP, série, týmový postup a odměny se ukládají do stejného účtu jako na ostrém webu.
- Návrhové fixture skripty, testovací účet ani simulované datum se do této aplikace nevkládají. Původní herní deska zůstává zachovaná.
- Přihlašovací session v localStorage je oddělená podle domény; na preview se hráč znovu přihlásí. Hesla, tokeny ani existující prohlížečové session se nekopírují.

## Přesné povolení

`LIVE_PLAYER_PREVIEW` vyžaduje současně:

1. `PROPLET_LIVE_PLAYER_PREVIEW_ENABLED=true`.
2. Vercel environment `preview`.
3. Přesnou větev `codex/studio-edition`.
4. Produkční Supabase URL `https://iopyhluayfszskyqqpuc.supabase.co`.

Klient musí potvrzení získat ze stejného originu přes `/api/config` (`environment: preview`, `livePlayerPreview: true`) před synchronizací. Neodvozuje jej z query parametru ani lokálního uložiště. Ostatní preview zůstávají omezená jako dosud. `isolated_fair_play_preview()` nad testovací databází se nemění.

Povolené jsou standardní herní session, výsledky, přenos anonymního postupu, skutečné odměnové RPC, referral průběh a běžné hráčské/týmové operace. Zůstávají autentizace, validace cest a identity desek, rate limits, deduplikace a atomické odměny. Explicitní `X-Proplet-Test: 1` nesmí uložit výsledek. Simulace budoucích dat a libovolných Tajenek je v tomto režimu vypnutá.

Deployment si zachovává skutečné označení `preview`, včetně analytického původu. Nepřepisuje se na produkční environment. Crony, rozesílání push kampaní, administrátorské souhrny a historické uzavřené playtesty zůstávají pod původními omezeními. Databázové schéma ani RLS politiky se nemění.

## Ověření

- Nové testy backendu, odměn a klienta pokrývají úzké povolení, odmítnutí jiné větve/databáze, kanonické RPC s mock službami, auth a vstupní kontroly, čekání klienta na konfiguraci, zachování fronty při chybě a omezení simulovaných dat.
- S04 fixture kontroluje nový aditivní boolean a zachovává původní historický digest ostatní odpovědi.
- Regresní testy běží s mock databází/transportem a bez produkčních tajných proměnných. Žádné syntetické hry se neprovádějí na skutečných hráčských účtech.
- Vercel původního preview již poskytuje produkční Supabase auth origin i běžné veřejné pořadí. Google auth start konstruuje návrat na stejný preview origin; na Supabase byl ověřen pouze `referrer` právě vytvořeného nepřihlášeného OAuth flow, nikoli cizí účty nebo přístupové tokeny.
- Po nasazení ověřit `livePlayerPreview=true`, skutečnou session policy, dnešní vydaný obsah, přístup bez Vercel/ChatGPT přihlášení a nedotčený produkční alias. Přihlášený průchod s osobním heslem nebo Google souhlasem provádí skutečný hráč.

Před případným sloučením do main znovu vyhodnotit, zda zachovat tuto dočasnou větev v allowlistu, a schválit produkční nasazení samostatně.
