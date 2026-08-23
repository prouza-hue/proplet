#!/usr/bin/env python3
"""Regression contract for Android PWAs resumed from a long-lived document."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
vercel = (root / "vercel.json").read_text(encoding="utf-8")

assert "navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})" in app
assert "document.addEventListener('visibilitychange',checkWhenVisible)" in app
assert "window.addEventListener('pageshow',checkForUpdate)" in app
assert "window.addEventListener('online',checkForUpdate)" in app
assert "setInterval(checkForUpdate,15*60*1000)" in app
assert "pwaResumeUpdateCheckV4012:true" in runtime
assert '"source": "/sw.js"' in vercel
assert '"value": "no-cache, no-store, must-revalidate"' in vercel

print("Proplet v4.01.4 PWA resume update contract: OK")
