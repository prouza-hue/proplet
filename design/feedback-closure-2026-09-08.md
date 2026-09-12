# September 8 feedback closure
Preview branch only: ux/tiskarska-dilna. Production unchanged.

Implemented: icon-only mobile help/calm controls (accessible names retained), fixed-height feedback area, reserved magnifier lane beside selected word, Fold XP metrics stack, completion emblems hidden, header settings spacing, difficulty chevron drawn geometrically, result avatar conversion, removed result count and large percentile block, balanced XP spacing.

Critical freeze: gesture-guard-v3325.js MutationObserver rewrote its own Skoro… copy indefinitely. Idempotent rewrite resolves main-thread starvation. Document-level pointer release and cancellation additionally prevent stuck tutorial gestures.

Verified live: erroneous K→C drag followed by successful P/E/S taps and next tutorial step. Verified browser layouts: 360×780 and 690×600 tutorial fully visible; synthetic result rendered by actual application function shows two SVG avatars, no count/percent block; mobile icon controls leave message readable. Fold is tested as viewport geometry, not physical Samsung hardware. Magnifier geometry checked separately with input-module dependencies; physical touch rendering still needs user's device check.

Regression: tools/test_tutorial_pointer_release.js covers pointer recovery AND observer convergence; existing Sprint12B engagement test passes.

Design QA page: /design/feedback-qa.html. Uses isolated srcdoc with actual application assets and synthetic result rows; does not modify real player data.

Deferred artwork: Půlměsíc; Vyzvat kamaráda; Klidný režim. No artwork generation in this repair pass.
