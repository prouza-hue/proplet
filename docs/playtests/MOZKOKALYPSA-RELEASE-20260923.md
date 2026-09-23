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

## Production release — verified 2026-09-23 13:21 UTC
PR #136 merged by the standard GitHub merge API.
Production main SHA: 77f2a9b8649747eb3dae445282460e60456d626a.
Deployment: dpl_9FbMeR6cYESWdekL3SdgF1NbsQxJ, READY, target production, source git/main.
Aliases: hrajproplet.cz and www.hrajproplet.cz (plus existing Vercel aliases).
Deployment URL: https://proplet-3az790lqx-pavel-prouzas-projects.vercel.app
This is a fresh production build, not a promoted QA preview.
Production tree 6b6d4e82a0223e583c8f3627e570a0fe34d0f4bf exactly equals tested candidate a13938d1599f1fd5b0d8e6fdea10a8e69d0e62e4.
vercel.json has PROPLET_MOZKOKALYPSA_ENABLED=true. Production retains its database; health HTTP 200, ok=true, database=true.

Final candidate gates all SUCCESS:
- current-runtime 107197109209; isolated-result-database 107197109571
- native pilot acceptance 107197109124
- gen4-contract 107197108861
- printshop-ui/idle/offline 107197108648
Final fix affects test readiness only: theme-init deliberately removes proplet-current-ui-ready after 280 ms, so tests now wait for boot-overlay removal plus wired invitation button. Two earlier timing failures are retained in CI history, not concealed by a runtime change.
Ordinary news ordering and hidden invitation are both covered by the corrected browser contract.

### Fixed cohort
Selected once at 2026-09-23 13:18:51.269439 UTC from proplet_rankings_xp_aggregate(null), player rows, lifetime_xp descending then immutable ID ascending; inserted atomically under a table lock with an explicit existing-cohort guard.
| Slot | Player | Lifetime XP at selection | Active |
|---|---|---:|---|
| 0 | PiettraWal | 93027 | true |
| 1 | Michael | 92154 | true |
| 2 | Ave | 75302 | true |
No periodic reranking and no UUID list in the client.

### Hosted write verification and isolation
Executed a synthetic transaction in the actual production Supabase project, using SET LOCAL ROLE service_role:
open + idempotent open; event insert + readback; duplicate replay; stale-revision conflict; feedback persistence; exact event count; zero ordinary result/reward writes.
The entire transaction was rolled back. Two preliminary synthetic inserts were rejected by existing player field-length constraints, also without retained writes; the corrected short synthetic name/family passed.
Post-rollback verification: zero synthetic accounts, invitations, attempts or events retained.
At 13:21:24 UTC: exactly 3 active real invitations, 0 pilot attempts, 0 pilot events, 0 retained synthetic accounts. Real human play has not yet been observed.

### Production checks
Byte-for-byte matches on hrajproplet.cz: public/app.js, public/index.html, public/sw.js, public/difficulty/printshop/mozkokalypsa.svg.
GET /api/mozkokalypsa/status: 200, eligible=false anonymously.
GET /api/mozkokalypsa/status?qa=true: 403.
GET /api/mozkokalypsa/board/mk26-03?qa=true: 403.
Deployment-scoped error/fatal log query since 13:19 UTC returned no matching logs at 13:20 UTC.
Authenticated synthetic HTTP/PostgREST/PostgreSQL flow is proven in isolation; actual testers' production browser sessions were not accessed or impersonated. Hosted metric writes were verified only in the rolled-back transaction. First human production completion is still pending.
No gameplay code, frozen boards, icon, regular XP/progression/streaks/rankings or polling behavior changed during this continuation.

### Operations
To stop the pilot, deactivate these experiment invitations or deploy the flag false; retain collected metrics.
This final evidence update is committed to the existing working branch after the production merge, so it does not cause another unnecessary production build.
