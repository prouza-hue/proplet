#!/usr/bin/env python3
"""Regression contract for the v4.00.2 update-button handover."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
sw = (root / "public" / "sw.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

assert "pwaUpdateButtonHotfixV4002:true" in runtime
assert "function applyPendingUpdate()" in app
assert "worker.state==='activated'||worker.state==='redundant'" in app
assert "button.textContent='Aktualizuji…'" in app
assert "setTimeout(()=>location.reload(),1800)" in app
assert "$('#applyUpdateBtn').onclick=applyPendingUpdate" in app
assert "$('#applyUpdateBtn').onclick=()=>{if(!pendingSW)return" not in app

install_block = re.search(r"self\.addEventListener\('install'.*?\n\}\);", sw, re.S)
assert install_block and "skipWaiting" not in install_block.group(0)
assert "if(e.data?.type==='SKIP_WAITING')e.waitUntil(self.skipWaiting())" in sw
assert "const cache=await caches.open(SHELL_CACHE)" in sw

print("Proplet v4.00.2 update-button contract: OK")
