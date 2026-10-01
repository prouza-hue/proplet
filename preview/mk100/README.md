# Izolované hratelné preview kandidátní stovky

Preview používá beze změn `public/app/game/{state,board,input,hints}.js`,
`game-layout-v3330.js`, současné tiskařské styly a původní ikony. Adaptér a HTML
vycházejí z `preview/gen6/` v ověřeném commitu
`553fb3578c958004b831068dfd268dbcb2a423ab`; rozšíření přidává výběr stovky a
reprezentativní dvanáctky. Neimportuje produkční aplikaci ani API klient.

`python tools/build_mk100_preview.py` vyžaduje přesně 100 desek, jejich otisky,
unikátní cesty a kompletní zmrazené uznávání. Načte `bank.json` a
`recognition-words.txt` z `content/gen6/mozkokalypsa-100/` a zkopíruje pouze
statické herní soubory do `dist-mk100/`. Odmítá `VERCEL_ENV=production` před
čtením banky a před jakýmkoli zápisem. Explicitní `--allow-representative`
slouží pouze k lokální práci na dvanáctce a není finálním buildem stovky.

Obě sady jsou dostupné tlačítky přehledu; přímý vstup do dvanáctky používá
`/?set=representative`. „Další deska“ respektuje zvolenou sadu. Lokální postup
se ukládá pod samostatným klíčem obsahujícím otisk této banky a obnoví se pouze
při shodě ID, otisku, slova a odpovědní cesty. Nedotýká se osobního postupu v
Propletu. Vedlejší uznávaná slova zůstávají platná a nezabírají políčka cílových
cest. Nalezená políčka, tahy, lupa a tři úrovně nápovědy používají nativní
moduly; nedochází k udělení XP či odeslání výsledků.

Obsahová bezpečnostní politika omezuje připojení pomocí `connect-src 'none'`
a `worker-src 'none'`. Data jsou lokálními skripty, ne síťovým načítáním.
Původní fonty Fraunces a Outfit se mohou načíst z Google Fonts. Žádné účty,
analytika, service worker, databáze, serverové funkce ani hráčský test nejsou
součástí výstupu.

## Ověření

`python -m unittest tests.mk100.test_preview -v` ověřuje produkční zábranu,
otisky, odmítnutí timeoutu, úplnost uznávání a shodu nativních modulů se zdrojem.

`node tests/mk100/test_preview_browser.cjs --output work/mk100-browser-final`
spustí pouze lokální statický server a samostatný prázdný headless Chromium.
Vyžaduje nainstalovaný Playwright; v dodaném Windows runtime je jeho cesta
dostupná prostřednictvím `NODE_PATH`. Test dokončuje všechny desky skutečnými
myšími událostmi a reprezentativní dvanáctku CDP dotykovými událostmi na telefonu
390 × 844 a rozloženém Fold viewportu 768 × 1024. Ověřuje též 1024 × 768 Fold
landscape, úzký viewport 320 × 820, desktop 1440 × 1080, nápovědu, lupu, klidný
režim, obnovu postupu a další desku. Výsledek a snímky ukládá do zvoleného
adresáře. Pokud je přítomné `independent-verification.json`, odehraje navíc
nezávisle nalezené vedlejší platné slovo a ověří nulový přírůstek pokrytí.

In-app Browser runtime byl podle jeho vlastních instrukcí připojen a prověřen,
ale v této relaci nevrátil žádný dostupný prohlížeč. Proto bylo použito izolované
headless Chromium z místní instalace. Jde o emulaci viewportů a dotyku; žádné
fyzické zařízení nebylo testováno. Snímky se musí skutečně prohlédnout a přesný
rozsah úspěšného běhu vyčíst z `report.json`. Technické hraní není měřením
lidské obtížnosti.
