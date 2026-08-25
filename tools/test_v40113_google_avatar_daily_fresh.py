#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
auth = (ROOT / "account_auth_core.py").read_text(encoding="utf-8")
account_js = (ROOT / "public" / "account-auth.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V4_01_13.sql").read_text(encoding="utf-8")
vercel = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))

# P0: a compatible-format but pre-Gen4 cache must never render/start a Daily.
guard = "Number(data?.contentGeneration||0)===4&&Number(data?.dailyGeneration||0)===4"
assert guard in app
assert "Number(data?.contentGeneration)===4&&Number(data?.dailyGeneration)===4" in sw

# Google picture is captured from verified Google identity metadata but remains opt-in.
assert "trusted_google_avatar" in auth and 'host.endswith(".googleusercontent.com")' in auth
assert '"use_google_avatar": False' in auth
assert "Fotka z Googlu" in account_js and "saveGoogleAvatar" in app
assert '"useGoogleAvatar": bool(player.get("use_google_avatar"))' in server
assert "Public rankings continue to use players.avatar" in migration
assert "use_google_avatar boolean not null default false" in migration

csp = next(h["value"] for entry in vercel["headers"] for h in entry["headers"] if h["key"] == "Content-Security-Policy")
assert "https://*.googleusercontent.com" in csp
assert "wakeLockGoogleAvatarDailyFreshV40113:true" in (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
print("PASS: v4.01.13 Google avatar opt-in and fresh Daily cache contracts.")
