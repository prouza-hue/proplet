# Proplet v3.34 — Generation 4 release candidate

Status: **candidate-paused**. Production, Supabase a release dates are unchanged.

## Scope

| Bank | Count |
|---|---:|
| Starter | 1 |
| Rescue | 30 |
| Free Easy / Medium / Hard / Hardcore | 200 / 200 / 200 / 200 |
| Daily Easy / Medium / Hard | 105 / 156 / 104 |
| Rolling Easy / Medium / Hard / Hardcore | 17 / 16 / 16 / 16 |
| **Total** | **1,261** |

## Automated gates

- exact mask coverage and orthogonal non-revisiting target paths: pass;
- wide uniqueness evidence and zero endpoint-to-other-start adjacency: pass;
- frozen geometry, vocabulary, curl and ambiguity profile: pass;
- IDs and canonical board hashes unique across runtime and Rolling: pass;
- target exclusions, including `LUNOCHOD` and `FRISBEE`: pass;
- target cooldown contract: pass;
- old playable bodies absent from candidate runtime: pass;
- Rolling remains `releaseEnabled: false`, with no release date: pass;
- strict validator: 1,261 puzzles, 0 errors.

## Calibrated ambiguity summary

| Profile | Median | P75 | Maximum |
|---|---:|---:|---:|
| Easy | 7.46 | 9.00 | 15.00 |
| Medium compact | 7.68 | 8.43 | 10.14 |
| Medium cutout | 8.06 | 9.22 | 11.71 |
| Hard bridge | 10.17 | 11.06 | 13.25 |
| Hardcore | 14.58 | 17.01 | 26.58 |
| Rescue | 6.18 | 6.60 | 7.71 |

The metric is a ranking signal, not a conversion to play seconds. Medium and Hard ranges are anchored in V3 human playtest data.

## Target cooldown contract

The initially proposed global 12-board rule is impossible for the deliberately narrow Easy vocabulary (200 Easy boards, one target appears 42 times; a 12-board cooldown permits at most 16). The strongest audited product-specific contract is:

- Free Easy and Rescue: 3 previous boards;
- Free Medium: 8 previous boards;
- Free Hard and Hardcore: 12 previous boards;
- Daily: 5 previous days;
- Rolling: no repeat inside one five-level weekly drop.

The assembler enforces this contract and the release validator recomputes it independently.

## Preview rehearsal

Vercel Preview commit `2c0d68b34fd1605f85c4cf4e33ba38e2a1528327` is branch-scoped and read-only. Live checks passed:

- `/api/health`: Gen4 Free + Daily, `activeGeneration: 4`, `candidate-paused`, database healthy;
- `/api/puzzle-database`: schema v11, 4 × 200 Free and 365 Daily, no legacy bodies, `productionApproved: false`;
- `/api/rolling-content`: Gen4 metadata but zero released levels and `releaseEnabled: false`;
- all three reads use `Cache-Control: no-store` and `X-Robots-Tag: noindex`;
- a live `POST /api/health` probe is rejected before routing with HTTP 409;
- archived Free body request returns the intended HTTP 410 metadata tombstone;
- Vercel reported no runtime error clusters in the verification window.

GitHub Actions is currently unavailable at runner start: every matrix job is created and fails with zero executed steps and no job log. This is an account/runner infrastructure gate, not a failing assertion. Equivalent local checks passed with the pinned runtime dependencies, including the preview read-only regression, archive pipeline test, strict 1,261-board validator, Python syntax checks and JavaScript syntax check. The Actions gate remains mandatory before merge.

## Archive and progress preservation

- Metadata-only catalog: 4,594 unique contents, 4,599 exact contexts and 365 ID-only tombstones.
- The catalog contains hashes, IDs, generation, bank, difficulty, slot, dimensions and counts; no letters, masks, answers or paths.
- Cold recovery source: Git commit `a1904574324c714526a5303f6584f3174a789f8e`.
- Source blobs: `2836e666df3616446a5caaf2bed6df7c4c5010d8` (`data/puzzles.json`) and `ba5803665701cdd1c5a00d7c269ff91df49c16eb` (`data/rolling_content_v1.json`).
- Runtime retains only a slot-level `legacyFreeIndex` and Daily generation windows for progress/statistics mapping, not old playable bodies.
- Tombstones preserve generation/bank/slot metadata for legacy Daily IDs whose bodies were already absent from the production source; they never receive an invented content hash.
- Supabase migration adds content lineage to results/runs/attempts and a historical stats view. It has not been applied.

## Remaining safe-release gates

1. Restore GitHub Actions runner availability and reproduce the complete candidate there.
2. Deploy the paused candidate to Vercel Preview only. **Done.**
3. Rehearse catalog seed/backfill and migration verification outside production; read-only census at 2026-08-21 18:06 UTC classified all 6,934 current historical rows: 6,908 exact and 26 across three Daily IDs as honest `inferred` tombstone lineage, with zero unmapped.
4. Smoke-test Free, Daily, Rolling-disabled behavior, progress transfer, archived challenge fallback and cache headers. **Preview API/cache/read-only/archive checks done; authenticated progress-transfer rehearsal remains.**
5. Obtain Pavel's explicit approval.
6. Bind Daily and next-Monday Rolling dates with the approval-only binder.
7. Merge, apply the migration in the agreed order, and verify production health and rollback signals.
