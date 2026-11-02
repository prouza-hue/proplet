# Proplet working rules

For every change, keep the current test suite aligned with approved product behavior.
Do not leave obsolete failing tests, silently omit necessary tests from CI, or weaken
assertions to obtain a green result. Add new regression tests to
`tests/current/manifest.json` or the applicable browser/database workflow and verify
that the intended scenarios actually run. Run the complete affected gate before
merging; report exact failures and causes, not "unrelated failures" without details.

Read `tests/current/README.md` for release/cache contracts and database fixture order.
Before changing shared code or merging, check the current main/head and preserve
concurrent work. Keep PWA asset revisions and release markers consistent. Validate
UI on mobile and Fold-sized viewports, and distinguish preview from production.

## Resource budget

- Reuse existing decisions and evidence. Read targeted files/ranges; report compact
  summaries rather than whole logs. Delegate only independent useful work, and give
  each agent explicit file ownership and a shared verification plan.
- Run focused checks while editing. Run the complete affected gate once after the
  candidate stabilizes; repeat only failing/affected checks until there is new reason
  for a full run. Keep one owner per CI unit suite, and cancel obsolete PR runs.
- Default to local fixtures and local PostgreSQL. The current gate strips inherited
  live credentials and denies external test connections. Never weaken that boundary
  to get a test green; live checks belong in a separate explicitly scoped command.
- Live GET requests also consume Supabase egress. Do visual viewport matrices locally.
  After deployment use one short live smoke on one viewport and only changed API
  contracts. Share its results across agents. Do not repeat baseline/preview/production
  matrices or query logs repeatedly without a specific unresolved failure.
- Git previews are on demand; main deploys automatically for runtime changes. Do not
  create a preview per edit. Create one exact-commit preview when review needs it.
- Read billing totals only when relevant to the task. Keep timestamped observations;
  never infer billed bytes from request counts or claim savings before measuring them.
