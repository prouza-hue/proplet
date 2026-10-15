# Automatic offline play — 2026-10-15

Implementation candidate 4.09.0, based on production/main
`e6f44759c424a5c882d5e538403fd6477deafda8`. Production has not been changed.

## Product decision

- Offline play prepares automatically for an installed PWA, including the `appinstalled` transition. No player setting or download switch. Ordinary browser arrivals retain the existing small bootstrap.
- Download every released Free board in all six difficulties (currently 1,750), the current released rolling delta and all 800 Archive boards / 879 approved complete covers.
- Keep ordinary progress and rewards. Locally unverified times never enter time rankings. Existing weekly/lifetime XP and historical-slot rules remain unchanged.
- The install offer says **Chceš hrát i offline?** and explains that the app needs its first connected launch to prepare content. Readiness is displayed only after the content, current shell and account snapshot are complete.
- Future Daily/Extra boards are not downloaded. An already cached Daily can use its existing validity rules. Official Extra requires a connection; a connection loss preserves all found words until a finished play-session receipt is confirmed. Existing date/practice rules still apply.

The `offline-v1` install campaign resets former dismissals once per browser. Existing accepted installations and acknowledged iOS instructions stay excluded. The offer retains a seven-day cooldown after the first decline and stops after the second decline in this campaign. The campaign marker prevents subsequent launches from resetting the count again.

## Content and storage

Public content uses a versioned candidate Cache API store. A single index write commits a fully checked pack; failed transfer, hash validation, quota write or shell validation preserves the previous pack. Personal account history and queues retain their separate account-scoped stores and never enter public caches.

The main bank is 4,095,212 bytes and the Archive aggregate is 2,214,399 bytes. The latter replaces 800 per-board requests. Unchanged banks and Archive revisions are reused; a new rolling revision downloads only the delta. Visibility checks are bounded. Optional persistence is requested for installed apps. Fraunces and Outfit are served locally under their SIL Open Font Licenses, retaining variable weights and Fraunces optical sizing.

Synchronization runs on return online or app use. It does not promise execution while the operating system has closed the PWA. Expired authentication keeps the queue; renewing the same account clears only the 401 cooldown. A different account cannot drain the former account's queue.

## Release order

1. Review/apply `supabase/migrations/20261015070626_offline_result_timing.sql`. It only lowers time trust and adds service-role-only offline submission wrappers; it changes no XP, slot, streak or Extra eligibility rule.
2. Verify both wrapper signatures and ACLs. Before this migration the new API returns 503 for offline submissions and retains their queue, rather than silently accepting a ranked time through the older routine.
3. Deploy the reviewed app commit and verify production version, manifest, static asset hash and service-worker readiness. Do not use real player progress for acceptance.

## Verification

Targeted existing queue, fair-play, boot-recovery, offline, service-worker lifecycle and automatic-update tests passed. New tests under `tests/offline/` cover atomic pack rollback, missing storage/eviction, SHA checking, finite Archive solutions, account boundaries, auth retry, time trust, same-week releases and deployment without bundled static assets.

The PostgreSQL tests use disposable PGlite 0.5.10. They execute the prepared migration and captured production ranking routines, including permissions, missing-function failure, single rewards, receipt replay, Archive reward slots, excluded offline times and retained personal/team XP. They never use a database URL.

`browser.cjs` runs the shipped UI and service worker against loopback-only personal API fixtures. Native Chromium acceptance covered a complete process restart offline, all six difficulties with pointer input, a partially solved board after another restart, an approved alternate Archive cover, seven result submissions with no duplicate rewards on replay, account switching, and Extra completion held through a failed finish request. Its transport ledger is a fixture; database semantics are verified separately above. Physical Android/Fold testing remains a release follow-up.

For browser checks, use an installed Playwright Chromium or `CHROMIUM_EXECUTABLE_PATH`. SQL checks accept `PROPLET_PGLITE_PATH` pointing to the isolated package. A Vercel preview uses `?offline-preview=1` to exercise automatic preparation without requiring installation; its existing write guard remains active.
