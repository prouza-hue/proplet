# Supabase usage intervention, 1 October 2026

## Decision and billing constraints

Keep Free while measuring the post-intervention daily Egress. Already consumed
Egress cannot be reversed; the last verified dashboard snapshot on 28 September
showed 6.488 GB in the 11 September–11 October cycle, above the 5 GB uncached
allowance. Later cumulative estimates are not verified billing readings.

The live [Logs Ingest guide](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest)
now lists Free 1 GB and Pro 20 GB. The [25 September announcement](https://supabase.com/changelog/logs-usage-based-pricing)
says log quotas are not enforced during the grace period through early 2027.
Log overage alone therefore does not currently require an upgrade. Cached and
uncached Egress have separate quotas; unused cached allowance does not offset
database Egress. Recheck live documentation rather than relying on cached docs.

## Diagnostic baseline

Production project: `iopyhluayfszskyqqpuc`. Read-only log aggregates for
30 September 10:35 UTC–1 October 10:35 UTC:

| Source | Events | Serialized log attributes, bytes |
| --- | ---: | ---: |
| API Gateway | 78,074 | 161,681,064 |
| PostgreSQL | 471 | 225,909 |
| Edge Function console | 350 | 199,603 |
| Edge Function invocation | 165 | 350,049 |
| Auth and audit | 27 | about 13,000 |

These attribute bytes are a diagnostic proxy, not billed Logs Ingest. Event
counts and partial HTTP content-length values cannot establish daily Egress.
Gateway attributes account for about 99.5% of this proxy. Changing PostgreSQL
logging thresholds would therefore have little impact on the current cause.

## Change

`proplet_auth_player_v1(text)` combines legacy-token lookup, independent-device
session lookup and player lookup in one REST RPC. Secondary-device auth changes
from three reads to one request, with optional daily touch/expired cleanup also
inside that request. Legacy auth remains one request. This removes unnecessary
API Gateway events; it does not promise any fixed percentage of total usage.

The function retains legacy-token priority, nullable expiry compatibility,
expired-session rejection, per-request revocation checks and explicit player
columns. Optional bookkeeping failures do not authorize expired sessions or
deny valid sessions. No auth state is cached between requests. Execution is
restricted to `service_role`, with `SECURITY INVOKER` and empty `search_path`.
The API maps database failures to HTTP 503 rather than invalid-login HTTP 401.
Security rate limits, gameplay verification and player data are retained.

The previous P0/P1 reductions remain: compact account snapshot deltas, 25-second
fair-play heartbeat, policy/ranking caches, batched analytics and atomic sampled
checkpoints. They are not redeployed as a new intervention.

## Rollout, validation and rollback

Run the current runtime gate and isolated PostgreSQL/PostgREST workflow before
merging. The new synthetic auth acceptance verifies legacy/session identity,
expiry, revocation, exact fields, bookkeeping failures and denied public access.
Existing HTTP result tests use the real new RPC in the isolated SQL fixture.

Apply the additive migration before deploying the server change. Verify the
function grants and unknown-token result, then merge and verify the production
deployment and HTTP auth/error boundaries. Do not create a production test
player merely to exercise login. Roll back the server commit if auth regresses;
the additive unused function can remain until reviewed cleanup.

## Follow-up criteria

Use actual organization/project billing readings and their observation times.
Report unavailable readings explicitly; never substitute diagnostic log bytes
or event counts for billed usage. Compare daily Egress after deployment and
especially after the 11 October reset. Aim below about 140 MB/day (4.2 GB per
30 days) for headroom; warn at 70% of the quota or a projection above it. An API
event threshold of 20,000/day is diagnostic, not a Supabase API quota.

If measured future-cycle Egress remains above Free despite these reductions,
recommend [Pro](https://supabase.com/pricing) with Micro compute: from $25/month
for one active project before tax and extras, 250 GB uncached Egress and 20 GB
Logs Ingest. Do not activate a paid plan automatically. A larger transport
refactor through Supavisor may reduce Gateway logs, but it needs DB credentials
and a separate authorization/transaction audit; it still generates Egress.
