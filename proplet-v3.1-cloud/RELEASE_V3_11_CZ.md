# Proplet v3.11 — Slovník

## Hlavní změna

Proplet dostává vlastní ručně kontrolovaný český slovník rozdělený do čtyř úrovní A–D. Frekvenční/dialogový korpus už nesmí dodávat cílová slova; slouží pouze solveru k hledání nechtěných alternativních řešení.

### Nový slovník

- A: 488 slov
- B: 278 slov
- C: 194 slov
- D: 148 slov
- celkem 1 108 cílových slov

### Aktivní obsah

Od 13. 8. 2026 je přegenerovaných 141 budoucích Denních výzev. Prvních 224 Daily včetně 12. 8. 2026 zůstává beze změny.

Free banky a Rescue se v tomto releasu **nemění**. Jejich audit je hotový a bezpečný regenerátor je připraven, ale nejdřív potřebujeme globální manifest již spuštěných puzzle ID.

### Kontroly

- 795 aktivních puzzle, 795 unikátních desek,
- Free banky bitově beze změny,
- Rescue bitově beze změny,
- Daily 1–224 bitově beze změny,
- Daily 225–365: 141 nových desek,
- všech 141 nových Daily splňuje tier policy,
- všech 141 znovu prošlo kontrolou jediné lokální cesty každého cílového slova,
- každé vzniklo pouze po úspěšném exact-cover uniqueness solveru.

### Další fáze

`PLAYED_PUZZLES_FREEZE_QUERY.sql` → získat globální freeze manifest → dry-run `regenerate_tiered_unplayed.py` → audit → teprve potom výměna globálně nedotčených Free úrovní.
