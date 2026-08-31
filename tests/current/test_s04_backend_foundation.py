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
        if route.path
    )
    return hashlib.sha256(
        json.dumps(routes, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


# The route inventory, including versioned compatibility routes, is part of the
# deployment contract.  This is the baseline captured before extraction.
assert _route_snapshot() == "3b2f8960d59d9b8588d29e90f1a23cffc539b5476224c99d1fcc3cbd3e8324b0"
assert server.app.docs_url is None
assert server.app.redoc_url is None
assert server.app.openapi_url is None
openapi_contract = server.app.openapi()
assert openapi_contract["info"]["version"] == server.APP_VERSION
# Release publication changes APP_VERSION without changing the HTTP schema.
# Normalize only that metadata field back to the characterization baseline;
# every path, method, component and field remains covered by the same digest.
openapi_contract = json.loads(json.dumps(openapi_contract))
openapi_contract["info"]["version"] = "4.01.37"
openapi_snapshot = json.dumps(
    openapi_contract, ensure_ascii=False, sort_keys=True, separators=(",", ":")
)
assert hashlib.sha256(openapi_snapshot.encode("utf-8")).hexdigest() == (
    "9887b465b1d3f53ae6c3dcadf2c4ca11fc988d486b8882138ec180bf90948854"
)


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
    response_fixtures = json.dumps(
        {
            "config": server.config(),
            "health": server.health(),
            "push": server.push_config(),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
assert hashlib.sha256(response_fixtures.encode("utf-8")).hexdigest() == (
    "73caf7437c52b8826d55f44b27761da7681183ef3ae8a6d07047f8de16ec26d0"
)


print("Sprint 04 characterization contracts: PASS")
