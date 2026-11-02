# Rozšíření volné hry o 600 úrovní

2. 11. 2026. Nová výroba navazuje na schválený Gen6, neměnný Lexikon v3
(4 290 hesel, otisk `7baff6af…`) a vydané kalibrované profily. Aktuální
uživatelské zadání požaduje 100 nových úrovní pro každou obtížnost do běžné
volné hry. Výchozí main i produkce: `162a865c724b6c5a5402ccf83d338704d81c2401`.

| Obtížnost | Nové desky | Celkem v základní bance | Nová čísla úrovní |
|---|---:|---:|---|
| Snadná | 100 | 500 | 418–517 |
| Střední | 100 | 500 | 417–516 |
| Těžká | 100 | 500 | 417–516 |
| Mozkožrout | 100 | 400 | 317–416 |
| Mozkomor | 100 | 250 | 151–250 |
| Mozkokalypsa | 100 | 200 | 101–200 |

Pravidelně vydávané rolling úrovně zůstávají samostatné; jejich vyhrazené
číselné sloty se nepřečíslovávají. Nová ID jsou `g6-expansion-{obtížnost}-001`
až `100`. Runtime `contentGeneration` a `freeGeneration` zůstávají 4.

Dosavadní desky, cílová slova, pořadí původních cest, výsledky a XP zůstávají
zachované. Nová stovka se připojuje na konec každé cesty. Rozehraná hra má
nadále přednost. Nejde o reset postupu, změnu režimů ani migraci databáze.

Výroba a redakce zachovávají délky slov, geometrické profily, tiery, tematickou
pestrost, rozestupy slov a slovních variant i omezení četnosti. Mozkokalypsa
přebírá vydanou metodiku MK100 v2 včetně dramaturgie 20/60/15/5, přesných
slovních směsí, výběru ze 16 nebo 48 ověřených rozmístění a kontrol koncovky.
Používá původní ověřený fond geometrických cest s novými slovy a písmeny.

Správnost a jedinečnost se ověřují nad výrobním kontrolním slovníkem 103 837
slov. Samostatný druhý solver používá jiný postup enumerace a
úplného pokrytí. Nedokončený důkaz při vyčerpání limitu znamená odmítnutí.
Samostatný širší slovník bonusových slov zůstává beze změny. Bonusové uznávání
neurčuje povinné řešení; uvedený důkaz se nevztahuje na všechny jeho tvary.

Číselná míra obtížnosti prvních pěti profilů používá původní kalibrační
slovník 13 940 slov doplněný o v3. Pozdější rozšíření uznávání nemění její
měřítko. Kotva z vydané Těžké `g6-refresh-hard-100` znovu dává přesně 15,972.
Úvodní běh nad posunutým měřítkem je doložen samostatně v opravě kalibrace;
po změně se všechny ponechané desky znovu zkontrolovaly.

`bank.json` uchovává obsah a výrobní důkazy, `editorial-review.json` konečné
redakční rozhodnutí ke každému otisku, `editorial-repairs.json` vrácené
sestavy a náhrady a `independent-verification.json` úplnou nezávislou kontrolu.
`production-boundaries.json` po připojení dokládá zachování původních bank.
Výrobní diagnostika se neposílá hráčům v runtime obsahu.

Redakce je AI kontrola všech konkrétních sestav. Nový lidský playtest celé
várky neproběhl; geometrická kalibrace navazuje na dříve schválené profily.
Ověření v prohlížeči používá místní syntetický hráčský postup a mobilní/Fold
viewporty. Nejde o test fyzického telefonu ani o výsledky skutečných hráčů.

Stav nasazení a konečné výsledky kontrol jsou v navazujícím release záznamu.
