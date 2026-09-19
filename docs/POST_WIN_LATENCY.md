# Post-win latency — 2026-09-19

Baseline production/main: `0a1950191d28dc9136b66f7a3c4b139c73dc238d`.
User priority: results after completing a board; general rankings secondary.

Production was inspected read-only. Estimated results table: 18,772 rows,
9,456 kB including indexes. Historical database statement averages are roughly
6–12 ms for common result-history reads and 65 ms for the XP aggregate.
A small production XP-handler sample was 412–734 ms. These are not measurements
of a user's post-win latency. External HTTP timings in this environment include
roughly eight seconds even for a tiny static asset, so they are not usable as
user-facing latency figures.

## Confirmed avoidable work

After an atomic result commit, `/api/result` calculates complete player stats
before acknowledging the write. The queue ignores those stats and immediately
refreshes `/api/me` and `/api/progress` again. Ranking cannot start until that
unused work finishes. `player_stats` reads full results, rewards and rescues;
account-history pagination also makes an empty terminal request for completeness.

Free-board world and team rankings are fetched concurrently but previously
neither could render before both requests settled.

## Patch

- The queue requests a receipt-only response with `X-Proplet-Result-Receipt: 1`.
  Only the post-commit statistics read is skipped. Validation, authentication,
  atomic transaction, durable receipt, awarded XP, and idempotency are unchanged.
  Default responses for older clients retain stats. The existing profile refresh
  still runs in the background. No schema or data migration.
- World and team sections can render independently. A pending team has an honest
  loading state, not a false empty ranking. The selected tab remains selected;
  late hidden-team updates do not collapse an expanded world ranking.
- Stale completion callbacks cannot start rendering into a subsequent game.
  Ranking responses also check the game, account and request identity.
- Application and service-worker release markers advanced to postwin1.

The fair-play finish acknowledgement still precedes completion serialization;
this patch does not weaken the verified clock. Slow network, session-finalization
and result-write latency remain possible. General ranking caching and profile
API consolidation are intentionally separate work.

## Verification

Targeted tests cover new commit and durable replay without stats, compatibility
with old response contracts, world rendering while team is unresolved, team
failure after world success, and background profile refresh. Current runtime,
assets and syntax gate run before review. No real production game completed and
no production deployment performed for this patch.

## Rollback

Revert the patch and deploy. No database rollback. Old clients keep the previous
response contract; new clients against the old backend simply receive unused
stats again, so a staged rollout is compatible in either direction.
