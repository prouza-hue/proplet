# Atomic `/api/result` contract v1

Status: Sprint 08A design contract. This document, its fixture and its tests are
non-runtime artifacts. Sprint 08A does not change `server.py`, the public API or
the database schema.

## 1. Problem and invariant

The current `/api/result` route performs independent remote operations. In
order, it can claim a legacy free-slot reward, write `puzzle_runs`, insert or
update `results`, finalize `puzzle_attempts`, and finally read player stats.
Failures in the run and attempt writes are suppressed, while failures around
the reward or official result can leave a partial state. A retry without an
`attempt_id` also receives a fresh random run identifier.

The v1 target invariant is:

> For one authenticated result command, the economic reward, official result,
> competition run, owned attempt finalization and durable receipt either commit
> together exactly once or do not change durable state at all.

An exact retry returns the stored receipt. Reusing the same idempotency key for
a different command returns a conflict and performs no write.

## 2. Server command

The browser continues to send the current `ResultCreate` body. The FastAPI
adapter authenticates the player, validates the current content rules and
builds the following server-only command. The browser never supplies
`playerId`, `points`, generation metadata or authorization decisions.

| Field | Type | Contract |
| --- | --- | --- |
| `contractVersion` | integer | Exactly `1`. |
| `playerId` | UUID | Taken only from `auth_player()`. |
| `idempotencyKey` | text | Preferred: `attempt:<attempt_id>`. Legacy fallback described below. |
| `requestDigest` | lowercase hex SHA-256 | Digest of the canonical browser request; available before content lookup. |
| `commandDigest` | lowercase hex SHA-256 | Digest of the canonical command fields, excluding the digest itself. |
| `puzzleId`, `challengeKey` | text | Content-validated identifiers. |
| `mode` | enum | `daily`, `free`, `starter`, `tajenka`. |
| `difficulty` | enum | A current `FREE_DIFFICULTIES` value. |
| `dailyDate` | ISO date or null | Required only for Daily. |
| `completedAt` | UTC timestamp | Sane client timestamp, otherwise one timestamp assigned once by the adapter. |
| `elapsedMs`, `moves` | integer | Existing `ResultCreate` bounds. |
| `hintsUsed`, `wrongAttempts`, `maxHintLevel` | integer | Existing `ResultCreate` bounds. |
| `cleanSolve` | boolean | Effective value: requested clean and zero hints. |
| `calmMode` | boolean | Persisted, and excluded from competitive rankings by existing readers. |
| `attemptId` | text or null | The supplied telemetry attempt identifier. |
| `points` | integer | Server-resolved reward for this content. |
| `contentGeneration`, `freeLevel` | integer or null | Server-resolved reward lineage. |
| `legacyRewardSlot` | object or null | Server-resolved `{difficulty, level}` only for the legacy cross-generation free-slot compatibility path. |
| `teamCodeAtCompletion` | text or null | Server-resolved historical team projection. |

Canonicalization uses UTF-8 JSON with sorted keys, no insignificant whitespace,
and explicit `null` values. `requestDigest` covers every accepted `ResultCreate`
field. `commandDigest` covers every field above except `commandDigest` itself.
Together they detect a changed browser request or server-resolved reward/player
under an existing idempotency key.

### 2.1 Idempotency key

1. If `attempt_id` is present, the key is `attempt:<attempt_id>`.
2. For a legacy client without `attempt_id`, the adapter uses
   `legacy:<player_id>:<challenge_key>:<sha256(canonical client result)>`.
   The canonical legacy result contains puzzle, challenge, mode, difficulty,
   date, timing, moves, hint/error metrics, clean/calm flags and the client
   `completed_at` value (including explicit null).

This fallback makes a byte-equivalent queued retry deterministic. Two genuinely
different legacy plays with identical metrics may collapse into one analytics
run; their XP and official result are already one-per-challenge. This bounded
analytics trade-off is safer than manufacturing a duplicate run on every retry
and can be removed after the legacy-client window.

## 3. Durable receipt

The transaction stores an internal receipt and the adapter maps it to the
unchanged public response.

| Internal field | Meaning | Public field |
| --- | --- | --- |
| `commandId` | Durable command ledger UUID. | Not exposed. |
| `idempotencyKey`, `requestDigest`, `commandDigest` | Replay/conflict proof. | Not exposed. |
| `firstCompletion` | This command created the one official result. | `firstCompletion` |
| `awardedPoints` | XP committed by this command; zero on replay/duplicate challenge. | `awardedPoints` |
| `dailyGenerationUpgrade` | Existing Daily generation replacement rule fired. | `dailyGenerationUpgrade` |
| `transferredSlot` | Existing legacy free-slot reward transfer rule fired. | `transferredSlot` |
| `officialResultId` | Result row selected/created by the transaction. | Not exposed. |
| `runId` | Exactly one run for this command. | Not exposed. |
| `attemptStatus` | `finalized`, `created_offline`, `not_supplied`, or `ownership_conflict`. | Not exposed. |
| `committedAt` | Server transaction timestamp. | Not exposed. |

`stats` remains a read-only, post-commit lookup. If it fails, the adapter returns
the existing `stats: null` and `statsWarning`; that failure never changes or
invalidates the stored receipt. An exact retry may refresh stats, but the four
economic/result fields must equal the stored receipt.

## 4. State table

| State | Result | Durable effect |
| --- | --- | --- |
| First valid submit | HTTP 200, `firstCompletion=true`, configured XP | One command, run, official result and receipt; owned/new offline attempt finalized. |
| Exact retry | HTTP 200 with the same economic/result receipt | No new or changed economic rows, run or attempt. |
| Same key, different digest | HTTP 409 `IDEMPOTENCY_CONFLICT` | No write. Original receipt remains authoritative. |
| Offline delayed submit | HTTP 200 if the archived puzzle/date is still valid | `completedAt` can replace a later official completion for the same puzzle; reward remains at most once. Missing attempt is created as completed. |
| Guest attempt already adopted by `/api/anonymous/claim` | HTTP 200 | Player-owned attempt is finalized in the transaction. Claim itself still creates no XP/result. |
| Anonymous/unowned or another player's attempt | HTTP 200 for an otherwise valid result, `attemptStatus=ownership_conflict` | Never adopts or overwrites the attempt; economic result is not lost because telemetry ownership differs. |
| Stale, unknown or unreleased puzzle on a new command | Existing 400/404 validation response | No command ledger row and no write. A previously committed exact retry is resolved from its receipt before live-content validation. |
| Duplicate official reward/challenge | HTTP 200, `firstCompletion=false`, `awardedPoints=0` | One new run for a genuinely new command; official result and XP remain single. Earlier offline time or the existing Daily-generation rule may update official fields. |
| Duplicate legacy free-slot reward | HTTP 200; transfer flag follows the existing rule | Unique slot reward is not paid twice and cannot exist without the matching committed result command. |

## 5. Transaction boundary

Sprint 08B may implement one service-role-only Supabase function with this
logical signature (name and exact SQL are frozen only after approving 08A):

```sql
public.proplet_submit_result_v1(
  p_player_id uuid,
  p_idempotency_key text,
  p_request_digest text,
  p_command_digest text,
  p_command jsonb
) returns jsonb
```

The function must be `SECURITY DEFINER`, set a fixed `search_path`, qualify all
objects, revoke execution from `public`, `anon` and `authenticated`, and grant it
only to `service_role`. FastAPI authenticates the session and passes the player
UUID separately; the function rejects a missing player and rejects any player
identity inside JSON that differs. Browsers never call this RPC directly.

Within one PostgreSQL transaction the function:

1. locks or inserts a unique `(player_id, idempotency_key)` command ledger row;
2. returns its stored receipt for equal request and command digests, or raises
   `IDEMPOTENCY_CONFLICT` for a different digest;
3. locks/claims the legacy free-slot row when that compatibility path applies,
   resolving the effective committed points and `transferredSlot` before the
   official result is built;
4. inserts exactly one `puzzle_runs` row linked by a unique
   `result_command_id`; it preserves the raw attempt ID when safe and may use a
   derived run attempt ID when an unowned global attempt-ID collision exists;
5. locks the unique `(player_id, challenge_key)` official result and applies the
   existing first-completion, earlier-offline and Daily-generation rules;
6. finalizes a matching player-owned attempt, creates a missing offline attempt,
   or records a non-fatal ownership conflict without touching an unowned row;
7. writes the receipt to the command ledger and returns it.

Any exception before step 7 rolls back steps 1–6. PostgreSQL's transaction is
the rollback mechanism; the function must not catch an error and return success
after a partial write.

### 5.1 Atomic versus best effort

Atomic: command ledger/receipt, `puzzle_runs`, `results`, committed XP, legacy
`free_slot_rewards`, and matching/missing `puzzle_attempts` finalization.

Outside the transaction and best effort: `player_stats()` read, response stats,
logs, operational metrics, helper/hint/product events, push work, snapshots and
explicit historical repair commands. `player_stats()` remains read-only.

## 6. Error contract

| Code | HTTP | Retry |
| --- | --- | --- |
| `IDEMPOTENCY_CONFLICT` | 409 | Do not retry with that key; inspect client queue corruption. |
| `RESULT_COMMAND_INVALID` | 400 | Fix/drop payload. |
| Existing unknown/unreleased/content errors | 400 or 404 | Retry only after content refresh; exact committed retry still returns its receipt. |
| `RESULT_COMMAND_UNAVAILABLE` | 503 | Safe to retry the exact same command/key. |
| Unexpected transaction failure | 500 | Safe to retry the exact same command/key; no partial commit. |

Attempt ownership disagreement is deliberately a receipt status rather than a
fatal error, matching current behavior where telemetry failure cannot discard a
valid official result. It is still observable in aggregate logs/metrics without
PII.

## 7. Adapter rollout

The additive 08B schema prerequisite is a result-command ledger, a nullable
unique `puzzle_runs.result_command_id` link, and a `puzzle_attempts.mode` check
that accepts every mode supported by `/api/result` (currently Starter and
Tajenka are missing there). Exact DDL and rollback SQL are deliberately deferred
until the contract is approved.

The public request and response stay compatible. The planned adapter order is:

1. rate limit and authenticate;
2. structurally validate and derive the key plus `requestDigest`;
3. look up an existing command receipt before live-content validation, so a
   committed offline retry survives later content retirement;
4. for a new command, apply current content/unlock/sanity rules and resolve all
   server-owned command fields;
5. derive `commandDigest` and call the single write RPC;
6. map its receipt to the current seven response keys and fetch read-only stats.

Rollout is additive: deploy ledger/function first, verify SQL, then deploy an
adapter behind a server-side flag with legacy path available. Compare aggregate
success/conflict/error counts, never raw player payloads. Promote gradually only
after exact-retry and failure-injection checks pass against a disposable DB.

Rollback disables the adapter flag and returns to the legacy path. The additive
ledger/function remain unused; no destructive downgrade is required. A separate
rollback SQL file must revoke function execution before optionally dropping the
function/table, and must never delete `results`, `puzzle_runs`, attempts or
reward history. Commands already committed through v1 remain valid product
state and must not be replayed through the legacy writer.

## 8. Approval gate

Sprint 08A is complete only when the fixture and failure-injection tests pass and
this contract is explicitly approved. Sprint 08B must not create a migration,
RPC, runtime adapter or feature flag before that approval.
