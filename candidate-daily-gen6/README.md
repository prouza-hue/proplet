# Daily Gen6: 100 kandidátních dní

5. 10. 2026: obsahová banka pro **7. 10. 2026–14. 1. 2027** je dokončená. Má 28 Snadných, 44 Středních a 28 Těžkých; nezávislé technické QA i AI redakce přijaly všech 100 desek. Pavel obsah dosud neschválil a nic není nasazeno.

## Obsah a důkazy

- `catalog.md` a `catalog.csv`: všech 100 dat, sestav a přesných obsahových hashů pro soukromé posouzení.
- `production/bank.json`, `server-pack.json`, `schedule.json`: finální banka a date bindings. Pack zůstává `status=candidate`.
- `production/independent-verification.json`: vlastní solver a geometrická kontrola. 100/100 jedinečných řešení i cílových cest; plná rozpoznávací sada 103 836 zápisů; bez chyb.
- `production/editorial-review.json`: konečná AI redakce, svázaná s každým přesným geometry contentHash. Není lidský playtest.
- `production/editorial-repairs.json`: jedna změna Snadné 23. 11. Kontextový tvar ZLATÁ v konkrétní sestavě nahradila nová přirozená sestava. Nejde o plošný zákaz v Lexikonu v3. Původní batch, redakce a manufacture checkpoint zůstaly v evidenci.
- `DAILY_INPUTS_VERIFIED.json` a `REMOTE_MAIN_METADATA.json`: aktuální main/produkce a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db. Výslovné změny vstupů jsou data/puzzles.json, public/puzzles.json a content/generation-manifest.json. Neměnný Lexikon v3 a původní výrobní evidence se nepřepisují.
- `summary.json`: kapacita, pestrost po obtížnostech a měsících, délky/témata, stav výroby a přesné hranice dokončení.
- `integration/`: konkrétní kandidátní patch, 11 Python kontraktových testů, Node kontrakt, logy a další potřebné kroky. **Není dokončená produkční integrace.**

Celý adresář candidate-daily-gen6 je v `.vercelignore`. Budoucí desky nesmějí být ve veřejném JSON, JS, bootstrapu, SW, sourcemapách nebo veřejném hráčském preview. Soukromý katalog nepoužívat pro veřejné sdílení. Při schváleném vydání přenést pouze konkrétní approved server-pack do ověřeného neveřejného serverového bundle.

## Výroba a reprodukce

Původní přesný výrobní zdroj je `Proplet_osvezeni_300_20261002.zip`, Library ID `libfile_04d7e9cd428481919a0be079c404a9e8`, SHA-256 `56ce8b9fe48f85d7180736aa0ba3745b55be53ad3b94ce61da9114721918457d`. Tooling source SHA `75b177320ffaa6726aa62c0f5d84ee04255349b2`; Lexikon v3 SHA-256 `7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277`.

Obnovit work-free-refresh z přesného původního balíčku, zachovat originální SOURCE_INPUTS_VERIFIED; získat tři aktuální delta soubory z připnutého main; použít nový DAILY_INPUTS_VERIFIED a vložit adaptéry do tools/. Kanonický vstup je:

```sh
python3 -m tools.daily_candidate_cli --out candidate-daily --limit 100 --seconds 45
```

`daily_gen6.py` uchovává přesný původní výrobní kód a jeho fingerprint. Root seed je 2026100501; per-board seed vychází z hashovaného root seed, bankVersion, pražského data, obtížnosti a pokusu. Existuje jediný zapisovatel, procesový timeout, checkpoint a odmítnutí změněných zdrojů.

`daily_candidate_cli.py` odmítá přepsat již redakčně přijatý batch předchozí výrobní fází. `production/resume-guard-verification.json` dokládá tento guard i odmítnutí změněného checkpoint seedu. Finální přijetí je v acceptance-checkpoint.json; původní manufacture checkpoint se po redakci znovu nepouští do finálního adresáře.

`repair_daily_editorial.py` provádí pouze konkrétní evidovanou opravu, s kontrolou minulých i budoucích odstupů a celkové četnosti. `independent_verify.py` má samostatnou geometrii a solver; CLI uvádí explicitní vstupy. Po každé změně obsahu se znovu ověřují nová sestava, celá banka a exact-contentHash redakce.

Finální bank contentHash je `3abe6feda3e25262ed07aa25aa02687338a41ab6382e018760a13961f2ada104`; soubor bank.json SHA-256 `49fbdb9d95aa007911f0d7bde5522127adac01d51728109315f84d51741a558e`.

## Přechod a navazující obsah

Plánovaná pražská půlnoc 7. 10. 2026 je 6. 10. 2026 22:00 UTC. Po schválení a bezpečné integraci se stará budoucí Daily od cutoveru vyřadí z oficiálního výběru; jejich původní ID/těla se archivují, historie/XP/streaks se zachovají. Klíč účastnické výzvy zůstává daily:YYYY-MM-DD. Při posunu cutoveru se již otevřené dny nesmějí nahradit a rozpis/připomínka se přepočítají.

Po 14. 1. 2027 nenásleduje modulo ani návrat ke staré odhalené bance. Další schválený obsah má navázat 15. ledna. Připomínka je vytvořená na 31. prosince 2026 dopoledne Europe/Prague, 14 dní před poslední deskou; další výroba má zohlednit tehdy schválenou evoluci generátoru a nepřegenerovat zbytečně dlouhou zásobu.

Před vydáním zbývá: schválení konkrétní banky, kompletní app.js/historie/serverDate napojení, SW migrace, skutečný build/HTTP/DB/browser gate. Viz integration/README.md pro přesné kroky a rollback. Po cutoveru se rollbackem nesmí obnovit stará budoucí modulo banka.
