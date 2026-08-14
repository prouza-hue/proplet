# QA — Proplet v3.23.1

## Jednočlenné týmy

PASS:
- veřejně přihlášený tým s 1 členem se objeví ve standings,
- `memberCount = 1`,
- denní skóre se skutečně počítá a není nulované podmínkou velikosti,
- tým může mít rank a být `isMine`,
- `myFamily.eligible = true`,
- veřejná odpověď dál neobsahuje interní `familyCode`,
- klient už neobsahuje text „Liga týmů potřebuje alespoň dva hráče“.

## Launch-readiness regrese

PASS:
- v3.23 security abuse suite,
- 56/56 API route trust-boundary inventura,
- privacy/terms,
- Launch radar,
- 10×10 board fit + display/font scaling,
- 14/14 historických Daily/Free migration/fairness testů,
- account nudges 1/4/10,
- optional starter hint,
- dark-mode found-cell/chip contrast,
- Python + JS syntax,
- package integrity + immutable puzzle hashes.

## SQL

Žádná nová migrace pro v3.23.1 nevzniká. Pokud v3.23 ještě nebyla nasazena, stále je potřeba před aplikací spustit `SUPABASE_MIGRATION_V3_23.sql` a potom `SUPABASE_VERIFY_V3_23.sql`.
