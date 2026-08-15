# Proplet Daily Generation 3 — release audit

**Výsledek: PASS**

- Nový Daily týden začíná vždy v pondělí.
- Rytmus je přesně `Po–Út Snadná · St–Pá Střední · So–Ne Těžká`.
- Přepnutí nastává v pondělí **2026-08-17**; do 16. 8. zůstává primární Gen2.
- 365/365 Gen3 desek znovu ověřeno exact-cover solverem: právě jedno úplné řešení.
- Kruhový anti-repeat slov má minimální rozestup 25 dní.
- Gen2 je plně archivovaná a staré/offline klienty server dál přijme pro správné datum.
- Free ani Rescue banka se nezměnila.

| Metrika | Výsledek |
|---|---:|
| Daily úloh | 365 |
| Snadná | 105 |
| Střední | 156 |
| Těžká | 104 |
| Odpovědí celkem | 2886 |
| Různých slov | 1330 |
| Průměr fun | 3.27 |
| Tier A / B / C | 907 / 1651 / 328 |
