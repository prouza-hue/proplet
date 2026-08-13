# Proplet v3.18.1 — oprava balíčku administrace

V3.18.1 opravuje neúplný update balíček verze 3.18.0. Ten obsahoval `public/admin.js`, ale chyběly v něm `public/admin.html` a `public/admin.css`. Při nasazení přes starší verzi proto `/admin` skončilo chybou, že soubor `admin.html` neexistuje.

## Oprava

- update i cloud balíček obsahují celou administraci: `admin.html`, `admin.css` a `admin.js`;
- `/api/health` nově vrací také `adminStatic`, takže lze úplnost deploymentu ověřit bez otevírání administrace;
- pokud by statické soubory přesto chyběly, `/admin` vrátí srozumitelnou servisní chybu namísto interního tracebacku;
- funkce globálního Free leaderboardu z v3.18.0 zůstávají beze změny.

Databázová migrace není potřeba.
