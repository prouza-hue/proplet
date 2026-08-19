# Proplet v3.33.1 — Competitive Sharing

Status: implementation-ready design
Base: production v3.33.0 (`996d0399ac7d7a790a63104680b33d27cac539d0`)

## Product goal

Turn Free-level sharing from a generic promo link into a real competitive loop:

1. a player shares the result of one exact Free level;
2. the shared URL opens that exact board, even if it is ahead of the recipient's normal progression;
3. the recipient can try to beat the shared result;
4. completing the challenge is a legitimate completion of that level and may award the normal one-time XP if the recipient had not completed that stable level slot before;
5. after the challenge, the player returns to their ordinary Free progression instead of continuing from the challenged level;
6. the recipient can share their own result and continue the challenge chain.

Daily sharing stays unchanged in this sprint. Daily already has a natural dated destination and this sprint should stay focused on Free-level virality.

## Share payload

Canonical URL format:

`https://hrajproplet.cz/?play=<puzzle_id>&t=<elapsed_ms>&h=<hints_used>&m=<moves>`

Example:

`https://hrajproplet.cz/?play=g3-m-012&t=48000&h=0&m=7`

Rules:
- `play` is the stable puzzle ID and is the authoritative target.
- `t`, `h`, `m` are a social benchmark only; they do not affect leaderboard truth, XP, or server scoring.
- URL parameters are validated and bounded before use.
- No player ID/name is embedded in the URL.
- Query parameters are removed from browser history immediately after the challenge has been resolved, so normal navigation/reloads do not accidentally reopen the challenge.

Suggested share copy:

`🧩 Proplet výzva · Střední #12`
`⏱ 0:48 · ✨ čistě · 7 tahů`
`Dokážeš mě porazit? 👀`

The Web Share API gets the same competitive text plus the challenge URL in its `url` field. Clipboard fallback gets both text and URL.

## Challenge resolution

On boot, after the puzzle DB is available:

1. parse `play`;
2. search the currently active Free banks by puzzle ID;
3. if not active, fall back to `/api/free-archive?puzzle_id=...` so old shared links remain playable after future content rotations;
4. reject unknown/non-Free puzzles gracefully and route to Volná hra;
5. capture the recipient's ordinary progression state for the challenged difficulty;
6. start the exact puzzle in normal `free` mode with an attached `sharedChallenge` context.

The challenge is intentionally still `mode='free'`. This preserves all existing stable-slot, XP, result-sync, leaderboard and anti-double-XP invariants.

## New-player behavior

A brand-new player must not lose the action-first onboarding. If onboarding is not complete:
- remember the pending shared challenge;
- run the existing v3.32.8 action-first onboarding;
- after onboarding, open the shared level instead of routing through normal Starter/Daily flow.

Existing players enter the shared board directly.

## Game presentation

Shared challenge is visibly distinct from ordinary Free play without adding a blocking landing page:

- eyebrow/header: `VÝZVA` / `Výzva od kamaráda`;
- keep the normal difficulty + level label;
- show a compact benchmark chip/card, e.g. `🎯 Překonej 0:48 · čistě`;
- gameplay mechanics, hints, helper and board remain completely standard.

No separate challenge-only rules.

## Result comparison

Use the same competitive ordering shown by Proplet rankings:

1. clean solve;
2. fewer hints;
3. lower elapsed time;
4. fewer moves.

Result screen receives one dedicated challenge summary, for example:

- `🏆 Překonal jsi výzvu!` + `O 12 s rychlejší.`
- `✨ Vyhrál jsi čistým řešením.`
- `Těsně! Chybělo 8 s.`
- exact tie: `🤝 Plichta. Stejný výkon.`

This comparison is social/UI-only. The server leaderboard remains the source of truth for official rankings.

## Progression invariants

Critical behavior:

- shared level completion is stored under the existing `free:<puzzle_id>` challenge key;
- if its stable difficulty+level slot was not previously completed, the existing `pointsFor()` logic grants normal one-time XP;
- if already completed/transferred, no extra XP;
- first completion remains the official leaderboard result according to current rules;
- challenge replay cannot duplicate XP;
- after challenge completion, primary CTA becomes `Pokračovat v mém postupu`;
- that CTA calls ordinary `startFree(difficulty)`, which naturally resumes an earlier in-progress level or the first ordinary unsolved level;
- it must never continue to `challenged level + 1` just because the challenge was ahead of progression;
- menu CTA returns to Volná hra.

## Persistence / reload

Store the small challenge context in session/local state keyed by puzzle ID so that normal autosave/resume does not silently turn the challenge into an ordinary Free session after a refresh.

Challenge context includes only:
- puzzle ID;
- benchmark time/hints/moves;
- opened timestamp.

It must not become a new progression model.

## Telemetry

Add:
- `level_share_created` — Free result share action successfully invoked;
- `shared_level_opened` — valid deep link resolved;
- `shared_level_started` — exact board started;
- `shared_level_completed` — recipient completed the board;
- `shared_level_beaten` — recipient beat benchmark;
- `shared_level_returned_to_progress` — primary CTA returned to ordinary progression;
- `shared_level_invalid` — link could not resolve.

Useful dimensions in existing event metadata where supported: puzzle ID, difficulty, level, app version. Do not put player names in telemetry.

## Implementation strategy

Prefer an additive `competitive-sharing-v3331.js` + CSS layer loaded after the existing app runtime. Patch only the required global functions/handlers instead of rewriting `app.js`:

- share handlers on `#winShareBtn` and `#levelDetailShareBtn`;
- exact-level deep-link resolver;
- `startGame` wrapper to attach challenge context;
- `finishGame` wrapper to render challenge comparison after normal result handling;
- `performPostWinAction` wrapper for return-to-normal-progression behavior.

Only touch core `app.js` if the additive layer cannot preserve an invariant cleanly.

## Acceptance QA

Must pass at minimum:

1. Player at Střední #4 opens shared Střední #37, completes it, earns XP exactly once, then `Pokračovat v mém postupu` returns to #4/#next ordinary unsolved — not #38.
2. Same recipient reopens #37 and gets no duplicate XP.
3. Recipient with an earlier in-progress Střední resumes that exact in-progress level after challenge.
4. Recipient already past #37 can play it as a challenge/training attempt without XP regression.
5. Shared link to a currently active level opens directly.
6. Shared link to an archived-but-known level resolves via archive endpoint.
7. Invalid puzzle ID fails safely into Volná hra.
8. Brand-new user completes onboarding and is then routed into the pending shared challenge.
9. Phone, Fold and desktop game layouts show challenge benchmark without squeezing the board.
10. Browser Back from challenge does not create a challenge reopening loop.
11. Refresh/resume preserves challenge context sufficiently for the result CTA to return to normal progression.
12. Normal Free and Daily share flows remain unchanged except for Free's new competitive copy/link.
13. No production push/session/rolling-content behavior changes.
