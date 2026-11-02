"""The content variant shares the existing morning slot without extra sends."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from fastapi import FastAPI, HTTPException
import free_expansion_push as campaign
import push_diagnostics_v3329 as pushes


def content_fixture():
    return {"freeGeneration": 4, "contentGeneration": 4,
            "freeExpansionRelease": {"batchId": campaign.CAMPAIGN_ID,
                "totalNewLevels": 600, "newLevelCounts": {d: 100 for d in campaign.DIFFICULTIES}},
            "free": {d: [{"id": f"g6-expansion-{d}-{i:03d}", "difficulty": d,
                "meta": {"releaseBatch": campaign.CAMPAIGN_ID, "contentGeneration": 4,
                         "generatorGeneration": 6, "candidateOnly": False,
                         "playtestOnly": False, "availableFrom": "2026-11-02"}}
                for i in range(1, 101)] for d in campaign.DIFFICULTIES}}


class Harness:
    def __init__(self, webpush, *, when=campaign.START, choices=None, environment="production", batch=None):
        self.time = when
        self.content = content_fixture()
        self.lock = threading.Lock()
        self.barrier = None
        self.after_insert = None
        self.before_fresh = None
        self.fail_provider = False
        self.fail_sent_update = False
        self.messages = []
        self.updates = []
        choices = choices or {"daily": (True, False), "content": (False, True),
                              "both": (True, True), "off": (False, False)}
        self.tables = {"push_subscriptions": [{"id": key, "player_id": "p-" + key,
            "anonymous_id": None, "endpoint": "https://push.example/" + key,
            "p256dh": "key", "auth": "auth", "daily_enabled": flags[0],
            "content_enabled": flags[1]} for key, flags in choices.items()],
            "push_delivery_log": [], "results": [], "puzzle_attempts": []}
        webpush.side_effect = self.send
        app = FastAPI()
        with patch.dict(os.environ, {"CRON_SECRET": "test-secret", "VAPID_PUBLIC_KEY": "test-public",
                "VAPID_PRIVATE_KEY": "test-private", "VERCEL_ENV": environment,
                "PROPLET_TAJENKA_RELEASE_ENABLED": "true"}):
            pushes.install_push_diagnostics(app, tz=campaign.TZ, db_select=self.select,
                db_insert=self.insert, db_update=self.update, db_delete=lambda *_a, **_k: None,
                auth_player=lambda _auth: {"id": "synthetic"}, enforce_rate_limit=lambda *_a, **_k: None,
                db_rpc=lambda *_a, **_k: [], clock=lambda: self.time,
                current_prague_date=lambda: self.time.astimezone(campaign.TZ).date(),
                released_batches=lambda _day: ([batch] if batch else [], []),
                free_expansion_content=lambda: self.content)
        self.run = next(r.endpoint for r in app.routes if r.path == "/api/cron/daily-push-v2")

    def select(self, table, **filters):
        if table == "push_subscriptions" and "id" in filters and self.before_fresh:
            self.before_fresh()
        with self.lock:
            rows = [deepcopy(row) for row in self.tables.get(table, [])
                    if all(row.get(key) == value for key, value in filters.items())]
        if self.barrier and table == "push_delivery_log" and filters.get("event_key") == campaign.DELIVERY_KEY:
            self.barrier.wait(timeout=10)
        return rows

    def insert(self, table, row):
        with self.lock:
            if table == "push_delivery_log" and any(
                    old["subscription_id"] == row["subscription_id"] and old["event_key"] == row["event_key"]
                    for old in self.tables[table]):
                raise HTTPException(409, "synthetic unique subscription/event conflict")
            self.tables.setdefault(table, []).append(deepcopy(row))
        if self.after_insert:
            self.after_insert()

    def update(self, table, filters, values):
        if self.fail_sent_update and values.get("status") == "sent":
            raise RuntimeError("synthetic ledger acknowledgement unavailable")
        with self.lock:
            self.updates.append((table, deepcopy(values)))
            for row in self.tables.get(table, []):
                if all(row.get(key) == value for key, value in filters.items()):
                    row.update(deepcopy(values))

    def send(self, **options):
        if self.fail_provider:
            raise RuntimeError("synthetic ambiguous provider timeout")
        with self.lock:
            self.messages.append({"subscription": options["subscription_info"]["endpoint"].rsplit("/", 1)[1],
                                  "payload": json.loads(options["data"]), "ttl": options["ttl"]})

    def invoke(self):
        return self.run(None, "Bearer test-secret")


class ExpansionPushTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(pushes, "webpush")
        self.webpush = patcher.start()
        self.addCleanup(patcher.stop)

    def harness(self, **options):
        return Harness(self.webpush, **options)

    def test_exact_window_and_published_release(self):
        self.assertEqual(campaign.START.astimezone(timezone.utc).hour, 7)
        self.assertTrue(campaign.in_window(campaign.START))
        self.assertTrue(campaign.in_window(campaign.END - timedelta(microseconds=1)))
        for value in (campaign.START - timedelta(microseconds=1), campaign.END,
                      campaign.START - timedelta(days=1), campaign.START + timedelta(days=1)):
            self.assertFalse(campaign.in_window(value))
        with self.assertRaises(ValueError):
            campaign.in_window(datetime(2026, 11, 3, 8))
        self.assertTrue(campaign.validate_content(json.loads((ROOT / "data/puzzles.json").read_bytes())))

    def test_content_opt_in_replaces_daily_and_keeps_shared_identity(self):
        h = self.harness()
        result = h.invoke()
        self.assertEqual(result["sent"], 3)
        by_sub = {row["subscription"]: row for row in h.messages}
        self.assertNotIn("off", by_sub)
        self.assertNotIn("campaignId", by_sub["daily"]["payload"])
        self.assertIn("Dnešní Proplet", by_sub["daily"]["payload"]["title"])
        for key in ("content", "both"):
            payload = by_sub[key]["payload"]
            self.assertEqual(payload["title"], "600 nových úrovní")
            self.assertEqual(payload["body"], "Po 100 v každé obtížnosti. Vyber si, co si dnes rozpleteš.")
            self.assertEqual(payload["url"], "https://hrajproplet.cz/?open=free&via=push-content")
            self.assertEqual(payload["campaignId"], campaign.CAMPAIGN_ID)
            self.assertEqual(payload["tag"], "proplet-" + campaign.CAMPAIGN_ID)
            self.assertLessEqual(by_sub[key]["ttl"], 3600)
        rows = h.tables["push_delivery_log"]
        self.assertEqual(len(rows), 3, "one reservation row per actual morning notification")
        self.assertEqual({r["event_key"] for r in rows}, {campaign.DELIVERY_KEY})
        self.assertEqual({r["category"] for r in rows if r["subscription_id"] != "daily"}, {"content"})
        self.assertEqual(h.invoke()["duplicate"], 3)
        h.time = campaign.END
        self.assertEqual(h.invoke()["duplicate"], 2)
        self.assertEqual(len(h.messages), 3, "delayed ordinary Daily cannot follow the content variant")

    def test_ordinary_before_window_consumes_the_same_day_slot(self):
        h = self.harness(when=campaign.START - timedelta(seconds=1), choices={"both": (True, True)})
        self.assertEqual(h.invoke()["sent"], 1)
        self.assertNotIn("campaignId", h.messages[0]["payload"])
        h.time = campaign.START
        self.assertEqual(h.invoke()["duplicate"], 1)
        self.assertEqual(len(h.messages), 1)

    def test_completed_daily_only_skips_but_completed_content_opt_in_receives_news(self):
        h = self.harness()
        h.tables["results"] = [{"mode": "daily", "daily_date": campaign.DAY, "player_id": "p-" + key}
                               for key in ("daily", "content", "both")]
        self.assertEqual(h.invoke()["sent"], 2)
        self.assertEqual({row["subscription"] for row in h.messages}, {"content", "both"})

    def test_every_prior_status_is_fail_closed_on_that_date(self):
        for status in ("pending", "failed", "sent", "removed", "expired"):
            with self.subTest(status=status):
                h = self.harness(choices={"both": (True, True)})
                h.tables["push_delivery_log"].append({"id": "existing", "subscription_id": "both",
                    "event_key": campaign.DELIVERY_KEY, "category": "daily", "status": status})
                self.assertEqual(h.invoke()["duplicate"], 1)
                self.assertEqual(h.messages, [])
                self.assertEqual(h.updates, [])

    def test_overlapping_invocations_obey_database_unique_reservation(self):
        h = self.harness(choices={"both": (True, True)})
        h.barrier = threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: h.invoke(), range(2)))
        self.assertEqual(sum(r["sent"] for r in results), 1)
        self.assertEqual(sum(r["duplicate"] for r in results), 1)
        self.assertEqual(len(h.tables["push_delivery_log"]), 1)
        self.assertEqual(len(h.messages), 1)

    def test_provider_or_acknowledgement_uncertainty_never_retries_that_day(self):
        h = self.harness(choices={"both": (True, True)})
        h.fail_provider = True
        self.assertEqual(h.invoke()["failed"], 1)
        h.fail_provider = False
        self.assertEqual(h.invoke()["duplicate"], 1)
        self.assertEqual(h.messages, [])
        h = self.harness(choices={"both": (True, True)})
        h.fail_sent_update = True
        with self.assertRaises(RuntimeError):
            h.invoke()
        self.assertEqual(len(h.messages), 1)
        h.fail_sent_update = False
        self.assertEqual(h.invoke()["duplicate"], 1)
        self.assertEqual(len(h.messages), 1)

    def test_content_must_be_published_complete_and_unique(self):
        for defect in ("count", "missing", "duplicate", "candidate", "future"):
            with self.subTest(defect=defect):
                h = self.harness(choices={"both": (True, True)})
                boards = h.content["free"]["easy"]
                if defect == "count": h.content["freeExpansionRelease"]["totalNewLevels"] = 599
                if defect == "missing": boards.pop()
                if defect == "duplicate": boards[-1] = deepcopy(boards[0])
                if defect == "candidate": boards[0]["meta"]["candidateOnly"] = True
                if defect == "future": boards[0]["meta"]["availableFrom"] = "2026-11-04"
                with self.assertRaises(HTTPException) as caught:
                    h.invoke()
                self.assertEqual(caught.exception.status_code, 503)
                self.assertEqual(h.messages, [])
                self.assertEqual(h.tables["push_delivery_log"], [])

    def test_consent_rechecked_and_window_rechecked_after_reservation(self):
        h = self.harness(choices={"both": (True, True)})
        h.before_fresh = lambda: h.tables["push_subscriptions"][0].update(daily_enabled=False, content_enabled=False)
        self.assertEqual(h.invoke()["sent"], 0)
        self.assertEqual(h.tables["push_delivery_log"], [])
        h = self.harness(choices={"both": (True, True)})
        h.after_insert = lambda: setattr(h, "time", campaign.END)
        self.assertEqual(h.invoke()["skippedWindow"], 1)
        self.assertEqual(h.messages, [])
        self.assertEqual(h.tables["push_delivery_log"][0]["status"], "expired")
        h.after_insert = None
        self.assertEqual(h.invoke()["duplicate"], 1)

    def test_other_dates_preview_auth_and_existing_weekday_selection(self):
        h = self.harness(environment="preview")
        self.assertTrue(h.invoke()["preview"])
        self.assertEqual(h.messages, [])
        h = self.harness()
        with self.assertRaises(HTTPException) as caught:
            h.run(None, "Bearer wrong")
        self.assertEqual(caught.exception.status_code, 401)
        self.assertEqual(h.messages, [])
        h = self.harness(when=campaign.START + timedelta(days=1), choices={"both": (True, True)})
        self.assertEqual(h.invoke()["sent"], 1)
        self.assertNotIn("campaignId", h.messages[0]["payload"])
        monday = datetime(2026, 11, 9, 8, tzinfo=campaign.TZ)
        h = self.harness(when=monday, choices={"both": (True, True)}, batch={"id": "monday", "availableFrom": "2026-11-09"})
        self.assertEqual(h.invoke()["category"], "content")
        self.assertIn("Pondělní", h.messages[0]["payload"]["title"])
        h = self.harness(when=datetime(2026, 9, 12, 8, tzinfo=campaign.TZ), choices={"both": (True, True)})
        self.assertEqual(h.invoke()["category"], "tajenka")
        self.assertIn("Tajenka", h.messages[0]["payload"]["title"])


if __name__ == "__main__":
    unittest.main()
