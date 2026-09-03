#!/usr/bin/env python3
"""Release contract for the wide profile alignment fix."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
css = (ROOT / "public" / "app-profile-settings.css").read_text(encoding="utf-8")
html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.02.2"' in (ROOT / "proplet_version.py").read_text(encoding="utf-8")
assert "version:'4.02.2'" in runtime
assert "proplet-v4.02.2-game-session-shell" in sw
assert 'theme-init.js?v=40140-s13b-pes1' in html and 'theme-init.js?v=40140-s13b-pes1' in sw
assert "app-profile-settings.css?v=40140-s13b" in theme

assert ".profile-grid>.profile-stat:not(.profile-stat-wide){grid-column:span 2" in css
assert "overflow-wrap:normal;word-break:normal;hyphens:none" in css
assert "flex:0 0 calc((100% - 3 * var(--profile-roadmap-gap)) / 4)" in css
assert "scroll-snap-align:start" in css
assert "position=current.getBoundingClientRect().left-rail.getBoundingClientRect().left+rail.scrollLeft" in app
assert "wide?position-current.offsetWidth-gap" in app
assert "if(currentScreen==='profile')focusProfileRoadmap()" in app

print("PASS: v4.02.2 preserves wide profile alignment")
