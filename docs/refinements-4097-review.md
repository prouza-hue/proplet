# Proplet 4.09.7 native review

The review uses the release's real `public/index.html`, game, hint chooser,
rankings module, CSS, public boards and bonus-recognition lexicon. It is not an
HTML mockup of those screens.

## Preview entry points

Append these paths to the Vercel Preview deployment URL:

| Path | Native screen / scenario |
| --- | --- |
| `/design/refinements/?review=hints` | Hint chooser above Mozkomor 63 |
| `/design/refinements/?review=rankings` | Daily: 124 players, 18 teams; own player at rank 47 |
| `/design/refinements/?review=bonus&word=OBRNA` | Original Mozkomor 63; real trace and discovery flow |
| `/design/refinements/?review=bonus&word=STROFA` | Original Mozkomor 63 |
| `/design/refinements/?review=bonus&word=AORTA` | Original Mozkomor 65 |
| `/design/refinements/?review=bonus&word=KANCL` | Original Mozkomor 65 |
| `/design/refinements/?review=bonus&word=KATION` | Original Mozkokalypsa 20 |

Add `&theme=dark` for dark mode; the default is light. The review navigation also
links hints, rankings, bonus words and the opposite theme. Gameplay hides this
review bar so it cannot alter the board's available height.

XP fixtures deliberately vary by period: Today has 68 players / 11 teams, Week
87 / 16, and All 173 / 31. They exercise content-height changes during switching.
Default rankings display the top five and a separate own row; expanding displays
the full available list. Section collapse is independent of full-list expansion.

## Isolation and limits

`tools/build_refinements_review.py` generates the native review only when
`VERCEL_ENV=preview`. Production, development and unset environments generate an
inert explanatory page and an empty adapter placeholder. The canonical source
`public/index.html` is never changed by this builder. Commit only the inert
`public/design/refinements/index.html` and `review.js` placeholders.

The generated adapter runs before transport/runtime/theme scripts. Accounts,
progress, discovery receipts and settings use fresh in-memory storage; it never
reads an existing local account and leaves no test token behind on reload.
Every `/api/` request is handled in-page, including mutations. External fetches,
API/external XHR and beacons are blocked. Only same-origin static GET/HEAD requests
reach the network, without Authorization/Cookie headers or credentials. No real
player, production API, result queue or database is used.

Bonus recognition uses the actual shipped offline lexicon and production client
recognition function. The `+1 XP` receipt is simulated in memory after that real
recognition flow; it does **not** demonstrate a production reward write. Python
and JavaScript lexicon tests, plus the server's normal claim tests, protect the
recognition/reward boundary separately. `/api/word-recognition` deliberately
returns false in this review so the five examples cannot pass through a mocked
remote recognizer.

A partial local checkout can omit older avatar, medal, difficulty or rank images.
That produces broken historical images in local screenshots even when these
changes pass; it is not evidence of a new product defect. Final visual review and
CI artifacts must use the complete GitHub checkout / Vercel Preview. The three
new hint assets must load and are explicitly asserted by browser QA.

## Build and checks

From the repository root, with normal development dependencies installed:

```sh
python tests/current/test_refinements_review_build.py
PYTHONPATH=. python tests/current/test_bonus_recognition.py
node tests/current/test_bonus_recognition.cjs
node tests/current/test_hint_chooser.js
```

The build/isolation test verifies Preview-only generation, byte-preservation of
the native source shell, inert non-Preview output, memory-only identity,
interception of all API methods, blocked external transports and stripped
credentials on static reads.

For browser QA, install the repository's CI-pinned Playwright and Chromium:

```sh
npm install --prefix /tmp/proplet-review-pw playwright@1.51.1 --no-save --no-audit --no-fund
node /tmp/proplet-review-pw/node_modules/playwright/cli.js install --with-deps chromium
VERCEL_ENV=preview python tools/build_refinements_review.py
PROPLET_PLAYWRIGHT=/tmp/proplet-review-pw/node_modules/playwright node tools/qa_refinements_review.cjs
```

The combined runner starts its own loopback static server and refuses all network
API calls. No server environment variables or database credentials are needed.
`PROPLET_CHROMIUM` optionally selects an installed executable;
`PLAYWRIGHT_BROWSERS_PATH` can select a nondefault browser installation.

Expected assertions:

- Native hint modal has three loaded generated icons, no obsolete eyebrow/copy,
  and no clipping or horizontal overflow at 320, 390, 768 and 1000 pixels in both
  themes. A 440-pixel-high landscape case also verifies all options fit, Tab
  trapping, Escape and focus restoration to the native hint button.
- Native Daily rankings start with top five plus own rank 47, expand to all 124
  rows, retain expansion across section collapse, and return to the compact list.
- Switching XP period and player/team scope preserves the controls' viewport
  position despite different row counts.
- Each of OBRNA, STROFA, AORTA, KANCL and KATION is traced on its original board,
  recognized locally, remains outside the required solution, and receives exactly
  one simulated discovery XP through the real client flow, with no recognition
  fallback request.
- Zero uncaught JavaScript errors and zero API requests reaching the test server.

Screenshots are written under `artifacts/refinements-review/`: hint, Daily and XP
screens for every width/theme pair, plus the five original-board bonus cases.
The dedicated `tools/test_rankings_navigation_browser.cjs` additionally covers
loading/error states, in-flight sharing, stale responses, account changes and
scroll races; it uses `PLAYWRIGHT_MODULE` / `CHROME_PATH` rather than the combined
runner's environment names.

After local QA, restore inert source placeholders:

```sh
VERCEL_ENV=production python tools/build_refinements_review.py
```

The Vercel build command includes the builder after the existing content/review
builders. The full affected CI gate remains required before production release.
