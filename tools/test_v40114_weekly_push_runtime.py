import json
import os
import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import push_diagnostics_v3329 as push_module


os.environ["CRON_SECRET"] = "test-secret"
os.environ["VAPID_PUBLIC_KEY"] = "public"
os.environ["VAPID_PRIVATE_KEY"] = "private"
os.environ["VERCEL_ENV"] = "production"

tables = {
    "push_subscriptions": [{
        "id": "sub-1", "player_id": None, "anonymous_id": "anon-hash",
        "endpoint": "https://push.example/sub-1", "p256dh": "key", "auth": "auth",
        "daily_enabled": True, "content_enabled": True,
    }],
    "push_delivery_log": [],
    "results": [],
    "puzzle_attempts": [],
}
sent_payloads = []


def db_select(table, **filters):
    return [row.copy() for row in tables.get(table, []) if all(row.get(key) == value for key, value in filters.items())]


def db_insert(table, row):
    tables.setdefault(table, []).append(row.copy())
    return row


def db_update(table, filters, body):
    for row in tables.get(table, []):
        if all(row.get(key) == value for key, value in filters.items()):
            row.update(body)


def db_delete(table, **filters):
    tables[table] = [row for row in tables.get(table, []) if not all(row.get(key) == value for key, value in filters.items())]


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
    auth_player=lambda _auth: {"id": "player"},
    enforce_rate_limit=lambda *_args, **_kwargs: None,
    current_prague_date=lambda: date(2026, 8, 31),
    released_batches=lambda _today: ([{"id": "back-to-school", "availableFrom": "2026-08-31"}], []),
)

route = next(route for route in app.routes if getattr(route, "path", None) == "/api/cron/daily-push-v2")
result = route.endpoint(None, "Bearer test-secret")

assert result["ok"] is True
assert result["category"] == "content"
assert result["batch"] == "back-to-school"
assert result["sent"] == 1
assert sent_payloads[0]["url"].endswith("via=push-weekly")
assert tables["push_delivery_log"][0]["anonymous_id"] == "anon-hash"
assert tables["push_delivery_log"][0]["player_id"] is None
assert tables["push_delivery_log"][0]["status"] == "sent"

print("PASS: anonymous Monday push is unified, audited and opens the weekly content CTA.")
