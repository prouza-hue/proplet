# QA — Proplet v3.22.2

## Cíl

Opravit pouze čitelnost barevných štítků v řádku **Nalezeno** v dark mode.

## Ověření

- Chromium render řádku **Nalezeno** v dark mode: PASS.
- Štítky používají `--word-color`: PASS.
- Dark pozadí štítku: 70 % barvy slova + 30 % dark surface: PASS.
- Písmo štítku: `#0c0b10`: PASS.
- Nejnižší vypočtený kontrast napříč 12 herními barvami: 4,78:1: PASS.
- Light-mode pozadí štítku zůstává 58 % barvy + bílá: PASS.
- Nalezené buňky v desce z v3.22.1 zůstávají beze změny: PASS.
- Puzzle JSON a `SUPABASE_MIGRATION_V3_21.sql` beze změny: PASS.
- Orientation blocker zůstává odstraněný: PASS.
- Žádná nová SQL migrace: PASS.
