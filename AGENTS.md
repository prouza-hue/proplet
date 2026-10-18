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
