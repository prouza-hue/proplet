# Aktualizace Proplet na v3.16.4

V3.16.4 doplňuje krásný náhled sdílené URL, kompletní sadu ikon a anonymní globální pořadí přímo na výsledkovku Daily.

## Databáze

Nová SQL migrace není potřeba.

## Deployment

Nejbezpečnější je nasadit celý cloud balíček. Z update balíčku nahraď:

- `server.py`,
- `public/app.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`,
- `public/manifest.webmanifest`,
- `public/favicon.svg`,
- `public/favicon-32.png`,
- `public/apple-touch-icon.png`,
- `public/icon.svg`,
- `public/icon-192.png`,
- `public/icon-512.png`,
- `public/share-card.png`.

Service worker má nový cache klíč. Po nasazení přijmi nabídku aktualizace a aplikaci jednou obnov.

## Kontrola po nasazení

1. Na `/api/health` ověř `version = 3.16.4`, `freeGeneration = 2`, `dailyGeneration = 2` a `database = true`.
2. V patičce ověř **Proplet v3.16.4**.
3. Otevři přímo `/share-card.png`; musí se zobrazit náhled 1200×630.
4. Pošli adresu Propletu v nové zprávě na WhatsApp nebo Messenger a ověř obrázkovou kartu. Starší náhled může mít konkrétní služba uložený v cache.
5. Dokonči Daily s přihlášeným hráčem. Po synchronizaci se na výsledkovce musí objevit přesné globální místo a okolní anonymní výsledky.
6. Znovu otevři hotovou Daily; globální karta se načte znovu.
7. Ověř, že žádný řádek soupeře neukazuje jméno, avatar ani tým.

## Rollback

Rollback na v3.16.3 nemaže žádná data. Z výsledkovky pouze zmizí globální karta a sdílení se vrátí ke starším metadatům.
