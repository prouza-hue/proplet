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
| GameStarted | Game opens, or consent is granted with a game currently open | game_mode |
| GameCompleted | Finished starter, daily, free or Tajenka board | game_mode |
| CompleteTutorial | Finished starter | None |

Only PageView is a standard web event. Other events use `trackSingleCustom`.
Starts and completions are deduplicated by board/mode/date locally for up to
180 days (maximum 1,000 records). Replay mode and rescue mode are excluded.
Thus these events measure unique consented board activity, not every attempt.
They are client-reported events, not server-validated leaderboard results.

## Consent and isolation

- No Meta script or request before explicit opt-in; reject and accept have equal prominence.
- A compact, non-modal bottom banner appears after six seconds without moving focus.
- Consent expires after 180 days and can be changed in settings or on the privacy page.
- Revocation signals Meta consent withdrawal and clears local marketing records and `_fbp`/`_fbc` cookies.
- Historical gameplay before consent is not replayed. The existing first-party analytics is independent.
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
