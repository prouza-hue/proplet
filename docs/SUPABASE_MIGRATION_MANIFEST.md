# Supabase migration manifest

`supabase/migrations/manifest.json` is the canonical, static lineage record
for the 38 versioned `SUPABASE_*.sql` files at the repository root. It records
an explicit order, release/version label, category, SHA-256 checksum, and any
replaced RPC definitions. It is an inventory and review aid only: it never
connects to Supabase and never applies SQL.

## Ordering and categories

The numeric `order` is the reviewed execution/lineage order. It is deliberately
not inferred from lexical filenames. Entries are grouped as follows:

- `setup`: historical bootstrap only;
- `migration`: versioned runtime migrations;
- `hotfix`: corrective runtime replacements;
- `archive`: explicitly retained historical/archive schema in the runtime
  lineage (a domain category, not an inactive or skipped migration);
- `seed`: generated content seed, separate from migration history;
- `verify`: historical read-only verification scripts.

The v4.01.32 word-discovery chain is explicit: the base definition is replaced
by `SUPABASE_MIGRATION_V4_01_32_WORD_DISCOVERY_HOTFIX.sql`, which is in turn
replaced by `SUPABASE_MIGRATION_V4_01_33_WORD_DISCOVERY_50_XP.sql`. All three
entries retain their checksums and the affected RPC name.

## `SUPABASE_SETUP.sql` status

`SUPABASE_SETUP.sql` started as the v3.7 clean-install bootstrap. A later
Tajenka compatibility patch changed its results-mode constraint (the same
change is represented by `SUPABASE_MIGRATION_TAJENKA_WEEKEND.sql`), so the
checked-in file is not a pristine original v3.7 setup. It creates the initial
schema and grants, so it is not the current v4.01 baseline and must not be
replayed against an existing/current database as a repair mechanism.
The manifest records this truth as
`historical-bootstrap-not-current-baseline`; the expected v4.01 state must be
verified against a known target with the read-only definitions in
`supabase/schema-verification.sql` and the existing `SUPABASE_VERIFY_*.sql`
files. Those query definitions are not run by the current gate.

## Validation

Run from the repository root:

```bash
python tools/validate_migration_manifest.py
```

The validator checks schema shape, duplicate IDs/paths/orders, strict order,
file existence, SHA-256 drift, RPC metadata, superseded IDs, and complete
coverage of root-level `SUPABASE_*.sql` files. It is a current-runtime gate
entry and uses filesystem reads only. Negative fixture coverage lives in
`tests/current/test_migration_manifest.py`.

No migration is applied, repaired, pushed, or connected to a database by this
sprint.

## Sprint 16 / current release hygiene

Sprint 16 legacy cleanup nemění SQL soubory, pořadí migrací ani databázi. Aktuální release proces má používat tento manifest a `python tools/validate_migration_manifest.py`; historické release dokumenty nebo `SUPABASE_SETUP.sql` nejsou náhradou za kanonický lineage manifest.
