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
    if route.path and route.path not in {"/api/result-receipt", "/api/team-victories/personal", "/api/offline-manifest", "/api/archive/offline", "/api/archive", "/api/archive/claims", "/api/archive/puzzle", "/api/referrals", "/api/referrals/invite", "/api/referrals/invite/{code}", "/api/referrals/dismiss", '/api/first-board/assignment', '/api/cron/mozkokalypsa-launch-push', '/api/cron/refresh300-launch-push', '/api/cron/archive-launch-push', '/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event', "/api/admin/quality-snapshot", "/api/account/welcome", "/api/play-session", "/api/play-session/config", "/api/free-order", "/api/free-order/config", "/api/account/snapshot", "/api/product-events", "/api/daily-special", "/api/rankings/daily-special"}
    for method in (route.methods or ())
]
for expected in EXPECTED_INSTALLER_ROUTES:
    assert route_keys.count(expected) == 1, f"expected exactly one installed route: {expected}"

route_snapshot = sorted(
    (route.path, tuple(sorted(route.methods or ())), route.name)
    for route in server.app.routes
    if route.path and route.path not in {"/api/result-receipt", "/api/team-victories/personal", "/api/offline-manifest", "/api/archive/offline", "/api/archive", "/api/archive/claims", "/api/archive/puzzle", "/api/referrals", "/api/referrals/invite", "/api/referrals/invite/{code}", "/api/referrals/dismiss", '/api/first-board/assignment', '/api/cron/mozkokalypsa-launch-push', '/api/cron/refresh300-launch-push', '/api/cron/archive-launch-push', '/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event', "/api/admin/quality-snapshot", "/api/account/welcome", "/api/play-session", "/api/play-session/config", "/api/free-order", "/api/free-order/config", "/api/account/snapshot", "/api/product-events", "/api/daily-special", "/api/rankings/daily-special"}
)
# Round III adds exactly four /api/mozkokalypsa3 routes. Removing those
# additions reproduces the prior 7da3e64c digest, including both weekly-team routes.
assert _digest(route_snapshot) == "9f8cb87c1786afdfd7bb04be8f595bcb62d8248b8cdedfdeb020cd32f25c6e4b"
openapi_contract = json.loads(json.dumps(server.app.openapi()))
# Offline publication adds read-only routes; preserve the original API digest.
for offline_path in ("/api/result-receipt", "/api/team-victories/personal", "/api/offline-manifest", "/api/archive/offline"):
    assert set(openapi_contract["paths"][offline_path]) == {"get"}
    openapi_contract["paths"].pop(offline_path)
# Referral release is additive; keep every historical route/schema in the digest.
# New routes and optional signup attribution have dedicated ASGI/SQL tests.
referral_paths = {
    "/api/referrals": {"get"},
    "/api/referrals/invite": {"post"},
    "/api/referrals/invite/{code}": {"get"},
    "/api/referrals/dismiss": {"post"},
}
assert {p for p in openapi_contract["paths"] if p.startswith("/api/referrals")} == set(referral_paths)
for referral_path, methods in referral_paths.items():
    assert set(openapi_contract["paths"][referral_path]) == methods
    openapi_contract["paths"].pop(referral_path)
# RecoveryReset inherits AuthCallback; the additive optional field is inert there.
for signup_model in ("PlayerCreate", "AuthCallback", "RecoveryReset"):
    schema = openapi_contract["components"]["schemas"][signup_model]
    assert "inviteCode" not in schema.get("required", [])
    code_schema = schema["properties"].pop("inviteCode")
    assert code_schema.get("default") is None
    assert {"type": "null"} in code_schema["anyOf"]
    string_schema = next(item for item in code_schema["anyOf"] if item.get("type") == "string")
    assert string_schema == {"type": "string", "minLength": 8, "maxLength": 80, "pattern": "^[A-Za-z0-9_-]+$"}

# Archive is additive and has finite-cover, gate, identity and auth tests.
for archive_path in ("/api/archive", "/api/archive/claims", "/api/archive/puzzle"):
    assert set(openapi_contract["paths"][archive_path]) == {"get"}
    openapi_contract["paths"].pop(archive_path)
archive_result_schema = openapi_contract["components"]["schemas"]["ResultCreate"]
assert "archive_solution" not in archive_result_schema.get("required", [])
archive_result_schema["properties"].pop("archive_solution")
for archive_model in ("ArchiveSolution", "ArchiveTrace"):
    openapi_contract["components"]["schemas"].pop(archive_model)

# Additive optional Daily routes have dedicated ASGI/identity/timing tests.
for special_path in ("/api/daily-special", "/api/rankings/daily-special"):
    assert set(openapi_contract["paths"][special_path]) == {"get"}
    openapi_contract["paths"].pop(special_path)
shared_kind = next(item for item in openapi_contract["paths"]["/api/shared-puzzle"]["get"]["parameters"] if item["name"] == "kind")
assert shared_kind["schema"]["pattern"] == "^(daily|daily_special|tajenka)$"
shared_kind["schema"]["pattern"] = "^(daily|tajenka)$"
# Declared special hashes are optional for cached legacy result clients.
result_schema = openapi_contract["components"]["schemas"]["ResultCreate"]
assert "content_hash" not in result_schema.get("required", [])
hash_schema = next(item for item in result_schema["properties"]["content_hash"]["anyOf"] if item.get("type") == "string")
assert hash_schema == {"type": "string", "minLength": 64, "maxLength": 64, "pattern": "^[0-9a-f]{64}$"}
result_schema["properties"].pop("content_hash")
# Offline clients may only lower timing trust. This optional boolean preserves
# compatibility with older cached clients; all pre-existing fields stay hashed.
assert "timing_unverified" not in result_schema.get("required", [])
assert result_schema["properties"].pop("timing_unverified") == {
    "type": "boolean", "title": "Timing Unverified", "default": False,
}



# The one-off authenticated campaign is covered by test_content_launch_push.
assert set(openapi_contract["paths"]["/api/cron/mozkokalypsa-launch-push"]) == {"get"}
openapi_contract["paths"].pop("/api/cron/mozkokalypsa-launch-push")
assert set(openapi_contract["paths"]["/api/cron/refresh300-launch-push"]) == {"get"}
openapi_contract["paths"].pop("/api/cron/refresh300-launch-push")
assert set(openapi_contract["paths"]["/api/cron/archive-launch-push"]) == {"get"}
openapi_contract["paths"].pop("/api/cron/archive-launch-push")
assert "/api/admin/quality-snapshot" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/admin/quality-snapshot")
assert "/api/account/welcome" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/account/welcome")
assert "/api/account/snapshot" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/account/snapshot")
assert "/api/product-events" in openapi_contract["paths"]
openapi_contract["paths"].pop("/api/product-events")
for model in ("ProductEventBatch", "ProductEventBatchItem"):
    openapi_contract["components"]["schemas"].pop(model)
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

# Additive allocator has its own isolated HTTP contract in test_first_board_catchup.
assert set(openapi_contract["paths"]["/api/first-board/assignment"]) == {"post"}
openapi_contract["paths"].pop("/api/first-board/assignment")
openapi_contract["components"]["schemas"].pop("AssignmentRequest")

# Diagnostic provenance adds only optional fields; the actual route/model boundary
# is covered by test_client_error_contract (including rejection and test exclusion).
diag = openapi_contract['components']['schemas']['ClientErrorCreate']
added = {'client_release','client_version','is_test','source_file','source_line','source_column'}
assert set(diag['properties']) == {'code','message','route'} | added
assert not (set(diag.get('required', [])) & added)
assert diag['properties']['is_test']['default'] is False
for field in ('source_line','source_column'):
    bounded = next(v for v in diag['properties'][field]['anyOf'] if v.get('type') == 'integer')
    assert bounded['minimum'] == 1 and bounded['maximum'] == 1000000
for field in added:
    diag['properties'].pop(field)

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

