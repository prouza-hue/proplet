# Pestre poradi — isolated real-game preview

19 September 2026. User authorized a real preview, not a production rollout.
Baseline: `e58aadab5889d43ecceb83333eb49fb9238e384b` (`main`).
Preview branch: `preview/pestre-poradi`.

Preview URL: https://proplet-git-preview-pestre-poradi-pavel-prouzas-projects.vercel.app/?open=free&scenario=existing

## Scope

Actual Proplet app, approved existing UI/assets and published puzzle content; changed selection for easy and medium only. No production DB or copied accounts. Synthetic per-scenario browser-local progress. No sign-in, server synchronization, analytics or service worker. No production deploy or main update.

Scenarios: existing (36 easy / 12 medium solved), newcomer (zero, varied by default), resume (existing plus one found word on the next original board), seen (existing plus three Gen5 boards solved per difficulty). Scenario dropdown, scoped reset and real-path QA solve controls are in the preview panel.

Immutable IDs, original level numbers, completed records, resume priority and reversible numeric/varied choice are retained. Gen5 is identified by `g5-r1-` ID prefix because player contentGeneration metadata was deliberately not migrated. Choice and deterministic plan are local only; cross-device persistence is not implemented here.

Actual available content is frozen at 2026-09-19: easy and medium each have 304 boards, including 100 Gen5. Intro selection is provisional, not a final editorial judgment.

## Build and verification

`node tools/order-preview/build.cjs && node tools/order-preview/privacy.cjs`

Build checks original app/HTML Git hashes, immutable source bank, actual answer paths, complete ordering traversals, resume and skip-completed. Output is exclusively static Build Output API; API paths return 403 and CSP/network guards block live DB access. The build refuses production and main.

Workflow `.github/workflows/order-preview-qa.yml` runs local Chromium scenarios at 390/768/1440 CSS pixels and hosted gameplay at 320 light / 768 dark, including actual pointer input, original win/next behavior, network isolation, deployed asset equality and screenshots. Read the latest run/artifact rather than assuming a historical PASS applies to future changes. Screenshots are emulated viewports, not a physical Fold test.

## Do not merge this branch directly

The branch deliberately overrides Vercel configuration and installs a preview-only runtime wrapper. A later separately authorized production implementation must port the clean engine/integration without the lab, implement account-level settings/plan synchronization, validate guest migration and multiple devices, finalize intro curation and ongoing-release policy, and rerun PWA/server/reward/leaderboard regressions. Recheck production SHA and database environment first.
