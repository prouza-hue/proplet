#!/usr/bin/env python3
"""Static client checks for the Daily replay control."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")

assert 'id="winReplayBtn"' in html
assert "function configureWinReplay" in app
assert "Zahrát novou dnešní výzvu" in app
assert "Zahrát znovu · trénink" in app
assert "function replayDailyFromWin" in app
assert "dailyReplay?'Tréninkový pokus · 100 XP už máš'" in app
assert "$('#winReplayBtn').onclick=replayDailyFromWin" in app
print("daily replay client: OK")
