# September 9 screenshot feedback

Branch: ux/tiskarska-dilna. Production/main untouched.
Baseline remote b2a369c74312e138e54c1fc83eba1db9befd0853, tree 69bd0a2b0e50bfd907eeb8d77568d53624096e80.
Local and remote commit IDs differ because transport uses GitHub connector; tree hashes must match.

Changes:
- No permanent magnifier reservation. Compact HUD has inline current word, clean state and a fixed two-line feedback area; bottom has labeled hint/calm buttons and magnifier.
- Remaining word lengths scroll horizontally within the HUD instead of wrapping.
- HUD/hint surfaces use a quiet paper/mat mix.
- Result success illustration hidden; primary action sits directly below XP/clean summary.
- Next/challenge actions share dimensions and corner radius, without shadows. Challenge controller mounts authoritative painted SVG itself, so it cannot overwrite it with emoji.
- World result standings offer total count, viewer position and paginated expansion (50 rows per request); team expansion uses its already-loaded rows. Existing privacy/first-completion/tie policies preserved.
- Dnes no longer repeats own rank/XP beneath the top three.
- Tajenka card appears at bottom of Dnes; completed card reveals the phrase and supports recap/share.
- Root cause of missing Tajenka: preview API defaulted to week 1 while client required current week. Default now follows current week; explicit preview week still works.

Verification:
- node tests/current/test_s11b2_game_interaction.js PASS.
- python tests/current/test_preview_feedback.py PASS: actual endpoint bodies, 105-player pagination, ties, self at position 78, compact-vs-expanded identity equivalence, privacy, beyond-end page, preview week selection.
- JS syntax and git diff --check PASS.
- Existing server integration environment unavailable (missing dependencies / stale binary modules); isolated endpoint tests avoid network and server initialization.
- Deployed normal desktop: actual STUL swipe accepted, count advanced, feedback rendered in upper panel.
- Deployed normal Dnes: current Tajenka visible, challenge painted SVG stays mounted.

QA harness sources: tools/feedback-qa. In-memory browser storage and fake API responses prevent writes from fixtures. Temporary copies under public/design must be removed/restored before final handoff.
Restore existing public/design/feedback-qa.html from baseline 5319f60; remove only new feedback-qa-runtime.js, feedback-qa-frame.js, feedback-qa.css.
Browser QA completed on deployed preview:
- 390x844: HUD info 52px, current-word/feedback 83px; actions 48px; no horizontal overflow (370/370px content).
- 760x900 Fold: side rail preserved, current-word/feedback 80px, board 552x781px; no horizontal overflow (732/732px).
- Free and Daily: next action immediately follows XP/clean summary, no success illustration.
- Next/challenge buttons both 309x52px, 12px radius, box-shadow none; challenge.svg mounted.
- Free expansion: all seven fixture players load, own position is 5/7. Actual backend page boundaries separately tested with 105 players.
- Completed Tajenka is the final card on Dnes, full phrase visible, share button present, recap opens correct phrase.
- No actual share message sent. Native sharing invocation remains the existing shareProplet flow.
- Temporary public QA files removed; pre-existing feedback-qa.html restored byte-for-byte.
- App entry point assets use feedback10; final shell feedback11 removes stale test caches on update.
Pending only final deployment verification.
