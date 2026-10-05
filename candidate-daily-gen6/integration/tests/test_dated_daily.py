from __future__ import annotations
import ast
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import importlib.util
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parent / "daily-work"
sys.path.insert(0, str(ROOT / "upstream"))
from backend import content as domain_content
from content_archive import archived_puzzle_info, daily_window_puzzle_id

spec = importlib.util.spec_from_file_location("backend.dated_daily", ROOT / "candidate/backend/dated_daily.py")
dated = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = dated
spec.loader.exec_module(dated)


def candidate_pack():
    return json.loads((WORK / "candidate-daily/server-pack.json").read_text())


class PureContract(unittest.TestCase):
    def setUp(self):
        self.payload = candidate_pack()
        self.bank = dated.DatedDaily(self.payload, allow_candidate=True)

    def test_candidate_is_not_runtime_approved(self):
        with self.assertRaises(dated.DailyPackInvalid):
            dated.DatedDaily(self.payload)

    def test_one_hundred_finite_bindings(self):
        start = date(2026, 10, 7)
        ids = set()
        for offset in range(100):
            selected = start + timedelta(days=offset)
            row = self.bank.binding(selected.isoformat(), today=date(2027, 1, 14))
            self.assertEqual(row.daily_date, selected.isoformat())
            self.assertEqual(row.bank_version, "daily-gen6-20261007-v1")
            self.assertNotIn(row.puzzle_id, ids)
            ids.add(row.puzzle_id)
        self.assertEqual(row.daily_date, "2027-01-14")
        self.assertTrue(self.bank.handles("2027-01-15"))
        with self.assertRaises(dated.DailyUnavailable):
            self.bank.binding("2027-01-15", today=date(2027, 1, 15))

    def test_future_date_id_and_wrong_id_fail_without_payload(self):
        now = datetime(2026, 10, 7, 12, tzinfo=timezone.utc)
        future = self.payload["bindings"][1]
        self.assertIsNone(self.bank.puzzle_by_id(future["puzzleId"], today=date(2026, 10, 7)))
        for kwargs in ({"daily_date": "2026-10-08"}, {"puzzle_id": future["puzzleId"]}):
            with self.assertRaises(dated.DailyUnavailable):
                self.bank.public_payload(now=now, **kwargs)
        current = self.bank.public_payload(now=now)
        self.assertEqual(current["dailyDate"], "2026-10-07")
        self.assertEqual(current["challengeKey"], "daily:2026-10-07")
        self.assertEqual(set(current["puzzle"]), set(self.payload["puzzles"][current["puzzleId"]]))
        self.assertNotIn(future["puzzleId"], json.dumps(current))

    def test_prague_midnight_dst(self):
        self.assertEqual(dated.prague_today(datetime(2026, 10, 6, 21, 59, 59, tzinfo=timezone.utc)), date(2026, 10, 6))
        self.assertEqual(dated.prague_today(datetime(2026, 10, 6, 22, 0, tzinfo=timezone.utc)), date(2026, 10, 7))
        for local, hours in ((datetime(2026, 10, 25, 0, tzinfo=dated.PRAGUE), 25),
                             (datetime(2027, 3, 28, 0, tzinfo=dated.PRAGUE), 23)):
            elapsed = dated.next_midnight(local).astimezone(timezone.utc) - local.astimezone(timezone.utc)
            self.assertEqual(elapsed.total_seconds(), hours*3600)

    def test_tamper_and_gap_refused(self):
        for change in ("letters", "binding", "missing"):
            payload = deepcopy(self.payload)
            if change == "letters":
                payload["puzzles"][payload["bindings"][0]["puzzleId"]]["letters"][0] = "!"
            elif change == "binding":
                payload["bindings"][0]["bankVersion"] = "wrong"
            else:
                payload["bindings"].pop()
            with self.assertRaises(dated.DailyPackInvalid):
                dated.DatedDaily(payload, allow_candidate=True)

    def test_bootstrap_before_and_after_cutover_never_prefetches_future(self):
        source = json.loads((WORK / "public/puzzles.json").read_text())
        projected = dated.public_runtime_projection(source, cutover="2026-10-07", active_until="2027-01-14")
        spec = importlib.util.spec_from_file_location("bootstrap_candidate", ROOT/"candidate/tools/generate_puzzles_bootstrap.py")
        bootstrap_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bootstrap_module)
        for day in (date(2026, 10, 5), date(2026, 10, 6), date(2026, 10, 7), date(2027, 1, 15)):
            encoded = json.dumps(projected, ensure_ascii=False).encode()
            slim = bootstrap_module.build_bootstrap(projected, encoded, today=day)
            slim_size = len(json.dumps(slim, ensure_ascii=False).encode())
            bootstrap_module.validate(projected, slim, len(encoded), slim_size)
            playable_ids = {body["id"] for body in slim["daily"] if "letters" in body}
            # No payload from after cutover; before cutover at most yesterday/today.
            if day >= date(2026, 10, 8):
                self.assertEqual(playable_ids, set())
            self.assertFalse(playable_ids & {row["puzzleId"] for row in self.payload["bindings"]})

    def test_public_projection_preserves_history_and_hides_future(self):
        source = json.loads((WORK / "public/puzzles.json").read_text())
        public = dated.public_runtime_projection(source, cutover="2026-10-07", active_until="2027-01-14")
        self.assertEqual([p["id"] for p in source["daily"]], [p["id"] for p in public["daily"]])
        for offset in range(44):
            self.assertEqual(source["daily"][offset], public["daily"][offset])
        for body in public["daily"][44:]:
            if body["id"] == "g3-d-007":
                self.assertEqual(body, source["daily"][-1])
            else:
                self.assertFalse(set(body) & {"letters", "mask", "answers", "rows", "cols"})
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "puzzles.json").write_text(json.dumps(public, ensure_ascii=False))
            self.assertEqual(dated.assert_no_private_payload(root, self.bank)["result"], "PASS")
            (root / "leaked.js.map").write_text(json.dumps({"sourcesContent": [self.payload["bindings"][1]["puzzleId"]]}))
            with self.assertRaises(dated.DailyPackInvalid):
                dated.assert_no_private_payload(root, self.bank)


class HTTPError(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail


def compile_functions(path, names, namespace):
    tree = ast.parse(path.read_text())
    selected = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in names:
            node.decorator_list = []
            selected.append(node)
    compile_tree = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), *selected], type_ignores=[])
    exec(compile(ast.fix_missing_locations(compile_tree), str(path), "exec"), namespace)


class AdapterCallableContract(unittest.TestCase):
    """Actual source functions with protocol doubles, NOT an ASGI/browser gate."""
    def setUp(self):
        self.clock = date(2026, 10, 7)
        self.source = json.loads((WORK / "data/puzzles.json").read_text())
        self.responses = {}
        class App:
            def get(_self, route):
                return lambda function: self.responses.setdefault(route, function)
        self.namespace = {
            "date": date, "timedelta": timedelta, "Optional": object,
            "HTTPException": HTTPError, "domain_content": domain_content,
            "daily_window_puzzle_id": daily_window_puzzle_id,
            "archived_puzzle_info": archived_puzzle_info,
            "load_puzzles": lambda: self.source,
            "load_content_catalog": lambda: {}, "GEN4_CANDIDATE_PREVIEW": False,
            "free_puzzle_info": lambda *args: None,
        }
        names = {"daily_rotation_index", "legacy_daily_banks", "previous_daily_bank", "legacy_daily_bank_by_generation",
                 "daily_bank_puzzle_id", "expected_daily_puzzle_id", "valid_daily_puzzle_ids", "resolved_puzzle",
                 "puzzle_exists", "puzzle_info", "daily_puzzle_matches_date"}
        compile_functions(ROOT / "upstream/server.py", names, self.namespace)
        self.original_expected = self.namespace["expected_daily_puzzle_id"]
        self.original_valid = self.namespace["valid_daily_puzzle_ids"]
        # Freeze all historical identities before the real wrapper is installed.
        self.historic = {day.isoformat(): (self.original_expected(day.isoformat()), self.original_valid(day.isoformat()))
                         for day in (date(2026, 1, 1) + timedelta(days=i) for i in range(279))}
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        private_path = Path(self.temp.name)/"data/daily_gen6_private.json"
        private_path.parent.mkdir()
        payload = candidate_pack()
        payload["status"] = "approved"  # Synthetic approval only in ephemeral test.
        private_path.write_text(json.dumps(payload, ensure_ascii=False))
        self.namespace.update({"app": App(), "ROOT": Path(self.temp.name), "current_prague_date": lambda: self.clock,
                               "TZ": dated.PRAGUE, "ATOMIC_RESULT_V1_ENABLED": True, "enforce_rate_limit": lambda *args, **kwargs: None})
        adapter = {"DatedDaily": dated.DatedDaily, "DailyPackInvalid": dated.DailyPackInvalid,
                   "DailyUnavailable": dated.DailyUnavailable, "iso_date": dated.iso_date,
                   "puzzle_digest": dated.puzzle_digest, "HTTPException": HTTPError,
                   "lru_cache": __import__("functools").lru_cache, "os": os,
                   "datetime": SimpleNamespace(now=lambda tz: datetime.combine(self.clock, datetime.min.time(), tz)),
                   "Query": lambda default=None: default, "JSONResponse": lambda payload, headers: {"payload": payload, "headers": headers}}
        compile_functions(ROOT/"candidate/backend/daily_runtime.py", {"install"}, adapter)
        with patch.dict(os.environ, {"PROPLET_DATED_DAILY_ENABLED": "true"}):
            adapter["install"](self.namespace)

    def test_historical_identity_and_compatibility_exactly_preserved(self):
        for day, (expected, valid) in self.historic.items():
            self.assertEqual(self.namespace["expected_daily_puzzle_id"](day), expected)
            self.assertEqual(self.namespace["valid_daily_puzzle_ids"](day), valid)

    def test_stale_client_cannot_enter_new_day_official_result(self):
        day = "2026-10-07"
        old = self.original_expected(day)
        valid = self.namespace["valid_daily_puzzle_ids"](day)
        self.assertEqual(len(valid), 1)
        self.assertNotIn(old, valid)
        self.assertFalse(self.namespace["daily_puzzle_matches_date"](old, day))
        official = next(iter(valid))
        body = candidate_pack()["puzzles"][official]
        self.assertTrue(self.namespace["puzzle_exists"](official, "daily", body["difficulty"]))
        self.assertEqual(self.namespace["resolved_puzzle"](official, "daily", body["difficulty"]), body)
        self.assertEqual(self.namespace["puzzle_info"](official)["generation"], 6)

    def test_api_future_date_id_list_and_cache_headers(self):
        route = self.responses["/api/daily"]
        for query, day, puzzle in (({}, "2026-10-08", None), ({"list": "1"}, None, None), ({}, "2026-10-07", candidate_pack()["bindings"][1]["puzzleId"])):
            with self.assertRaises(HTTPError) as found:
                route(SimpleNamespace(query_params=query), daily_date=day, puzzle_id=puzzle)
            self.assertEqual(found.exception.status_code, 404)
        response = route(SimpleNamespace(query_params={}), daily_date=None, puzzle_id=None)
        self.assertEqual(response["payload"]["dailyDate"], "2026-10-07")
        self.assertEqual(response["headers"]["Vercel-CDN-Cache-Control"], "no-store")
        future_id = candidate_pack()["bindings"][1]["puzzleId"]
        self.assertIsNone(self.namespace["dated_daily_shared_body"](future_id))

    def test_no_modulo_and_atomic_flag_guard(self):
        self.clock = date(2027, 1, 15)
        self.assertEqual(self.namespace["valid_daily_puzzle_ids"]("2027-01-15"), set())
        with self.assertRaises(HTTPError) as found:
            self.namespace["expected_daily_puzzle_id"]("2027-01-15")
        self.assertEqual(found.exception.status_code, 503)
        self.clock = date(2026, 10, 7)
        self.namespace["ATOMIC_RESULT_V1_ENABLED"] = False
        with self.assertRaises(HTTPError) as found:
            self.namespace["valid_daily_puzzle_ids"]("2026-10-07")
        self.assertEqual(found.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main(verbosity=2)
