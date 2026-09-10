#!/usr/bin/env python3
"""Regression contract for the current PWA startup/update boundary."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
sw = (root / "public" / "sw.js").read_text(encoding="utf-8")
app = (root / "public" / "app.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (root / "proplet_version.py").read_text(encoding="utf-8")
vercel = json.loads((root / "vercel.json").read_text(encoding="utf-8"))

assert 'APP_VERSION = "4.02.2"' in version
assert "version:'4.02.2'" in runtime
assert "pwaStartupHotfixV4001:true" in runtime

shell_release = re.search(r"const SHELL_CACHE='([^']+)'", sw)
app_release = re.search(r"const APP_PREVIEW_RELEASE='([^']+)'", app)
assert shell_release and app_release
assert shell_release.group(1) == app_release.group(1), (
    "Service-worker shell and app release marker must stay identical; a mismatch "
    "causes the runtime-update reload loop."
)
assert shell_release.group(1) == "proplet-v4.02.2-printshop-preview-fix20"
assert "const DATA_CACHE='proplet-data-v11'" in sw

shell_match = re.search(r"const SHELL=\[(.*?)\];", sw, re.S)
assert shell_match
shell = shell_match.group(1)
# Keep heavy/lazy data outside the install shell; shell asset count itself is
# allowed to grow as the modular frontend evolves.
assert "/app/core/result-queue.js" in shell
assert "/app/core/api-client.js" in shell
assert "/app/core/storage.js" in shell
assert "/app/account/session.js" in shell
assert "/app/account/tajenka-storage.js" in shell
assert "/app/account/account.js" in shell
assert "/app/engagement/onboarding.js" in shell
assert "/app/engagement/nudges.js" in shell
assert "/app/content/progression.js" in shell
assert "/app/content/daily.js" in shell
assert "/app/rankings/rankings.js" in shell
assert "/app/game/state.js" in shell
assert "/app/game/board.js" in shell
assert "/app/game/input.js" in shell
assert "/app/game/hints.js" in shell
assert "/app/core/completion-pipeline.js" in shell
for heavy_or_lazy in ("/puzzles.json", "/valid-words-v3328.txt", "/share-card.png", "/privacy.html", "/terms.html"):
    assert heavy_or_lazy not in shell

assert "preserveExistingPuzzleDatabase" in sw
assert "caches.match('/puzzles.json',{ignoreSearch:true})" in sw
assert "Number(data?.contentGeneration)===4&&Number(data?.dailyGeneration)===4" in sw
assert "client.navigate(client.url)" not in sw
assert "PROPLET_SW_UPDATED" in sw
assert "cacheFirst(e.request)" in sw
assert "fetch(e.request,{cache:'no-store'}).then" not in sw

sw_headers = [entry for entry in vercel["headers"] if entry.get("source") == "/sw.js"]
assert len(sw_headers) == 1
cache_control = [h["value"] for h in sw_headers[0]["headers"] if h["key"].lower() == "cache-control"]
assert cache_control == ["no-cache, no-store, must-revalidate"]

print("PASS: current PWA startup/update contract")
