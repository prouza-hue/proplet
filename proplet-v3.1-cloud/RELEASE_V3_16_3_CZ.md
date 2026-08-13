# Proplet v3.16.3 — výsledkovka, která umí slavit

## Každé dohrání dostane vlastní malou oslavu

Obecné **Hotovo!** nahrazuje krátká hravá pochvala podle obtížnosti:

- Snadná má klidné a příjemné povzbuzení,
- Střední přidává více slovního humoru,
- Těžká dostává osm poctivějších vítězných hlášek,
- Mozkožrout má deset nejvýraznějších reakcí odpovídajících skutečně těžké desce.

Čisté řešení bez nápovědy přidá ještě jednu krátkou pochvalu. Výběr je stabilní pro konkrétní pokus: znovu otevřený uložený výsledek ukáže stejný text, nový pokus může dostat jiný.

Pochvaly fungují pro Free i Daily a nesnižují hráče za použití Pomocníka. Výsledkovka se na menších displejích může bezpečně posouvat, pokud obsahuje hodně slov, achievement nebo leaderboard.

## Monetizace

Součástí release je první rozhodovací dokument `PROPLET_PLUS_DESIGN_V1_CZ.md`. Navrhuje sympatické předplatné i Lifetime, tematické balíčky a kosmetiku, ale žádné pay-to-win, reklamy za nápovědy ani spotřební mikrotransakce.

XP se v tomto releasu nemění.

## Testy

- syntaxe klienta přes `node --check`,
- automatický test velikosti a stability sad pochval,
- kompilace serveru přes `py_compile`,
- regresní testy migrace Free/Daily,
- kontrola unikátních HTML ID a vyváženosti CSS závorek.
