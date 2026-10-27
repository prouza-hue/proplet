"""Exercise the scheduled invitation with an in-memory ledger and fake sender."""
import copy
from datetime import timedelta
import json
import logging
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException
from visual_pilot_push import END, EVENT_KEY, PAYLOAD, START, install_visual_pilot_push

TESTER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"


class VisualPilotPushTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"CRON_SECRET": "test-secret", "VERCEL_ENV": "production"})
        env.start()
        self.addCleanup(env.stop)
        self.now = START + timedelta(minutes=15)
        self.state = {"active": True, "participant_ids": [TESTER]}
        self.state_reads = 0
        self.revoke_member = False
        self.revoke_consent = False
        self.fail_ledger = False
        self.provider_error = None
        self.expire_on_reservation = False
        self.racing_reservation = False
        self.ready = True
        self.messages = []
        self.reservations = []
        self.updates = []
        self.reads = []
        self.logs = []
        self.subs = [dict(id="device", player_id=TESTER, content_enabled=True,
                         daily_enabled=True, endpoint="https://push.example.org/device",
                         p256dh="fake-key", auth="fake-auth")]
        app = FastAPI()
        install_visual_pilot_push(app, push_ready=lambda: self.ready,
            db_select_bounded=self.select, reserve_delivery=self.reserve,
            db_update=self.update, webpush=self.send, campaign_state=self.campaign,
            vapid_private="fake", vapid_subject="fake", logger=logging.getLogger("test"),
            clock=lambda: self.now)
        self.route = next(r.endpoint for r in app.routes if r.path == "/api/cron/visual-pilot-push")

    def campaign(self):
        self.state_reads += 1
        return ({"active": True, "participant_ids": []}
                if self.revoke_member and self.state_reads > 1 else copy.deepcopy(self.state))

    def select(self, table, **kwargs):
        self.reads.append((table, kwargs))
        rows = self.subs if table == "push_subscriptions" else self.logs
        for key, predicate in kwargs.get("filters", {}).items():
            if predicate.startswith("eq."):
                target = predicate[3:]
                rows = [r for r in rows if str(r.get(key)).lower() == target.lower()]
            elif predicate.startswith("in.("):
                ids = predicate[4:-1].split(",")
                rows = [r for r in rows if r.get(key) in ids]
            else:
                self.fail("Unexpected filter " + predicate)
        if table == "push_subscriptions" and "id" in kwargs.get("filters", {}) and self.revoke_consent:
            rows = [{**r, "content_enabled": False} for r in rows]
        return copy.deepcopy(rows)

    def reserve(self, sub, event, category):
        self.assertEqual((event, category), (EVENT_KEY, "content"))
        if self.racing_reservation or any(r["subscription_id"] == sub["id"] and r["event_key"] == event for r in self.logs):
            return None
        self.logs.append(dict(id=sub["id"], subscription_id=sub["id"], event_key=event, status="pending"))
        self.reservations.append(sub["id"])
        if self.expire_on_reservation:
            self.now = END
        return sub["id"]

    def update(self, table, binding, values):
        if self.fail_ledger and table == "push_delivery_log":
            raise RuntimeError("ledger unavailable")
        self.updates.append((table, binding, values))
        for row in self.logs if table == "push_delivery_log" else self.subs:
            if all(row.get(k) == v for k, v in binding.items()):
                row.update(values)

    def send(self, **kwargs):
        if self.provider_error:
            exc = RuntimeError("provider failure")
            exc.response = type("Response", (), {"status_code": self.provider_error})()
            raise exc
        self.assertGreater(kwargs["ttl"], 0)
        self.assertLessEqual(kwargs["ttl"], 3600)
        self.assertEqual(kwargs["timeout"], 10)
        self.messages.append(kwargs)

    def call(self, dry=False):
        return self.route(None, "Bearer test-secret", dry)

    def test_unauthorized_before_any_reads(self):
        for secret in ("wrong", ""):
            with patch.dict(os.environ, {"CRON_SECRET": secret}):
                with self.assertRaises(HTTPException) as ctx:
                    self.call()
                self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual((self.state_reads, self.reads, self.reservations), (0, [], []))

    def test_only_production_exact_date_and_hour(self):
        with patch.dict(os.environ, {"VERCEL_ENV": "preview"}):
            self.assertEqual(self.call()["reason"], "not-production")
        for instant in (START-timedelta(seconds=1), END, START+timedelta(days=1), START.replace(year=2027)):
            self.now = instant
            self.assertEqual(self.call()["reason"], "outside-release-window")
        self.assertFalse(self.reads)
        self.assertFalse(self.reservations)

    def test_inactive_and_bad_cohort_fail_closed(self):
        for state in ({"active": False}, {"active": True, "participant_ids": []}):
            self.state = state
            self.assertEqual(self.call()["reason"], "campaign-inactive-or-empty")
        for ids in (["not-a-uuid"], [TESTER]*13, "all"):
            self.state = {"active": True, "participant_ids": ids}
            with self.assertRaises(HTTPException):
                self.call()
        self.assertFalse(self.reads)

    def test_dry_run_before_schedule_has_no_writes_or_messages(self):
        self.now = START-timedelta(hours=9)
        self.assertEqual(self.call(True)["eligible"], 1)
        self.assertEqual((self.reservations, self.updates, self.messages), ([], [], []))

    def test_only_members_with_content_consent_not_daily_only_or_reviewer(self):
        self.subs += [dict(self.subs[0], id="reviewer", player_id=OTHER),
                      dict(self.subs[0], id="daily-only", content_enabled=False),
                      dict(self.subs[0], id="guest", player_id=None)]
        self.assertEqual(self.call()["sent"], 1)
        self.assertEqual(self.reservations, ["device"])
        self.assertEqual(self.reads[0][1]["filters"]["player_id"], "in.("+TESTER+")")

    def test_ordinary_morning_push_does_not_suppress_approved_invitation(self):
        self.logs.append(dict(subscription_id="device", event_key="tajenka:today", status="sent"))
        self.assertEqual(self.call()["sent"], 1)
        self.assertEqual(json.loads(self.messages[0]["data"]), {**PAYLOAD, "deliveryId": "device"})

    def test_all_prior_campaign_statuses_are_final(self):
        for status in ("sent", "pending", "failed", "removed"):
            self.logs = [dict(subscription_id="device", event_key=EVENT_KEY, status=status)]
            self.assertEqual(self.call()["duplicate"], 1)
        self.assertFalse(self.messages)
        self.assertFalse(self.reservations)

    def test_membership_and_opt_in_revocation_before_reserve(self):
        self.revoke_member = True
        self.assertEqual(self.call()["sent"], 0)
        self.revoke_member = False
        self.revoke_consent = True
        self.assertEqual(self.call()["sent"], 0)
        self.assertFalse(self.reservations)

    def test_racing_reservation_and_expiry_never_send(self):
        self.racing_reservation = True
        self.assertEqual(self.call()["duplicate"], 1)
        self.racing_reservation = False
        self.expire_on_reservation = True
        self.assertEqual(self.call()["skippedWindow"], 1)
        self.assertFalse(self.messages)
        self.assertEqual(self.logs[0]["status"], "pending")

    def test_provider_failure_and_accepted_ledger_failure_never_retry(self):
        self.provider_error = 500
        self.assertEqual(self.call()["failed"], 1)
        self.provider_error = None
        self.assertEqual(self.call()["duplicate"], 1)
        self.assertFalse(self.messages)
        self.logs.clear()
        self.fail_ledger = True
        self.assertEqual(self.call()["ledgerPending"], 1)
        self.assertEqual(self.call()["duplicate"], 1)
        self.assertEqual(len(self.messages), 1)

    def test_gone_subscription_disabled_and_no_retry(self):
        self.provider_error = 410
        self.assertEqual(self.call()["removed"], 1)
        self.assertFalse(self.subs[0]["content_enabled"])
        self.assertFalse(self.subs[0]["daily_enabled"])
        self.assertEqual(self.call()["sent"], 0)

    def test_invalid_endpoint_and_missing_push_configuration(self):
        self.subs[0]["endpoint"] = "https://push.invalid/test"
        self.assertEqual(self.call()["eligible"], 0)
        self.ready = False
        with self.assertRaises(HTTPException):
            self.call()
        self.assertFalse(self.reservations)

    def test_scheduled_cron_contract(self):
        config = json.loads((Path(__file__).resolve().parents[2]/"vercel.json").read_text())
        matches = [r for r in config["crons"] if r["path"] == "/api/cron/visual-pilot-push"]
        self.assertEqual(matches, [{"path": "/api/cron/visual-pilot-push", "schedule": "0 10 28 10 *"}])


if __name__ == "__main__":
    unittest.main()
