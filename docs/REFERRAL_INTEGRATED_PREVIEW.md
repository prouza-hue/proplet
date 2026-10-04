# Integrated Proplet invitation preview
Baseline: production/main a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db, 2026-10-04.
Branch: preview/referrals-integrated-20261004. PREVIEW ONLY: do not merge.

This branch runs the real current public/index.html, native navigation, native board engine, real puzzle bank and account/result/ranking components. Invitations are added to Dnes, Já and the normal completed-game dialog. A user opens the invitation sheet explicitly.

Both users receive 1,000 fixture XP after the invited new account completes five different boards. The bonus contributes to lifetime individual XP and total ranking, but is excluded from weekly individual and weekly team XP. Normal board XP still counts toward weekly XP. Registration's existing 500 XP remains separate.

Preview scenarios are in the small collapsible control above the normal game header: inviter; new invitee using native account creation; invitee at 4/5; paid bonus. On the 4/5 scenario play the next native easy board to complete the reward flow. Actual game results are stored only in memory; reloading resets the scenario.

## Isolation
- vercel.json explicitly builds ONLY public/** with @vercel/static. No Python functions, cron jobs or runtime database clients are deployed.
- All /api requests, regardless of method, return 410 at the hosting edge.
- The first script installs fixture fetch before any native scripts. API calls never leave the browser.
- CSP blocks connections to Supabase and every other external origin. Only same-origin static game files can be fetched; Google Fonts stylesheet/font downloads preserve native typography.
- Auth uses synthetic identifiers/token PREVIEW-LOCAL-ONLY. Submitted test passwords are ignored, never persisted or forwarded.
- WebSocket, XHR, EventSource, sendBeacon and service-worker registration are disabled.
- No SQL migrations, Supabase writes, environment changes or production aliases are involved.
- CI runs a static-only server and browser with no database credentials. It draws real answer paths, verifies once-only reward and total/weekly ranking separation, and records network requests and screenshots.

Production persistence, server attribution and anti-abuse are deliberately outside this visual preview; this branch is not a production-ready referral backend.
