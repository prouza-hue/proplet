# Authoritative account creation analytics

## Creation paths

All current player creation converges on two INSERT sites:

- `server.create_player` (`POST /api/player`): solo/password and team accounts.
  Profile/settings, win CTA, post-game nudge and the progress guard's alternative
  account action use the shared account modal. Onboarding opens the login modal;
  switching it to creation uses this same endpoint.
- `account_auth_core.google_complete` (`POST /api/auth/google/complete`): inserts
  only when no mapped player, authenticated current player or verified-email
  owner exists. All Google buttons, including the progress guard, reach it.
  Existing-account login, linking and recovery update/reuse players, not INSERT.

The former browser event lives only in `saveNewProfile` after the password flow.
Google completion does not execute it. Even password signup could lose it after
the player INSERT (tab close, network failure, or failure building the response).

## Ownership and compatibility

The `players_account_created` AFTER INSERT trigger records the event in the same
transaction as the player. Its unique partial index on `product_events.player_id`
for `account_created` and deterministic event UUID enforce one event per player.
Login, linking, updates and conflicting INSERT retries do not fire it again.
The registration endpoints and their authentication logic are unchanged.

This is event idempotency, not a redesign of registration idempotency. If an
existing registration endpoint creates two genuinely distinct player IDs for
two requests, each actual account is counted once.

Old clients can still submit their legacy event; the database discards standalone
`account_created` inserts without failing the request. Other events are unaffected.
An old anonymous claim cannot attach a second historical signup to a player who
already has one; the historical anonymous event remains unchanged.

The event contains only the existing pseudonymous player ID, event ID/time,
fixed origin marker, version and environment. The backend supplies environment
and version to PostgREST via server-owned headers. No name, email, password,
OAuth profile, arbitrary browser properties, or CTA context is copied. Unknown
database writers are labelled `unknown`, never assumed production. No history is
backfilled. `signup_source` is intentionally not inferred.

## Rollout (requires isolated cloud preview verification first)

1. Verify destination projects and environment separation; do not create test
   players on a preview connected to production.
2. Deploy the backend header addition first. It is backward compatible before
   the migration; existing analytics continues unchanged during this stage.
3. Inspect existing non-null-player `account_created` duplicates. The migration
   fails rather than deleting or rewriting historical duplicates.
4. Apply `20260916071346_account_created_authoritative.sql` to the isolated DB.
5. Register by password and Google; verify one new event per new player, repeat
   login and callback, exercise failure, and check event fields and environment.
6. Only after that passes, repeat the backend-first/migration sequence in
   production. Registration and its event now commit or roll back together:
   event insertion errors fail the transaction, rather than silently losing data.
   The index creation briefly locks event writes; schedule accordingly.

Never run the migration through application startup. Never run a historical
INSERT/SELECT backfill. A rollback requires deliberate coordination: removing
both triggers restores old browser-only measurement, with its original gaps.

## Reproduction

Run the current runtime gate. On a disposable loopback PostgreSQL cluster run
`tools/test_isolated_result_db.py`, then `tools/test_account_created_db.py` with
its database report and the local password file. The latter executes the real
password/team/Google route functions against SQL with a synthetic OAuth provider.
CI runs both. These are not real Google end-to-end tests.

For a local browser preview, start the second script with `--serve 8877`, then
run `tools/test_account_created_browser.cjs` with `TEST_URL=http://127.0.0.1:8877`.
The browser invokes profile/win entry helpers and submits their real visible
forms; it verifies the player/event count deltas. External traffic is blocked.
Cloud preview requires separate verification; the fixture is not its substitute.
