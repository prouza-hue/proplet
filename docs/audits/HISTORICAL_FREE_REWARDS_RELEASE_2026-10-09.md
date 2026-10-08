# Historical reward foundation — runtime phase, 9 October 2026

Pavel authorized deployment of the technical foundation from PR #177, with Archive and historical rewards closed. This release incorporates main 5a08f2c24efec2daedd3dee42f65062ec394c5ef (including Daily Gen6 and usage optimizations) without Archive UI from #188.

## This release
- Version 4.05.2. Explicit PROPLET_HISTORICAL_FREE_REWARDS_ENABLED=false in vercel.json, atomic result transport remains enabled.
- G1–3 submissions fail closed; committed receipt replays remain possible.
- G4+ rewards remain per concrete board, with no historical-slot consumption.
- Health exposes both gate values for post-deploy verification.
- Prepared SQL and disposable PostgreSQL tests from #177 are included.

## Database boundary
Production function definition was read and the historical ledger is absent. This runtime phase DOES NOT apply prepared/historical_free_rewards.sql or change player XP.
The reviewed deployment ordering requires closing/draining every old historical writer before the RPC replacement and seed. Older immutable deployments still exist and were not disabled by this release. The prepared migration therefore remains explicitly not applied. Apply/reconcile it after old-writer isolation is established and before enabling Archive; no need to enable the historical flag during that migration.

## Verification and rollback
Require Current runtime gate (including isolated PostgreSQL historic concurrency tests), Gen4 contract and release metadata alignment on the updated PR. Check production /api/health for version 4.05.2, historicalFreeRewardsEnabled=false, atomicResultEnabled=true and database=true. Confirm canonical client/runtime version and Daily availability.
If runtime regression occurs, the previous production deployment is the rollback target; production RPC has not changed in this phase. Archive #188 stays draft and untouched.
