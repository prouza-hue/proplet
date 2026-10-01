# Mozkokalypsa III — soukromá revize propletení

27. 9. 2026. Navazuje na Pavlův nový souhrn feedbacku II: lepší čeština a pestrost, zejména elegantní propletení; nikoli plošně lehčí hra. Osm soukromých desek. Žádná aktivace veřejného kola, účtů, XP či databáze.

## Co je skutečně změněné

- Nová osmička `mk3w2-01` až `mk3w2-08`, samostatná identita experimentu `mozkokalypsa-round3-interwoven-v2` a obsahový hash. Původní osmička `mk3v3-*`, její adresa a postup zůstávají zachované. Nová větev je `preview/gen6-interwoven-20260927`; původní PR148 head a91a4bd0 se nepřepisuje.
- Vychází ze stejného úplného Lexikonu v3: 4 290 hesel, zapracovaná schválená zásoba 1 143 slov. Žádná nová hromadná jazyková revize, zúžení rozpoznávání nebo změna kategorií slov.
- 112 různých cílů, z toho 88 (78,57 %) z rozšíření; 93 zápisů není v zahrnutých historických bankách. Nula přesných opakování uvnitř osmičky i vůči prvním dvěma hráčským playtestům. 102 cílů z již schválené soukromé osmičky ponecháno, deset cíleně změněno. Tato revize tedy není vydávána za 112 dosud neviděných slov pro lidi, kteří hráli první soukromý náhled.
- Cílené změny: GENETIKA → ZÁKULISÍ, HMOTNOST → SKOŘÁPKA, ALGEBRA → PODNEBÍ, NOSTALGIE → TAJEMSTVÍ, GALEONA → POBŘEŽÍ, DRUID → ŠIFRA, MATICE → POHOŘÍ, BAKTERIE → KORMIDLO, MINOTAUR → POTÁPNÍK, KENTAUR → PŘÍZVUK. To je preference pro charakter této sady, nikoli obecný zákaz původních slov v lexikonu.
- SOFTWARE, NINJA, EROTOMAN ani FIREWALL mezi cíli nejsou (nebyly ani v předchozí soukromé osmičce). Přirozeně užívané výrazy jako PERGAMEN či SYMFONIE nejsou mechanicky zakázané. U všech cílů je evidováno redakční posouzení a u užší slovní zásoby příznak; nejvýše tři takto označená odbornější přírodní/řemeslná hesla na desku. Jde o úsudek AI, nikoli měření známosti.

## Propletení není samotný počet zatáček

Pravidla se nemění: cíle mají ortogonální, nepřekrývající se cesty. Písmena se nezačínají sdílet jako v křížovce. Propletení zde znamená skutečné prostorové prolínání oblastí různých slov, jejich kontakty, přerušení příliš čistých hranic a možné odstranění klamných pokračování nálezem souseda.

Geometrická hledací vrstva nově hodnotí tvar po rozdělení na konkrétní délky slov, ne jen zatáčky jedné dlouhé cesty. Návraty stejného slova v řádku/sloupci po úseku jiného slova skutečně svědčí o jeho protažení kolem souseda. Příliš kompaktní vlastní smyčky zhoršují hodnocení. Dále se kontrolují sousedé a cesty přes vnitřní dělicí čáry. Mezi dvěma novými deskami nesmí být sedm totožných oblastí slov.

Mediány, stejné metriky na všech srovnávaných bankách:

| Pomocná metrika | Kolo II | Předchozí soukromá osmička | Nová revize |
|---|---:|---:|---:|
| Hrany kontaktu mezi různými slovy | 67 | 67,5 | 76 |
| Opětovné vstupy téhož slova do řádku/sloupce přes jiné slovo | 1 | 0 | 4 |
| Nadbytečné dotyky vlastních nepo sobě jdoucích políček | 27 | 26,5 | 18 |
| Nejslabší vnitřní dělicí čára: kolik slov ji překračuje | 1 | 1 | 3 |
| Průměr různých sousedních slov | 4 | 4,07 | 4,29 |

Každá nová deska má nejméně 76 mezislovních kontaktů, 4 opětovné vstupy v řádcích/sloupcích a alespoň tři sousedy každého slova. Jde o měřitelné vlastnosti uspořádání, ne prokázanou hráčskou zábavnost.

## Náročnost a férovost

Zachováno 10×10, 14 slov, plných 100 políček, přesný délkový profil 5 / 3×6 / 4×7 / 5×8 / 9 a skladba 2A/6B/6C. Stále nejméně tři zatáčky na každé cestě a průměr alespoň 4,65; původní štítky nejsou přeznačené pro naplnění kvót. Mírně nižší pomocná míra klamných pokračování není skrytá: proti kolu II vychází počáteční medián 57,786 vs. 60,75; po polovině slov 33,9645 vs. 37,107. Nová revize neoptimalizuje jen trvalé matení; nálezy mají pomáhat. Z těchto rozdílů nelze předpovědět procentní změnu lidské obtížnosti.

U každé desky se ukládá samostatně: slovní revize a opakování, označení užších/cizojazyčně působících výrazů, metriky propletení, možné odkrývání dalších cílů a stávající pomocné metriky náročnosti včetně pozdějších fází. `helpedOtherWordsMean` měří, u kolika jiných cílů nalezené slovo přeruší alespoň jednu slovníkově možnou falešnou cestu délky 2–4. Nejde o pozorování skutečných hráčů.

Všech osm desek má kompletní jediné řešení i jednoznačné cílové cesty podle nezávislého solveru nad stejnými 103 836 rozpoznávanými zápisy včetně zmrazené runtime frekvenční vrstvy. Timeout není úspěch. Žádné zeslabení solveru ani odstranění uznávaných slov.

## Výroba a důkazy

`bank.json`, `verification.json` a `lexical-review.json` obsahují konkrétní výsledky. Obsahový hash nové banky:
`b6bfe8034861ad3cad0d3d9057658b046ea85ef172579229da60ab5dd7cdc42f`.

Nová offline C++ vrstva pouze efektivně hledá geometrie; nemá přístup k síti či databázi. Její 32členný fond byl místně nezávisle znovu vytvořen a bajtově porovnán. Následná výroba používá stávající slovní katalog a nezávislý Python solver. Kompletní fond má pevný seed a limit, nedokončení je chyba. Lokální browser navigaci zablokovala správa prostředí; nepovažujeme ji za úspěšný browser test. Skutečné browserové ověření bude doloženo zvlášť z izolovaného CI. Lokálně šest cílených behaviorálních testů PASS; nic z toho není fyzický test Foldu.

```sh
g++ -O3 -std=c++17 tools/gen6/interwoven_geometry.cpp -o /tmp/proplet-weave
/tmp/proplet-weave 92720262 30000000 32 > /tmp/pool.jsonl
cmp /tmp/pool.jsonl content/gen6/round3-interwoven/geometry-pool.jsonl
python -m tools.gen6.interwoven --output lab-output/gen6/fresh-interwoven-replay
python -m unittest discover -s tests/interwoven -v
python tools/build_gen6_interwoven_preview.py
python tools/test_gen6_eight_browser.py --output /tmp/interwoven-browser
```

Baseline převzatého preview a91a4bd0, produkce při začátku f07a43d1 (oprava push z PR149); pouze statické soukromé prostředí, bez API/DB/účtů/XP. Žádný přenos do main. Kód hry, ovládání, ikonografie a Tiskařská dílna zůstávají. Širší nasazení Lexikonu v3 a společné pestré trasy je navazující etapa po hráčském vyhodnocení, ne součást této revize.

## Dokončené CI ověření

https://github.com/prouza-hue/proplet/actions/runs/36339549061 — geometrie i všech osm desek nezávisle reprodukováno, 11 převzatých a 6 nových testů PASS, všech osm nových desek skutečně dohráno pointer tahy. Prošla emulace mobilu/Foldu, nápověda, lupa, Klid, obnova, klávesnice a obě témata na 320/390/768/1440 px. Žádné herní síťové zápisy. Report: `docs/gen6/INTERWOVEN-BROWSER-QA-20260927.json`. Závěrečný push tohoto běhu selhal pouze kvůli chybějícímu oprávnění CI měnit workflow; následné balení přebírá stejný prověřený obsah, nemění workflow a neopakuje hotové browser testy. Emulace není fyzický test telefonu.
