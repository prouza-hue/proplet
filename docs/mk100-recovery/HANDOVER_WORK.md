# Mozkokalypsa 100 — předání po přerušení konverzace

1. 10. 2026. Začni tímto souborem, vedlejším ZADANI_100_DESEK.md a PROJECT_CONTEXT.md. Přílohy ChatGPT ani přístup do původního chatu nejsou nutné. Nové zadání je výroba a ověření celé kandidátní stovky, ne další obecný plán.

## Ověřený stav a skutečné přerušení

Při obnovovací kontrole byly přečteny živé Git reference, diff, konkrétní soubory, seznam Actions běhů a produkční deployment. Příčina chyby chatu není známá. Aktuální runtime obsahuje přílohy a zdrojový archiv, ale ne původní neodeslaný pracovní strom. Netvrdíme proto, že známe všechny původní lokální výsledky.

- Main i produkční SHA: `0c597b980821749fa6d397b04716376aea1aa2e0`.
- Vercel production: `dpl_9R9ofNzAdQspYpy5BbSk3RZCVLxW`, READY, alias hrajproplet.cz.
- Rozpracovaná větev: `preview/mozkokalypsa-100-candidates-20261001`.
- Poslední ověřený pracovní commit: `49ac5aabb83abef215164738c53df298e519a016`, 1. 10. 2026 08:30:56 UTC.
- Zahajovací izolovaný commit: `ee035e85e1c8453773e7d9f417510ca94fa1c3ab`.
- Původ dokončeného předchozího Lexikonu v3 / Gen6: `553fb3578c958004b831068dfd268dbcb2a423ab` (PR #150).

**Je zachovaný plný pracovní Lexikon v3 a předchozí výrobní nástroje. Není doložena dokončená nová stovka.** Na pracovní větvi jsou převzaté `content/lexicon-v3/`, `content/gen6/`, `tools/gen6/`, `tools/build_lexicon_v3_working.py` a `tools/build_gen6_preview.py`. Historické banky v těchto adresářích nejsou novým výsledkem stovky.

**Přenos dalšího balíku je neúplný:** uloženy jsou `tools/mk100-transfer-01.b64` a `tools/mk100-transfer-02.b64`, poslední commit je označen `(2/10)`. V porovnaném stromu nejsou části 03–10 ani úplný aplikovaný nový balík. Nehádej chybějící data a nevydávej dva fragmenty za hotovou pipeline. Zachovej je jako stopu; pokud najdeš úplný původní balík/checkout, ověř jeho původ, úplnost a kontrolní součty před použitím. Nenalezení zbytku není důvod blokovat práci s existujícím kódem.

`tools/build_mk100_preview.py` nyní vytváří jen informační HTML, nikoli hratelné preview. Odmítá `VERCEL_ENV=production`. Větev má izolovanou statickou konfiguraci bez API/DB. Úspěšný build této stránky není validace obsahu.

Jediný nalezený Actions běh nové větve: `36829282649`, SUCCESS — **pouze export vstupních zdrojů**, nikoli obsahové nebo browserové ověření stovky. Novou reprezentativní dvanáctku ani novou stovku nelze v předaném stromu označit za dokončenou. Neodeslaná lokální práce není v tomto prostředí dostupná.

## Bezpečný start nového Worku

Toto předání je na oddělené větvi `docs/mk100-recovery-20261001` založené na `49ac5aab`. Starou pracovní větev tímto předáním nepřepisujeme. Vytvoř vlastní novou pracovní větev z tohoto checkpointu; nepokračuj souběžně na původní větvi a nic nezapisuj do main.

```sh
git status --short --branch
git fetch origin main docs/mk100-recovery-20261001 preview/mozkokalypsa-100-candidates-20261001
git worktree add -b work/mozkokalypsa-100-resume-20261001 ../proplet-mk100-resume origin/docs/mk100-recovery-20261001
cd ../proplet-mk100-resume
git status --porcelain=v1
git rev-parse HEAD
git merge-base --is-ancestor 0c597b980821749fa6d397b04716376aea1aa2e0 HEAD
```

Pokud název nebo adresář existuje, prohlédni ho a zvol jiný. Nepoužívej reset --hard ani force push. Prázdný status doloží čistotu tvého checkoutu, ne jiného prostředí. Znovu ověř produkční SHA a origin/main. Pokud se posunuly, prohlédni změny a zachovej je bez ztráty preview izolace. Nevracej týmovou soutěž, onboarding nebo další mezitím opravené funkce. Preview vercel.json nesmí do produkce.

Používej běžný Git/terminál, pokud funguje. Není důvod znovu posílat velké patche po mnoha base64 částech přes chat. Ukládej menší úplné commity, checkpointy a stavovou dokumentaci. Subagenty lze využít na oddělené úlohy s jedním integračním vlastníkem; nesmějí paralelně přepisovat stejnou banku či stejné soubory.

## Konkrétní zdroje

### Lexikon a generátor

- `content/lexicon-v3/working/lexicon.json`, `manifest.json`, `editorial-reviews.json`, `inventory.json`, `source-manifest.json`, `source-limitations.json`, `editorial-addendum-20260927.json`, `topic-map.json`, `variant-groups.json`, `capacity.json`, `recognition-words.txt`.
- `tools/gen6/full_catalog.py`, `catalog.py`, `recognition_snapshot.py`, `eight.py`, `interwoven.py`, `interwoven_geometry.cpp`.
- Aktuální `tools/gen5/catalog.py`, `validation.py`, `package.py`, `content/gen5/profiles.json`, `tools/mozkokalypsa_lab.py`, `tools/measure_gen4_ambiguity.py`.
- Aktuální `word_recognition_v3330.py`, jeho skutečné vstupy včetně overlay a `requirements*.txt`.

Převzatý úplný pracovní lexikon má 4290 hesel a 4248 cílově způsobilých po původních výlukách. Zpracovaná schválená zásoba 1143 doplnění má různou hloubku jazykového doložení; individuální stopy a mezery jsou explicitní. Nepoužívej místo ní původní neupravený zásobník a nevracej se k dávce 155. `runtime_approved=false` není odvolání schválení zásoby, ale oddělení od produkčního vydání.

Referenční SHA-256 pracovního lexicon.json: `7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277`. Aktuální bajty ověř. Historické README, datum 26./27. 9. a pokyny k pozastavení výroby nepřebíjejí nynější zadání. `FullCatalog` hlídá staré vstupní otisky a `available_for_round3` omezuje fond konkrétního pilotu. Pro stovku tuto politiku vědomě rozšiř, změř kapacitu a eviduj změny; nevypínej bezmyšlenkovitě hashe ani neregeneruj lexikon bez skutečné potřeby.

Starý kompletní validační fond měl 103836 zápisů včetně připnuté wordfreq 3.1.1. To není kvóta pro nový běh. Prověř nynější runtime/overlay/varianty/prahy, vytvoř odpovídající zmrazenou množinu a manifest. Starších 26190 nebo 26893 statických zápisů není automaticky úplné uznávání. Nevynechávej uznávaná slova kvůli jednoznačnosti. Timeout solveru není PASS.

### Banky a evaluace

Neměnné banky na aktuálním základu: `data/playtests/mozkokalypsa-v1.json`, `mozkokalypsa-v2.json`, `mozkokalypsa-v3.json`. Ve skutečném III se hrálo mk3w2-01…08, ne starší prototyp mk3v3-*.

Adresář `evaluations/` vedle tohoto souboru obsahuje přesné kopie dokumentů z těchto Git snapshotů:

- II: větev `docs/mozkokalypsa-round2-evaluation-20260929`, commit `cc5b33752744dea223c0ae5b5e3e37ac32a82be7`, `MOZKOKALYPSA-ROUND2-EVALUATION-20260929.md`.
- III: větev `docs/mozkokalypsa-round3-evaluation-20261001`, commit `f67694e3f136913644590b046c2d9122c11936a7`, `MOZKOKALYPSA-ROUND3-EVALUATION-20261001.md`, `MOZKOKALYPSA-ROUND3-METRICS-20261001.json`, `MOZKOKALYPSA-ROUND3-VERIFICATION-20261001.sql`.

Pro I projdi existující `docs/playtests/MOZKOKALYPSA-20260922.md`, oba RELEASE dokumenty z 22./23. 9., `mozkokalypsa-verification.json` a srovnání I v evaluacích II/III. Samostatné úplné vyhodnocení I nebylo při této obnově dohledáno. Najdeš-li je, uveď skutečný zdroj; obsah si nevymýšlej.

Přečti issue #146 včetně novějších komentářů, zejména `5926660159` ke startu stovky. PR #148/#150 uchovávají výrobní práci a soukromá preview, #155 nativní preview, #156 sloučenou produkční integraci III. Historické preview větve se už nemají mergovat. III skončilo a bylo vyhodnoceno; starý HANDOVER_ASTRA_GEN6_v2.md z 26. 9. není aktuální seznam nehotových úkolů.

Chybějící staré testy a preview adaptéry lze cíleně získat z původního commitu:

```sh
git fetch origin 553fb3578c958004b831068dfd268dbcb2a423ab
git ls-tree -r --name-only 553fb3578c958004b831068dfd268dbcb2a423ab -- tests preview tools
```

Prověř zejména `preview/gen6/`, `tests/gen6/`, `tests/interwoven/`, `tests/lexicon_v3/`, `tools/test_gen6_eight_browser.py` a `tools/build_gen6_eight_preview.py`. Před převzetím ověř existenci a diff. Nekopíruj přes main staré public/app.js, SW, backend nebo vercel.json. Starý osmideskový test není důkazem hraní nové stovky.

### Záložní zdrojový archiv

Actions run `36829282649`, artifact `11146561433`, name `mk100-source`, původní expirace 8. 10. 2026. Existující konverzační kopie `mk100-source-current-20261001.zip` má skutečně zkontrolovaný SHA-256 `bc90e5400adcf1b37ac59cca5a3d5326fb673ac70e43701b1945ef09e0a04c53`.

Obsahuje main.zip, gen6-proven.zip, evaluace a minimální Git objects/refs. Není to archiv nové stovky ani neodeslaných změn. Přístup k příloze v novém chatu není zaručen a není potřeba: použitelné zdroje jsou na GitHubu. Expirace artefaktu nesmí blokovat práci. Archiv není určený k veřejné distribuci.

## Pořadí další práce

1. Ověřit checkout a aktuální uznávání; řešit pouze skutečné nesoulady provenience. Použít dokončený lexikon, neopakovat jeho hromadné schvalování.
2. Před výrobou porovnat konstrukci a slovní složku závěrů mk2-09/mk2-10 proti III. EROTOMAN v II/09 je doložená lexikální složka, ne důkaz univerzálně lepší konstrukce. Nový strukturální audit konců není v předání hotový.
3. Cíleně prověřit HŘEBELEC a kritizované slovní kumulace. Méně známé české slovo není automaticky chyba. Vyhýbat se především hromadění polarizujících výrazů; nevynucovat kvóty rarit.
4. Interně vyrobit a ověřit 12 reprezentantů 3/6/2/1 s několika odlišnými pokusy o zajímavější závěr. Opravit slabiny před škálováním. Připravit dávku pro test, ale test neaktivovat.
5. Dokončit přesně 100 vybraných desek 20/60/15/5 ve vlnách, s přibližně 20 cílenými konstrukčními závěry. Globálně řídit opakování, varianty, rodiny a témata. Vybrat z většího poolu, ne první stovku technických průchodů.
6. Individuálně redakčně posoudit a validovat každou vybranou desku. U závěrových kandidátů vyhodnotit více plausibilních pořadí, izolované řetízky a robustnost poslední trojice. Výsledky simulací nejsou telemetrie.
7. Připravit skutečně hratelné izolované preview celé stovky i vstup do reprezentativní dvanáctky; zachovat vzhled/ovládání. Ověřit browserový tok na mobil/Fold/desktop, prohlédnout snímky a uvést přesný rozsah emulace.

Hlavní panel sedmi hráčů II → III: zábavnost 3,73 → 4,05; náročnost 3,15 → 3,84; medián 3:17 → 3:57. Poslední trojice ale 15,7 % → 10,8 % času. Nezaměňovat tuto nevyřešenou hypotézu za potvrzený úspěch generátoru. Ani vyšší strukturální skóre není naměřená lidská obtížnost.

## Výstupy, autorizace a checkpointy

Závazné detaily jsou v ZADANI_100_DESEK.md. Dodat banku100 s konkrétními písmeny a cestami, manifest1–100/profilů/identit/verzí, redakční katalog, globální opakování a metriky, individuální důkazy validace a závěrů, izolované hratelné preview a neaktivní reprezentativní sadu. Doporučený nový adresář je například `content/gen6/mozkokalypsa-100/`; takový dokončený výstup zatím předání nedokládá.

Vybrat nekolidující stabilní ID. Není automaticky zadáno převzít osm starých desek a dodělat pouze92. Změněný obsah musí mít nové ID/hash. Historické playtestové banky, hashe, výsledky a odměny zachovat. Převod dokončení či odměn jen samostatně navrhnout.

Autorizována je pouze izolovaná výroba, změny výrobní pipeline a preview. Zakázáno nasadit stovku do produkce, aktivovat test, měnit výsledky/XP/týmy/odemčení/postup. Gen6 je výrobní verze, ne důvod resetovat runtime freeGeneration/contentGeneration. Plošná výroba/vydání pro nižší obtížnosti a společná pestrá cesta jsou navazující etapa, ne aktuální rozšíření rozsahu.

Produkční DB není pro výrobu potřeba. Případné nezbytné doplnění původních dat pouze read-only v Supabase `iopyhluayfszskyqqpuc`; žádné syntetické hráčské zápisy. Vercel team `team_5WMqzMhPV9vWfkNAWCygaeap`, project `prj_0XHgnCQhdPS3pPETrxIpoXn0McMG`; preview bez účtů, odměn a připojení k produkčnímu API/DB.

Milníky ukládat: převzetí → reference/uznávání → první12 → celá100 → redakce/validace → preview. Vždy datum, commit, rozhodnutí, provedené kontroly a otevřené body. Nespouštět opakovaně široké DB/runtime testy bez související změny. Obsahové/solverové/reprodukční kontroly a ověření skutečného preview jsou nutné. Po vyřešení relevantních kontrol pokračovat k dokončení, ne opakovat audity bez nové příčiny.

Toto předání vzniká pouze jako dokumentace na nové větvi. Main, produkce, původní pracovní větev ani databáze se tím nemění. Nový Work má pokračovat provedením úplného zadání; směr už je dostatečně schválený.
