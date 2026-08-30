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
    if route.path
    for method in (route.methods or ())
]
for expected in EXPECTED_INSTALLER_ROUTES:
    assert route_keys.count(expected) == 1, f"expected exactly one installed route: {expected}"

route_snapshot = sorted(
    (route.path, tuple(sorted(route.methods or ())), route.name)
    for route in server.app.routes
    if route.path
)
assert _digest(route_snapshot) == "3b2f8960d59d9b8588d29e90f1a23cffc539b5476224c99d1fcc3cbd3e8324b0"
assert _digest(server.app.openapi()) == "a4c54893f22909963965e8d4b3d6a5c1186a3dd7d64370cd5d1d446963d2d5e9"


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
