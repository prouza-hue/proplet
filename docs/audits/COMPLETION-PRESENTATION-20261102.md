# Completion provenance and starter presentation follow-up

## Completion time

The result writer used account-sync arrival time for puzzle_attempts.completed_at,
even when anonymous finish/result data already recorded the original completion.
It could move historical games into today's totals after claim or replay.

The legacy writer now supplies the normalized declared completion. The additive
migration patches only the two equivalent acceptance-clock expressions in the
current atomic result writer, preserving its existing reward/timing/receipt rules.
A row trigger makes the first non-null completed_at immutable under later finish,
account claim, replay and concurrent writes. completion_received_at separately
records the server's first acceptance of a newly completed row. Clients cannot
override it. Previously completed rows keep their existing timestamp and NULL
receipt where unknown; there is no historical reconstruction or backfill.

The trigger covers old clients/server writers too. Install the migration before
deploying the new handler. A migration assertion rejects an unexpected atomic
writer shape, rolling back the whole migration instead of partially installing it.
Official results, XP, account ownership and result idempotency are unchanged.

## Starter presentation

Existing presentation_checked and idle events retain their once-per-run contract.
They now distinguish initial vs idle observation and carry bounded viewport size,
a finite obscurer tag and an identifier from a static UI allowlist. Arbitrary DOM
IDs, content, classes, input values and URLs are never collected. The server
validates the UUID/enums/ranges and strips these details from all other events.
This records obstruction without changing onboarding navigation or conversion.

## Regression gates

- Current manifest: delayed/repeated legacy result submit and unchanged XP;
  phone/Fold initial obstruction -> later visibility, run/release provenance,
  once-only diagnostics, header transport and real product-event persistence.
- Disposable PostgreSQL: first finish/receive separation, historical NULL,
  80-result replay, claim, actual current atomic RPC and offline insert, stable
  result/receipt/XP and a two-connection race on one unfinished attempt.
- Existing browser onboarding suite remains active; focused presentation browser
  coverage uses a loopback fixture only and blocks external network requests.

This change does not backfill live rows or perform synthetic production games,
registrations, client-error probes or account repairs. Technical acceptance is
not an organic PASS: after a separate authorized rollout, inspect actual first
games, immutable completion/receipt timestamps and initial/idle diagnostics.
