# Weekly team victories — Proplet 4.03.0

Weekly public-team competition starts 28 September 2026. Each period is Monday
00:00 through the next Monday 00:00 in Europe/Prague, with a ten-minute closure
grace. First scheduled award is 5 October 2026 at 00:10 Prague time.

## Product rules

- Existing gameplay team XP attribution is unchanged. Sum results.points from
  non-calm games; account rewards and administrative bonuses do not compete.
- Public opted-in teams compete. No team privacy setting is changed by rollout.
- Every positive-XP joint first-place team earns one permanent gold per week.
  An empty week awards nothing. Gold never adds XP or multiplies by member count.
- Milestones are 1, 3, 10 and 25 gold, then further Legend levels every 25.
- Results are frozen by the first successful closure. Later synchronization does
  not rewrite a finalized week. Scheduler retries safely catch up missing weeks.
- Membership at the close determines celebration recipients. Current teammates
  can view the cabinet; joining later does not claim an old celebration.
- A latest-award acknowledgement clears earlier unread awards from that team.

## User experience

An inline paper-cut announcement appears below the existing result action after
a confirmed positive gameplay XP receipt, once per account across devices. It
does not open on entry, steal focus, or appear for calm/stale/offline queue results.
The CTA opens the weekly team rankings. The permanent cabinet is available there.
An earned award appears on a safe Dnes visit; it can be closed immediately and
respects reduced motion. Refresh is event-driven, without polling.

## Rollout and recovery

1. Deploy the two timestamped weekly_team_victories migrations. Settings default
   disabled. The hourly minute-10 Supabase Cron job performs no work until enabled.
2. Deploy the matching production application after the CI/browser gates pass.
3. Enable the singleton settings row in production and verify launch_date.
4. Verify scheduler command, permissions, authenticated boundary and empty ledger
   before the first full competition week. Never insert synthetic production XP.

To stop awarding and hide feature state, set team_victory_settings.enabled=false.
Do not delete awards or roll back the additive tables. The previous application
ignores these tables. Preview HTTP endpoints return disabled before authentication
or DB calls; the QA fixture mocks all API traffic in memory.

## Verification

Dedicated CI executes the real migration in isolated PostgreSQL 17.11, checks
concurrent finalization, Prague DST, ties, launch boundaries, historical team
attribution, membership/ACK scope, immutable awards and RLS/role privileges.
HTTP boundary tests and frontend identity/receipt tests run in the same gate.
The repository's existing current-runtime and version-alignment gates also apply.

Visual fixtures are under tools/weekly-victory-qa, outside public/. Their optional
build script is used only by the separate QA deployment, never by production.
