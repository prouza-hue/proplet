# Proplet v3.16.5 — Daily lze bezpečně zopakovat

## Oprava

Výsledkovka Daily nově vždy nabízí samostatné tlačítko pro další pokus:

- u aktuální desky **Zahrát znovu · trénink**,
- u výsledku z archivované generace **Zahrát novou dnešní výzvu**.

Přechodová možnost už tedy není schovaná pouze na hlavní kartě Daily. Pomůže i hráči, jehož lokální stav chybně považuje starý výsledek za aktuální.

## Férovost a XP

- Opakování aktuální Daily nepřidá dalších 100 XP.
- Do globálního i týmového pořadí dál platí první oficiální dokončení aktuální desky.
- Tréninkový pokus se ukládá do historie `puzzle_runs`, ale soutěžní výsledek nepřepisuje.
- Pokud server drží starou archivovanou Daily, dokončení aktuální desky ji bezpečně nahradí bez druhých XP a hráč se objeví v dnešním i týdenním pořadí.

To řeší také Petera z týmu Prouza bez ručního mazání výsledku a bez rizika ztráty XP.

## Co ukázal screenshot

Pavlův obrázek z v3.16.4 zachycoval aktuální Gen2 Daily: výsledek byl 2. ze 3 v globálním pořadí. Nebyl tedy případem archivované desky. Zároveň ale správně odhalil, že výsledkovka vůbec nenabízela další pokus a předchozí popis funkce byl zavádějící.

## Testy

- syntaxe klienta a kompilace serveru,
- kontrola přítomnosti a zapojení nového tlačítka,
- 14 regresních testů,
- samostatný test, že replay aktuální Daily nepřidá XP a nepřepíše první výsledek,
- zachovaný test generačního převodu bez druhých XP.
