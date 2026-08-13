# Proplet Free Generation 2 — release audit

**Výsledek: PASS**

- 400/400 aktivních Free desek znovu ověřeno exact-cover solverem: právě jedno úplné řešení.
- Lexicon v2: 3153 schválených cílových slov; D s fun 4–5: 197.
- Aktivní Gen2 ID jsou unikátní a nekolidují s legacy bankou.
- Anti-repeat: stejné slovo se v jedné obtížnosti nevrátí dříve než po 24 mezilehlých úrovních.
- Daily 365 a Rescue 30 jsou přítomné; Daily má generaci 2.

| Obtížnost | Úrovně | Slov celkem | Různých slov | Min. rozestup | Průměr fun | Fun 4–5 | Tier mix |
|---|---:|---:|---:|---:|---:|---:|---|
| Snadná | 100 | 638 | 341 | 25 | 3.05 | 32 | A 638 |
| Střední | 100 | 745 | 542 | 25 | 3.31 | 222 | A 157, B 588 |
| Těžká | 100 | 1009 | 833 | 25 | 3.21 | 205 | B 202, C 807 |
| Mozkožrout | 100 | 1276 | 794 | 25 | 3.79 | 585 | C 597, D 679 |

## Migrace hráčů

Gen1 desky jsou v `legacyFree`; aktivní Gen2 používá nové ID. Postup se převádí po dvojici obtížnost + číslo úrovně. XP, hodnosti, achievementy a historické výsledky zůstávají. Dobrovolné dohrání převedené Gen2 desky založí nový čas a nový leaderboard, ale XP za stejný slot už podruhé nepřidá.
