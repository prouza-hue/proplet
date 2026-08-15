# Proplet v3.26.0 — instalace PWA

## Co se mění

- kontextová instalační pobídka po dokončené Denní výzvě,
- instalační pobídka po přímém založení účtu,
- žádné vrstvení s account nudge ani push nudge ve stejném dohrávacím flow,
- Android / Chromium používá systémový `beforeinstallprompt`,
- iOS / iPadOS dostává stručný návod „Sdílet → Přidat na plochu“,
- automatická nabídka po odmítnutí čeká 7 dní a po druhém odmítnutí se přestane sama ukazovat,
- instalace zůstává ručně dostupná v profilu,
- v nainstalovaném standalone režimu se instalační UI skryje,
- na iOS se automatická nabídka ukáže jen hráči s účtem, aby lokální postup nezůstal pouze v browserovém úložišti,
- přidáno měření instalačního funnelu přes product events,
- manifest má stabilní `id` a `scope`,
- cache service workeru je posunutá na v3.26.

## Verze v patičce

Patička už nemá verzi natvrdo v HTML. Vykresluje se z klientské `APP_VERSION`, takže se při dalších releasech posune automaticky spolu s aplikací.

## Databáze

Žádná SQL migrace není potřeba.
