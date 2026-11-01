# Reward-read egress audit — 2026-11-01

## Verified baseline

- Production: main `949fb33c6d67be6cc49516f4fd40b9eb38e0b0cd`, v4.10.5,
  deployment `dpl_E8BVryLMPd9GQ9KiCVQaC8Q4WFBh`. Main matched production.
- Production database: `iopyhluayfszskyqqpuc`, ACTIVE_HEALTHY.
- Organization `gxncyoaoxcylxwgsxokj`: production plus active
  `eanzztstmwlamwfdskbf` (atomic-result test); `awqvbjxatjzvymuatpgm` is inactive.
- Rolling last-24-hour diagnostic snapshots around this audit: approximately
  10,593 edge events; GET account_rewards 2,620; results 1,102;
  puzzle_attempts 995; players 657. These are requests, not billed bytes.
- Account-reward reads all selected `*`; 1,043 first-page requests and 1,578
  cursor-continuation requests in a slightly later rolling snapshot.
- Database has 23,407 reward rows. SQL JSON serialization of the proposed
  discovery projection is 77.1% of all-column serialization. This is a payload
  comparison, not a measurement of wire compression, protocol overhead, or
  total organization egress savings.
- Test project: 69 pgbouncer and 9 postgres log events, no edge/API events in
  its last-24-hour snapshot. Its billed egress share remains unverified.
- pg_stat_statements cumulative counters start 2026-08-11, so they cannot
  establish current daily demand without two timed snapshots. Log content-length
  is absent for many nonempty responses and cannot rank their transferred bytes.

## Implementation

- Account-creation bonus reads only reward_key/points for its unique player/key.
- Discovery selects the six fields needed for pagination, old and structured
  word identity, recovery balances, and daily/board summaries.
- Duplicate and simulated-preview claims reuse their request-local snapshot.
- Actual atomic claims still reread after mutation, including recovery exchanges.
  No cross-request cache, auth change, ledger mutation, schema migration, cap,
  or change to XP awards is introduced.

## Verification and open items

- Focused HTTP regression covers 1,500+ rewards, unique creation lookup,
  post-write recovery balances, duplicate/preview read counts, and visibility of
  external updates on the next request. Registered in the current gate.
- Full runtime/database gates run in PR CI with the complete repository.
- Local historical discovery test initially could not run because this sparse
  source workspace lacks data/recognition/manifest.json and lexicon assets;
  that environment failure is not a gameplay finding.
- Billing dashboard redirected to sign-in. Auto-review blocked ChatGPT sign-in
  at auth.openai.com. Current billing totals, per-project egress and savings are
  unverified. Do not reuse October 29 totals as today's measurements.
- Do not pause/delete the test project without checking preview users and test
  dependencies; absence of API requests over one day does not prove redundancy.
- Prepared in a PR; not deployed. Before release, recheck main, coordinate the
  next version/cache markers and verify preview, CI and production health.
