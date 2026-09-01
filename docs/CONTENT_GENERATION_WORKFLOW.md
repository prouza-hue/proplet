# Proplet content pipeline

Status: canonical map introduced in Sprint 14.  Existing released banks remain frozen.

## Sources, evidence, and runtime outputs

`content/generation-manifest.json` is the machine-readable authority for paths,
roles, SHA-256 values, byte sizes, generation metadata, and provenance.  The
validator is read-only:

```bash
python tools/build_runtime_content.py --check
```

The released content path is:

1. curated/frequency inputs (`source_cs_50k`, answer tiers, Lexicon V2, Gen4
   profiles and exclusions);
2. paused Gen4 puzzle and Rolling candidates;
3. approval-only binding through `tools/bind_gen4_release.py`;
4. exact embedding of the 100-board Mozkomor source;
5. `data/puzzles.json` as the canonical server runtime source;
6. one declared public compatibility append, `g3-d-007`, sourced from the
   checked-in v3.33.5 cold archive;
7. deterministic compact UTF-8 serialization to `public/puzzles.json`.

The exact checked-in Git evidence is: paused archive/candidates `d8c087f`,
binder introduction `db55f73`, Gen4 release cutover `ea475a8`, public Daily
compatibility `5ffa725`, and the current Mozkomor/runtime bodies `cf1da0b`.
`f4e5ed7` is recorded separately only as the production runtime merge preceding
this sprint; it is not mislabeled as a content-producing commit.  Full object
IDs live in the manifest.

The canonical build intentionally produces different server/public hashes:
the server bank has 365 Daily boards and the public bank has 366.  Every shared
Daily body and every other top-level value is identical.  Copying the server
file over the public file would be a production regression.

The validator lexicon is a separate identity build:
`data/words.txt` and `public/valid-words-v3328.txt` must remain byte-identical.
Rolling content, the lineage catalog, Tajenka, and release evidence are
hash-bound runtime/evidence artifacts; Sprint 14 does not rebuild them.

## Safe command boundaries

`tools/build_runtime_content.py` has no default write target.  Use `--check` for
read-only verification or an explicit `--output PATH`; writing uses a temporary
file in the target directory followed by `os.replace`.

`tools/generate_puzzles.py` remains import-compatible for historical helper
consumers, but CLI generation now requires one explicit `--output`.  Auxiliary
word-list output requires `--words-output`; Daily Generation 2 archive output
requires `--legacy-daily-output`.  It never fans out automatically to both
released puzzle banks.  Auxiliary files are replaced before the primary bank,
so an auxiliary failure cannot advance the canonical output.  The replacements
are individually atomic, not a cross-file transaction; an earlier explicit
auxiliary can already have been replaced if a later auxiliary fails.

No generation command or workflow is part of the normal current-runtime gate.
Sprint 14 verification builds only in memory or into a temporary directory.

## Noncanonical legacy entrypoints

The complete current inventory of historical tools that can directly write a
released puzzle/rolling artefact is below.  They are not the canonical Sprint
14 release path:

- `generate_free_generation3.py`
- `generate_daily_v324.py`
- `format_v324_puzzles.py`
- `patch_v4002_daily_compat.py`
- `repair_bank_repeats.py`
- `regenerate_long_hard.py`
- `regenerate_tiered_unplayed.py`
- `regenerate_future_daily_tiered.py`
- `topup_strict.py`
- `generate_rolling_content.py`

The stale `mozkomor-fastgen` workflow also contains an inline direct rewrite of
both released puzzle banks.  Explicit-output release tools
`assemble_gen4_release.py` and `bind_gen4_release.py` can target those files only
when a caller deliberately supplies those paths.

They are retained as release evidence/legacy tooling.  Removing or converting
all of them belongs to a separate, explicitly characterized cleanup.

Four Mozkomor workflows (`v40129-mozkomor-build`, `mozkomor-fastgen`,
`mozkomor-brutal10`, `mozkomor-masochist-playtest`) reference deleted historical
files and must not be used as a current release signal.  Sprint 14 neither runs
nor silently repairs them.

## Known provenance limits

- The historical Gen4 candidate manifest describes the paused pre-Mozkomor
  candidate; it is evidence, not the canonical current manifest.
- Provenance commits are recorded as exact full Git object IDs and validated
  syntactically.  Shallow CI does not prove object reachability; the content
  bytes, sizes and available Git blob IDs are the machine-verified contract.
- The Lexicon V2 builder historically consumed an external reviewed green-core
  seed that is not tracked in this repository.  The current released Lexicon V2
  bytes are hash-bound, but a fully reproducible historical lexicon regeneration
  is not claimed.
- The Mozkomor source metadata still carries its historical playtest status even
  though its 100 puzzle bodies exactly match the released runtime.  The manifest
  records this fact without rewriting either artifact.
- Some old package tests require server/public puzzle files to be identical.
  They are legacy evidence and conflict with the declared one-board compatibility
  window; current tests enforce 365/366 instead.
