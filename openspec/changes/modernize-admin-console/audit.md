# Audit a podklady k modernizaci adminu

Ověřeno 28.–29. 10. 2026, Europe/Prague. Dokument rozlišuje čtení skutečného stavu, návrh a implementaci. Zdrojové soubory `sources/` zůstaly beze změny.

## Ověřený výchozí stav

| Oblast | Zjištění |
|---|---|
| Produkce | `https://hrajproplet.cz`, release 4.09.15 |
| Git | `origin/main` = `1de738938ff244fc010808daf33aea7def4b6481` |
| Vercel | READY production `dpl_5Z5Eu9YBNZRRGHSEWJM837jpAVac`, větev main, stejný SHA |
| Veřejný health | `ok=true`, `database=true`, free/daily generation 4, 300 free desek na obtížnost, archiv/Tajenka/atomic result zapnuté |
| Databáze auditu | Supabase `proplet`, `iopyhluayfszskyqqpuc`, ACTIVE_HEALTHY; pouze metadata funkcí, žádná osobní hráčská data |
| Testovací databáze | Existující `proplet-s08b-atomic-result-test`, `eanzztstmwlamwfdskbf`; dostupnost neznamená volný prostor pro libovolné zápisy |
| Pracovní větev | `codex/admin-modernization`, vytvořená z ověřeného origin/main v samostatném worktree |
| PR 118 | Otevřený draft `ux/admin-legacy-recovery`, head `c92e70f41458118f2cea87cb3490105be1e3fdbf`; nemergován |
| Souběžná práce | Měsíční soutěž a další vizuální preview jsou oddělené větve; nesmějí se vykazovat jako současná produkce |

`/api/config` potvrzuje prostředí production; health sám nezveřejňuje DSN. Projekt Supabase byl vybrán podle připojeného projektu a známého mapování v kódu, metadata RPC ověřena přímo na tomto projektu. Před realizací znovu potvrdit skutečné připojení nasazované aplikace bez zveřejňování klíčů.

Živé `/admin.html` bylo otevřeno v prohlížeči. Připojený prohlížeč ukázal přihlašovací bránu; za ní nebyly prohlíženy skutečné přihlášené obrazovky ani metriky. Audit autentizovaných částí vychází z kódu ověřeného produkčního SHA, nikoli z domnělého přihlášení. Návrh používá výslovně fiktivní data.

## Co dnes admin umí

| Stávající sekce | Schopnosti | Rozhodnutí v návrhu |
|---|---|---|
| Launch | historický funnel, návraty, chyby, support | Výchozí obrazovku zrušit; současná analytika zvlášť, podpora zvlášť, historický funnel archivovat |
| Přehled | aktivita, dokončení, Daily, verze, hlasy | Zachovat užitečné údaje, sjednotit význam a období |
| Quality | první pokusy, obtížnost, příznaky desek | Zachovat, zpřístupnit metodiku, limity a historii |
| Hlášení | slova, stavy, interní poznámky | Zachovat workflow a doplnit kontext úlohy a hráče |
| Uživatelé | hledání jména/týmu, přehled a detail | Stránkování, UUID, správné XP, identity, porovnání, recovery |
| Historie | posledních max. 200 zásahů | Zachovat a doplnit filtry, cílové odkazy a srozumitelné názvy |
| API bez UI | account-integrity, push-diagnostics, quality-history | Zpřístupnit v příslušných sekcích s přesným rozsahem |

## Konkrétní nálezy

1. **P1: Launch sleduje jinou verzi onboardingu.** `backend/launch_report.py:7` má `board-v2`; stará slova jsou MRAK/JABLKO/ČOKOLÁDA (ř. 72). `public/app/engagement/first-steps.js:3–5` má `board-v3-short` a PES/LES/ČAJ. Příslušná SQL migrace filtruje `board-v2`. Read-only dotaz na produkční `pg_get_functiondef` navíc potvrdil, že skutečný `proplet_launch_dataset` obsahuje `board-v2` a neobsahuje `board-v3-short`.
2. **P1: XP v seznamu a detailu mají jiný zdroj.** `SUPABASE_MIGRATION_V4_01_39_QUERY_BOUNDS.sql:187,196` sčítá výsledky; `server.py:3430` používá `player_stats`. Skutečná produkční `proplet_admin_users_v1` obsahuje `sum(r.points)` a neodkazuje na `account_rewards`; `proplet_player_stats_v1` na `account_rewards` odkazuje. Jde o ověřenou odlišnost výpočtu, nikoli změřenou konkrétní odchylku hráče.
3. **P1: Neúplný seznam hráčů bez upozornění.** API `server.py:3392–3401` vrací default 60/max 200 a nepředává offset. RPC jej podle produkčních metadat přijímá. UI `public/admin.js:124` ignoruje total; hledání SQL zatím neobsahuje přesné UUID.
4. **P1: Podpora je ukrytá a po vyřízení mizí.** `admin.js:62–69` načítá jen `status=open`; backend nabízí více stavů. Chybí historie, vyhledání a propojení na stabilní hráčské ID. Backendové total po limitu není skutečný počet všech odpovídajících případů (`server.py:3314–3330`).
5. **P2: Nevyužité API.** `account_integrity_v33210.py:188`, `push_diagnostics_v3329.py:391`, `server.py:3570`. Integrity pokrývá podezřelé registrace v krátkém burstu, nikoli veškeré duplicity či důkaz společného vlastníka.
6. **P2: Quality zatajuje kontext.** API má 90denní okno, první životní pokusy a `historicalDataLimited`; UI období a limity neukazuje. Zachovat oddělení calm mode, vyřazená ID a kalibraci. Současný index pokrývá daily/free; ostatní režimy neslibovat bez nového kontraktu.
7. **P2: Smíšená období a jednotky.** Přehled míchá účty za 7 dní, dnešní výsledky, celoživotní hlasy a verze podle počtu pokusů za 30 dní (`admin.js:76–83`). Počet pokusů není počet unikátních hráčů.
8. **P2: Nedostatečná autorizace zápisu snapshotu.** `POST /api/admin/quality-snapshot` nekontroluje `write=True` (`server.py:3578–3584`). Centrální owner-only kontrolu vztáhnout i na samostatné installery, explicitní write check ponechat.
9. **P2: Obtížné ovládání.** Výběr se neukládá v URL; tab se po reloadu vrací na Launch; klikací řádky nejsou přístupné klávesnici; dialog nemá plnou správu fokusu; chybí čerstvost dat a typografie obsahuje 8–10px text. Admin má generické P a eyebrow nadpisy.

## PR 118: co převzít a co opravit

Zdroje: [PR 118](https://github.com/prouza-hue/proplet/pull/118), chat [Obnova hesla Proplet](https://chatgpt.com/g/g-p-6aac5023adc48191bd66be037edff741-proplet-pro/c/6aa7f27f-c208-83eb-8697-671b83967303). Chat byl načten, původní dokončení draftu a novější případy rozlišeny od nového zadání.

Převzít GET/POST recovery-email nad stabilním player UUID, serverový owner pin, aktivní grant, Magic Link, maskování, hash tokenu, expirační limit, odmítnutí obsazeného ověřeného e-mailu a dokončení až skutečným ověřením schránky. PR neposkytuje slučování účtů, odpojení Google ani přepočet týmových výsledků.

- **Oprava nutná před vydáním:** `public/admin-recovery.js:32–40` může po rychlém přepnutí A → B vykreslit opožděnou odpověď A do detailu B. Kontrolovat UUID/generaci požadavku při renderu a odeslání, zrušit starý request, potvrdit cíl.
- **Oprava nutná před vydáním:** `admin_recovery.py:153–176` ignoruje chybu při zneplatnění předchozího challenge. Sdílený problém je i v dnešním auth helperu. Vydání/spotřeba musí být transakční a při chybě zavřené; novější vydání nesmí ponechat starší odkaz účinný. Explicitně vyřešit souběh i kolizi během čekání.
- **Kompatibilita:** celý diff prošel `git apply --check` na aktuálním main bez konfliktu; nic se neaplikovalo. Dnešní Google PKCE, link intent a providerovo `email_confirmed_at` zachovat, nepřepisovat starým auth souborem.
- **Další release podmínka z nezávislé revize:** cílový účet může mezi odesláním a spotřebováním recovery ověřit jinou schránku nebo změnit auth vazbu. Kontrola e-mailu obsazeného jiným hráčem tento případ sama neřeší. Při spotřebování ověřit také stav/revizi identity cíle a odmítnout přepsání novější vazby; stejné již dokončené ověření řešit idempotentně.
- **Ověření:** původní bezpečnostní test PR spuštěný auditním agentem v paměti s mock DB/HTTP prošel. Není to současný plný gate, browser recovery test ani skutečný průchod e-mailem.

## Otevřené body pro realizaci

- Ověřit skutečně emitované události a úplnost měření `board-v3-short`; neodvozovat konverzi z pouhé existence event name.
- Potvrdit dnešní pravidla prvního účtu, potvrzeného uložení a anonymních návštěv, které lze měřit bez porušení preferencí.
- U cronů, front a integrací zobrazovat jen stavy s doloženým zdrojem; dostupnost endpointu sama neprokazuje poslední úspěšné spuštění.
- Znovu zjistit main/prod/preview/databázi před změnou a před mergem; souběžné soutěžní preview není tímto návrhem schváleno k vydání.
- Citlivé opravy týmů/identity ve druhé etapě potřebují vlastní transakční operace, náhled dopadu, důvod a audit; nevydávat je za funkce PR 118.

## Provedené a neprovedené kroky

Provedeno: načtení START/registru, relevantního chatu, PR, ověřeného kódu, přihlašovací brány, Vercel metadata, health/config a read-only SQL metadat. Vytvořen samostatný návrh a prototyp.

Neprovedeno: změna produkčního kódu/dat, přihlášení za uživatele, odeslání recovery e-mailu, merge PR 118, spuštění soutěžního přepočtu nebo změna hráčského účtu. Implementační úkoly zůstávají neoznačené jako hotové.
