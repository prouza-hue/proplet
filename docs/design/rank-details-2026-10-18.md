# Rank details — 2026-10-18

User approved the visual prototype and requested continuation. Implementation extends
PropletAchievementDetails rather than creating a separate modal. All 51 original
rank identities, thresholds and art are preserved. Short Czech stories, current /
earned / future status, and previous / next navigation are available from Today,
profile rank and profile roadmap. The last rank explains the existing chapters.

Baseline production/main: 7562368ca0d801024ae442998cd8db076e500b7a,
Vercel production dpl_6S3uQFVyW1ZhETg6WzxKgBzVSciw.
Work branch: feat/rank-details. No data migration or reward mutation.

A single effectiveStats snapshot is read on explicit open; browsing does not scan
history, poll, write state or send telemetry. Existing dialog lifecycle closes on
account/screen changes and supports Escape, Back, focus containment and return.
Cache revision rank-details1 coordinates the app shell and changed assets.

Validation: syntax checks and release_contract passed locally. Browser validation
is registered in the existing achievements workflow alongside the full existing
achievement/loyalty regression checks; CI results are required before release.

Status: implementation / integrated preview; production release not yet requested.
