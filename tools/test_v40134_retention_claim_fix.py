#!/usr/bin/env python3
"""Release contract for terminal word-claim rejection and the first-win return nudge."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
feedback = (ROOT / "public" / "valid-word-feedback-v3330.js").read_text(encoding="utf-8")
html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")

assert 'APP_VERSION = "4.01.36"' in (ROOT / "proplet_version.py").read_text(encoding="utf-8")
assert "version:'4.01.36'" in runtime
assert "firstWinReturnNudgeV40134:true" in runtime
assert "wordDiscoveryTerminalRejectV40134:true" in runtime

assert "[400,404,410,422].includes(Number(error?.status))" in feedback
assert "status:'rejected'" in feedback
assert "if(permanentClaimError(error)){rejectClaim(store,key,row,error);changed=true}" in feedback
assert "return 'rejected'" in feedback
assert "word_discovery_claim_rejected" in feedback and "word_discovery_claim_rejected" in server
assert "['local','pending','confirmed'].includes(row?.status)" in feedback
assert "valid-word-feedback-v3330.js?v=7" in theme

assert "firstRealGameJustCompleted" in app
assert "completedGameCount()===1" in app
assert "maybeOfferFirstWinReturnNudge('continue')" in app
assert "context:'first_win',followUp:'account'" in app
for event in (
    "first_win_return_nudge_shown",
    "first_win_return_nudge_accepted",
    "first_win_return_nudge_dismissed",
):
    assert event in app and event in server
for element_id in ("pushNudgeEyebrow", "pushNudgeTitle", "pushNudgeCopy"):
    assert f'id="{element_id}"' in html

print("PASS: v4.01.34 terminal claims and first-win return nudge")
