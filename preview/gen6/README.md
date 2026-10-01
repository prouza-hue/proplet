# Izolované preview Mozkokalypsy III

Pracovní náhled, nikoli aktivace třetího hráčského playtestu. Produkční banky,
backend, účty, XP a výsledky druhého kola zůstávají beze změny.

`preview.js` skládá existující beze změny převzaté moduly
`public/app/game/{board,input,state,hints}.js` a `game-layout-v3330.js`.
Přebírá schválené styly Tiskařské dílny, Fraunces a ikonu Mozkokalypsy.
Připojuje výhradně statickou ověřenou kandidátní banku a přesný zmrazený
rozpoznávací slovník použitý validátorem. Dynamický wordfreq fallback
v tomto statickém náhledu neběží; produkční rozpoznávání se nemění.

## Sestavení

```sh
python tools/build_gen6_preview.py \
  --bank content/gen6/mozkokalypsa-v3-preview.json \
  --recognition content/gen6/recognition-words.txt
```

Výstup: `.vercel/output/static`, konfigurace Vercel Build Output API v3
v `.vercel/output/config.json`, otisky přebraných souborů a oddělení režimu
v `.vercel/output/preview-build.json`.

Builder odmítne produkční build (`VERCEL_ENV=production`), neúplnou banku,
jiné ID či rozměry, nesouhlasné otisky a chybějící důkaz jedinečnosti.
Před sestavením musí být dokončený plný důkaz přes výrobní validátor;
builder jej nenahrazuje kontrolou deklarovaného stavu.

## Oddělení od produkce

- Výstup obsahuje pouze jmenovitě povolené statické soubory. Žádný API backend,
  Supabase klient, přihlašování, analytika, service worker ani cron.
- CSP `connect-src 'none'` a `worker-src 'none'`; cesta `/api` vrací 404.
  Google Fonts zůstává povolený kvůli původním fontům.
- Hra zapisuje pouze vlastní localStorage jmenný prostor
  `proplet-gen6-isolated-v1:<bankContentHash>`. Nenahrává výsledky ani poznámky.
- Nepoužívat běžný produkční `vercel.json` pro toto statické preview.
  Izolovaná větev musí výslovně spouštět uvedený builder bez cronů.
- Změna konfigurace pro takovou větev není produkční migrace a nemá být
  sloučena do main bez samostatně schváleného postupu.

## Ověření pro zveřejnění náhledu

Ověřit úplnou banku, odmítnutí neplatných vstupů a produkčního sestavení,
statické výstupy bez funkcí, otevření hry, skutečný tah a nápovědu, návrat
k rozehrané desce, dokončení a síť bez API požadavků. Pro mobil, Fold viewport
a desktop zaznamenat pouze skutečně provedenou kontrolu; viewport není
ověření fyzického telefonu.
