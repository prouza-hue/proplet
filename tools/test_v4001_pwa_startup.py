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

assert 'APP_VERSION = "4.01.39"' in version
assert "version:'4.01.39'" in runtime
assert "pwaStartupHotfixV4001:true" in runtime
assert "const SHELL_CACHE='proplet-v4.01.39-data-consistency-shell'" in sw
assert "const DATA_CACHE='proplet-data-v11'" in sw

shell_match = re.search(r"const SHELL=\[(.*?)\];", sw, re.S)
assert shell_match
shell = shell_match.group(1)
# The split quality bootstrap adds one small core script while puzzle data and
# all genuinely heavy/lazy assets stay outside the shell.
# v4.01.23 adds one tiny Daily result-menu asset to the intentional shell set.\n# Sprint 10 adds two small dependency-free frontend core modules; heavy/lazy\n# data remains outside the shell, so the startup budget grows only by those two.\nassert shell.count("'/") <= 13
assert "/app/core/result-queue.js" in shell\nassert "/app/core/api-client.js" in shell\nassert "/app/core/storage.js" in shell
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

print("Proplet v4.01.7 PWA startup contract: OK")
