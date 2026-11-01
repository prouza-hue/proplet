# Native Studio Edition preview

The harness runs the current `public/` app. It does not replace board geometry, input, hints, result handlers, or game layout. All API requests resolve in a first-loaded fixture adapter. Public free boards model Daily/Extra; unpublished dated content is never copied. Model date: 2026-10-21.

From the checkout root, using Node 24 (no npm dependencies):

```powershell
node tools/studio-preview/build.cjs
node tools/studio-preview/serve.cjs
```

Open `http://127.0.0.1:8892/`. Output is the sibling `studio-preview-public`, outside the checkout. Rebuild after app changes; the server reads the latest generated files. Optional first argument selects an output outside the checkout; `PORT` selects another loopback port.

The whole static directory can be hosted at the root of an isolated HTTPS origin. Canonical assets use absolute paths, so it must occupy that origin root. No backend, Python, database, secrets or real account is required. Never publish on production aliases. These commands do not deploy or push anything.

## Controls and scenarios

The disclosure above the app controls theme, sample account, initial completion and Extra. It disappears while playing so the native game layout is preserved.

- `account=member` (default), `guest`, `incoming`.
- `state=ready` (default), `done` (Daily complete), `complete` (Daily and Extra complete).
- `extra=hardcore` (default), `mozkomor`, `mozkokalypsa`, `none`.
- `theme=light` or `dark`.
- `receipt=missing` refuses Extra finish confirmation to test pending progress without XP.

Example: `http://127.0.0.1:8892/?account=guest&state=ready&extra=hardcore&theme=dark`.

Account/state/Extra select distinct prefixed localStorage namespaces. Play persists within a namespace; reset clears only that synthetic state. Done/complete seeds are explicit fixture records written once. Actual play uses the native pointer input and completion path. Authentication does not accept or create real accounts; use the sample account selector.

Isolation uses the native Storage objects with per-realm prototype methods, not a replacement `window.localStorage` object. Namespace v2 ignores earlier preview experiments. The hidden `#studioFixtureDiagnostics` element records requested/stored/actual theme, expected/actual synthetic account, completion count and namespace after application readiness; it never includes tokens. Browser QA must check these fields, because VM tests alone cannot prove native browser realm behavior.

## Isolation

`guard.js` runs first. Network fetches are same-origin static GET/HEAD only. External fetch, HTTP API, XHR, beacon, WebSocket, EventSource, workers and service-worker registration are blocked. CSP excludes external resources, workers and forms. The loopback server also refuses API routes/write verbs. Generated runtime metadata identifies this origin as preview and keeps release probes local.

The adapter derives from existing archive-review contracts, providing synthetic account/referral/ranking responses and game-session receipts. Successful Extra finish returns `finished:true`; missing receipt retains the real app's pending-confirmation behavior. Competitive time is always unverified. Archive rewards use the existing local solution contract. This is a UI harness, not backend correctness or production reward verification.

Only public runtime assets are copied, plus fixture files and the existing sample Tajenka. Private data banks, backend, repository sources, old design galleries, review evidence, admin/calibration pages and ZIP source bundles are excluded.

## Checks

```powershell
node tools/studio-preview/verify.cjs
```

Node-only verification checks real client descriptor compatibility, success/refused session receipts, account/state isolation, blocked transport, CSP and byte-for-byte gameplay-file equality. Evidence is written outside the checkout to `studio-preview-contracts.json`. It does not claim browser gesture or layout verification.

Use the approved browser tools against the isolated URL for native Daily start, drawing answer paths, result, Extra start/finish, return and reload. Check 100/200 sample XP, unchanged Daily series, guest Free, resume, refused receipt, both themes and required widths. Never run synthetic gameplay on production.

## Original board comparison

```powershell
node tools/studio-preview/baseline.cjs
$env:PORT='8893'
node tools/studio-preview/serve.cjs ../studio-baseline-public
```

This materializes original public files from exact Git base `9f8ae24bc4dc121e7e554f7aac370fada8c8b16d` into sibling `studio-baseline-public`. It verifies every copied blob against Git and adds the same fixture harness. Original index and runtime metadata receive only isolation changes; no Studio CSS/JS is loaded. All original gameplay JavaScript and styles remain byte-identical. Use the same URL parameters on ports 8892 and 8893 for browser geometry and behavior comparisons. Storage is isolated by origin as well as fixture prefix.

## Monthly quality v2 preview (2026-11-01)

The same native app and `/api/competition/monthly` response contract now have four explicit, synthetic UI fixtures. Open `/?open=monthly&monthlyCase=ready`, or use `provisional`, `ties`, `closed`. These states contain labelled sample players only, never database snapshots or production results. `ready` shows a clean-solve tiebreak; `ties` withholds podium art while the final draw is pending; `closed` shows an audited-draw outcome as a UI example, not evidence that a real draw ran.

The fixture lives in `monthly-v2-fixture.js`, is loaded only by this generated preview and is exercised by `tests/current/test_monthly_competition_ui.cjs`. Production files do not import it. `node tools/studio-preview/verify.cjs` continues to verify transport isolation and exact gameplay bytes. This preview validates presentation, not scoring/database correctness. All other Studio gameplay uses the existing October model date; monthly sample results deliberately model a November month with 21 completed days.

## Public supporter avatar detail (2026-11-01)

`/?patronInfo=1` explicitly seeds one synthetic completed Daily and opens the native result with supported “Ukázkový Pavel” plus unsupported sample rows. Patron status is handled in memory; payment/preference/claim routes return 409 and create nothing. Clicking the supported avatar opens the current native patron dialog; its CTA switches to the existing support offer. This tests rendering and focus only, not an actual entitlement or payment. The clicked hydrated avatar nodes are cloned into the detail, so its identity does not fall back to the viewer’s avatar.


The supporter-avatar consistency preview also accepts `patronOwn=public`, `private`, or `none` alongside `patronInfo=1`. Public marks the synthetic viewer in both their header and result; private marks only their own header/profile; none leaves the viewer unmarked. The other synthetic public supporter stays marked in each case. The card uses the existing blue keepsake inside the allocated avatar box, and result labels share the name line. These parameters change only in-memory UI fixtures and never issue payment or preference writes.


`/?patronRankings=1` opens the native XP weekly player ranking with an explicitly public synthetic supporter at rank 21, outside the first-five summary. The sample has a long rank title and team “Propletové – Řeporyje”. Add `&rankingView=daily` for Daily, or `&patronOwn=private` to verify the own public mark disappears while the personal header remains marked. This fixture uses no real player data or backend writes.


## Recurring supporter preview (2026-11-01)

An explicit `patronPeriod=first|current|grace|expired|reinstated|oneoff|private` enables the guarded in-memory supporter fixtures. `first` models one genuinely confirmed payment as sample data; subsequent examples model renewal, a seven-day grace period, permanent blue thanks after expiry, reinstatement and private visibility. They do not confirm any real bank payment or prove SQL behavior. Sample `nextDue=2026-12-01`, `paidThrough=2026-11-30`, `graceUntil=2026-12-08`: red through the end of 8 December, blue from 9 December in Prague.

Build/serve separately from other review outputs:

```powershell
node tools/studio-preview/build.cjs ../recurring-patron-preview-public
node tools/studio-preview/verify.cjs ../recurring-patron-preview-public
$env:PORT='8898'
node tools/studio-preview/serve.cjs ../recurring-patron-preview-public
```

The native result comparison is `/?patronInfo=1&patronOwn=public&patronPeriod=current`. It contains a public recurring mark, a blue one-off mark, the synthetic viewer, and an unmarked private sample player. Add `patronView=thanks`, `offer`, or `settings`; `patronFrequency=monthly` preselects the native monthly offer. `patronOwn=none&patronView=offer` previews the unentitled offer. `/?patronRankings=1&patronOwn=public&patronPeriod=current` opens XP; append `rankingView=daily` for Daily rankings. The top two entries compare recurring and blue support, and the own row remains outside the first five.

Only synthetic privacy preferences change in memory. Patron intents, payments and claim endpoints remain blocked with 409; no QR or bank transfer is created. Production imports none of these fixtures. Controls and notice remain outside the app shell. The preview verification covers every explicit state, public row redaction, unknown-state rejection, blocked payment creation, memory-only preferences and existing network/service-worker isolation. Browser layout and backend PostgreSQL acceptance are separate checks.

## Compact native Play QA (2026-11-01)

`/?open=free` opens the current app’s native Play screen without starting a game. Optional `playCase=resume`, `complete`, or `fresh` selects an isolated storage namespace: one valid Medium saved word, every released free board completed, or one explicitly synthetic fresh Hard release. The fixture GET history reflects these local records. All gameplay and catalogue actions remain the real native handlers; external/API writes are still guarded. These local cases are QA aids, not a replacement for the normal Vercel preview of the full app.
