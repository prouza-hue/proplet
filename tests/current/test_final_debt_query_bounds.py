#!/usr/bin/env python3
"""Static guardrails for the final-debt bounded-query closure."""

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
server = (ROOT / "server.py").read_text(encoding="utf-8")
core = (ROOT / "account_auth_core.py").read_text(encoding="utf-8")
integrity = (ROOT / "account_integrity_v33210.py").read_text(encoding="utf-8")
push = (ROOT / "push_diagnostics_v3329.py").read_text(encoding="utf-8")
manifest = json.loads((ROOT / "supabase/migrations/manifest.json").read_text(encoding="utf-8"))

login = re.search(r'@app\.post\("/api/login"\)(.*?)@app\.post\("/api/anonymous/claim"\)', server, re.S).group(1)
assert 'db_select("players")' not in login
assert login.count('db_select_bounded("players"') >= 2
assert '"name": f"ilike.{identifier}"' in login

owner = re.search(r"    def verified_email_owner\(.*?\n    def ", core, re.S).group(0)
assert 'db_select("players")' not in owner
assert 'filters={"email": f"eq.{email}"}' in owner

integrity_login = re.search(r'@app\.post\("/api/login-integrity"\)(.*?)@app\.get\("/api/admin/account-integrity"\)', integrity, re.S).group(1)
assert 'db_select("players")' not in integrity_login
assert integrity_login.count('bounded_rows("players"') == 2
assert 'bounded_rows(\n                    "players",' in integrity_login

admin_integrity = re.search(r'@app\.get\("/api/admin/account-integrity"\)(.*)', integrity, re.S).group(1)
for table in ("players", "results", "player_sessions", "push_subscriptions"):
    assert f'bounded_rows("{table}"' in admin_integrity

admin_push = re.search(r'@app\.get\("/api/admin/push-diagnostics"\)(.*)', push, re.S).group(1)
for table in ("push_subscriptions", "push_delivery_log", "players"):
    assert f'diagnostic_rows("{table}"' in admin_push or f'"{table}",' in admin_push
assert 'db_select("push_delivery_log")' not in admin_push

# The one unbounded subscription read left in this module is the delivery cron:
# it must enumerate every current subscription to perform the requested fan-out.
assert push.count('subscriptions = db_select("push_subscriptions")') == 1
cron_pos = push.index('subscriptions = db_select("push_subscriptions")')
admin_pos = push.index('@app.get("/api/admin/push-diagnostics")')
assert cron_pos < admin_pos

by_id = {entry["id"]: entry for entry in manifest["files"]}
assert by_id["v4.01.38-atomic-result"]["status"] == "current-history"
assert by_id["v4.01.39-query-bounds"]["status"] == "current-history"

print("PASS: final-debt migration/auth/admin query bounds guarded")
