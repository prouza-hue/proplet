# Referral backend v1 — release contract

Base: main a0e3b622 (4.06.0). Production DB is iopyhluayfszskyqqpuc.
This branch prepares production code; neither the migration nor deployment was applied to production here.

## APIs
- POST /api/referrals/invite: authenticated stable personal code, canonical URL, rewardXp=1000, requiredBoards=5.
- GET /api/referrals/invite/{code}: public code validation, inviter name/avatar only.
- GET /api/referrals: authenticated invite, incoming progress/rewardDismissed, at most 100 invitations, referralCount.
- POST /api/referrals/dismiss: authenticated, idempotent dismissal of paid incoming reward.
- /api/player and /api/auth/google/complete accept optional inviteCode. Existing login/link paths cannot acquire attribution.

## Eligibility and transaction
The server validates a code before registration and supplies request-local signup provenance to PostgREST.
AFTER INSERT players records immutable attribution in the same transaction. Missing/invalid code never silently promises a reward.
Only AFTER INSERT results counts: daily, daily_special, free, tajenka; completed_at must be at or after signup attribution.
A canonical puzzle_id counts once across all modes. Starter and updates/replays do not count.
The claim row is locked before deduplication/counter update. Fifth completion, two account_rewards rows and paid marker commit or roll back together.
Referral ledger keys start referral_v1:. Lifetime stats already classify them as otherRewardXp; XP aggregate RPC excludes them from timed periods. Team XP remains result-only.

## Activation and preview safety
PROPLET_REFERRALS_ENABLED defaults false. Set it production-only after SQL review/migration and staged deployment verification.
A Vercel preview with the production Supabase URL is disabled regardless of the flag. An isolated test project can enable the flag.
Disabling acquisition blocks new invites and new attribution. Previously accepted promises continue to completion in the DB trigger.
Status returns enabled:false and empty UI state when disabled; no polling or stats fabricated client-side.
No new billing service or Supabase branch is required.

## SQL and validation
Prepared SQL: supabase/prepared/referral_v1.sql. It is additive; old code sends no invite header and is inert.
Use the project migration workflow to record the generated migration version when applying the reviewed SQL.
A real test in eanzztstmwlamwfdskbf remapped this SQL into a unique disposable schema inside BEGIN/ROLLBACK:
immutable attribution, modes, puzzle identity, post-signup window, injected partial-grant failure, retry, period/lifetime XP, dismissal all passed.
Permanent public tables/accounts were untouched.
GitHub PostgreSQL service acceptance adds simultaneous fifth/sixth boards and retry races with no production secrets.
