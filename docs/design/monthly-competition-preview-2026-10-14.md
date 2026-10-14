# Monthly competition — native integrated review, 14 October 2026

Based on production 4.08.9, c2501bc31fcb5c4da4c8fa3d5932ad910c8f432b. Only a preview branch, no production promotion. Reuses the edition medal artwork from PR188's season-view.js and the approved weekly screen typography/layout. The old full Archive experience is not copied back.

## Agreed scoring represented here

- First valid basic Daily completion on its publication date; best 20 days.
- Each Daily: 55 completion +15 clean + max(0,10−3×hints) +0–20 relative speed (10 if alone). Daily results provisional until day closes. Maximum 2,000 monthly points.
- Extra, Tajenka, Free and Archive earned gameplay XP: 12 XP per point, capped at 500 points / 6,000 XP. Basic Daily, referral and registration bonuses excluded. 80/20 by maxima, 2,500 total.
- Ties: Daily subtotal, clean solves, fewer hints, lower summed verified times, all from counted days; exact final tie requires auditable one-time lottery. Preview fixture IDs are solely a stable ordering of synthetic rows, never a proposed production lottery.
- November first season, no invented October winners. Monthly medals for unique positions 1–3, no XP reward. 48-hour review before awards.

## Integrated surfaces

Native Dnes and Pořadí cards open `screen-monthly` using the actual app router, native bottom navigation and theme. Daily CTA returns to the native Daily screen. Shadow-root styles cannot resize existing game icons. Medal detail, 20 counted days, gameplay XP breakdown, rules and tie explanation open real dialogs with Escape support.

The existing isolated preview adapter supplies a synthetic Alex profile and intercepts game/API writes. The new module is additionally gated by PROPLET_ARCHIVE_PREVIEW, has no fetch/storage/reward writes and does not alter backend or production flags. No service-worker changes, observers or polling.

Five review states: ongoing November, first season start, equal total with decisive Daily subtotal, pending verification, confirmed podium. All are clearly labeled sample data. The state selector is collapsed below the game content.

## Still required before November production launch

Authoritative ledger and gameplay-XP attribution, immutable day closure and monthly finalization, exact arithmetic/rounding policy, deterministic selection of equally-scoring counted days, auditable lottery process, award persistence/idempotency, enforcement of first attempt/publication date, private/guest/account transitions, actual data calibration of 6,000-XP cap, production feature gate and end-to-end verification. The model preview is not evidence of a working award backend.

## QA

`tools/qa_monthly_competition.cjs`: native Dnes/Pořadí entry and return, score breakdown, 20 days, rules, tie reason, all five scenarios, medals and podium, native Daily return, viewport widths 320/390/690/1440, dark theme and browser errors. These are emulated widths, not a physical Fold test.
