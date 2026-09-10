# Tajenka Content v2 — authoring contract and rollout guardrail

Status: **authoring-only / runtime disabled**

This package separates the Tajenka editorial redesign from the active weekend runtime. It is intentionally safe to carry on `ux/tiskarska-dilna` through the later merge to `main`.

## Rollout rule

The current v2 authoring package must not modify or import into these active v1 surfaces:

- `data/tajenka_weekend_v1.json`
- `tools/build_tajenka_preview_bank.py`
- Tajenka runtime rendering/state
- Tajenka backend release flags or database contract

Therefore merging `ux/tiskarska-dilna` to `main` with the v2 authoring files present does **not** switch production Tajenka to v2.

After the Tiskařská dílna rollout, continue Tajenka v2 from the new `main` in a separate follow-up change. The authoring schema, reviewed pool, validator and scoped anchor allowlist will already be present there because they travelled with the preview branch.

## Editorial rule

> Good Czech is written first. The board adapts to the sentence, never the other way around.

The generator may accept or reject copy. It may not rewrite approved copy to make geometry easier.

## Content types

- `observation`: original dry humour / everyday observation
- `fact`: verified surprising fact
- `czech`: Czech language/history/culture curiosity
- `proverb`: established saying
- `quote`: exact attributed quote

Facts, Czech factual claims and quotes require a verified source before passing the dry validator.

## Anchors

Standard Tajenka:

- exactly 5 anchors
- normally 4–10 letters per anchor
- one 3-letter anchor only with explicit editorial justification
- 24–31 playable letters total; 26–30 preferred
- no duplicate anchors
- an anchor explicitly marked `weak` is rejected

Immutable source text (quote / established saying) may use exactly 4 anchors if it has 24–30 playable letters. This exception is not available to original copy.

A preposition or conjunction must not become a board answer merely to hit the desired count.

## Companions

A companion is display text that is not on the board and is revealed together with a specified anchor.

Guardrails:

- at most 5 companion words in the whole phrase
- at most 2 companion entries attached to one anchor
- at most 1 meaning-significant companion entry
- companions must not become a dumping ground for long content words

Punctuation remains display-only.

## Tajenka-only anchor allowlist

`content/tajenka-v2/lexicon-overlay.json` is deliberately scoped to `tajenka-v2-only` and has `runtimeEnabled: false`.

It approves exact forms for the editorial/board-generation pipeline without making them globally generatable Proplet answers. This is especially important for proper names and inflected forms such as `SATURN`, `JÁCHYMOVĚ` or `DAČICÍCH`.

## Board contract — next phase

The eventual adapter keeps a 6×6 board, but active-cell density must be adaptive rather than assuming the old fixed 27–28 phrase-letter budget.

Initial targets:

- playable letters: 24–31
- decoys and cut-outs chosen adaptively
- path curvature scaled by word length
- existing ambiguity/unique-solution quality gates preserved until real v2 boards give evidence for recalibration

No board generation is performed by the current package.

## Current reviewed bank

The 60-item editorial pool was reviewed by the product owner; 14 items were rejected editorially. The remaining 46 are stored as category shards under `content/tajenka-v2/editorial-*.json`.

Dry structural expectation:

- **41 PASS**
- **5 FAIL** retained as regression fixtures: #30, #40, #58, #59, #60

An earlier manual note incorrectly treated #31 as a duplicate because numbering from the older 25-item draft pool was mixed with the 60-item pool. The machine-readable bank fixes that bookkeeping error; #31 is a valid PASS.

Run:

```bash
python tools/validate_tajenka_content_v2.py
python tools/test_tajenka_content_v2.py
```

Expected test output:

```text
PASS: Tajenka Content v2 dry validation = 41 PASS / 5 FAIL
```
