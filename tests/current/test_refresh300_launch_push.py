import copy
import json
import logging
import os
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException
from refresh300_launch_push import EVENT_KEY, PAYLOAD, install_refresh300_push


class CampaignTests(unittest.TestCase):
    def setUp(self):
        os.environ.update(CRON_SECRET="test-secret", VERCEL_ENV="production")
        self.now = datetime(2026, 10, 4, 11, 0, tzinfo=ZoneInfo("Europe/Prague"))
        self.subs = [dict(id=s, daily_enabled=s != "off", content_enabled=False,
                          endpoint="https://push.invalid/"+s, p256dh="key", auth="auth")
                     for s in ("fresh", "today", "pending", "prior", "off", "dead", "fail")]
        self.logs = [dict(subscription_id="today", event_key="daily:2026-10-04", status="sent"),
                     dict(subscription_id="pending", event_key="daily:2026-10-04", status="pending"),
                     dict(subscription_id="prior", event_key=EVENT_KEY, status="failed")]
        self.messages = []
        self.reserved = set()
        self.updates = []
        self.content = {"free": {d: [{"id": f"g6-refresh-{d}-{i}"} for i in range(100)]
                                 for d in ("easy", "medium", "hard")}}
        self.revoke = False
        self.ledger_error = False
        app = FastAPI()
        install_refresh300_push(app, tz=self.now.tzinfo, push_ready=lambda: True,
                                db_select_bounded=self.select, reserve_delivery=self.reserve,
                                db_update=self.update, webpush=self.send,
                                load_puzzles=lambda: self.content, vapid_private="test", vapid_subject="test",
                                logger=logging.getLogger("test"), clock=lambda: self.now)
        self.route = next(r.endpoint for r in app.routes if r.path == "/api/cron/refresh300-launch-push")

    def select(self, table, **kwargs):
        rows = self.subs if table == "push_subscriptions" else self.logs
        filters = kwargs.get("filters", {})
        for key in ("id", "subscription_id"):
            if key in filters:
                rows = [r for r in rows if r[key] == filters[key][3:]]
        if table == "push_subscriptions" and filters and self.revoke:
            return [{**r, "daily_enabled": False, "content_enabled": False} for r in rows]
        return copy.deepcopy(rows)

    def reserve(self, sub, event, category):
        assert event == EVENT_KEY and category == "content"
        if sub["id"] in self.reserved:
            return None
        self.reserved.add(sub["id"])
        self.logs.append(dict(subscription_id=sub["id"], event_key=event, status="pending"))
        return sub["id"]

    def update(self, table, filters, values):
        self.updates.append((table, filters, values))
        if self.ledger_error and values.get("status") == "sent":
            raise RuntimeError("ledger unavailable")

    def send(self, **kwargs):
        name = kwargs["subscription_info"]["endpoint"].rsplit("/", 1)[1]
        if name in ("dead", "fail"):
            exc = RuntimeError("provider error")
            exc.response = type("Response", (), {"status_code": 410 if name == "dead" else 500})()
            raise exc
        assert 0 < kwargs["ttl"] <= 3600
        self.messages.append(json.loads(kwargs["data"]))

    def call(self, dry=False):
        return self.route(None, "Bearer test-secret", dry)

    def test_unauthorized(self):
        with self.assertRaises(HTTPException) as ctx:
            self.route(None, "Bearer wrong", False)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertFalse(self.reserved)

    def test_window_and_preview(self):
        for y, day, hour in [(2026,3,11),(2026,4,9),(2026,4,12),(2026,5,11),(2027,4,11)]:
            self.now = self.now.replace(year=y, day=day, hour=hour)
            self.assertEqual(self.call()["reason"], "outside-release-window")
        os.environ["VERCEL_ENV"] = "preview"
        self.assertEqual(self.call()["reason"], "not-production")
        self.assertFalse(self.reserved)

    def test_dry_run(self):
        result = self.call(True)
        self.assertEqual(result["eligible"], 6)
        self.assertEqual(result["skipped"], 3)
        self.assertFalse(self.reserved)
        self.assertFalse(self.messages)

    def test_send_dedupe_and_failure_retention(self):
        result = self.call()
        self.assertEqual((result["sent"], result["failed"], result["removed"], result["skipped"]), (1,1,1,3))
        self.assertEqual(result["skippedToday"], 2)
        self.assertEqual(result["duplicate"], 1)
        self.assertEqual(self.messages[0], {**PAYLOAD, "deliveryId": "fresh"})
        self.assertEqual(self.reserved, {"fresh", "dead", "fail"})
        result = self.call()
        self.assertEqual(result["sent"], 0)
        self.assertEqual(result["duplicate"], 4)
        self.assertEqual(len(self.messages), 1)
        self.assertTrue(any(t == "push_subscriptions" and v.get("daily_enabled") is False for t, f, v in self.updates))

    def test_missing_content_fails_closed(self):
        self.content["free"]["hard"].pop()
        with self.assertRaises(HTTPException):
            self.call()
        self.assertFalse(self.reserved)

    def test_revocation_rechecked(self):
        self.revoke = True
        self.assertEqual(self.call()["sent"], 0)
        self.assertFalse(self.reserved)

    def test_accepted_but_ledger_failure_never_retries(self):
        self.ledger_error = True
        self.assertEqual(self.call()["ledgerPending"], 1)
        self.call()
        self.assertEqual(len(self.messages), 1)

    def test_delayed_daily_cron_skips_release_recipient(self):
        import push_diagnostics_v3329 as diagnostics
        from unittest.mock import patch
        from datetime import date
        sub = dict(id="fresh", player_id=None, anonymous_id="anon", daily_enabled=True)
        def select(table, **filters):
            if table == "push_subscriptions":
                return [sub]
            if table == "push_delivery_log" and filters.get("event_key") == EVENT_KEY:
                return [dict(id="existing", status="pending")]
            return []
        def unexpected(*args, **kwargs):
            raise AssertionError("Daily must not send or reserve after the release campaign")
        os.environ.update(VAPID_PUBLIC_KEY="test", VAPID_PRIVATE_KEY="test")
        app = FastAPI()
        with patch.object(diagnostics, "webpush", unexpected):
            diagnostics.install_push_diagnostics(
                app, tz=self.now.tzinfo, db_select=select,
                db_insert=unexpected, db_update=unexpected, db_delete=unexpected,
                auth_player=unexpected, enforce_rate_limit=lambda *a, **k: None,
                current_prague_date=lambda: date(2026, 10, 4))
            route = next(r.endpoint for r in app.routes if r.path == "/api/cron/daily-push-v2")
            result = route(None, "Bearer test-secret")
            self.assertEqual(result["duplicate"], 1)
            self.assertEqual(result["sent"], 0)


if __name__ == "__main__":
    unittest.main()
