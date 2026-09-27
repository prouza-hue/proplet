# Weekly CTA layout correction

PR #152; implementation c6ec5a93db1a3e5ea541b9f85d62f63dd474fffd; production merge a977f5b77518e4f3060271acaecbb9046ca62c99.

Removed eyebrow and decorative arrow (the legacy pictograph decorator converted it to a fallback circle). Badge now occupies a grid cell beside the title; close button stays inside the card with reserved heading space. Cache release weekly2.

Browser QA on isolated preview a8d88b27d19ab381190725e914f1a3b43ec627eb: 360px and 390px light, 768px dark. No badge/close overlap; eyebrow absent; CTA text only. Closing announcement preserves next-game action. Screenshot weekly-cta-clean.jpg is actual 390px browser emulation, not physical-device proof. All applicable PR checks passed, including printshop-ui, browser, current-runtime and isolated database checks. QA fixtures remain outside production.
