# Atomic team leave

The old leave handler closed active membership rows with independent REST writes,
then called an undefined solo-code helper. A failure could therefore end history
without moving the player out of the team.

The authenticated route now issues one service-role-only, security-invoker RPC.
It locks the player, checks the expected family and join timestamp, closes active
memberships and changes the player to a freshly generated SOLO code in one SQL
transaction. Any write failure propagates and rolls back both changes. There is
no non-atomic fallback. A repeated request after a lost successful response is a
no-op for an already solo player; it does not replace their solo code. A stale
request cannot remove the player from a different/rejoined team. Historical
membership rows, results, rewards and other players are not rewritten.

## Verification

- `tests/current/test_team_leave_atomic.py` exercises the actual HTTP handler:
  authenticated identity, unchanged public response, success/retry, conflict,
  unavailable/malformed RPC, auth/preview guards and generator failure before RPC.
- `tests/current/team_leave_database_acceptance.sql` injects failures into each
  update, checks rollback, successful transition, unchanged history/other player,
  stale state, invalid SOLO code, retry, missing history/player and execute ACL.
- `tools/test_team_leave_db.py` runs that SQL in the disposable loopback PostgreSQL
  database after the existing chronological migration bootstrap in CI.
- Local SQL acceptance can be executed in an isolated PostgreSQL-compatible
  PGlite engine. That checks SQL and rollback semantics, not multiple connections;
  CI's native PostgreSQL remains the deployment gate.

## Rollout order and limits

Apply `20261030230000_team_leave_atomic.sql` before deploying the handler. The
migration only adds a function and restricts its ACL; it does not repair or
backfill existing accounts. Without the function the new handler fails closed
with 503 and performs no independent membership writes. Old server instances do
not gain atomic behavior merely by installing the function: verify the new
server SHA is active as well.

No synthetic production leave, game or registration is required or authorized by
this audit. Existing account state is inspected read-only, with discrepancies
reported separately rather than automatically reconstructed from timestamps.
