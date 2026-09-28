# Starter save repair — 28 September 2026

Production baseline: 0e06a56ff0beb64dda6c3ee172324b8f105c1f19. The three-answer board-v3-short reused starter-v1, but server result validation resolved the four-answer legacy bank. A valid three-move result returned HTTP 400, stayed queued, and prevented saved confirmation although the first free game persisted.

The exact starter-v1/easy identity now accepts the minimum requirements of its two released variants (3 answers/9 cells). Already shipped offline payloads have no variant field: requiring a new field or relying on mutable onboarding headers would leave old queues broken. Authentication, 2500 ms minimum, wrong-attempt accounting, hint consistency, puzzle/key checks and the shared once-per-player reward remain enforced. Other modes keep canonical constraints.

No UX, auth/claim, provenance, schema or production player data changes. Existing clients retry normally. No synthetic production accounts or retrospective saved events are created. Historical save_failed remains truthful; users who already left the offer can sync on return without a new first_steps_v1_saved event.

Verification: actual HTTP /api/result and /api/progress regression passes and fails against the original validator with the expected inconsistent-moves HTTP 400. Covers 3/4 moves, retry XP, wrong attempts, duration, hints, invalid IDs/keys, and regular-mode validation. Extended PostgreSQL CI exercises actual atomic receipt replay, legacy compatibility and SQL verification of one starter reward. Existing browser scenarios cover manual/Google return, failure/retry and saved confirmation; browser fixtures alone do not prove server storage or real OAuth.

Release marker: proplet-v4.03.0-startersave1. Record final CI and deployment in PR. Rollback restores the previous deployment, reintroducing rejected three-move results; no schema rollback needed.

Organic follow-up: join first_steps_v1 account_created, offer and saved through first_steps_run_id; verify starter:starter-v1 and free:g4-e-001 in results. Monitor /api/result 400 as well as 5xx. Distinguish successful tests/deployment from organic verification.
