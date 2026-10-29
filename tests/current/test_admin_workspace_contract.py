"""Ensure admin normalization cannot hide an unapproved HTTP contract change."""
from copy import deepcopy
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI
import server
from admin_recovery import install_admin_recovery
from admin_workspace_contract import normalize_admin_workspace, normalize_admin_routes


def rejected(contract):
    try:
        normalize_admin_workspace(contract)
    except (AssertionError, KeyError):
        return
    raise AssertionError("Normalizer accepted an unapproved admin contract change")


original = server.app.openapi()
local = deepcopy(original)
normalize_admin_workspace(local)
assert "/api/admin/users" in local["paths"]
assert "/api/admin/reports" in local["paths"]
assert "/api/admin/workspace" not in local["paths"]

changed = deepcopy(original)
param = next(p for p in changed["paths"]["/api/admin/teams"]["get"]["parameters"] if p["name"] == "limit")
param["schema"]["maximum"] = 201
rejected(changed)

changed = deepcopy(original)
param = next(p for p in changed["paths"]["/api/admin/users"]["get"]["parameters"] if p["name"] == "offset")
param["required"] = True
rejected(changed)

changed = deepcopy(original)
changed["paths"]["/api/admin/unreviewed"] = {"delete": {}}
rejected(changed)

# Pre-existing fields stay in the historical digest, rather than being normalized.
changed = deepcopy(original)
param = next(p for p in changed["paths"]["/api/admin/users"]["get"]["parameters"] if p["name"] == "q")
param["schema"]["maxLength"] = 81
normalize_admin_workspace(changed)
assert changed["paths"]["/api/admin/users"] != local["paths"]["/api/admin/users"]

# Exercise the deployed-only recovery delta without creating sessions or making I/O.
app = FastAPI()
noop = lambda *args, **kwargs: []
install_admin_recovery(app, supabase_url="https://example.invalid", supabase_key="test",
    tz=ZoneInfo("Europe/Prague"), db_select=noop, db_rpc=None,
    auth_player=noop, enforce_rate_limit=noop)
recovery = app.openapi()
deployed = deepcopy(original)
deployed["paths"].update(recovery["paths"])
deployed["components"]["schemas"].update(recovery["components"]["schemas"])
normalized_deployed = deepcopy(deployed)
normalize_admin_workspace(normalized_deployed)
assert normalized_deployed == local, "Deployed recovery normalizes to exactly the same historical surface"

changed = deepcopy(deployed)
changed["components"]["schemas"]["AdminRecoveryEmailRequest"]["properties"]["confirmationToken"]["minLength"] = 0
rejected(changed)
changed = deepcopy(deployed)
changed["paths"]["/api/admin/users/{player_id}/recovery-email"]["post"]["requestBody"]["required"] = False
rejected(changed)

inventory = [(r.path, tuple(sorted(r.methods or ())), r.name) for r in server.app.routes if r.path]
normalized = normalize_admin_routes(inventory)
assert ("/api/admin/users", ("GET",), "admin_users") in normalized
try:
    normalize_admin_routes([r for r in inventory if r[0] != "/api/admin/users"])
except AssertionError:
    pass
else:
    raise AssertionError("Normalizer silently discarded a removed historical route")

print("PASS admin HTTP normalization: exact additions, bound/required drift, deployed recovery, historical preservation")
