"""Single-read transport preserves the pre-fix calibration and fails closed."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi import HTTPException
from backend.quality_dataset import COLUMNS, load_quality_dataset
from quality_dataset_fixture import NOW, fixture
import server


def wire(data=None, start=None, until=NOW):
    data = data or fixture()
    start = start or until - timedelta(days=90)
    return {"schemaVersion": 1, "ok": True,
        "window": {"from": start.isoformat(), "until": until.isoformat()},
        "columns": {k: list(v) for k, v in COLUMNS.items()},
        "counts": {k: len(data[k]) for k in COLUMNS},
        "datasets": {k: [[r.get(c) for c in columns] for r in data[k]] for k, columns in COLUMNS.items()},
        "eventCounts": data["event_counts"]}


class QualityDatasetTests(unittest.TestCase):
    def test_complete_report_exactly_matches_pre_fix_golden(self):
        data = fixture()
        rpc = Mock(return_value=wire(data))
        with patch.object(server, "db_rpc", rpc), patch.object(server, "load_puzzles", return_value=data["puzzles"]), \
             patch.object(server.measurement, "pages", side_effect=AssertionError("No REST pagination")), \
             patch.object(server, "db_request", side_effect=AssertionError("No REST datasets")):
            report = server.build_quality_report(until=NOW)
        golden = json.loads((ROOT / "tests/current/fixtures/quality-report-single-read-baseline.json").read_text(encoding="utf-8"))
        self.assertEqual(report, golden)
        rpc.assert_called_once_with("proplet_quality_dataset_v1", {
            "p_from": (NOW - timedelta(days=90)).isoformat(), "p_until": NOW.isoformat()})
        self.assertEqual(report["calmMode"]["calm"]["starts"], 1)
        self.assertEqual(report["summary"]["tooHard"], 3)
        self.assertEqual(report["summary"]["tooEasy"], 3)

    def test_more_than_one_thousand_rows_are_not_truncated(self):
        data = fixture()
        row = data["attempts"][0]
        data["attempts"] = [{**row, "id": f"many-{i}", "player_id": f"actor-{i}"} for i in range(1305)]
        rpc = Mock(return_value=wire(data))
        result = load_quality_dataset(rpc, NOW - timedelta(days=90), NOW)
        self.assertEqual(len(result["attempts"]), 1305)
        self.assertEqual(result["attempts"][-1]["id"], "many-1304")
        self.assertEqual(rpc.call_count, 1)

    def test_helper_hint_and_identity_columns_preserve_types(self):
        result = load_quality_dataset(lambda *_: wire(), NOW - timedelta(days=90), NOW)
        self.assertEqual(result["hint_events"][0], {"attempt_id": "attempt-easy-1-12", "source": "manual", "complimentary": True, "hint_level": 2})
        self.assertEqual(result["helper_events"][0]["idle_ms"], 70000)
        self.assertEqual(result["helper_events"][0]["support_mode"], "older")
        self.assertEqual(result["attempts"][0]["player_id"], "actor-0")
        self.assertIsNone(result["attempts"][0]["anonymous_id"])
        self.assertEqual(result["event_counts"]["app_open"], 30)

    def test_empty_complete_source_is_valid_but_missing_source_is_not(self):
        data = {key: [] for key in COLUMNS}
        data["event_counts"] = {}
        result = load_quality_dataset(lambda *_: wire(data), NOW - timedelta(days=90), NOW)
        self.assertEqual(result["attempts"], [])
        for invalid in (None, [], {}, {"ok": False, "schemaVersion": 1, "code": "dataset_too_large"}):
            with self.subTest(invalid=invalid), self.assertRaises(HTTPException) as error:
                load_quality_dataset(lambda *_: invalid, NOW - timedelta(days=90), NOW)
            self.assertEqual(error.exception.status_code, 503)

    def test_partial_or_wrong_schema_is_never_an_empty_report(self):
        corruptions = [
            lambda p: p["datasets"].pop("helper_events"),
            lambda p: p["counts"].update(attempts=99999),
            lambda p: p["columns"]["attempts"].reverse(),
            lambda p: p["datasets"]["attempts"][0].pop(),
            lambda p: p["datasets"]["attempts"][0].__setitem__(0, None),
            lambda p: p["datasets"]["attempts"][0].__setitem__(9, "invalid elapsed"),
            lambda p: p["window"].update(until="2026-10-01T00:00:00Z"),
            lambda p: p.update(eventCounts={"app_open": -1}),
        ]
        for change in corruptions:
            payload = wire()
            change(payload)
            with self.subTest(change=change), self.assertRaises(HTTPException) as error:
                load_quality_dataset(lambda *_: payload, NOW - timedelta(days=90), NOW)
            self.assertEqual(error.exception.status_code, 503)

    def test_rpc_failure_cannot_fall_back_to_slow_rest_reads(self):
        rpc = Mock(side_effect=HTTPException(400, "Missing SQL function"))
        with patch.object(server, "db_rpc", rpc), patch.object(server, "db_request", side_effect=AssertionError("No fallback")):
            with self.assertRaises(HTTPException) as error:
                server.build_quality_report(until=NOW)
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(rpc.call_count, 1)

    def test_prague_ninety_day_window_preserves_dst_instants(self):
        until = datetime(2026, 10, 29, 2, 36, tzinfo=ZoneInfo("Europe/Prague"))
        start = until - timedelta(days=90)
        self.assertEqual(until.astimezone(timezone.utc) - start.astimezone(timezone.utc), timedelta(days=90, hours=1))
        payload = wire(start=start, until=until)
        # PostgreSQL may serialize instants in UTC; string equality is not the contract.
        payload["window"] = {"from": start.astimezone(timezone.utc).isoformat(), "until": until.astimezone(timezone.utc).isoformat()}
        rpc = Mock(return_value=payload)
        load_quality_dataset(rpc, start, until)
        self.assertEqual(rpc.call_args.args[1]["p_from"], "2026-07-31T02:36:00+02:00")
        self.assertEqual(rpc.call_args.args[1]["p_until"], "2026-10-29T02:36:00+01:00")

    def test_ambiguous_prague_folds_match_only_the_same_utc_instant(self):
        for fold in (0, 1):
            until = datetime(2026, 10, 25, 2, 30, tzinfo=ZoneInfo("Europe/Prague"), fold=fold)
            start = until - timedelta(days=90)
            payload = wire(start=start, until=until)
            payload["window"] = {"from": start.astimezone(timezone.utc).isoformat(), "until": until.astimezone(timezone.utc).isoformat()}
            with self.subTest(fold=fold):
                load_quality_dataset(lambda *_: payload, start, until)
                other = until.replace(fold=1-fold)
                payload["window"]["until"] = other.astimezone(timezone.utc).isoformat()
                with self.assertRaises(HTTPException) as error:
                    load_quality_dataset(lambda *_: payload, start, until)
                self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
