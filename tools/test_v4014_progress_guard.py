#!/usr/bin/env python3
"""Regression contract for the anonymous progress protection prompt."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
html = (root / "public" / "index.html").read_text(encoding="utf-8")
css = (root / "public" / "styles.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

assert "PROGRESS_GUARD_COOLDOWN_MS=14*24*60*60*1000" in app
assert "PROGRESS_GUARD_MOBILE_AWAY_MS=20*1000" in app
assert "completedGameCount()<1" in app
assert "source==='desktop'&&progressGuardHasCoarsePointer()" in app
assert "source==='mobile'&&!progressGuardHasCoarsePointer()" in app
assert "document.addEventListener('mouseout'" in app and "e.clientY>4" in app
assert "document.addEventListener('visibilitychange'" in app
assert "lastHiddenAt" in app and "rememberProgressGuardDeparture" in app
assert "maybeOfferProgressGuard('mobile')" in app
assert "accountNudgeState().lastShownAt" in app
assert "progressGuardState().lastShownAt" in app
assert "beforeunload" not in app

assert 'id="progressGuardModal"' in html
assert 'id="progressGuardGoogleBtn"' in html
assert 'Pokračovat přes Google' in html
assert "location.href='/api/auth/google/start'" in app
assert ".progress-guard-card" in css
assert "anonymousProgressGuardV4014:true" in runtime

print("Proplet v4.01.4 anonymous desktop exit intent and mobile return guard: OK")
