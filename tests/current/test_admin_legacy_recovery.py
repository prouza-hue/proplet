"""Security regression checks for owner-assisted legacy account recovery."""

from __future__ import annotations

import copy
import hashlib
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from admin_recovery import ADMIN_OWNER_PLAYER_ID, install_admin_recovery


OWNER_TOKEN = "owner-token"
OTHER_TOKEN = "other-token"
TARGET_ID = "804350ee-8fd9-4a4c-b9ab-9bbc7c75e7aa"
DUPLICATE_ID = "8e071eba-05ae-4923-ae00-2ace0048b4a2"
VERIFIED_ID = "00000000-0000-0000-0000-000000000099"
TZ = ZoneInfo("Europe/Prague")


def build_fixture():
    tables = {
        "players": [
            {"id": ADMIN_OWNER_PLAYER_ID, "name": "Pavel", "email": "owner@example.com", "email_verified_at": "2026-08-17T21:33:46+00:00"},
            # Deliberately give the non-owner a database owner grant below. The
            # immutable deployed owner pin must still reject this account.
            {"id": "00000000-0000-0000-0000-000000000002", "name": "Other admin"},
            {"id": TARGET_ID, "name": "slaytana", "email": None, "email_verified_at": None},
            {"id": DUPLICATE_ID, "name": "slaytana", "email": None, "email_verified_at": None},
            {"id": VERIFIED_ID, "name": "Verified", "email": "used@example.com", "email_verified_at": "2026-09-01T10:00:00+00:00"},
        ],
        "admin_accounts": [
            {"player_id": ADMIN_OWNER_PLAYER_ID, "role": "owner", "active": True},
            {"player_id": "00000000-0000-0000-0000-000000000002", "role": "owner", "active": True},
        ],
        "account_auth_challenges": [],
        "admin_audit_log": [],
    }
    sent = []
    rate_calls = []

    def db_select(table: str, **filters):
        rows = tables.get(table, [])
        return [
            copy.deepcopy(row)
            for row in rows
            if all(row.get(key) == value for key, value in filters.items())
        ]

    def db_insert(table: str, row: dict):
        tables.setdefault(table, []).append(copy.deepcopy(row))
        return copy.deepcopy(row)

    def db_update(table: str, filters: dict, values: dict):
        changed = []
        for row in tables.get(table, []):
            if all(row.get(key) == value for key, value in filters.items()):
                row.update(copy.deepcopy(values))
                changed.append(copy.deepcopy(row))
        return changed

    def auth_player(authorization):
        token = str(authorization or "").removeprefix("Bearer ")
        if token == OWNER_TOKEN:
            return copy.deepcopy(tables["players"][0])
        if token == OTHER_TOKEN:
            return copy.deepcopy(tables["players"][1])
        raise HTTPException(401, "bad auth")

    def enforce_rate_limit(request, scope, **kwargs):
        rate_calls.append((scope, kwargs))

    class Response:
        status_code = 200

    class FakeHTTPClient:
        status_code = 200

        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def request(self, method, url, **kwargs):
            sent.append({"method": method, "url": url, **kwargs})
            response = Response()
            response.status_code = self.status_code
            return response

    app = FastAPI()

    @app.get("/api/admin/probe")
    def probe():
        return {"ok": True}

    install_admin_recovery(
        app,
        supabase_url="https://example.supabase.co",
        supabase_key="secret",
        tz=TZ,
        db_select=db_select,
        db_insert=db_insert,
        db_update=db_update,
        auth_player=auth_player,
        enforce_rate_limit=enforce_rate_limit,
        strict_owner_lock=True,
        httpx_client_factory=FakeHTTPClient,
    )
    return app, tables, sent, rate_calls, FakeHTTPClient


app, tables, sent, rate_calls, FakeHTTPClient = build_fixture()
client = TestClient(app)
owner_headers = {"Authorization": f"Bearer {OWNER_TOKEN}"}
other_headers = {"Authorization": f"Bearer {OTHER_TOKEN}"}

# The deployed gate is non-delegable: a second active owner DB grant is not enough.
assert client.get("/api/admin/probe", headers=owner_headers).status_code == 200
assert client.get("/api/admin/probe", headers=other_headers).status_code == 403

# A same-name duplicate is irrelevant: the stable player_id is the recovery target.
response = client.post(
    f"/api/admin/users/{TARGET_ID}/recovery-email",
    headers=owner_headers,
    json={"email": "Tana@Outlook.com"},
)
assert response.status_code == 200, response.text
payload = response.json()
assert payload["pending"] is True
assert payload["emailMasked"] == "ta***@outlook.com"
assert TARGET_ID != DUPLICATE_ID
challenge = tables["account_auth_challenges"][-1]
assert challenge["player_id"] == TARGET_ID
assert challenge["purpose"] == "link_email"
assert challenge["email"] == "tana@outlook.com"
assert not challenge.get("used_at")
assert rate_calls[-1][0] == "admin_legacy_recovery_email"
assert rate_calls[-1][1]["discriminator"] == TARGET_ID

# Supabase receives a Magic Link request. The raw challenge exists only in the
# redirect URL; the DB stores its SHA-256 digest.
mail = sent[-1]
assert mail["method"] == "POST"
assert mail["url"].endswith("/auth/v1/otp")
assert mail["json"] == {"email": "tana@outlook.com", "create_user": True}
redirect = mail["params"]["redirect_to"]
assert redirect.startswith("https://hrajproplet.cz/?auth=email-link&challenge=")
raw = parse_qs(urlparse(redirect).query)["challenge"][0]
assert challenge["token_hash"] == hashlib.sha256(raw.encode()).hexdigest()
assert challenge["token_hash"] != raw

# Audit data identifies the account/action but does not retain the full address.
audit = tables["admin_audit_log"][-1]
assert audit["admin_player_id"] == ADMIN_OWNER_PLAYER_ID
assert audit["target_id"] == TARGET_ID
assert audit["action"] == "legacy_recovery_email_requested"
assert "tana@outlook.com" not in repr(audit).lower()

# Status exposes only a masked pending address.
status = client.get(f"/api/admin/users/{TARGET_ID}/recovery-email", headers=owner_headers)
assert status.status_code == 200
status_body = status.json()
assert status_body["pending"] is True
assert status_body["pendingEmailMasked"] == "ta***@outlook.com"
assert "tana@outlook.com" not in status.text.lower()

# A verified address belonging to another player cannot be reassigned.
conflict = client.post(
    f"/api/admin/users/{DUPLICATE_ID}/recovery-email",
    headers=owner_headers,
    json={"email": "used@example.com"},
)
assert conflict.status_code == 409

# Delivery failure closes the newly created challenge instead of leaving a live
# takeover link in the database.
FakeHTTPClient.status_code = 500
failed = client.post(
    f"/api/admin/users/{DUPLICATE_ID}/recovery-email",
    headers=owner_headers,
    json={"email": "fresh@example.com"},
)
assert failed.status_code == 502
failed_challenge = tables["account_auth_challenges"][-1]
assert failed_challenge["player_id"] == DUPLICATE_ID
assert failed_challenge.get("used_at")
assert tables["admin_audit_log"][-1]["action"] == "legacy_recovery_email_delivery_failed"

print("PASS: owner-only legacy recovery, stable target, email ownership and failure cleanup")
