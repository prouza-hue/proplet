# Mozkokalypsa 100 — dokončené kandidátní vydání v2

**Navazující požadavek Pavla:** další playtest nebude. Aktuální práce je
náhled v běžném celém Propletu na větvi `work/mk100-proplet-preview-20261001`;
dosavadní brány se zachovávají a produkce se zatím nenasazuje. Podrobnosti
a pozdější podmínky vydání jsou v [INTEGRATED_PREVIEW_20261001.md](INTEGRATED_PREVIEW_20261001.md).

Finální stav po převzetí nereagujícího chatu „Dokončení stovky Mozkokalypsy“, 1. 10. 2026. Samostatná větev `work/mk100-completion-20261001` navazuje na úplný checkpoint `dc1fd060db70f38f7419f48dc498686faf5e5707`.

- Přesně 100 nových desek `mk100-v2-001` až `mk100-v2-100`, hash banky `84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab`.
- Každá 10×10, 14 slov, úplné disjunktní pokrytí a ortogonální cesty. Pět vln; celkem 20 úlev / 60 hlavních / 15 výzev / 5 vrcholů. Reprezentativní dvanáctka 3/6/2/1 zůstala totožná.
- 2 406 obsahově odlišných přesně ověřených kandidátů v úplném archivu. 62 různých kanonických konstrukcí, nejmenší opakovaný rozestup 10 desek, nejvýše čtyři použití.
- 1 400 slovních výskytů, 1 008 různých slov, nejvýše dva výskyty, přesný rozestup alespoň 20 a rodiny alespoň 9. LAHODNÝ37 je jediná přiznaná shoda se třemi předchozími playtesty. Široká historie vydaných i rezervovaných bank má 417 různých shod; není osobní historií hráče.
- Nezávislé PASS100/100: úplný přesný solver, jedinečné cílové cesty, deterministické přehrání výroby a kompletní inventář vedlejších slov podle skutečných runtime pravidel. Timeout a neúplný slovník neprocházejí.
- Individuálně posouzené slovní sady a všech 100 skutečných finálních mřížek. `CATALOG.md`, obě konstrukční recenze a `editorial-bindings-v2.json` vážou modelovou redakci na konkrétní otisky. Změněné mřížky byly znovu prohlédnuté.
- Dvacet závěrových experimentů má všechny tři hypotézy, šest citlivostních pořadí a 7 280 trojic. U všech dvaceti je dolní kvartil tlaku přes všechny trojice pod referencí mk2-10. Robustní zlepšení napříč pořadími ani lidská náročnost/zábavnost nejsou prokázané.
- Hratelné statické preview má celou stovku i dvanáctku, nativní styly a herní moduly a oddělený místní postup. Finální browserový report a prohlédnuté snímky jsou v `preview/mk100/verification/`. Jde o emulaci, nikoli fyzický test.

RADAR jako palindrom znemožňoval jedinečnost orientovaných cest na 16 a 88. Individuálně schválené LASER a SLOKA zachovaly délku a tier. Původní recenze a plán jsou archivované, změny mají vlastní evidence. Lexikon v3 a všech 103 836 rozpoznávaných slov zůstaly zachované; RADAR se stále uznává.

Finální čtení GitHub main a přesného Vercel aliasu hrajproplet.cz potvrzuje nezměněné `174e0fa2a3e8befd0fe01ac8ba7771f4ece25558` / `dpl_AiLrqzQwahpqrFRwowAn96XYrTQ8`, READY/production. Produkční zdrojové soubory se proti tomuto main neliší. Supabase byl použit pouze k čtení metadat projektu, bez hráčských dotazů nebo zápisů.

Hotová je kandidátní stovka a izolované preview. Další playtest nebyl aktivován, produkce nebyla nasazena a výsledky/XP/týmy/postup hráčů nebyly měněné. Reprodukci a jednotlivé důkazy popisuje `content/gen6/mozkokalypsa-100/README.md`; zdrojový snapshot výroby je `ae0ba92c7a154eaca97a18c08e5dbdc20a6ded5a`.

## Archivní checkpoint před tímto dokončením

Následující text zachovává tehdejší stav rozpracované práce. Jeho otevřené položky byly dokončeny podle výše uvedených důkazů.

1. 10. 2026. Převzetí: a9e5bd9dfde0524312fd610118f3bcbcedc16ee8, vlastní vzdálená větev work/mozkokalypsa-100-resume-20261001. Původní pracovní a předávací větev ani main se nepřepisují.

## Ověřený základ

- HANDOVER_WORK.md, ZADANI_100_DESEK.md a PROJECT_CONTEXT.md skutečně načteny přes GitHub na uvedeném SHA.
- Main i produkce nyní 174e0fa2a3e8befd0fe01ac8ba7771f4ece25558. Vercel dpl_AiLrqzQwahpqrFRwowAn96XYrTQ8 READY, alias hrajproplet.cz; jde o dnešní auth úsporu Supabase (#163).
- Supabase iopyhluayfszskyqqpuc potvrzen jako proplet, ACTIVE_HEALTHY. Čtena pouze metadata projektu; žádné dotazy ani zápisy do hráčských tabulek.
- Přímý GitHub clone neměl autentizaci. Oficiální GitHub Actions artifact11146561433 dodal původní Git objekty; SHA256 všech čtyř vnitřních zdrojových ZIPů odpovídají SHA256SUMS.txt. Chybějící blob/tree/commit objekty předání byly doplněny přes GitHub API a přesně ověřeny Git SHA. Nový worktree startuje na přesném a9e5bd9, status při startu prázdný.
- Devět změněných souborů main174e0fa bylo převzato pouze po shodě Git blobSHA. Statické vercel.json z předání se zachovává; žádný produkční deployment.
- Lexikon v3 má stejný SHA2567baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277. Všechny původní vstupní a výstupní hashe Lexikonu zůstávají ověřované.
- Části přenosu1/10 a2/10 zachovány. Úplnější nový výsledek nebyl doložen; nepoužívají se jako banka nebo pipeline.

## Rozpoznávání a reference

Úplná současná rozpoznávací množina byla zrekonstruována z aktuálních statických zdrojů, overlay, v3/variant a připnuté wordfreq3.1.1:103836 zápisů. 94208 frekvenčních zápisů reprodukuje starý kompletní export. Snapshot v recognition-manifest.json obsahuje skutečné sourceSHA256 a meze; neomezuje uznávání kvůli jednoznačnosti.

Nástroj mk100_endgame.py hodnotí poslední3 po nalezení11 slov, tři pojmenované hypotézy pořadí a šest kontrol citlivosti. Reference-audit.json dokládá všech364 trojic na10referencích. Proxy nerozlišuje všechny lidské výsledky (např. III02/06 mají vysoké skóre, ale rychlý měřený konec); slouží k výběru, nikoli důkazu opraveného závěru.

## Právě rozpracované a otevřené

Výroba lexical-plan → interní12(3/6/2/1) →100(20/60/15/5), individuální redakce a plný solver. Hratelné statické preview je rozpracováno. Tato fáze NENÍ dokončená stovka a informační staré preview není důkaz hraní.

Žádná aktivace testu, produkční změna, odměna, účet nebo hráčský zápis nejsou autorizované ani provedené. Lidská obtížnost/zábavnost a účinek závěru čekají na samostatné měření. Browserové ověření bude označeno jako emulace mobil/Fold/desktop.
