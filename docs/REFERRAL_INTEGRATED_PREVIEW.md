# Integrated Proplet invitation preview
Baseline: production/main a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db, 2026-10-04.
Branch: preview/referrals-integrated-20261004. PREVIEW ONLY: do not merge.

## Design revision, 2026-10-04
Invitations use native Proplet character artwork, colored printed paper and a prominent XP ticket. The normal result screen groups bonus invitations and native board challenge sharing within one centered card; each retains its own handler and link. Challenge buttons say “Pojď si zahrát Proplet”. The next-game action remains primary.

For incoming new players the invitation/progress card is immediately below Daily, and both the 300-board announcement and its permanent promotional card are suppressed. Completion updates all five colored steps. A paid reward can be dismissed with a cross on Dnes or in the result; dismissal is scoped to the fixture account and invitation. Já retains the reward history.

Both users receive 1,000 fixture XP after the invited new account completes five different boards. Bonus contributes to lifetime individual XP and total ranking, but excludes weekly individual and team XP. Normal board XP counts weekly. Registration's existing 500 XP remains separate.

## Isolation
Vercel builds public/** only with @vercel/static, with no Python functions or cron. All hosting /api paths return 410 for every method. Client API transport, profiles, passwords and XP remain in-memory fixtures. CSP excludes Supabase and production origins. Service workers and outbound API transports are disabled. No SQL migrations, database writes, environment changes or production aliases are involved.

## Verification
Existing preview browser flow covers native registration, a real fifth board, Tajenka, once-only rewards, total/weekly XP separation and network isolation. Revision adds browser checks for distinct challenge/invitation actions, centered desktop result card, paid-card dismissal through navigation and retained history. Mobile, 320px, dark and desktop screenshots are included in integrated-referral-preview CI evidence.

Production persistence, server attribution and anti-abuse remain outside this visual preview. Fixture state resets on reload; this branch is not a production-ready referral backend.
