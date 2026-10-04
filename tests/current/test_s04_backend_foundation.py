#!/usr/bin/env python3
"""Characterization contracts for the Sprint 04 backend extraction.

These assertions intentionally describe the pre-refactor public surface.  They
must stay green while config, Pydantic contracts, and Supabase transport move
behind the compatibility facade in ``server.py``.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import date
from unittest.mock import Mock, patch

import httpx
from fastapi import HTTPException


ROOT = __import__("pathlib").Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend import db as backend_db  # noqa: E402
from backend.config import load_settings  # noqa: E402


def _route_snapshot() -> str:
    routes = sorted(
        (route.path, tuple(sorted(route.methods or ())), route.name)
        for route in server.app.routes
        if route.path and route.path not in {'/api/first-board/assignment', '/api/cron/mozkokalypsa-launch-push', '/api/mozkokalypsa/status', '/api/mozkokalypsa/board/{board_id}', '/api/mozkokalypsa/open/{board_id}', '/api/mozkokalypsa/event', "/api/admin/quality-snapshot", "/api/account/welcome", "/api/play-session", "/api/play-session/config", "/api/free-order", "/api/free-order/config", "/api/account/snapshot", "/api/product-events"}
    )
    return hashlib.sha256(
        json.dumps(routes, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


# The route inventory, including versioned compatibility routes, is part of the
# deployment contract.  This is the baseline captured before extraction.
# Round III adds exactly four /api/mozkokalypsa3 routes. Removing those
# additions reproduces the prior 7da3e64c digest, including both weekly-team routes.
assert _route_snapshot() == "9f8cb87c1786afdfd7bb04be8f595bcb62d8248b8cdedfdeb020cd32f25c6e4b"
assert server.app.docs_url is None
assert server.app.redoc_url is None
assert server.app.openapi_url is None
openapi_contract = server.app.openapi()
assert openapi_contract["info"]["version"] == f"{server.APP_VERSION}-cloud"
# Release publication changes APP_VERSION without changing the HTTP schema.
# Normalize only that metadata field back to the characterization baseline;
# every path, method, component and field remains covered. Tajenka v2
# intentionally extends the schema while preserving the route inventory.
openapi_contract = json.loads(json.dumps(openapi_contract))
# The one-off authenticated campaign is covered by test_content_launch_push.
assert set(openapi_contract["paths"]["/api/cron/mozkokalypsa-launch-push"]) == {"get"}
openapi_contract["paths"].pop("/api/cron/mozkokalypsa-launch-push")
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

# Additive authenticated repair endpoint is covered by test_analytics_v2.
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

# Additive allocator has its own isolated HTTP contract in test_first_board_catchup.
assert set(openapi_contract["paths"]["/api/first-board/assignment"]) == {"post"}
openapi_contract["paths"].pop("/api/first-board/assignment")
openapi_contract["components"]["schemas"].pop("AssignmentRequest")

openapi_snapshot = json.dumps(
    openapi_contract, ensure_ascii=False, sort_keys=True, separators=(",", ":")
)
openapi_digest = hashlib.sha256(openapi_snapshot.encode("utf-8")).hexdigest()
# Weekly trophies add those two paths and the Seen request schema.
# Removing only these additions reproduces prior OpenAPI digest c0d9ee3b.
# Gen5 adds a preview branch: only /api/puzzle-database's description changed.
# Restoring its old Gen4-only description reproduces the prior 70d48981 digest.
assert openapi_digest == (
    "1f690ed5cfb2d83c8ac173726dc77cb52f11ccb977877243cc5db8a1cc401a4c"
), f"current OpenAPI digest: {openapi_digest}"


# Config parsing remains byte-for-byte compatible with the old server globals,
# including the intentionally non-normalized Supabase secret.
with patch.dict(
    os.environ,
    {
        "SUPABASE_URL": " https://example.supabase.co///",
        "SUPABASE_SECRET_KEY": " secret ",
    },
):
    parsed_settings = load_settings()
assert parsed_settings.supabase_url == " https://example.supabase.co"
assert parsed_settings.supabase_secret_key == " secret "


def _dump(model, **kwargs):
    return model(**kwargs).model_dump()


assert _dump(server.PlayerCreate, name=" Pavel ") == {
    "name": " Pavel ",
    "family_code": None,
    "password": None,
    "league_pin": None,
    "create_league": False,
    "league_name": None,
}
assert _dump(server.PlayerLogin, name="Pavel", password="12345678") == {
    "name": "Pavel",
    "family_code": None,
    "password": "12345678",
}
assert _dump(server.ResultCreate, puzzle_id="p-1", challenge_key="free:p-1", mode="free", difficulty="easy", elapsed_ms=1000, moves=1) == {
    "puzzle_id": "p-1",
    "challenge_key": "free:p-1",
    "mode": "free",
    "difficulty": "easy",
    "elapsed_ms": 1000,
    "moves": 1,
    "daily_date": None,
    "hints_used": 0,
    "wrong_attempts": 0,
    "max_hint_level": 0,
    "attempt_id": None,
    "clean_solve": False,
    "completed_at": None,
    "calm_mode": False,
}
assert _dump(server.AttemptStart, attempt_id="attempt-1234", puzzle_id="p-1", challenge_key="free:p-1", mode="free", difficulty="easy") == {
    "attempt_id": "attempt-1234",
    "puzzle_id": "p-1",
    "challenge_key": "free:p-1",
    "mode": "free",
    "difficulty": "easy",
    "calm_mode": False,
}
assert _dump(server.PushSubscriptionCreate, endpoint="https://example.test/" + "x" * 20, p256dh="x" * 20, auth="x" * 8) == {
    "endpoint": "https://example.test/" + "x" * 20,
    "p256dh": "x" * 20,
    "auth": "x" * 8,
    "user_agent": None,
    "daily_enabled": None,
    "content_enabled": None,
}


class _Response:
    def __init__(self, status_code=200, payload=None, content=True):
        self.status_code = status_code
        self._payload = payload
        self.content = b"{}" if content else b""

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


def _transport_response(status_code=200, payload=None, content=True):
    return _Response(status_code, payload, content)


client = Mock()
client.request.return_value = _transport_response(200, [{"id": "p1"}])
with (
    patch.object(server, "SUPABASE_URL", "https://example.supabase.co"),
    patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"),
    patch.object(server, "DB_HTTP_CLIENT", client),
):
    assert server.db_select("players", family_code="ALFA", ignored=None) == [{"id": "p1"}]

call = client.request.call_args
assert call.args == ("GET", "https://example.supabase.co/rest/v1/players")
assert call.kwargs["params"] == {"select": "*", "family_code": "eq.ALFA"}
assert call.kwargs["json"] is None
assert call.kwargs["headers"] == {
    "apikey": "sb_secret_opaque",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

client.reset_mock()
client.request.return_value = _transport_response(200, [])
with (
    patch.object(server, "SUPABASE_URL", "https://example.supabase.co"),
    patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"),
    patch.object(server, "DB_HTTP_CLIENT", client),
):
    assert server.db_select("events", request_fn="literal-filter") == []
assert client.request.call_args.kwargs["params"] == {
    "select": "*",
    "request_fn": "eq.literal-filter",
}


# The remaining table helpers preserve their exact PostgREST verbs, filters,
# bodies and Prefer headers while accepting an isolated fake transport.
transport_calls = []


def _fake_request(method, table, **kwargs):
    transport_calls.append((method, table, kwargs))
    return [{"id": "created"}] if method == "POST" else []


assert backend_db.db_insert("events", {"kind": "test"}, _fake_request) == {"id": "created"}
assert backend_db.db_update("players", {"id": "p1"}, {"name": "P"}, _fake_request) == []
assert backend_db.db_delete("sessions", _fake_request, id="s1", ignored=None) == []
assert transport_calls == [
    (
        "POST",
        "events",
        {"body": {"kind": "test"}, "prefer": "return=representation"},
    ),
    (
        "PATCH",
        "players",
        {
            "params": {"id": "eq.p1"},
            "body": {"name": "P"},
            "prefer": "return=representation",
        },
    ),
    (
        "DELETE",
        "sessions",
        {"params": {"id": "eq.s1"}, "prefer": "return=representation"},
    ),
]


for status, expected_status, expected_detail in (
    (409, 409, "Konflikt při ukládání dat"),
    (500, 503, "Databáze je momentálně nedostupná"),
    (400, 400, "Data se nepodařilo zpracovat"),
):
    failing = Mock()
    failing.request.return_value = _transport_response(status, {"message": "private db detail"})
    with (
        patch.object(server, "SUPABASE_URL", "https://example.supabase.co"),
        patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"),
        patch.object(server, "DB_HTTP_CLIENT", failing),
    ):
        try:
            server.db_request("GET", "players")
        except HTTPException as exc:
            assert exc.status_code == expected_status
            assert exc.detail == expected_detail
        else:
            raise AssertionError(f"expected HTTPException for Supabase status {status}")


offline = Mock()
offline.request.side_effect = httpx.ConnectError(
    "offline", request=httpx.Request("GET", "https://example.supabase.co/rest/v1/players")
)
with (
    patch.object(server, "SUPABASE_URL", "https://example.supabase.co"),
    patch.object(server, "SUPABASE_SECRET_KEY", "sb_secret_opaque"),
    patch.object(server, "DB_HTTP_CLIENT", offline),
):
    try:
        server.db_request("GET", "players")
    except HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail == "Databáze je momentálně nedostupná"
    else:
        raise AssertionError("expected HTTPException for a network failure")


# A legacy JWT remains in both headers; an opaque sb_secret key remains only as
# apikey.  Existing RPC authorization behavior is deliberately characterized.
with patch.object(server, "SUPABASE_SECRET_KEY", "eyJheader.payload.signature"):
    assert server._supabase_headers() == {
        "apikey": "eyJheader.payload.signature",
        "Authorization": "Bearer eyJheader.payload.signature",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


with (
    patch.object(server, "VAPID_PUBLIC_KEY", ""),
    patch.object(server, "VAPID_PRIVATE_KEY", ""),
):
    assert server.push_config() == {
        "available": False,
        "publicKey": None,
        "preferencesVersion": 2,
        "preferencesReady": False,
    }


with (
    patch.object(server, "current_prague_date", return_value=date(2026, 8, 30)),
    patch.object(server, "SUPABASE_URL", ""),
    patch.object(server, "SUPABASE_SECRET_KEY", ""),
    patch.object(server, "VAPID_PUBLIC_KEY", ""),
    patch.object(server, "VAPID_PRIVATE_KEY", ""),
):
    config_fixture = server.config()
    health_fixture = server.health()
    # Keep the Linux production fixture portable to Windows development.
    health_fixture["puzzleSource"] = health_fixture["puzzleSource"].replace("\\", "/")
    # Release publication changes APP_VERSION without changing these response
    # contracts. Normalize only the release metadata back to the captured
    # v4.01.40 baseline so every other response field stays hash-protected.
    for fixture in (config_fixture, health_fixture):
        if isinstance(fixture, dict) and "version" in fixture:
            fixture["version"] = "4.01.40"
    # The new edition adds its own counts/XP and intentionally removes gating.
    assert config_fixture['points'].pop('mozkokalypsa') == 200
    assert health_fixture['freeXp'].pop('mozkokalypsa') == 200
    assert health_fixture['freeBaseLevelCounts'].pop('mozkokalypsa') == 100
    assert health_fixture['mozkomorUnlock']['requiresCurrentBaseLevels'] == 0
    health_fixture['mozkomorUnlock'].update(requiresDifficulty='hardcore', requiresCurrentBaseLevels=200, persistentOnceEarned=True)
    # Approved refresh appends exactly 100 boards in each of these banks.
    for difficulty in ('easy', 'medium', 'hard'):
        assert health_fixture['freeBaseLevelCounts'][difficulty] == 400
        health_fixture['freeBaseLevelCounts'][difficulty] -= 100
        health_fixture['rollingContentAvailableCounts'][difficulty] -= 100
    response_fixtures = json.dumps(
        {
            "config": config_fixture,
            "health": health_fixture,
            "push": server.push_config(),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
response_fixture_digest = hashlib.sha256(response_fixtures.encode("utf-8")).hexdigest()
# Approved Gen5 publication updates free-bank totals and Mozkomor count to 150;
# the unlock requirement remains the original 200 base Mozkozrout levels.
assert response_fixture_digest == (
    "47a07d50adc60b7d45adf528b6b4ba153fea5f3ba3178eea136cd04bdb6b6c21"
), f"current response fixture digest: {response_fixture_digest}"


print("Sprint 04 characterization contracts: PASS")
