# Refresh starts on Today — 2026-11-14

User decision: Today is the sole default tab after opening or refreshing the application.

Baseline: production/main a63fafd8cb73d31354bb1aee9a76b41d6635aba7, Vercel dpl_12CFyYAe94aKPoehH9t6KLne1sL8, version 4.10.42. Production health confirmed postgres transport; this change contains no database or player-data writes. Work branch: fix/refresh-today-20261114.

Cause: monthly panel navigation persisted open=monthly in the document URL, including after leaving competitions. The ready handler reopened that destination on every reload. Startup additionally restored history.state.screen.

Implementation (4.10.43): initialize each new document on daily; on reload remove launch-only open/play/panel/collection parameters before boot and competition modules; stop monthly panel navigation from writing launch URLs. Preserve fresh external links, unrelated URL parameters/hash, in-session Back, and saved gameplay. Coordinate app, runtime, theme bootstrap and service-worker revisions.

Validation: complete current gate ran 250 tests, 192 asset checks and 633 syntax checks. First pass had two frozen-input hash failures caused by Windows checkout CRLF conversion and one runtime-meta cache URL mismatch in theme-init. After correcting checkout line endings and the bootstrap URL, all three failed tests plus release/navigation/monthly focused regressions passed (6/6). No assertions removed or weakened. Browser regression is registered in refinements-review CI; local matrix covers mobile/Fold and browser/standalone emulation, all tabs, monthly panel interaction, fresh links and stale launch URL. Final browser and deployment evidence is recorded in the task result.

Limitation: standalone emulation is not a physical Android PWA device test.
