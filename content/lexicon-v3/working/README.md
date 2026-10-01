# Lexikon v3 — úplný pracovní základ

Zpracováno všech **1 143/1 143** schválených kandidátů; neuzavřených: **0**. Stavy: {'accepted': 1142, 'corrected': 1}.
Zachováno 155 hotových přijetí, uzavřeno dalších 988 včetně PLYŠÁKU. Plný lexikon: **4290** hesel; pro cíle způsobilých **4248**.

[Závazné rozhodnutí](https://github.com/prouza-hue/proplet/pull/148#issuecomment-5849652613) schvaluje zásobu. `runtime_approved=false` znamená nevydáno do produkce, nikoli neschválenou zásobu.

Významy a klasifikace jsou vlastní redakční posudky AI. Rozsah konkrétních dokladů i jednotlivé zdrojové mezery uvádí `source-limitations.json`; nepřímý kontext či pravopisný seznam se nevydává za samostatné výkladové heslo. Historická v2 je zachována včetně původu a výluk, bez tvrzení o nové revizi.

## Kapacita podle současných profilů

| Profil | Způsobilá hesla | Z v2 | Nová | Po starém filtru fun≥3 |
|---|---:|---:|---:|---:|
| easy | 805 | 455 | 350 | 805 |
| medium | 1970 | 1121 | 849 | 1967 |
| hard | 3835 | 2715 | 1120 | 3760 |
| hardcore | 4248 | 3105 | 1143 | 4127 |
| mozkomor | 3772 | 2715 | 1057 | 3651 |

Jde o způsobilost podle délky a tieru, nikoli počet vyrobitelných desek. Původní kvóty a geometrické požadavky jsou v capacity.json zachované. Novým slovům se nevymýšlí skóre fun. Délky, témata, slovní druhy, tiery a jejich průniky jsou v témže souboru.

## Mozkokalypsa III

Základ délky 5–10: 3772 hesel; bez přesných cílů obou předchozích kol 3503; bez výskytu ve všech zahrnutých bankách 1390.
Náročný finální profil ani počet desek se nyní nevolí. Žádné nové desky nevznikly a délkové požadavky se neuvolnily. Existujících 12 desek je historický prototyp. Jejich důkaz platí pro tehdejší zmražené uznávání a musí se před budoucím použitím znovu ověřit.
Úplná pracovní statická sada uznávání má 26893 hesel, proti prototypu přidává 703. Produkční uznávání se nemění.

## Jednotlivé výjimky a opravy

- **ZÁKRUTA → ZÁKRUT** (corrected): Doložený český základ je zákrut. Posuzovaný ženský tvar je v dostupném místním výkladovém záznamu doložen jako slovenské heslo. Netvrdíme absolutní neexistenci historické české varianty; pro kandidátní český lexikon zvolena jednoznačně doložená podoba. Význam zůstává stejný. 
- **ZÁŠEVEK — mezera v nezávislém dokladu**: Přesné heslo ani nezávislý významový doklad nebyly v dostupných místních zdrojích nalezeny. Přijetí je výslovný vlastní jazykový posudek AI k uživatelsky schválené zásobě; ověření zdroje se nepředstírá.

## Soubory a reprodukce

- `editorial-reviews.json`: všech 1 143 individuálních rozhodnutí, původní ID, glosy, zdroje a oddělená schválení.
- `lexicon.json`: úplná v3 = zachovaná v2 + přijaté doplnění; všechna původní pole v2 zůstávají zachována, nové položky odkazují na úplný individuální posudek pomocí `review_ref`.
- `inventory.json`, `capacity.json`, `variant-groups.json`, `topic-map.json`: uzavření zásoby, kapacita, explicitní varianty a sjednocení témat. Původní témata zůstávají zachována; neurčité historické štítky se nepředstírají jako nově tříděné.
- `recognition-words.txt`: samostatné offline uznávání pro budoucí důkazy, bez zápisu do runtime.
- `source-manifest.json`, `manifest.json`: původ, rozsah a kontrolní součty.

```sh
python tools/build_lexicon_v3_working.py --check
python -m unittest discover -s tests/lexicon_v3 -v
```

Výrobní ani publikační schválení z tohoto kompilátoru neplyne. Produkce, běžící druhé kolo a hráčský postup se nemění.
