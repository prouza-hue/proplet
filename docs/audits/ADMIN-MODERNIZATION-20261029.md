# Administrace Propletu — první etapa

Datum: 29. 10. 2026, Europe/Prague. Rozhodnutí uživatele: implementovat první etapu včetně PR 118 a bezpečnostních oprav, samostatná větev, testy a funkční preview. Main a produkci neměnit.

## Výsledek

- Větev: `codex/admin-modernization`; draft [PR 222](https://github.com/prouza-hue/proplet/pull/222).
- [Funkční preview](https://proplet-git-codex-admin-modernization-pavel-prouzas-projects.vercel.app/admin.html).
- Preview vyžaduje přesnou větev, prostředí preview a databázi `eanzztstmwlamwfdskbf`. Při nesouladu se nespustí. Inherited produkční klíč se nepoužije; push a cron credentials jsou vypnuté.
- Syntetické přihlášení vlastníka je pouze v gitignored `work/admin-preview-login.txt`. Uživatelova produkční identita ani heslo se do testovací databáze nekopírovaly.
- Původní PR 118 zůstává draft/open/nemergovaný; jeho funkce byly přeneseny na současný auth základ této větve.

## Implementace

Sedm sekcí: Přehled, Hráči a týmy, Hlášení, Obsah a kvalita, Provoz, Analytika a Historie. Nový shell zachovává Tiskařskou dílnu, lokální Fraunces/Outfit a české ovládání bez eyebrow nadpisů.

Seznam hráčů má skutečné total, stránkování, řazení a hledání UUID. XP používají společný databázový souhrn s detailem účtu, včetně account rewards. Běžné stránkové souhrny se počítají nad page IDs; řazení podle XP nezbytně pracuje se všemi odpovídajícími identitami. Přibyl detail a porovnání účtů a přehled týmů pouze ke čtení.

Podpora a slova mají samostatné podtypy, filtry, historii a vazby na hráče/úlohu. Změna stavu a audit jsou jedna transakce, včetně idempotentního opakování. Obsah používá aktuální runtime selektory; analytické pokrytí režimů je uvedené zvlášť. Zapojené jsou historie kvality, push a omezená diagnostika krátkých registračních burstů.

Současná analytika zpracovává doložené `board-v3-short` first-game flows a vyzrálé D1/D7 kohorty. Kroky bez doložené společné identity, zejména návštěva/trénink či dokončená autentizace, zůstávají označené jako nedostupné. Client-confirmed save není vydáván za databázovou účtenku. Starý `board-v2` Launch je oddělená historie.

## Bezpečnost obnovy

- Owner pin a aktivní grant chrání všechny adminové API i historické `/api/quality-report` a `/api/quality-history`. Zápisy mají navíc write kontrolu. Další DB owner grant nestačí.
- Serverový náhled je vázaný na přesné UUID, monotónní revizi identity, vlastníka, hash e-mailu a důvodu a bezpečný callback. Platnost je pět minut.
- Issue, supersede, delivery a consume používají společný transakční lifecycle. Během odesílání je challenge neúčinný; až doručení a audit v jedné transakci jej aktivují.
- Reset hesla atomicky mění heslo, primární token a revokuje další relace. Ověřenou novější identitu nemůže přepsat starý odkaz.
- Tokeny jsou hashované, e-maily maskované, potvrzení idempotentní. Chybějící RPC neaktivuje neatomický fallback.
- Preview odesílá pouze do uživatelem určené testovací schránky. Callback používá ověřenou stabilní adresu větve, nikoli libovolný browser Origin/Host. Produkční callback zůstává omezený na produkční prostředí.
- Zachované jsou Google PKCE, explicitní link intent a providerovo potvrzení schránky.

Migrační dopad před případným produkčním vydáním: nedokončené historické challenge bez cílové revize budou zneplatněny. Hráč požádá o nový odkaz. V této etapě se změna aplikovala pouze do testovacího projektu a disposable PostgreSQL.

## Ověření

| Oblast | Doložený výsledek |
|---|---|
| Aktuální lokální gate | 192 testů PASS, 536 syntax kontrol PASS |
| PostgreSQL 17.11 | 13 skutečných concurrency/rollback skupin PASS; pouze nová databáze na loopback |
| Workspace SQL | 206 syntetických účtů: dvě stránky, true total, UUID, bonusová XP a archiv; BEGIN/ROLLBACK PASS |
| Case SQL | Selhání auditu vrací změnu případu zpět; idempotence, poznámka a ACL PASS |
| Živý API průchod | 19 kontrol PASS nad skutečným preview a syntetickými účty |
| Vlastnická hranice | Nepřihlášený 401; jiný účet i s owner grantem 403 včetně starých quality aliasů |
| E-mailové E2E | Dva skutečné e-maily; uživatel potvrdil schránku a nastavil nové testovací heslo |
| Výsledek E2E | Oba challenge consumed, revize identity 2, jedna nová relace, staré heslo 401; XP 2250 a tým beze změny |
| UI | Sedm sekcí, hledání a porovnání, serverový náhled, Escape, fokus, Back/Forward, obě témata |
| Šířky | 320/390/690/1440 CSS px; porovnáváno se skutečným clientWidth, nikoli šířkou včetně scrollbaru |
| Artefakty a cache | Admin shell/moduly/API obcházejí herní SW cache, statika adminu má no-store; společné release/cache markery souhlasí |
| Historické kontrakty | Původní route/OpenAPI digesty zachované; validují se pouze schválené aditivní delty |

Šířky jsou browser emulace, nikoli test fyzického zařízení. E-mailové potvrzení i reset provedl uživatel; jeho nové testovací heslo nebylo vyžádáno ani zaznamenáno. Přihlašovací údaje vlastníka testovacího adminu zůstaly funkční.

Při ověření byly opravené dvě skutečné SQL chyby (rezervovaný alias a kolize PL/pgSQL proměnné se sloupcem), chybná šablona Quality, návrat fokusu po asynchronním náhledu a mobilní datumová pole. Současně se do testovacího projektu doplnily dvě chybějící existující parity migrace pro diagnostiku integrity a push opens. Produkce se při těchto opravách neměnila.

Lokální Windows checkout potřeboval vrátit neměnné referenční soubory na přesné Git blob bytes, aby CRLF nerozbíjelo zmrazené obsahové hash testy. Herní banky se neměnily a tyto normalizace nejsou obsahovým diffem. Dočasný PostgreSQL runtime byl přesunut mimo repozitář, aby se nezahrnul do syntax inventory.

V CI se zachovaly všechny browser scénáře. Kombinovaný profilový job překročil původních pět minut bez selhané assertion; rozpočet byl zvýšen na osm minut. Aktuální výsledky konkrétního head jsou u PR, nikoli odvozené ze staršího běhu.

## Hranice a další vydání

Main i produkční deployment při závěrečném ověření zůstávají na `1de738938ff244fc010808daf33aea7def4b6481`, release 4.09.15. Veškeré nové migrace jsou pouze připravené pro případné budoucí produkční rozhodnutí.

Produkční nasazení, změny skutečných hráčů, přesuny týmů, odpojování identit, slučování účtů a korekce historických bodů nejsou touto etapou provedené ani dodatečně autorizované. Úkoly 9.1–9.2 v OpenSpec zůstávají výslovně odložené.

Před budoucím vydáním znovu ověřit aktuální main, produkční SHA, datový projekt, migrační pořadí a dopad zneplatnění starých odkazů. U neověřené telemetrie a nedoložených cron běhů zachovat přiznané omezení dat; nevyrábět zpětné konverze nebo zelené stavy.
