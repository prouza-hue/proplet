"""Focused regression for the v4.01.17 Vercel compute-relief release."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
account = (ROOT / "public" / "account-auth.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
service_worker = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")


assert 'APP_VERSION = "4.01.18"' in version
assert "version:'4.01.18'" in runtime
assert "vercelComputeReliefV40117:true" in runtime
assert "proplet-v4.01.18-shell" in service_worker

# Public push configuration can be reused without leaking any account state.
assert 'request.url.path == "/api/push/config"' in server
assert '"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"' in server
assert "let pushConfigPromise=null" in app
assert "fetch('/api/push/config',{headers:{Accept:'application/json'}" in app
assert "api('/api/push/config')" not in app
assert app.count("loadPushConfig()") >= 3  # definition plus both consumers

# Expensive private checks are lazy and duplicate requests are coalesced.
assert "if(currentScreen!=='profile'||!p?.token)" in app
assert "const adminAccessCache=new Map()" in app
assert "if(!profileScreenActive())return" in account
assert "if(securityRefreshPromise)return securityRefreshPromise" in account
assert account.count("call('/api/account/auth-status')") == 1
assert "setTimeout(()=>{enhanceProfileArchitecture();refreshSecurityCard()}" not in account

# Keep the first-correct timestamp exact, sample only later correct-word updates,
# and keep all leave/hint/reset/resume/final paths intact.
assert "foundWords!==1&&(foundWords-1)%3!==0" in app
assert "sendAttemptCheckpoint('correct')" in app
for event_type in ("leave", "hint", "reset", "resume"):
    assert f"sendAttemptCheckpoint('{event_type}')" in app
assert 'payload.event_type == "correct" and row.get("first_correct_ms") is None' in server

print("Proplet v4.01.17 Vercel compute relief regression: OK")
