#!/usr/bin/env python3
"""Characterize the current admin push-diagnostics response before query bounding."""

from datetime import timezone

from fastapi import FastAPI
from starlette.requests import Request

from push_diagnostics_v3329 import install_push_diagnostics


rows = {
    "admin_accounts": [{"player_id": "admin", "active": True}],
    "players": [{"id": "admin", "name": "Admin"}, {"id": "p1", "name": "Pavel"}],
    "push_subscriptions": [
        {"id": "s1", "player_id": "p1", "endpoint": "https://push.example/a", "user_agent": "Chrome/1", "daily_enabled": True, "content_enabled": False, "created_at": "2026-08-30T10:00:00+00:00", "updated_at": "2026-09-01T10:00:00+00:00"},
        {"id": "s2", "anonymous_id": "anon", "endpoint": "https://push.example/b", "user_agent": "Safari/1", "daily_enabled": False, "content_enabled": True, "created_at": "2026-08-31T10:00:00+00:00", "updated_at": "2026-09-01T11:00:00+00:00"},
    ],
    "push_delivery_log": [
        {"id": "l1", "category": "daily", "event_key": "daily:2026-09-01", "status": "sent", "created_at": "2026-09-01T07:00:00+00:00", "sent_at": "2026-09-01T07:00:01+00:00", "opened_at": "2026-09-01T07:10:00+00:00"},
        {"id": "l2", "category": "return", "event_key": "daily:2026-09-01", "status": "failed", "created_at": "2026-09-01T07:00:02+00:00"},
        {"id": "l3", "category": "test", "event_key": "test:1", "status": "sent", "created_at": "2026-09-01T12:00:00+00:00", "sent_at": "2026-09-01T12:00:01+00:00"},
    ],
}


def db_select(table, **filters):
    result = list(rows.get(table, []))
    for key, value in filters.items():
        result = [row for row in result if row.get(key) == value]
    return result


app = FastAPI()
install_push_diagnostics(
    app,
    tz=timezone.utc,
    db_select=db_select,
    db_insert=lambda *args, **kwargs: None,
    db_update=lambda *args, **kwargs: None,
    db_delete=lambda *args, **kwargs: None,
    auth_player=lambda _auth: rows["players"][0],
    enforce_rate_limit=lambda *args, **kwargs: None,
)
endpoint = next(route.endpoint for route in app.routes if route.path == "/api/admin/push-diagnostics")
request = Request({"type": "http", "method": "GET", "path": "/api/admin/push-diagnostics", "headers": []})
payload = endpoint(request, None)

assert payload["auditingSinceVersion"] == "3.32.9"
assert payload["latestDaily"]["eventKey"] == "daily:2026-09-01"
assert payload["latestDaily"]["eligible"] == 2
assert payload["latestDaily"]["sent"] == 1
assert payload["latestDaily"]["failed"] == 1
assert payload["latestDaily"]["opened"] == 1
assert payload["latestDaily"]["returnTargeted"] == 1
assert payload["subscriptions"]["total"] == 2
assert payload["subscriptions"]["dailyEnabled"] == 1
assert payload["subscriptions"]["contentEnabled"] == 1
assert payload["subscriptions"]["rows"][1]["playerName"] == "Pavel"
assert payload["tests"]["total"] == 1
assert payload["tests"]["recent"][0]["status"] == "sent"

print("PASS: final-debt push diagnostics response characterized")
