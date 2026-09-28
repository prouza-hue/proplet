"""Sprint 06 contracts for explicit backend dependency assembly.

The route and OpenAPI digests are the pre-refactor launch contract.  The
installer assertions make the dependency boundary reviewable: feature modules
must receive callbacks from one explicit assembly point, never from a caller's
frame globals.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
from unittest.mock import DEFAULT, patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def _digest(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


account_auth_source = (ROOT / "account_auth.py").read_text(encoding="utf-8")
server_source = (ROOT / "server.py").read_text(encoding="utf-8")

# This is intentionally a source-level characterization so it fails before
# production code changes, even when the optional test virtualenv is absent.
assert "import inspect" not in account_auth_source
assert "currentframe" not in account_auth_source
assert "f_back" not in account_auth_source
assert "f_globals" not in account_auth_source
assert "class AppServices" in account_auth_source
assert "AppServices(" in server_source

import server  # noqa: E402
import account_auth  # noqa: E402


EXPECTED_INSTALLER_ROUTES = (
    ("GET", "/api/account/auth-status"),
    ("POST", "/api/account/display-name"),
    ("POST", "/api/account/email/start"),
    ("POST", "/api/account/email/verify"),
    ("POST", "/api/auth/recovery/start"),
    ("POST", "/api/auth/recovery/check"),
    ("POST", "/api/auth/recovery/reset"),
    ("GET", "/api/auth/google/start"),
    ("POST", "/api/auth/google/complete"),
    ("POST", "/api/login-integrity"),
    ("GET", "/api/admin/account-integrity"),
    ("POST", "/api/push/open"),
    ("GET", "/api/cron/daily-push-v2"),
    ("POST", "/api/push/test"),
    ("GET", "/api/admin/push-diagnostics"),
    ("GET", "/api/word-recognition"),
    ("GET", "/api/word-recognition/status"),
    ("GET", "/api/word-discovery/status"),
    ("POST", "/api/word-discovery/claim"),
    ("POST", "/api/challenge-event"),
    ("GET", "/api/account-bonus/status"),
    ("POST", "/api/account-bonus/claim"),
    ("POST", "/api/account-bonus-event"),
    ("GET", "/api/rescue-status"),
    ("POST", "/api/rescue/start"),
    ("POST", "/api/rescue/finish"),
)

route_keys = [
    (method, route.path)
    for route in server.app.routes
    if route.path and route.path not in {'/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event', "/api/admin/quality-snapshot", "/api/account/welcome", "/api/play-session", "/api/play-session/config", "/api/free-order", "/api/free-order/config"}
    for method in (route.methods or ())
]
for expected in EXPECTED_INSTALLER_ROUTES:
    assert route_keys.count(expected) == 1, f"expected exactly one installed route: {expected}"

route_snapshot = sorted(
    (route.path, tuple(sorted(route.methods or ())), route.name)
    for route in server.app.routes
    if route.path and route.path not in {'/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event', "/api/admin/quality-snapshot", "/api/account/welcome", "/api/play-session", "/api/play-session/config", "/api/free-order", "/api/free-order/config"}
)
# Round III adds exactly four /api/mozkokalypsa3 routes. Removing those
# additions reproduces the prior 7da3e64c digest, including both weekly-team routes.
assert _digest(route_snapshot) == "9f8cb87c1786afdfd7bb04be8f595bcb62d8248b8cdedfdeb020cd32f25c6e4b"
openapi_contract = json.loads(json.dumps(server.app.openapi()))
assert "/api/admin/quality-snapshot" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/admin/quality-snapshot")
assert "/api/account/welcome" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/account/welcome")
# Additive session endpoints have separate real HTTP/SQL acceptance tests.
for path in ("/api/play-session", "/api/play-session/config"):
    assert path in openapi_contract["paths"]
    openapi_contract["paths"].pop(path)
for model in ("SessionCommand", "Progress", "FoundWord"):
    openapi_contract["components"]["schemas"].pop(model)

assert openapi_contract["info"]["version"] == f"{server.APP_VERSION}-cloud"
openapi_contract["info"]["version"] = "4.01.35-cloud"
# New order API is covered independently; retain the historical API digest.
for order_path in ("/api/free-order", "/api/free-order/config"):
    openapi_contract["paths"].pop(order_path, None)
openapi_contract.get("components", {}).get("schemas", {}).pop("OrderCommand", None)
# Round III is additive and covered by real HTTP/SQL acceptance. Preserve
# the complete older OpenAPI contract, including team and onboarding schemas.
round3_paths = (
    '/api/mozkokalypsa3/status', '/api/mozkokalypsa3/board/{board_id}',
    '/api/mozkokalypsa3/open/{board_id}', '/api/mozkokalypsa3/event',
)
assert {p for p in openapi_contract['paths'] if p.startswith('/api/mozkokalypsa3/')} == set(round3_paths)
round3_schema = openapi_contract['paths']['/api/mozkokalypsa3/event']['post']['requestBody']['content']['application/json']['schema']['$ref'].rsplit('/', 1)[-1]
round2_schema = openapi_contract['paths']['/api/mozkokalypsa/event']['post']['requestBody']['content']['application/json']['schema']['$ref'].rsplit('/', 1)[-1]
assert round3_schema != round2_schema
for round3_path in round3_paths:
    openapi_contract['paths'].pop(round3_path)
# Resolve names from exact request refs: Pydantic may qualify both Event models.
schemas = openapi_contract['components']['schemas']
schemas.pop(round3_schema)
if round2_schema != 'Event':
    schemas['Event'] = schemas.pop(round2_schema)

# Invite-only pilot has its own HTTP and frozen-content boundary tests.
for pilot_path in ('/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event'):
    openapi_contract["paths"].pop(pilot_path, None)
openapi_contract.get("components", {}).get("schemas", {}).pop("Event", None)

openapi_digest = _digest(openapi_contract)
# Weekly trophies add those two paths and the Seen request schema.
# Removing only these additions reproduces prior OpenAPI digest c0d9ee3b.
# Tajenka v2 intentionally extends the API schema while preserving the route inventory.
# Only the candidate database description now covers Gen4 and Gen5 preview branches;
# restoring the Gen4-only description reproduces the former 70d48981 digest.
assert openapi_digest == "1f690ed5cfb2d83c8ac173726dc77cb52f11ccb977877243cc5db8a1cc401a4c", f"current OpenAPI digest: {openapi_digest}"


# A fake-service assembly proves feature modules remain independently testable
# and that the production assembly preserves the historical installer order.
fake = object()
services = account_auth.AppServices(
    supabase_url="https://example.invalid",
    supabase_key="secret",
    tz=fake,
    db_select=fake,
    db_insert=fake,
    db_update=fake,
    db_delete=fake,
    auth_player=fake,
    new_session=fake,
    hash_password=fake,
    verify_password=fake,
    enforce_rate_limit=fake,
    player_stats=fake,
    public_family_code=fake,
    league_name_for=fake,
)
installer_names = (
    "_install_account_auth_core",
    "_install_push_diagnostics",
    "_install_account_integrity",
    "_install_word_recognition",
    "_install_competitive_sharing",
    "_install_account_bonus",
    "_install_rescue_limit_v40115",
    "_install_preview_auth_v334",
)
with patch.multiple(account_auth, **{name: DEFAULT for name in installer_names}) as installers:
    calls = []
    for name, installer in installers.items():
        installer.side_effect = lambda *args, _name=name, **kwargs: calls.append(_name)
    account_auth.install_account_auth(object(), services=services)
    assert tuple(calls) == installer_names
    assert installers["_install_push_diagnostics"].call_args.kwargs["db_rpc"] is None
    assert installers["_install_word_recognition"].call_args.kwargs["resolved_puzzle"] is None

print("PASS: Sprint 06 explicit dependency and route/OpenAPI characterization")
