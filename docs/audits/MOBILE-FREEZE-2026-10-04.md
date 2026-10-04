# Mobile freeze incident — 2026-10-04

Reported: slow navigation/scroll and unresponsive resume (Hard 319) on mobile.

Baseline production and main: 5ac821081a64d3b106aff997a5aa5d2b36986f05, deployment dpl_3VHfzz2tygVryBey64395PuXcM6j; production Supabase iopyhluayfszskyqqpuc. No database changes.

Confirmed root cause: refresh-ui parsed getState().completed once per board (600 full-history parses per screen render; 900 with 300 catalogue buttons). Replace with a fresh render-scoped snapshot; standalone catalogue also takes one fresh snapshot. Synthetic 1,500-result benchmark: about 956ms baseline vs 6ms fixed on desktop Node, not a physical-device measurement.

Secondary defect: Android popstate did not route mk100LaunchPreview to its owner close(), leaving body overflow and background inert state locked. Added matching cleanup dispatch.

Validation: executable performance/correctness regression, native-function navigation and Hard 319 resume regression, JS syntax. Hard 319 selection preserves saved words and time and precedes varied-order next candidate. Tests registered in current runtime gate. PWA script URLs and shell cache advanced to mobilefix1; storage schema and player progress unchanged.

Physical handset behavior and the original signed-in account remain for user confirmation after reload. The fix does not claim to remove network latency before opening a synchronized game. PR #170 carries deployment/check evidence.
