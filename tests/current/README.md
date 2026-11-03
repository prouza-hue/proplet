# Current runtime regression gate

Run `python -m pip install -r requirements-dev.txt`, then `python tools/test_current.py`
from the repository root. The runner supplies the repository import path; individual
Python tests can also be run with `PYTHONPATH=. python tests/current/<test>.py`.
`manifest.json` is the explicit list of active tests. Historical filenames in that
list still protect current behavior, not the release number in their name.

For a focused rerun, use `python tools/test_current.py --only <registered-path> ...`.
It uses the same offline guard and skips only the unrelated global asset/syntax scan.
The default complete gate strips inherited live credentials and denies external
Python/Node socket connections; loopback fixtures remain available. See
`tools/test_isolation/README.md` for its explicit accident-prevention boundary.
Do not work around the guard to test a live endpoint.

Live verification is separate and budgeted: `python tools/check_live_release.py
--url https://hrajproplet.cz --version <release>` prints a dry-run plan. Add `--live`
only for an authorized release check. `--weekly`, `--monthly`, and `--week YYYY-MM-DD`
select changed contracts within a hard maximum of four public GETs, with no automatic
retry or account credentials. HTTP response bytes are not Supabase billed egress.
The competition viewport matrix is local-only, including when BASELINE is set.

Maintenance rules:

- Check release consistency with `tools/release_contract.py`. Do not pin the current
  version or an asset cache suffix to the release that introduced a feature. The
  helper's tests accept a coordinated future bump and reject version/cache drift.
- Update changed product expectations at the behavioral boundary. Completed weekly
  banners are hidden and empty; unfinished batches retain both working entry points.
- Fixtures must implement the current API contract (archive cover count, online state,
  official special finish receipt). Cover missing/refused confirmation as well as success.
- The S04/S06 historical API digests remain compatibility checks. Review additive
  routes/optional fields explicitly before normalizing them; do not replace a digest
  simply because it fails. Existing routes, required fields and validation stay protected.
- The disposable PostgreSQL setup uses legacy roots followed by dated migrations and
  applied hotfixes at their manifest date. Never execute a dated file twice or replay
  an older RPC after its replacement. `test_isolated_migration_plan.py` covers this
  ordering without connecting to a database; CI also runs the real SQL acceptance suite.
- Report a failure with the failing test/assertion, cause, and gameplay impact. Missing
  local assets/dependencies are environment limitations, not evidence of a product defect.

Retired scenarios (2026-10-31):

- The Daily specials authoring-preview workflow and the integrated-preview workflow
  pinned to 2026-10-21 / v4.06.0 were removed from automatic CI. Their generators,
  manual QA commands, frozen content and validation receipts remain available under
  `tools/daily_specials/`, `preview/daily-specials/` and `content/gen6/daily-specials-36/`.
  Current special publication/binding, reward eligibility and client handling remain
  covered by `test_daily_specials.py`, `test_daily_special_client.cjs`,
  `test_daily_special_app.cjs`, `test_daily_special_runtime.py` and both
  `test_daily_special_discovery` tests in the active manifest. The historical
  103836-word recognizer baseline was not changed; this retirement does not claim
  a new uniqueness validation of the authored boards. New content still requires
  its own reviewed recognizer baseline and independent validation.
- Old footer wording / large result-CTA CSS assertions and the former collapsible
  two-section ranking scenario were removed. Current result hierarchy is covered
  by `test_result_action_dock.js` and `test_result_summary_visibility.cjs`; current
  tab navigation, distant own rank, expansion/return focus, races, errors and scroll
  behavior by `tools/test_rankings_navigation_browser.cjs` in refinements CI.
- Retired Refresh300 promotion/Today layout assertions and its duplicate newcomer
  smoke were removed from `verify_refresh300_production.cjs`. Its browser job now
  covers current free-play preferences, resume and history. Campaign suppression
  remains in `test_refresh_release.cjs`; first visits remain in the onboarding and
  first-steps browser suites. Free-order economics/persistence stay in the active
  free-order API/client tests and database gate.
- Static achievement design-gallery screenshots and the old pre-Continue badge
  placement/detail click were removed. `test_win_awards.cjs` covers the current
  grouping, order and preserved detail targets; real completion/reload receipts
  remain in `verify_mozkokalypsa_achievements.cjs`, while native detail keyboard,
  focus and read-only state remain in `verify_achievement_details.cjs`.
- The old Today catalogue loop, `studioDailyResult` visibility and legacy news
  block ordering were removed from Extra/printshop browser smoke. Current Today
  readiness/actions are covered by `test_today_one_screen_readiness.cjs`; actual
  Daily completion -> Extra start/resume remains in `test_extra_entry_browser.cjs`.
  Printshop still checks viewport overflow, typography, navigation and the board;
  its account-progress and idle/offline browser steps remain active.
- Hidden Daily/Tajenka Today share-button cases were removed from the referral
  browser suite. Actual result chooser -> native board share, Profile invitations,
  analytics and rewards remain covered there and by `test_result_referral_choice.cjs`,
  referral transport/API tests and the referral database gate.
- CI no longer replays the expected telemetry bug on the historical onboarding
  baseline. Current input/auth/telemetry/outage cases and the historical service
  worker upgrade stay active. The loopback fixture explicitly models production
  metadata so these tests exercise real event gates without external requests.
  Weekly rewards likewise retain their native celebration/history/identity tests;
  their isolated adapter now supplies the explicit live-preview capability.
- Follow-up browser cleanup removes the obsolete `.order-next` counter check,
  Printshop's hardcoded default `leaderboard` destination and the referral suite's
  duplicate result-layout/always-visible-clean-metrics matrix. Current free-order
  actions, rankings navigation and result/deduplication contracts remain in their
  dedicated suites. Loyalty and rank-detail browser checks now open their real
  collection disclosures first; the removed Today rank hero is no longer a target.
  Referral reward dismissal/eligibility is tested in Profile and invitation signup
  through the visible Today notice, preserving the actual API and invite-code checks.

- Historical signature-error replays and an injected obsolete HomeLayout were retired
  from the module browser suite. Current HomeLayout resume and all four input
  outcomes remain; module recovery uses the current module with a single malformed
  export. The real 4.09.9 service-worker upgrade still checks exact account,
  completed-result and in-progress preservation on desktop, mobile and Fold.
  Focused `test_module_contracts.cjs`, `test_first_input_diagnostics.cjs` and
  `test_automatic_updates.js` retain contract/recovery/error handling coverage.
