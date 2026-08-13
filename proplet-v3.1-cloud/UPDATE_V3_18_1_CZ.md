# Hotfix Propletu na v3.18.1

## Co nasadit

Nahraj celý obsah `proplet-v3.18.1-update.zip` do kořene stávajícího projektu a potvrď přepsání souborů.

Balíček musí obsahovat mimo jiné:

- `server.py`,
- `public/admin.html`,
- `public/admin.css`,
- `public/admin.js`,
- `public/app.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`.

## Databáze

Žádnou SQL migraci nespouštěj. Pokud už jsi spustil migraci v3.17 pro administraci, databáze je připravená.

## Kontrola

1. Po deploymentu otevři `/api/health`.
2. Správný stav je `version = 3.18.1`, `adminStatic = true` a `adminMigration = true`.
3. Potom otevři `/admin` jako přihlášený hráč Pavel v týmu Prouza.

Pokud prohlížeč stále ukazuje starou verzi, přijmi aktualizaci PWA a stránku jednou obnov.
