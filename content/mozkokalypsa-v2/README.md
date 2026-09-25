# Mozkokalypsa — kapacita a druhá kalibrace

25. 9. 2026. Navazuje na vyhodnocení pěti hráčů z `docs/mozkokalypsa-evaluation-20260925`. Uživatel schválil směr a upřednostnil kvalitu slov před pevným odstupem 20 úrovní. Tento balíček je offline obsah pro další lidské ověření, není nový aktivovaný produkční playtest.

## Výsledek

- Připraveno 12 nových plných desek 10×10, po 14 slovech; 168 různých slov.
- 3 přístupnější, 6 hlavních, 2 náročnější a 1 vrchol jsou **hypotézy kategorií**, nikoli naměřená lidská obtížnost.
- Každá slovní sada má 24 ověřených rozložení; celkem 288 kandidátů. Výběr používá kvantil nového pomocného skóre uvnitř stejné slovní sady, ne globální kalibraci obtížnosti. Kategorie mají překrývající se absolutní skóre; zejména označení „vrchol“ musí potvrdit lidé.
- Nové skóre sleduje věrohodné odbočky a izolovaná celá slova po odstranění 3, 7 a 10 slov v sedmi modelových pořadích. Skóre není předpověď času ani náhrada lidského hodnocení.
- Znovu nezávisle ověřeno: 100 polí, přesné pokrytí, pravopis cest, jednoznačnost každé cílové cesty a úplného řešení vůči verzovanému slovníku. Timeout není přijat jako důkaz.
- Všude zachováno rozložení délek 5 / 3×6 / 4×7 / 5×8 / 9 a třídy 2×A + 6×B + 6×C. Výluky dodrženy.

## Kapacitní zjištění a oprava předchozího návrhu

V aktuálním katalogu je 1 165 slov způsobilých pro tento konkrétní profil (A/B/C, délky 5–9, fun≥3, bez automatických kandidátů z Wikidat a existujících výluk). To je provozní filtr dosavadního kurátorovaného/autorsky sestaveného katalogu, nikoli nový individuální průzkum znalosti každého slova u lidí.

| Délka | Dostupná slova | Potřebné výskyty ve 100 deskách |
|---|---:|---:|
| 5 | 412 | 100 |
| 6 | 349 | 300 |
| 7 | 221 | 400 |
| 8 | 128 | 500 |
| 9 | 55 | 100 |

Původní nápad nejvýše dvou výskytů slova není s touto skladbou proveditelný: 128 osmipísmenných slov dvakrát poskytne jen 256 z potřebných 500 výskytů. Aspoň některá osmipísmenná slova se musí objevit čtyřikrát. Ani 1 000 různých slov nelze při fixní skladbě dosáhnout; délkový horní odhad je 804 (po čtyřslovném doplnění 808). Jde o nutné délkové meze, nikoli důkaz geometrické realizovatelnosti celé banky.

Proto **žádný tvrdý odstup 20 úrovní ani pevné maximum výskytů**. Nejdřív vybírat méně použité kvalitní výrazy, zvýhodnit delší odstup a penalizovat nedávné opakování. Pokud omezený výběr neumožní požadovanou skladbu, preference postupně uvolnit; nebrat nekvalitní slovo jen kvůli číslu.

## Praktická slovní alokace pro 100 úrovní

`lexical-allocation-soft.json` je **pouze plán slov, ne 100 herních desek**. Ověřuje délky, součet 100 písmen a rozložení tříd pro každý záznam.

- 1 400 pozic, 761 různých slov, nejvýše 4 použití slova.
- Nejkratší rozdíl pořadových čísel opakování je 5; 99 opakování má odstup kratší než 20. Kratší odstupy jsou dovolené a vykázané.
- Čtyři neobvyklá zpestření mají jedno použití každé, přibližně po 25 úrovních.
- Výsledku dosaženo bez poklesu kvalifikačních filtrů slovníku. Žádný z těchto počtů není tvrdou podmínkou pro geometrický generátor.
- Kontrolní běh původního, pouze četností váženého výběru dosáhl 707 unikátních slov, ale až 10 opakování a odstupu 1. Proto pro plán stovky používáme také uvolnitelnou preferenci nejméně použitých slov a plynulou penalizaci nedávného výskytu.
- Nadále potřeba finální redakční kontrola podobných slovních základů a témat. Algoritmus používá existující tematické štítky a historické četnosti, ale není úplným lemmatickým auditorem všech odvozenin.

## Hravější slovník

`editorial-overlay.json` doplňuje pouze do této laboratoře čtyři redakčně zvolené výrazy. Ve 12 kandidátech je každý jednou, na deskách 03/06/09/12:

- BONVIVÁN — SSJČ, https://ssjc.ujc.cas.cz/search.php?heslo=bonviv%C3%A1n&hsubstr=no
- ŠPRÝMAŘ — SSJČ, https://ssjc.ujc.cas.cz/search.php?heslo=%C5%A1pr%C3%BDma%C5%99&hsubstr=no
- EROTOMAN — výslovný podnět uživatele; doložen v IJP při přechylování: https://m.prirucka.ujc.cas.cz/?id=followerka
- FURIANT — SSJČ, https://ssjc.ujc.cas.cz/search.php?heslo=furiant&hsubstr=no

Přiřazení C/fun4 je redakční hypotéza. Existence ve slovníku neprokazuje zábavnost nebo známost; to ověří hráči. Nejde o zavedení jednotného sexuálního tématu, ale o občasné překvapení mezi běžnými slovy. Produkční lexikon se nemění. Před ostrým použitím musí být overlay připojen do odpovídajícího validátoru/rozpoznávání; solver v této laboratoři ho už zahrnuje. Furiant již byl v kontrolním rozpoznávacím slovníku, proto čtyři cílové výrazy přidaly tři nové položky validátoru.

## Ověření a reprodukce

Kontrolní slovník: 26 096 slov, hash `34992ead280fc1915188f5563031987e453152553371911080fec85344ff552d`.
Hash banky: `5352122e033299a00580ffdc906522718f902d1dc0054dc7db3db76f9e2c272c`.
Zmražené produkční vstupy zůstaly beze změny. Jejich hashe, pooly, seedy a odmítnutí jsou ve verification.json.

```sh
python tools/mozkokalypsa_round2.py --output lab-output/mozkokalypsa/round2-20260925-r1
python tools/mozkokalypsa_round2.py --output lab-output/mozkokalypsa/round2-20260925-r1 --validate-only
PYTHONPATH=. python tools/mozkokalypsa_lexical_plan.py
```

Generátor vyžaduje nový adresář; uložené kandidáty nepřepisuje. Časově omezený běh nemusí na libovolném stroji dokončit pool v limitu; uložená banka a hash jsou kanonické. K validaci uloženého balíčku je možné zkopírovat candidates.json jako bank.json do pojmenovaného lab-output adresáře a spustit --validate-only.

## Grafika

Nová malovaná ikona je připravena jako `public/difficulty/printshop/mozkokalypsa-v2.svg` a WebP zdroj. Oproti původnímu přebarvenému Mozkomoru s plochými hroty jde o soudržný vrstvený vír se švestkovými pásy, měděnými úlomky a světlým jádrem. Porovnání a malé velikosti jsou v docs/design. Kontrola proběhla na světlém i tmavém podkladu včetně 24–96 px. Jde o připravený asset, nikoli již změněnou produkční referenci.

## Hranice a další krok

Původní experiment, deset desek, pozvánky a naměřená data jsou zachovány. Tento balíček nepřidává polling ani nemění XP, postup nebo žebříčky. Nových 12 desek zatím není v živé aplikaci: jejich lidské ověření musí běžet pod novým experimentId a oddělenými pokusy, ne přepsáním dokončeného pilotu. Poté kalibrovat kategorie a teprve vyrobit celou stovku. Žádný automatický závěr o lidské obtížnosti nových desek nebyl učiněn.
