# Meta measurement for the Proplet campaign

Status: dedicated dataset **Proplet – hrajproplet.cz**, ID **1379409957596561**,
created after owner approval of Meta Business Tools Terms and connected to ad
account **Klokočka (370983596435354)**. The real ID is installed in the code.
Automatic Advanced Matching was left off in the setup wizard.
Production deployment and Meta Test Events verification remain outstanding.

## Event definitions

| Event | Trigger | Parameters |
| --- | --- | --- |
| PageView | First consented page visit | None |
| CompleteRegistration | Server confirms a genuinely new account while opted in | None |
| GameStarted | Game opens, or consent is granted with a game currently open | game_mode |
| GameCompleted | Finished starter, daily, free or Tajenka board | game_mode |
| CompleteTutorial | Finished starter | None |

PageView and CompleteRegistration are standard web events. Game activity uses `trackSingleCustom`.
Starts and completions are deduplicated by board/mode/date locally for up to
180 days (maximum 1,000 records). Replay mode and rescue mode are excluded.
Thus these events measure unique consented board activity, not every attempt.
They are client-reported events, not server-validated leaderboard results.

## Consent and isolation

- No Meta script or request before explicit opt-in; reject and accept have equal prominence.
- A compact, non-modal bottom banner appears 800 ms after the actual game UI becomes ready,
  without moving focus or blocking gameplay. It does not appear over the boot screen.
- Consent expires after 180 days and can be changed in settings or on the privacy page.
- Revocation signals Meta consent withdrawal and clears local marketing records and `_fbp`/`_fbc` cookies.
- Historical gameplay before consent is not replayed. The existing first-party analytics is independent.
- A registration completed before opt-in is not replayed when consent is later granted.
- Only the canonical production host and game entry paths are enabled. Previews, legal pages,
  fragments and unrecognized query parameters do not load Meta.
- Explicit events only, automatic configuration and history tracking disabled, no advanced matching.
- SDK failures cannot interrupt gameplay. Ad blockers and lack of consent mean Meta sees only a subset of players.
- CSP permits the required Meta script/event origins; service-worker shell includes the new local files.

## Validation completed

- Current runtime gate: 91 tests, 116 asset checks, 335 syntax checks pass.
- Focused consent tests also exercise the actual browser adapter with a fake SDK:
  production/preview URL boundaries, hook registration, no events before consent,
  deduplication, completed-versus-unfinished games, expiry, withdrawal and blocked scripts.
- Browser inspection: initial banner, persisted rejection, settings on privacy page,
  desktop layout and actual 390 px iframe viewport.

## Before launch

1. Verify dataset automatic events are off.
2. Review the compact-banner preview and obtain release approval following README release flow.
3. Deploy, then verify PageView, GameStarted, GameCompleted and CompleteTutorial in Meta Test Events,
   plus no Meta request when consent is denied and no CSP violations.
4. Connect the dataset to the campaign and add per-creative UTM parameters before publishing.

Reference for SDK commands: https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl


## Acquisition update, 24 September 2026 (review branch)

CompleteRegistration uses the standard web event, only after the server confirms
an inserted account. Login and identity linking do not qualify. The client deduplicates
by account locally; no account ID, nickname, email, password or token is sent in the
explicit event payload. Existing Meta technical identifiers remain subject to consent.
A blocked SDK or rejected consent does not block registration. This is browser Pixel
measurement, not Conversions API, and delivery is not guaranteed under blockers.

The four numeric campaign identifiers in paid-social links are captured only after
consent and retained in this tab's sessionStorage for up to seven days. OAuth may
retain consented attribution while Pixel itself remains blocked until its URL is clean.
Product events capture context at event time, never at delayed transport time.
Withdrawal strips campaign context from queued product events without dropping
ordinary first-party telemetry. Existing anonymous-to-account claiming supplies the
join; the authoritative account_created event still comes from the database insert.
No database migration or historical backfill is included.

URL parameters:
`utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}`

Report new accounts by joining consented campaign product events (context.acquisition)
to the authoritative account_created event on player_id after successful guest claiming.
Count a registered account once, then check an actual non-starter puzzle completion
within 24 hours of its first consented campaign event. Existing accounts are excluded.
D1/D7 require matured cohorts and actual gameplay; do not treat page views as returns.
Unconsented, blocked, lost-session and unsuccessfully claimed players are unattributed,
not zero conversions. Do not divide all website accounts by a single campaign's clicks.
The same person can encounter multiple campaigns: assign the earliest consented paid
campaign touch for this test once per new account; report Meta attribution separately.

This branch integrates main 66e5816 including the new first-steps onboarding.
Shared app/SW cache markers are updated together (metaacquisition2). Real Facebook/Instagram in-app OAuth and production Meta Test Events
remain a release check. Preview must not send synthetic registrations to the live Pixel.

## Consent-aware diagnostics, 3 October 2026 (review branch)

Three first-party product events help separate a valid advertising opt-in from Pixel
startup and script failures. They are emitted only while the player has valid marketing
consent, through the existing product-event queue; they are not additional Meta events.

| Product event | Meaning |
| --- | --- |
| marketing_measurement_ready | Once per page with new or persisted valid opt-in |
| marketing_sdk_loaded | The advertising script's load callback ran |
| marketing_sdk_failed | The advertising script's error callback ran |

Each includes only the bounded `context.marketing_gate` category: `eligible`,
`unknown_parameter`, `auth_url`, `nonproduction`, or `non_game_path`. No full URL,
parameter value, OAuth token, or email is added by these diagnostics. The category is
captured when the event enters the queue and is preserved across delayed transport.
Consented numeric campaign attribution follows the existing event-time rules.

These counts are neither unique visitors nor all ad clicks. Rejected or missing consent
produces no marketing diagnostics. Pending marketing diagnostics are discarded before
retry if consent has been withdrawn or expired; ordinary product telemetry remains
unchanged. During startup, consent may not yet be restored by the marketing module;
pending marketing diagnostics wait in the queue until that policy is known, while
ordinary product events pass. A queued PageView, a loaded SDK, or successful
first-party transport does **not** prove Meta accepted a PageView or attributed an LPV.
The release adds evidence for subsequent real traffic; it cannot repair historical
measurement or establish the cause of the historical LPV discrepancy by itself.

Shared runtime and service-worker markers use `inappauth1-measurement1` for the combined
login-help and measurement release. Local contracts verify
new/stored/denied/expired consent, fail-closed URL gates, SDK load/error callbacks,
withdrawal, UI readiness, and no historical registration replay. Production receipt and
conversion attribution remain checks against genuine new players after deployment;
no synthetic production accounts or advertising events are created for this check.

## Paid landing URL repair, 6 October 2026

After valid marketing consent, ordinary production game landings now remove unknown
query parameters using `history.replaceState` before the Pixel SDK is inserted.
The existing UTM fields, `fbclid`, `open`, navigation history state and a bounded
numeric `styleRetry` counter are preserved. No reload is required. If URL cleanup
fails, the Pixel remains disabled; unknown parameter names or values are not logged.
OAuth URLs/fragments, previews, QA controls and application deep links retain their
existing fail-closed behavior and are not rewritten. Registration semantics and
deduplication remain unchanged; there is no replay of missed historical events.
The repair is covered by the existing isolated marketing/attribution contracts.
Future genuine Meta receipt and attribution are verified separately from SDK load.
