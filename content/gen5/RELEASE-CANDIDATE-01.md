# Gen5: první úplná série, 15. září 2026

Generátor dokončil všech 450 nových desek. Série `g5-r1` je soukromý kandidát;
nebyla publikována. Zdrojový stav výroby je commit `d0bdd70`.

| Obtížnost | Nové desky | Rozměr | Různých cílových slov | Nejvyšší počet použití slova |
| --- | ---: | --- | ---: | ---: |
| Snadná | 100 | 75× 5×5, 25× 6×6 | 288 | 4 |
| Střední | 100 | 7×7 | 507 | 4 |
| Těžká | 100 | 9×9 | 705 | 3 |
| Mozkožrout | 100 | 10×10 | 802 | 3 |
| Mozkomor | 50 | 10×10 | 473 | 3 |

Celkem jde o 3 365 výskytů a 1 978 různých zápisů slov napříč obtížnostmi.
Počet zápisů není počet významů: například BALON a BALÓN jsou dvě povolené
položky. V původních 200 snadných deskách se nejčastější slovo objevovalo
42krát; v nových 100 je maximum čtyři. Podíl čtyřpísmenných slov ve snadných
klesl z 87,5 % na 18,6 %. Vyšší pestrost se neopírá jen o tuto jednu metriku:
generátor současně kontroluje odstup opakování, obtížnost slov a geometrii.

Snadná a střední odpovídají schválenému zjednodušení. Větší snadné desky mají
stejný rozpočet slov, aktivních polí a zatáček jako 5×5. Těžká, Mozkožrout
a Mozkomor používají již schválené profily. Metriky nenahrazují hráčský čas;
tato výroba navazuje na již dodaný uživatelský feedback.

## Ověření

- 53 automatických testů prošlo: výběr slov, struktura, řešitelnost, limity,
  obnova výroby, pořadí souběžných výsledků a balení bez změny herního postupu.
- Všech 450 přijatých desek prošlo závěrečným nezávislým ověřením struktury,
  schváleného profilu, expozice slov a jednoznačnosti řešení vůči pevné
  validační sadě 26 093 slov. Vzdálený frekvenční fallback tato sada nepokrývá.
- Výroba byla úmyslně zastavena po 25 deskách a obnovena. Již přijaté desky
  se znovu negenerovaly. Všech 450 výrobních úloh uspělo při prvním spuštění;
  uvnitř každé úlohy se nevhodné kandidáty průběžně odmítají.
- Otisky zmrazených vstupů zůstaly shodné. Produkční soubory se neměnily.
- Galerie byla vytvořena pro všech 450 desek a vložený JavaScript prošel
  kontrolou syntaxe. Vizuální kontrolu v automatizovaném prohlížeči tato
  etapa nedokládá.
- Redakční průchody pokryly všech 1 978 slov, bez zjevného blokujícího
  jazykového nálezu. Jsou zaznamenané v `EDITORIAL-*-BATCH.md`.
- Další nezávislý průchod potvrdil 29 otisků vstupů, oba obsahové hashe,
  zachování prvních 25 desek a otisky všech 965 původních a rezervovaných desek.

## Výstupy a obnova

Místní hratelná galerie: `lab-output/gen5/release-candidate-01/index.html`.
Ve stejném adresáři jsou `series.json`, `candidate.json` a `report.json`.
Jejich přesné kopie jsou verzované jako gzip v `evidence/release-candidate-01/`;
`archive-manifest.json` obsahuje SHA-256 rozbalených souborů a jejich velikosti.
Tyto tři archivy mají dohromady přibližně 431 KiB. Stačí je rozbalit do nového adresáře
pod `lab-output/gen5/` a galerii obnovit příkazem:

```sh
python tools/gen5_gallery.py lab-output/gen5/obnovena-serie/series.json
```

Navíc je verzována úplná jazyková evidence jako `editorial.json.gz`.
Nemění původní výrobní soubory: jejich manifest zachycuje stav před redakční
kontrolou. Dokončení kontroly dokládá tato samostatná evidence se shodným
hashem vyrobeného obsahu.

## Následující krok: připojení obsahu ke hře

Výroba je hotová. Zbývá integrační krok vydání, nikoli další tvorba generátoru
nebo opakování stejné kalibrace. Při připojení se musí zachovat dosavadní
úrovně včetně připravené rolling rezervy:

- Snadná: dosavadní 1–217, nové 218–317.
- Střední, Těžká a Mozkožrout: dosavadní 1–216, nové 217–316.
- Mozkomor: dosavadní 1–100, nové 101–150.

Balíček zachovává herní generaci postupu 4; algoritmus označuje samostatně
jako generaci 5. Je nutné ověřit dostupnost nové série, započítání starých
i nových výher a odemykání Mozkomora ve skutečné hře. Současný manifest
proto výslovně neoznačuje balíček za nasazený ani integraci za dokončenou.
