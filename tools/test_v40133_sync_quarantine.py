#!/usr/bin/env python3
"""Contract for safely unblocking terminally obsolete result queues."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")

# Release identity is shared, never pinned to the version that introduced this feature.
import runpy
runpy.run_path(str(ROOT / "tools/release_contract.py"))["assert_release_contract"](ROOT)
assert "const REJECTED_QUEUE_KEY='proplet-v4-rejected-sync-queue'" in app
assert "Number(error?.status)===400&&error?.message==='Neznámá úloha'" in app
assert "obsoleteQueuedResultError(e)&&quarantineRejectedResult(r,e.message,scope)" in app
assert "scopedStorageKey(REJECTED_QUEUE_KEY,scope)" in app
assert "Array.isArray(parsed)?parsed:[]" in app
assert "catch{return false}" in app
assert "old.slice(-20)" in app
assert "error.status=r.status" in app
assert "Synchronizace opravena" in app
assert "scopedStorageKey(REJECTED_QUEUE_KEY,deletedId)" in app

print("v4.01.33 sync quarantine contract: PASS")
