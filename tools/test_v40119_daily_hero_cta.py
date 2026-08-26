#!/usr/bin/env python3
"""Regression contract for Daily hero challenge CTA parity and stale-arrow cache bust."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / "public" / "challenge-cta-v3333.css").read_text(encoding="utf-8")
script = (ROOT / "public" / "challenge-cta-v3333.js").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.01.24"' in version
assert "version:'4.01.24'" in runtime
assert "dailyHeroCtaParityV40119:true" in runtime
assert "proplet-v4.01.24-shell" in sw

# Force the current CTA code/style onto existing PWAs instead of reusing stale
# challenge assets that could still contain the old leading share arrow.
assert "/challenge-cta-v3333.css?v=5" in theme
assert "/challenge-cta-v3333.js?v=4" in theme
assert "setText(daily,'⚔️ Vyzvat kamaráda')" in script
assert "↗ ⚔️ Vyzvat kamaráda" not in script
assert "#shareDailyBtn.daily-challenge-cta::before{content:none!important}" in css

# Both Daily hero actions use the same geometry and type scale; only their
# color treatment communicates primary play vs. challenge/share intent.
for token in (
    ".daily-hero .daily-main-actions>#playDailyBtn,",
    ".daily-hero .daily-main-actions>#shareDailyBtn{",
    "min-height:50px;",
    "padding:12px 16px;",
    "border-radius:14px;",
    "font-size:15px!important;",
    "font-weight:900;",
    "align-items:center;",
    "justify-content:center;",
):
    assert token in css, token

print("PASS: v4.01.19 Daily hero CTA matches play/result visual grammar and has no stale arrow.")
