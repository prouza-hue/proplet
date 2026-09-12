# Fold and mobile UI feedback — September 10

Scope: preview branch ux/tiskarska-dilna only. Production/main untouched.
Baseline local d633b70; baseline remote fa16b8a7699d686aa0a5abe00730e40940113a1e.

Changes:
- Side-rail controls use one vertical column, regardless of a competing phone breakpoint.
- Current word and feedback can wrap. Phone word space reserves two lines to avoid moving the board as a word grows.
- Magnifier uses a measured layout dock, centered below the word on phones and in the spare rail area on Fold. Position updates when the word changes. Device eligibility and game rules unchanged.
- Active-path order numbers removed; hint order numbers retained.
- Shared result rows separate rank, avatar, wrapping name/status, and tabular time. Own rows have a mint surface and ink border, also in expanded results.
- XP has a full-width row above rank/streak, independent of viewport-based column guesses.
- Medium weight for action buttons and daily title; secondary game feedback regular.

Browser verification uses temporary preview fixtures with memory-only storage and mocked API writes. Those temporary public assets are removed after verification; fixture sources remain under tools/feedback-qa. Original pre-existing feedback-qa.html is restored.

Observed in cloud Chrome at 390x844, Fold 690x600 and 560x700, desktop 1200x850:
- Active short and long words; stress fixture with a 27-character word and a long rejection message.
- Visible magnifier and all three controls on eligible touch dimensions. Native desktop has no magnifier, preserving eligibility.
- Own result in expanded leaderboard, long nicknames, free/daily results.
- Dnes with 123,456,789 XP and a four-digit streak, no collision with divider.
- Actual drag produced rejection feedback. Synthetic active fixtures additionally make the held-drag layout reviewable.

Tests:
- node tests/current/test_s11b2_game_interaction.js
- node tests/current/test_magnifier_docking.js
- python tests/current/test_printshop_board_clarity.py

Limit: viewport simulation in Chrome, not a physical Samsung device. On phone the active magnifier may cover secondary feedback, as requested; the word and board remain unobscured.

Final mobile geometry check: board top is 279.4375px and height 498.5625px for both the three-letter word and the 27-character stress word at 390x844. Fold 560x700 shows all controls at the same rail width. Long feedback is regular weight so the active word remains dominant.
