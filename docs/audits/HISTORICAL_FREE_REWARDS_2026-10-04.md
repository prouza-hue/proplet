# Historical free reward preparation — 4 October 2026

Status: prepared draft; no Archive activation, no production SQL or XP mutation.
Pinned production/main: a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db.
Database: iopyhluayfszskyqqpuc. Production RPC service-only access verified read-only.
This file describes the final implementation, not an authorization to deploy it.

## Problem and resulting behavior

A completed generation-4 level 29 currently blocks a never-earned historical
generation-1–3 level 29: both the Python history guard and the original unique
ledger ignore the difference between reward pools. Current result RPC also
retains positive points after a conflicting historical claim.

The historical shared pool now reserves (player, difficulty, level) only for
G1–3. Generations 4 and later retain independent rewards per concrete board,
regardless of which generation is active. Old XP and original ledger rows
remain unchanged.

The prepared SQL creates historical_free_slot_rewards, seeds existing G1–3
claims, and marks already-paid historical result slots once. The ledger is an
audit record and is never added to any XP total. A ledger row counts as a
consumed slot even when points=0: its reward may live in an earlier result.

The RPC inserts a historical result at zero points, then attempts the unique
claim only for a genuinely new result. Only the winning claim updates that
result's XP. Results, runs, claim, attempts and receipt commit together.
Duplicate challenges cannot consume an unpaid slot; claim conflicts leave
zero XP. The HTTP adapter always sends base XP and delegates eligibility to
the transaction, eliminating history-dependent digests and full-history reads.
Non-atomic historical writes fail closed; G4+ existing fallback remains.

Exact replay uses the original browser request digest and returns its durable
receipt before comparing a later server-generated command digest. A modified
browser request still fails with IDEMPOTENCY_CONFLICT.

## Read-only production evidence

There are 1,916 original claims: G1=5, G2=507, G3=1,391, G4=13.
Every one of the 13 G4 claims has no paid G1–3 result for that exact slot.
These are valid G4 records; they must not be deleted or treated as historical
claims. Michael's g4-h-029 is one concrete example.

The preparation would seed 2,129 historical slots at this snapshot:
1,903 G1–3 claims plus 226 already-paid slots lacking a historical claim.
No XP is awarded by this seed.

All 26 zero-point G1–3 claims have a positive historical result for the slot.
All 62 zero-point historical results are legitimate already-paid repeats.
Nineteen oldest positive results have unknown content_generation but exact
content_level/lineage. Sixteen share a slot with a later paid historical row.
They date to 12 August 2026 and do not involve Michael or PiettraWal. Prior
rules are unproven; this change neither removes nor re-awards their XP.
The source generation stays NULL in the new ledger where it is unknown.
The exact content_level takes precedence over a puzzle-ID number suffix.

## Prepared files and validation

- server.py: G1–3 guard, all G4+ per-board rewards, safe historical fallback.
- supabase/prepared/historical_free_rewards.sql: isolated ledger, seed, RPC.
- tests/current/test_historical_free_rewards.py: real adapter boundary behavior.
- tools/test_historical_free_rewards_db.py: real disposable PostgreSQL races,
  conflict, rollback, replay, seed idempotency and permission checks.
- Existing Current runtime gate/isolated PostgreSQL 17.11 runs both regressions.
- Existing Sprint 08B acceptance injects failure into the new historical ledger.

The SQL is intentionally a standalone prepared file. At deployment, generate
the actual migration with Supabase CLI migration new historical_free_rewards
and place the reviewed SQL into that generated file; local CLI execution was
unavailable in this session. Do not invent an applied migration timestamp.

## Deployment preflight and ordering

1. Verify actual production deployment SHA, main, DB and RPC definition again.
2. Confirm CI on the exact PR head: current runtime and isolated database green.
3. Keep Archive unavailable and PROPLET_ATOMIC_RESULT_V1_ENABLED=true for it.
4. Save the current RPC definition and original ledger/result XP snapshots.
5. Generate the migration with the CLI and apply the reviewed standalone SQL.
   It acquires short table locks with 3-second lock timeout and 20-second
   statement timeout. Failure aborts the complete preparation.
6. Verify original ledger digest and result XP/count unchanged; all previously
   paid historical slots covered; RLS enabled and RPC service-only.
7. Deploy the compatible runtime. Existing G4+ content works before/after SQL.
   Historical plays remain unavailable until archive content/UX release.
8. Before opening Archive, repeat the idempotent reconciliation while hidden,
   verifying no old in-flight writer created an uncovered paid historical slot.
9. Only then activate Archive separately, after content and solution acceptance.

## Rollback

Before Archive opens, hide its entry point if present and restore the previous
runtime if necessary. The separate ledger can safely remain with no gameplay
effect. Keep the corrected RPC: G4+ calls are compatible with both runtimes.

After any Archive play, do not drop the historical ledger, undo granted XP, or
restore the old claim-before-result writer. Disable Archive entry/start paths,
retain the safe RPC and ledger, and fix forward. Pending results must keep their
durable receipts. Other existing game modes continue normally.

No production rollback action is included in this draft. The prior production
RPC definition is reference backup only, because executing it after Archive
opens would reintroduce duplicate-reward risk.
