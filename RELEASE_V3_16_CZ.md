# Proplet v3.16 — Lexicon v2 + Free Generation 2

V3.16 nahrazuje všech 400 aktivních Free úrovní novou generací obsahu a současně chrání veškerý dosavadní postup hráčů.

## Co je nové

- **Lexicon v2:** 3 153 kurátorovaných cílových lemmat v tieru A–D.
- **Zábavnost slov:** každé slovo nese skóre `fun` a další metadata pro řízení generátoru.
- **400 nových desek:** 100 Snadných, 100 Středních, 100 Těžkých a 100 Mozkožroutů.
- **Hravější Tier D:** například KVARK, MENHIR, ARKÁDA, FRAKTÁL, TESERAKT, ALCHYMIE, SYMBIÓZA nebo PARADOX.
- **Anti-repeat:** stejné slovo se v jedné obtížnosti nevrátí dříve než po 24 mezilehlých úrovních.
- **Samostatná identita:** aktivní desky mají ID `g2-*`; staré desky jsou uložené v `legacyFree`.

## Co zůstává hráčům

- všechny vydělané XP,
- hodnost a achievementy,
- staré časy a výsledky v archivu,
- postup v každé obtížnosti.

Původně dokončený slot se v Gen2 zobrazí jako **✓ Převedeno**. Hráč jej nemusí opakovat a tlačítko Hraj dál pokračuje prvním dosud nesplněným číslem úrovně. Novou verzi převedené desky lze kdykoli dobrovolně zahrát; získá vlastní čas a místo v novém leaderboardu, ale ne druhou XP odměnu.

## Ověření vydání

Nezávislý release audit znovu spustil exact-cover solver nad všemi 400 aktivními deskami. Výsledek je **PASS 400/400**: každá deska má právě jedno úplné řešení. Audit současně ověřuje tier policy, cesty slov, unikátní ID, kolize s archivem, anti-repeat a shodu serverové a veřejné puzzle banky.

Podrobnosti jsou v `FREE_GENERATION2_AUDIT_CZ.md`.
