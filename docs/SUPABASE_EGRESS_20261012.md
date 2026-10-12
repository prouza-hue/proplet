# Supabase egress remediation — 12 October 2026

Production baseline: `cf16817aadfa9cb991630bf99d04aeb62860f6fd` (v4.06.0 Daily Extra), Vercel `dpl_BtNKiMR3q9SHAswXnmuwuc5Ygb81`, Supabase `iopyhluayfszskyqqpuc`. User authorized implementation, checks and production deployment.

## Billing baseline

Read directly from the authenticated Supabase organization Usage dashboard on 12 October, before this release. Current cycle: 11 October–11 November. Org uncached egress 0.235 GB / 5 GB, Proplet 0.234 GB. Org log ingest 0.048 GB / 1 GB, Proplet 0.044 GB. Cached egress 0. Supabase warns of potential restriction from 28 October if the org remains over quota. Log pricing grace through early 2027 does not defer this egress warning.

Org daily chart totals on 9–11 October: approximately 185, 183, 201 MB egress and 32.229, 33.230, 38.196 MB logs. These are chart labels, not exact decimal billing units. Recent pace projects roughly 6 GB egress and 1.1 GB logs per cycle; this is an estimate, not a confirmed outcome.

## Cause and changes

`rankings_xp` requested all lifetime player identities even for a daily/weekly leaderboard that drops nonpositive scores before rendering. A read-only production query found 256 lifetime players but 18 positive daily scorers. The unchanged context RPC transfers 46,780 bytes for all identities versus 5,433 bytes for the required positive scorers, including complete scored-team memberships: 88.4% fewer bytes for this measured request.

The API now requests only positive period scorers and always adds the current viewer. All lifetime XP, badge counts, team scores and member expansion remain available. No identity or authorization decisions are cached. SQL's stable ID ordering preserves anonymous alias collision handling. Existing privacy, tied ranks, historical team attribution and inactive viewers' lifetime totals are preserved.

The direct PostgreSQL transport carries XP aggregate rows as positional JSON arrays and reconstructs the original dictionaries on the server. Production read-only measurement: 33,636 bytes of JSON objects versus 15,956 bytes of arrays (52.6% fewer aggregate row bytes). All rows are retained, including zero-score players and historical teams. PostgREST compatibility remains unchanged; malformed direct responses fail, and writes are never replayed.

These are measured reductions for specific query payloads. They are not evidence that total daily billing egress is already below 140 MB. The mix of all-time, weekly and daily rankings and traffic will determine the final saving.

## Verification and follow-up

Current regression adds exact full-response parity over 12 combinations of period and viewer, including anonymized alias collisions, hidden teams, transferred historical team XP, inactive members and zero-score viewers. Direct transport tests preserve bigint values, fields and single execution. The existing disposable PostgreSQL acceptance runner compares native dictionary results with the compact transport for all-time and a future zero-score period.

Release checks and exact deployment commit are recorded in this PR. After deployment verify the live health/transport and public rankings, then compare actual daily billed GB in the authenticated dashboard. Do not substitute API event counts for billed bytes. Keep the org Free; no billing-plan changes or production schema migrations are part of this release.

