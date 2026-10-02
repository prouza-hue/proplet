"""The release campaign must respect time, consent and atomic send reservations."""
import json
import logging
import os
from datetime import datetime
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException
from mozkokalypsa_launch_push import EVENT_KEY, PAYLOAD, install_launch_push

os.environ.update(CRON_SECRET="test-secret", VERCEL_ENV="production")
tz = ZoneInfo("Europe/Prague")
current = datetime(2026, 10, 2, 9, 59, tzinfo=tz)
subscriptions = [
    dict(id="daily", daily_enabled=True, content_enabled=False),
    dict(id="content", daily_enabled=False, content_enabled=True),
    dict(id="off", daily_enabled=False, content_enabled=False),
    dict(id="dead", daily_enabled=True, content_enabled=True),
    dict(id="failed", daily_enabled=True, content_enabled=True),
    dict(id="ledger-error", daily_enabled=True, content_enabled=False),
]
for sub in subscriptions:
    sub.update(endpoint="https://push.example/" + sub["id"], p256dh="key", auth="auth", player_id=None)
reservations, messages, updates = set(), [], []


def reserve(sub, event, category):
    assert event == EVENT_KEY and category == "content"
    if sub["id"] in reservations:
        return None
    reservations.add(sub["id"])
    return sub["id"]


def send(**kwargs):
    endpoint = kwargs["subscription_info"]["endpoint"]
    if endpoint.endswith("/dead"):
        exc = RuntimeError("gone")
        exc.response = type("Response", (), {"status_code": 410})()
        raise exc
    if endpoint.endswith("/failed"):
        raise RuntimeError("network")
    messages.append(json.loads(kwargs["data"]))


def update(table, filters, values):
    if filters.get("id") == "ledger-error":
        raise RuntimeError("ledger unavailable after provider accepted")
    updates.append((table, filters, values))


app = FastAPI()
install_launch_push(app, tz=tz, push_ready=lambda: True,
                    db_select_bounded=lambda *_args, **_kwargs: subscriptions,
                    reserve_delivery=reserve, db_update=update, webpush=send,
                    vapid_private="private", vapid_subject="https://hrajproplet.cz",
                    logger=logging.getLogger("launch-test"), clock=lambda: current)
route = next(r.endpoint for r in app.routes if r.path == "/api/cron/mozkokalypsa-launch-push")
try:
    route(None, "Bearer wrong", False)
    raise AssertionError("Unauthenticated request must fail")
except HTTPException as exc:
    assert exc.status_code == 401
assert route(None, "Bearer test-secret", False)["skipped"] == "outside-release-window"
assert not messages and not reservations
preview = route(None, "Bearer test-secret", True)
assert preview["eligible"] == 5 and preview["payload"] == PAYLOAD
assert not messages and not reservations
os.environ["VERCEL_ENV"] = "preview"
assert route(None, "Bearer test-secret", False)["skipped"] == "not-production"
os.environ["VERCEL_ENV"] = "production"
current = datetime(2026, 10, 2, 10, 0, tzinfo=tz)
assert current.astimezone(ZoneInfo("UTC")).hour == 8
result = route(None, "Bearer test-secret", False)
assert result["sent"] == 3 and result["removed"] == 1 and result["failed"] == 1
assert "off" not in reservations
assert all(m["body"].endswith("Troufneš si?") and m["deliveryId"] for m in messages)
assert any(t == "push_subscriptions" and v["daily_enabled"] is False for t, _, v in updates)
assert route(None, "Bearer test-secret", False)["duplicate"] == 5
assert len(messages) == 3
current = datetime(2027, 10, 2, 10, 0, tzinfo=tz)
assert route(None, "Bearer test-secret", False)["skipped"] == "outside-release-window"
assert len(messages) == 3
print("PASS launch push: exact release window, opt-in, canonical CTA, dry run, failures and deduplication")
