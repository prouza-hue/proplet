#!/usr/bin/env python3
"""Regression contract for the v4.00.1 PWA startup hotfix."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
sw = (root / "public" / "sw.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (root / "proplet_version.py").read_text(encoding="utf-8")
vercel = json.loads((root / "vercel.json").read_text(encoding="utf-8"))

assert 'APP_VERSION = "4.01.12"' in version
assert "version:'4.01.12'" in runtime
assert "pwaStartupHotfixV4001:true" in runtime
assert "const SHELL_CACHE='proplet-v4.01.12-shell'" in sw
assert "const DATA_CACHE='proplet-data-v11'" in sw

shell_match = re.search(r"const SHELL=\[(.*?)\];", sw, re.S)
assert shell_match
shell = shell_match.group(1)
assert shell.count("'/") <= 8
for heavy_or_lazy in ("/puzzles.json", "/valid-words-v3328.txt", "/share-card.png", "/privacy.html", "/terms.html"):
    assert heavy_or_lazy not in shell

assert "preserveExistingPuzzleDatabase" in sw
assert "caches.match('/puzzles.json',{ignoreSearch:true})" in sw
assert "client.navigate(client.url)" in sw
assert "cacheFirst(e.request)" in sw
assert "fetch(e.request,{cache:'no-store'}).then" not in sw

sw_headers = [entry for entry in vercel["headers"] if entry.get("source") == "/sw.js"]
assert len(sw_headers) == 1
cache_control = [h["value"] for h in sw_headers[0]["headers"] if h["key"].lower() == "cache-control"]
assert cache_control == ["no-cache, no-store, must-revalidate"]

print("Proplet v4.01.7 PWA startup contract: OK")
