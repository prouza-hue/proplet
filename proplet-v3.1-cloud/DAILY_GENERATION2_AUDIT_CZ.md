# Proplet Daily Generation 2 — release audit

**Výsledek: PASS**

- 365/365 aktivních Daily desek znovu ověřeno exact-cover solverem: právě jedno úplné řešení.
- Všechny odpovědi pocházejí z Lexiconu v2 a splňují rodinný mix A/B/C.
- Každá Daily má průměr `fun` nejméně 3,0 a alespoň jedno slovo s `fun` 4–5.
- Kruhový anti-repeat má minimální rozestup 25 dní, včetně přechodu konec → začátek rotace.
- Původních 365 Daily je plně archivováno; staré/offline ID zůstává validní pro správné datum.
- Aktivní leaderboard přijímá jen primární generaci daného data, takže nemíchá výsledky dvou různých desek.

| Metrika | Výsledek |
|---|---:|
| Daily úloh | 365 |
| Snadná geometrie | 61 |
| Střední geometrie | 183 |
| Těžká geometrie | 121 |
| Odpovědí celkem | 2989 |
| Různých slov | 1399 |
| Průměr fun | 3.27 |
| Fun 4–5 | 768 |
| Tier A / B / C | 910 / 1709 / 370 |
