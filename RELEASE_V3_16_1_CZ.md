# Proplet v3.16.1 — Daily Generation 2

V3.16.1 dokončuje obsahový remake Propletu: po 400 Free úrovních nahrazuje také celou roční Daily rotaci.

## Nová Daily banka

- 365 úplně nových Daily úloh z Lexiconu v2,
- 2 989 odpovědí a 1 399 různých slov,
- 61 desek se Snadnou, 183 se Střední a 121 s Těžkou geometrií,
- rodinný mix Tier A/B/C bez Tier D kuriozit,
- průměrná zábavnost 3,27/5,
- 768 odpovědí s `fun` 4–5,
- každá jednotlivá Daily má průměr `fun` nejméně 3,0 a alespoň jedno slovo s `fun` 4–5,
- kruhový anti-repeat: minimální rozestup stejného slova je 25 dní i přes konec roční rotace.

## Historie a férovost

Původních 365 Daily desek je plně uloženo v `data/legacy_daily_gen1.json`. Ve veřejné puzzle bance zůstává jen kompaktní mapa jejich ID, takže archiv nezpomaluje aplikaci víc, než je nutné.

Server přijme starý výsledek z cachované nebo offline v3.16, pokud ID odpovídá správnému datu. Výsledek dál přidá XP, streak a zůstane v historii. Denní leaderboard ale pro dané datum zobrazuje pouze primární generaci, takže nesrovnává časy ze dvou různých desek.

## Audit

Release audit znovu vyřešil všech 365 Daily exact-cover solverem. Výsledek je **PASS 365/365**. Současně znovu proběhl audit Free banky: **PASS 400/400**.

Podrobnosti jsou v `DAILY_GENERATION2_AUDIT_CZ.md` a `FREE_GENERATION2_AUDIT_CZ.md`.
