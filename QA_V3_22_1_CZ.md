# QA — Proplet v3.22.1

## Cíl

Opravit pouze čitelnost písmen na nalezených barevných stopách v dark mode bez vedlejších změn.

## Ověření

- Chromium render všech 12 herních barev v dark mode: PASS.
- Písmo nalezené stopy: `#0c0b10`: PASS.
- Pozadí nalezené stopy: 70 % `--word-color` + 30 % dark surface: PASS.
- Nejnižší vypočtený kontrast napříč 12 barvami: > 4,5:1: PASS.
- Light-mode pravidlo `.cell.used` nezměněno: PASS.
- Puzzle JSON a `SUPABASE_MIGRATION_V3_21.sql` beze změny: PASS.
- Orientation blocker zůstává odstraněný: PASS.
- Žádná nová SQL migrace: PASS.
