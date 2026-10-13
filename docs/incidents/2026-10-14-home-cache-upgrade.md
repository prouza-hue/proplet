# Home restoration and cached-script lockup — 4.08.7

The 4.08.6 home restoration was rolled back to 4.08.5 after a returning user reported a frozen page and partially applied styling. A clean local browser did not reproduce the fault. That verification was insufficient.

## Reproduced failure

Release 4.07.3 (`f31c8959323b8edae75e01ccd6b04ded168cf982`) and the Archive release both requested `/tajenka-release-fix.js?v=invitations1`, despite changing that script's layout behavior. A still-active older service worker answers this exact URL from its shell cache. The old script appends the Play Tajenka card to the screen's end; the new printshop script moves it before Archive. Both observe subtree child-list mutations and schedule microtasks. They repeatedly move the same card, starving rendering, input and subsequent boot work. A diagnostic reproduction reached 2,000 callbacks per affected observer before the test-only circuit breaker disconnected them. This explains why a fresh-browser smoke check passed. We did not inspect the user's device cache directly.

## Change

- Restore the approved 4.08.6 UI changes: visible Tvůj postup, Daily → invitation → unsolved Tajenka → Free → weekly contest → Archive; completed Tajenka immediately before progress. Enlarge all six Free icons. Use the simplified readable Archive art both on the entry and Archive header.
- Request the corrected Tajenka script at the new immutable release URL `?v=archive-layout2` in both the loader and service-worker shell.
- Advance all changed home assets and the shell to `home-stable1` / 4.08.7. Advance runtime metadata URL to `release4087` so an old worker cannot supply an older version declaration.
- Share the same 20 px drawn arrow and 650 font weight on result/Daily invitations and the dismissible referral offer. Result stylesheet advances to v17.
- Keep weekly competition redesign separate; no new trophy UI in this release. Existing prior result wrapping and completed-batch hiding remain included.

## Verification

`tools/qa_home_cache_upgrade.cjs` uses an actual old service worker and its actual archived script, with isolated synthetic account/API responses. It does not replace or disconnect application observers. It verifies the old script exists in cache, boots the fixed page under that worker, clicks between Daily and Play, marks a local Tajenka completion, activates the new worker, reloads and verifies retained completion and navigation. It also checks card order, visible progress, six readable Free icons, invitation arrow/font, Archive heading art and solved/unsolved placement at 320, 390 and 768 CSS px. Browser page errors must be empty. The 90-second external watchdog makes starvation fail rather than hang indefinitely.

Fixtures contain only public puzzle/configuration data and historical source; no player credentials or production writes. The preview API adapter is used only by the local test. Tests emulate widths; they do not claim physical Fold testing.

The earlier 4.08.3 completed-card ordering bug was a separate, already corrected loop. This release retains that correction. Do not reuse an asset URL when its script semantics change; test returning-worker upgrades, not just clean installs.
