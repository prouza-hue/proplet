# Mozkokalypsa release continuation — 2026-09-23

## Verified starting state
Production/main: 6a3918f592698562943026203c5e6ce9869b9652, READY deployment dpl_2Mh5jfoYtViNjXH7zsLLnpkhzYj9.
Working branch initially 1eeed5974fc0f7f9d667619af4954d80d50d4631, 12 ahead/0 behind main.
Frozen gameplay, ten boards and illustration remain unchanged from 55283ada5f21f565fdd4edcc73c089fe6d914646.

## Database
Standard Supabase apply_migration succeeded, without alternate credentials/channels or bypass.
Project iopyhluayfszskyqqpuc; migration 20260923125858 / mozkokalypsa_playtest_v1.
All three tables exist with RLS; anon/authenticated denied table access and RPC execution; service_role granted. RPC security invoker, not definer.
Security advisor's RLS-without-policies INFO is intentional for these server-only tables (https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Existing unrelated leaked-password-protection warning was not changed.
Invites and pilot metrics remain empty before release activation.

## Additional acceptance
Commit f9a2c32bb40251e526225649832a7848e6dcd0b9:
- Current runtime gate success, run 35864699395.
- Authenticated integration job 107193217324: real custom player sessions -> pilot HTTP API -> real PostgREST 12.2.3 -> PostgreSQL 17.11, using synthetic isolated players and reconstructed schema.
- Verified missing/invalid login and uninvited denial, production QA denial, open idempotency, durable word/wrong/hint/calm/leave/resume metrics, fresh authenticated recovery read, event retry, revision conflicts, rejected forged/incomplete completion, 14-word completion and feedback, invite revocation.
- SQL snapshots prove ordinary results, runs, attempts, rewards, streaks and free slots unchanged.
- Native ten-board Chromium acceptance success, run 35864699646 / job 107193218444.
Limits: synthetic tests are not human difficulty evidence; local gateway routing replaces the hosted Supabase gateway. No actual tester session was taken over or populated.

## Final release gate
Adjust two existing test contracts to the implemented pilot: calm event is pilot-specific while ordinary resume is preserved; hidden pilot invite must not interrupt visible Today news ordering.
Candidate production flag becomes true only in this release commit; preview runtime still disables server writes by environment.
Before merge: final CI must pass, fixed top-three cohort must be selected once from authoritative lifetime XP.
Create a new production deployment through main. Never promote the disconnected QA preview.
Final production SHA/deployment/cohort verification will be appended after release.
