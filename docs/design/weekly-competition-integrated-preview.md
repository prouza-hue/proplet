# Weekly competition integrated review

Preview-only extension based on production 4.08.7 (481637038f58d6ddbdb0864b28afc2dc0741ba21). Open Dnes → Týdenní soutěž → Otevřít soutěž. The page uses the native shell, navigation, theme, reward artwork and isolated Archive preview API adapter.

The two tabs show this week's model standings and the team's trophy cabinet, with clickable trophy details and historical wins. The review selector covers member, no team, guest and private team. Play actions return to actual Daily / Free pages. Account/team actions use native Profile/team surfaces under the preview adapter; no real membership or award writes.

All competition numbers and teams are model data. Public team cabinets and live backend mapping are still design work. Do not merge this review fixture to production. The extension exits unless PROPLET_ARCHIVE_PREVIEW is true; production build already removes the preview adapter. No database, cron, push, service-worker or production release changes.

Implementation uses an isolated shadow root to avoid leaking proposal styles into game screens. It adds one native route and one capture handler for the Dnes competition entry. No polling or MutationObservers.

Verification: Chromium at 320, 390, 768 and 1280px, light/dark; Dnes entry, tabs, trophy close, all four review states, return to Free/Dnes, no horizontal overflow or JS exceptions. Physical devices not tested.
