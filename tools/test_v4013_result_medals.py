#!/usr/bin/env python3
"""Regression contract for prominent podium medals on result leaderboards."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
css = (root / "public" / "styles.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

for rank, label in ((1, "Zlatá medaile"), (2, "Stříbrná medaile"), (3, "Bronzová medaile")):
    assert label in app
    assert f".result-medal-{rank}" in css

assert 'role="img"' in app
assert 'result-medal result-medal-${value}' in app
assert ".result-medal{" in css
assert "width:40px;height:40px" in css
assert "grid-template-columns:44px minmax(0,1fr) auto" in css
assert "resultMedalBadgesV4013:true" in runtime

print("Proplet v4.01.7 result medal badges: OK")
