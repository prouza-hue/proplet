import json
import os
import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import push_diagnostics_v3329 as push_module


# Exercise the first scheduled Tajenka Saturday with the production gate enabled.
os.environ["CRON_SECRET"] = "test-secret"
os.environ["VAPID_PUBLIC_KEY"] = "public"
os.environ["VAPID_PRIVATE_KEY"] = "private"
os.environ["VERCEL_ENV"] = "production"
os.environ["PROPLET_TAJENKA_RELEASE_ENABLED"] = "1"

tables = {
    "push_subscriptions": [{
        "id": "sub-1",
        "player_id": "player-1",
        "anonymous_id": None,
        "endpoint": "https://push.example/sub-1",
        "p256dh": "key",
        "auth": "auth",
        "daily_enabled": True,
        "content_enabled": True,
    }],
    "push_delivery_log": [],
    "results": [],
    "puzzle_attempts": [],
}
sent_payloads = []


def db_select(table, **filters):
    return [
        row.copy()
        for row in tables.get(table, [])
        if all(row.get(key) == value for key, value in filters.items())
    ]


def db_insert(table, row):
    tables.setdefault(table, []).append(row.copy())
    return row


def db_update(table, filters, body):
    for row in tables.get(table, []):
        if all(row.get(key) == value for key, value in filters.items()):
            row.update(body)


def db_delete(table, **filters):
    tables[table] = [
        row for row in tables.get(table, [])
        if not all(row.get(key) == value for key, value in filters.items())
    ]


def fake_webpush(**kwargs):
    sent_payloads.append(json.loads(kwargs["data"]))


push_module.webpush = fake_webpush
app = FastAPI()
push_module.install_push_diagnostics(
    app,
    tz=push_module.datetime.now().astimezone().tzinfo,
    db_select=db_select,
    db_insert=db_insert,
    db_update=db_update,
    db_delete=db_delete,
    auth_player=lambda _auth: {"id": "player-1"},
    enforce_rate_limit=lambda *_args, **_kwargs: None,
    current_prague_date=lambda: date(2026, 8, 29),
    released_batches=lambda _today: ([], []),
)

route = next(route for route in app.routes if getattr(route, "path", None) == "/api/cron/daily-push-v2")
first = route.endpoint(None, "Bearer test-secret")

assert first["ok"] is True
assert first["date"] == "2026-08-29"
assert first["category"] == "tajenka"
assert first["tajenka"] == "tajenka-week-01"
assert first["eventKey"] == "tajenka:tajenka-week-01"
assert first["sent"] == 1
assert len(sent_payloads) == 1
payload = sent_payloads[0]
assert payload["title"] == "✨ Víkendová Tajenka je tady"
assert "200 XP" in payload["body"]
assert payload["url"] == "https://hrajproplet.cz/?open=tajenka&via=push-tajenka"
assert tables["push_delivery_log"][0]["category"] == "tajenka"
assert tables["push_delivery_log"][0]["event_key"] == "tajenka:tajenka-week-01"
assert tables["push_delivery_log"][0]["status"] == "sent"

# A retry of the same cron event is idempotent at delivery level.
second = route.endpoint(None, "Bearer test-secret")
assert second["category"] == "tajenka"
assert second["tajenka"] == "tajenka-week-01"
assert second["sent"] == 0
assert second["duplicate"] == 1
assert len(sent_payloads) == 1

print("PASS: Tajenka week 1 push sends 200 XP copy and is idempotent on repeat.")
