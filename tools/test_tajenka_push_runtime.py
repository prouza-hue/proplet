import json
import os
import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import push_diagnostics_v3329 as push_module


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
current_day = [date(2026, 8, 29)]


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
    current_prague_date=lambda: current_day[0],
    released_batches=lambda _today: ([], []),
)

route = next(route for route in app.routes if getattr(route, "path", None) == "/api/cron/daily-push-v2")

# Historical first Saturday still sends puzzle 1.
first = route.endpoint(None, "Bearer test-secret")
assert first["ok"] is True
assert first["date"] == "2026-08-29"
assert first["category"] == "tajenka"
assert first["tajenka"] == "tajenka-v2-week-01"
assert first["eventKey"] == "tajenka:tajenka-v2-week-01"
assert first["sent"] == 1
assert len(sent_payloads) == 1
payload = sent_payloads[0]
assert payload["title"] == "✨ Nová Tajenka je tady"
assert "200 XP" in payload["body"]
assert payload["url"] == "https://hrajproplet.cz/?open=tajenka&via=push-tajenka"

# Repeating the same cron event is idempotent.
second = route.endpoint(None, "Bearer test-secret")
assert second["category"] == "tajenka"
assert second["tajenka"] == "tajenka-v2-week-01"
assert second["sent"] == 0
assert second["duplicate"] == 1
assert len(sent_payloads) == 1

# Once the new cadence starts, Wednesday is a real release day.
current_day[0] = date(2026, 9, 16)
wednesday = route.endpoint(None, "Bearer test-secret")
assert wednesday["ok"] is True
assert wednesday["date"] == "2026-09-16"
assert wednesday["category"] == "tajenka"
assert wednesday["tajenka"] == "tajenka-v2-week-04"
assert wednesday["eventKey"] == "tajenka:tajenka-v2-week-04"
assert wednesday["sent"] == 1
assert len(sent_payloads) == 2
assert sent_payloads[-1]["title"] == "✨ Nová Tajenka je tady"

print("PASS: Tajenka push is idempotent and releases on Saturday + Wednesday")
