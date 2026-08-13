# Proplet v3.19.1 — opravný release

V3.19.1 opravuje chybný balík 3.19.0. Herní obsah, databázové schéma i všech 800 Free úrovní zůstávají stejné.

## Co se pokazilo

`public/index.html` ve v3.19.0 skončil uprostřed formuláře profilu. Chyběl zbytek rozhraní i `<script src="/app.js"></script>`, takže se klientský JavaScript vůbec nespustil. Stránka proto působila jako odhlášená a žádné tlačítko nereagovalo. Účty, výsledky a další data v Supabase tím nebyly změněny.

Route `/admin` navíc zkoušela načíst `public/admin.html` z izolovaného Python runtime. Vercel ale složku `public/` doručuje samostatně jako statické soubory, takže kontrola hlásila chybu, přestože `/admin.html` na CDN existoval.

## Opravy

- obnoven kompletní `public/index.html`,
- verze a PWA cache zvýšeny na 3.19.1,
- `/admin` nyní bezpečně přesměruje na `/admin.html`,
- `/api/health` popisuje skutečný způsob doručení administrace,
- release test ověřuje konec HTML, načtení `app.js` a všechny statické ovládací prvky vyžadované funkcí `bind()`,
- balík se po sestavení znovu testuje v rozbalené podobě.

## Data

Release nemění ani nemaže žádné tabulky. SQL migraci v3.19 není potřeba spouštět znovu, pokud už `/api/health` ukazuje `freeGeneration2Migration: true`. Její opakované spuštění je ale bezpečné.
