# Proplet v3.17.0 — první skutečná administrace

## Co přibylo

- samostatná stránka `/admin`, vizuálně navazující na Proplet a použitelná i na mobilu;
- serverově ověřované admin oprávnění oddělené od běžného hráčského účtu;
- první vlastník administrace: hráč Pavel v týmu Prouza;
- Přehled hráčů, dokončených her, dnešní Daily, otevřených hlášení a používaných verzí;
- plné Quality Analytics nad prvními pokusy, včetně filtrů obtížnosti a outlierů;
- skutečná fronta hlášení slov s poznámkou hráče a stavem zpracování;
- seznam uživatelů a detail hráče bez vystavování hesel, hashů nebo přihlašovacích tokenů;
- auditní historie každého zapisujícího administrátorského zásahu;
- odkaz do administrace v profilu, který server ukáže jen oprávněnému účtu.

## Oprava hlášení slov

Původně mohl jeden člověk uložit pouze jedno hlášení na celou úlohu. Druhé slovo první záznam přepsalo.

Nově:

- každé různé slovo ze stejné úlohy tvoří samostatný případ;
- opakované odeslání stejného slova jen aktualizuje poznámku a nevyrábí spam;
- anonymní reporty se při přihlášení slučují podle konkrétního slova, ne celé desky.

## Zabezpečení

- běžný hráč se do admin API nedostane ani po přihlášení a znalosti adresy;
- původní `?qa=1` přesměruje na chráněnou administraci;
- Quality endpointy nově vyžadují admin grant;
- browser nemá přímý přístup k `admin_accounts` ani `admin_audit_log`;
- uživatelské API neposílá `password_hash`, `token_hash` ani tajné hodnoty;
- zapisovat mohou role `owner` a `editor`, role `viewer` pouze čte.

## Rozsah první verze

Administrace záměrně neumí mazat hráče, výsledky ani XP. Jedinou změnou dat je vyřízení hlášení slova a ta se vždy audituje. Bezpečné opravné zásahy nad výsledky přijdou až jako přesně omezené akce, ne univerzální tlačítko „něco smaž“.

## Testy

- serverová kompilace a syntaxe obou JavaScriptů;
- oddělení role Pavel / Prouza od běžného hráče stejného týmu;
- ochrana nových i původních Quality endpointů;
- dva reporty různých slov z jedné úlohy zůstávají dvěma záznamy;
- opakování stejného reportu nevytváří duplicitu;
- změna stavu vytváří auditní záznam;
- admin API nevystavuje hesla ani tokeny;
- zachované regresní testy Daily replaye, sdílení a výsledkových pochval.
