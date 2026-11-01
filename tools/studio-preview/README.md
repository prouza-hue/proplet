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
