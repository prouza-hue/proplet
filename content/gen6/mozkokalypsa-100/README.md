# Mozkokalypsa — dokončená kandidátní stovka v2

Dokončeno po převzetí chatu „Dokončení stovky Mozkokalypsy“. Izolovaná větev `work/mk100-completion-20261001` navazuje na úplný checkpoint `dc1fd060db70f38f7419f48dc498686faf5e5707`. Zachovává původní historii a archivní výsledky; finální nové identity jsou `mk100-v2-001` až `mk100-v2-100`.

## Hotový obsah a důkazy

- `bank.json`: přesně 100 desek 10×10, 14 cílových slov a úplné disjunktní pokrytí každé desky. Obsahový hash banky: `84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab`.
- `manifest.json`: konkrétní identity, otisky, seedy, profily a pořadí. Pět vln po 4 úlevách / 12 hlavních / 3 výzvách / 1 vrcholu; celkem 20/60/15/5.
- `CATALOG.md`: individuální důvod výběru, konkrétní slovní sada, posouzení skutečné mřížky a rizika každé desky. Obě konstrukční recenze a `editorial-bindings-v2.json` vážou úsudek na skutečný finální obsah. Jde o modelovou redakci.
- `full-verification.json` a `independent-verification.json`: 100/100 úplných přesných důkazů jednoznačného pokrytí i cílových cest. Nezávislá kontrola reprodukuje vybrané mřížky z původní geometrie, seedu a transformace; enumeruje kompletní vedlejší slovní zásobu a ověřuje skutečná pravidla runtime. Timeout a neúplný slovník neprocházejí.
- `recognition-words.txt` a `recognition-manifest.json`: všech 103 836 současných rozpoznávaných zápisů, připnutá wordfreq 3.1.1. Hash množiny `eaf808cd425024e1f84df62498abb8f7de9a39257b70dc0d069ac6f4d0cd05c1`; hash souboru `5d747a525609f648296297850223f3b01a8e628f75e1ca6ec9e1da9d919002f7`. Uznávání se kvůli jednoznačnosti neomezilo.
- `candidate-pools-v2.zip`, `candidate-pool-provenance.json`, `candidate-pool-archive-audit.json`: 2 406 obsahově odlišných plně ověřených kandidátů, všech 100 finálních výběrů v archivu. Není to prvních 100 průchodů solverem.
- `summary.json`: všechna opakování a překryvy. 1 400 výskytů, 1 008 různých slov, nejvýše dva výskyty jednoho slova, nejmenší odstup 20 desek. Jediná výjimka vůči předchozím playtestům: LAHODNÝ na 37. Široká historie vydaných i rezervovaných bank obsahuje 417 různých shod; není osobní historií hráče.
- `independent-canonical-geometry.json`: 62 různých konstrukcí po sjednocení otočení, zrcadlení a obrácení jednotlivých cest. Nejmenší opakovaný rozestup 10 desek, nejvýše čtyři použití. Archivní výběr před úpravou rozestupu je zachován; změny popisuje `canonical-selection-amendments-v2.json`. Schválená dvanáctka zůstala totožná.
- `endgame-audit-v2.json`: dvacet cílených závěrů po nalezení jedenácti slov, tři pojmenované hypotézy pořadí, šest citlivostních pořadí a všech 364 zbývajících trojic na desku, celkem 7 280. Slabé zbytky jsou přiznané. Ve všech 20 je dolní kvartil tlaku přes všechny trojice nižší než u reference mk2-10; robustní zlepšení napříč pořadími není prokázané.

Původní Lexikon v3 zůstal bajtově shodný: `7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277`. Palindrom RADAR znemožňoval jedinečnost orientovaných cest na 16 a 88; individuálně schválené náhrady LASER a SLOKA zachovaly délku a tier. Původní slovní recenze a plán jsou uchovány; rozsah a důvod změny dokládají oba soubory `*-amendments-v2.json` a checkpoint odmítnutí. RADAR zůstal v lexikonu a rozpoznávání.

## Hratelné preview

`preview/mk100/` obsahuje samostatný statický náhled s přehledem stovky i reprezentativní dvanáctky. Používá stejné nativní herní moduly, Fraunces, tiskařské styly, nápovědy, lupu a klidný režim. Postup je oddělený v místním prohlížeči; nezapisuje výsledky ani XP. Serverové funkce, účty a připojení herního runtime k API nejsou součástí sestavení. Produkční sestavení je výslovně odmítnuto.

Finální `preview/mk100/verification/report.json` dokládá všechny desky dokončené skutečnými událostmi myši a reprezentativní dvanáctku skutečnými emulovanými dotykovými událostmi na telefonu a rozloženém Foldu. Obsahuje přesné rozměry, průchody nápovědou, obnovou a další deskou, kontrolu vedlejšího slova a chyby/síťové požadavky. Snímky byly vizuálně prohlédnuté. Jde o headless Chromium a emulaci; žádné fyzické zařízení nebylo testované.

## Reprodukce z repozitáře

Použít Python s `-X utf8`, připnutou wordfreq 3.1.1 a balíčky uvedené v `offline-environment.json`. `core.autocrlf=false` zachová bajtové otisky. Místní závislosti při výrobě byly izolované pod `work/`, produkční requirements se neměnily.

```text
python -X utf8 -m tools.verify_mk100_release --stage full
python -X utf8 -m tools.verify_mk100_geometry_diversity
python -X utf8 -m tools.build_mk100_delivery endgames
python -X utf8 -m tools.build_mk100_delivery catalogue
python -X utf8 tools/build_mk100_preview.py
python -X utf8 -m unittest tests.mk100.test_preview -v
node tests/mk100/test_preview_browser.cjs --output work/mk100-browser-final
```

Browserový test vyžaduje Playwright a Chromium; podrobnosti a argumenty jsou v `preview/mk100/README.md`. Pro přeselekci z dochovaných poolů rozbalit `candidate-pools-v2.zip` do `work/mk100/pools-v2/` a spustit `python -X utf8 -m tools.gen6.mk100_manufacture full`; tato akce znovu vytvoří výrobní výstupy, které je nutné nově nezávisle ověřit. Výroba nových poolů není nutná pro reprodukci vybraných mřížek nebo kontrolu důkazů.

`sourceSha` označuje uložený zdrojový snapshot výroby `ae0ba92c7a154eaca97a18c08e5dbdc20a6ded5a`; skutečné byte-hashe zmrazených vstupů jsou v důkazech. Vercel deployment se ověřuje proti vlastnímu Git SHA zvlášť, nikoli podle tohoto informačního pole.

## Rozsah dokončení

Hotová je kandidátní stovka, její individuální modelová redakce, důkazy a izolované preview. Produkce hrajproplet.cz zůstává na `174e0fa2a3e8befd0fe01ac8ba7771f4ece25558` / `dpl_AiLrqzQwahpqrFRwowAn96XYrTQ8`. Supabase byl použit pouze pro čtení metadat projektu; bez dotazů nebo zápisů do hráčských dat. Nebyl aktivován další playtest. Hráčská obtížnost, zábavnost a účinek konce nové série dosud nejsou změřené.
