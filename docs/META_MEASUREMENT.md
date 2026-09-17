# Meta measurement for the Proplet campaign

Status: implementation prepared; **not production-ready** until the dedicated
Proplet dataset has been created and `PIXEL_ID` in `public/app/marketing.js`
has been populated. The empty identifier intentionally disables all Meta calls.
Do not reuse Klokočka's historical client pixel.

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
- Browser inspection: initial dialog, persisted rejection, settings on privacy page,
  desktop layout and actual 390 px iframe viewport.

## Before launch

1. User accepts Meta Business Tools Terms at dataset creation.
2. Create Proplet dataset, record its ID, connect advertising account 370983596435354.
3. Set PIXEL_ID and verify dataset automatic advanced matching/automatic events are off.
4. Review preview and obtain release approval following README release flow.
5. Deploy, then verify PageView, GameStarted, GameCompleted and CompleteTutorial in Meta Test Events,
   plus no Meta request when consent is denied and no CSP violations.
6. Connect the dataset to the campaign and add per-creative UTM parameters before publishing.

Reference for SDK commands: https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl
