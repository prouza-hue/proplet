# Account progress truncated beyond one database page

## Finding

Account-wide `db_select` calls fetched one PostgREST response and treated it as
complete history. An investigated account has 1,049 result rows (including eight
since Monday 2026-09-07). This exceeds the conventional 1,000-row response cap.
The same transport implementation exists on main. No authenticated browser
session belonging to the reporter was used, so the precise missing rows in his
local cache have not been captured.

The frontend merges `/api/progress` into origin-local storage. A fresh preview
origin can therefore expose missing remote rows that an established LIVE cache
already remembers. Shared server data does not imply shared browser storage.
Leaderboards explicitly use `first-completed-only`: retaining the original time
on replay is expected, while showing an already completed board as unplayed is
not.

## Fix

Account-wide reads of results, account_rewards and streak_rescues now exhaust
pages in immutable primary-key order using an `id > cursor` filter. Short pages
do not end the read prematurely if the deployment sets a smaller row limit.
A failed page raises instead of returning a partial history. Point lookups,
public ranking reads and write operations are unchanged. This also covers the
existing full-history reward guard, unlock and stats consumers without changing
their rules. Preview shell release fix20 triggers the existing safe auto-update.

This is a read-path fix: no migrations, account changes, historical result
rewrites, imports or resets are required or performed.

## Read-only database checks

- No duplicate challenge keys for the investigated account.
- Unique indexes exist on results(player_id, challenge_key),
  account_rewards(player_id, reward_key), and
  free_slot_rewards(player_id, difficulty, level).
- No result_commands with missing receipts/commit timestamps.
- No result_commands without a corresponding puzzle_runs row.
- LIVE and preview expose the same tested board identity (g4-x-202), participant
  count (19), first three ranking entries and times, and the same generation/XP
  configuration. These checks support shared data, but do not directly prove
  equality of the Vercel SUPABASE_URL environment variables: the available
  deployment connector does not expose environment configuration.

No private account identifiers or authentication material are included here.
These are scoped checks, not a blanket certification of all database contents.

## Verification

`python -m pytest -q tests/current/test_account_history_pagination.py tests/current/test_runtime_resilience.py tests/current/test_s07b_readonly_stats.py tests/current/test_s08b_atomic_result_adapter.py`

20 tests passed, including module-level read-only statistics / atomic-result
assertions. Coverage includes 0, 1,000, 1,049 and 2,049 rows, a lower 500-row
server cap, full progress serialization, a reward beyond the first page,
late-page failure, non-advancing cursors and unchanged point lookups.

`node tests/current/test_preview_auto_update.js` passed.

## Future production rollout conditions

- Include this fix in the reviewed main merge; main still has the old read path
  until that explicitly authorized production release.
- Verify production and preview SUPABASE_URL/project identity and result-write
  feature flags from deployment settings at rollout. Do not infer this from a
  matching schema or from identical sample rows alone.
- Build using production environment settings. Do not blindly alias a preview
  build: this app intentionally distinguishes preview/production behavior.
- Preserve puzzle IDs, challenge keys and existing account identities. This fix
  needs no database migration or progress transfer.
- On the final release, verify an authenticated >1,000-result account returns
  its complete history and marks the Monday boards completed. Read-only checking
  of an existing account is enough; do not replay boards or edit historical XP
  as a diagnostic step.
- Re-run the integrity queries immediately before rollout. Current checks are a
  point-in-time observation, not a promise about later writes.
