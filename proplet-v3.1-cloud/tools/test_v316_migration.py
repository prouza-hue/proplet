#!/usr/bin/env python3
"""Focused regression tests for the Free Gen2 slot migration."""

from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# The release container installs FastAPI/httpx from requirements.txt. The
# workspace audit only needs pure migration helpers, so tiny import stubs keep
# this focused test runnable without mutating the host Python environment.
if "httpx" not in sys.modules:
    sys.modules["httpx"] = types.ModuleType("httpx")
try:
    import fastapi  # noqa: F401
except ModuleNotFoundError:
    fastapi_stub = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str = "") -> None:
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class FastAPI:
        def __init__(self, **_kwargs) -> None:
            pass

        def __getattr__(self, name):
            if name in {"get", "post", "put", "delete", "exception_handler"}:
                return lambda *_args, **_kwargs: lambda fn: fn
            if name == "mount":
                return lambda *_args, **_kwargs: None
            raise AttributeError(name)

    fastapi_stub.FastAPI = FastAPI
    fastapi_stub.HTTPException = HTTPException
    fastapi_stub.Header = lambda default=None, **_kwargs: default
    fastapi_stub.Query = lambda default=None, **_kwargs: default
    fastapi_stub.Request = object
    responses_stub = types.ModuleType("fastapi.responses")
    responses_stub.JSONResponse = type("JSONResponse", (), {"__init__": lambda self, **_kwargs: None})
    responses_stub.RedirectResponse = type("RedirectResponse", (), {"__init__": lambda self, **_kwargs: None})
    staticfiles_stub = types.ModuleType("fastapi.staticfiles")
    staticfiles_stub.StaticFiles = type("StaticFiles", (), {"__init__": lambda self, **_kwargs: None})
    sys.modules["fastapi"] = fastapi_stub
    sys.modules["fastapi.responses"] = responses_stub
    sys.modules["fastapi.staticfiles"] = staticfiles_stub

import server  # noqa: E402


class FreeGeneration2MigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        server.load_puzzles.cache_clear()

    def test_active_ids_resolve_to_generation_two_slots(self) -> None:
        info = server.free_puzzle_info("g2-e-001", "easy")
        self.assertIsNotNone(info)
        self.assertEqual(info["level"], 1)
        self.assertEqual(info["generation"], 2)
        self.assertFalse(info["legacy"])

    def test_slot_summary_unions_legacy_and_gen2_without_double_counting(self) -> None:
        rows = [
            {"mode": "free", "difficulty": "easy", "puzzle_id": "old-e-1"},
            {"mode": "free", "difficulty": "easy", "puzzle_id": "g2-e-001"},
            {"mode": "free", "difficulty": "easy", "puzzle_id": "old-e-2"},
        ]
        mapping = {
            "old-e-1": {"difficulty": "easy", "level": 1, "generation": 1},
            "g2-e-001": {"difficulty": "easy", "level": 1, "generation": 2},
            "old-e-2": {"difficulty": "easy", "level": 2, "generation": 1},
        }
        with patch.object(server, "free_puzzle_info", side_effect=lambda puzzle_id, _difficulty: mapping[puzzle_id]):
            summary = server.free_slot_summary(rows)
        self.assertEqual(summary["effective"]["easy"], 2)
        self.assertEqual(summary["transferred"]["easy"], 1)
        self.assertEqual(summary["gen2"]["easy"], 1)

    def test_historical_slot_is_inserted_as_zero_point_claim(self) -> None:
        inserted = []

        def select(table: str, **_filters):
            if table == "results":
                return [{"mode": "free", "difficulty": "easy", "points": 10, "puzzle_id": "legacy-e-001"}]
            if table == "free_slot_rewards":
                return []
            raise AssertionError(table)

        legacy_info = {"difficulty": "easy", "level": 1, "generation": 1}
        with (
            patch.object(server, "db_select", side_effect=select),
            patch.object(server, "db_insert", side_effect=lambda table, row: inserted.append((table, row))),
            patch.object(server, "free_puzzle_info", return_value=legacy_info),
        ):
            awarded, transferred = server.claim_free_slot_points(
                "player-1", {"difficulty": "easy", "level": 1, "generation": 2}, 10, "g2-e-001"
            )

        self.assertEqual(awarded, 0)
        self.assertTrue(transferred)
        self.assertEqual(inserted[0][0], "free_slot_rewards")
        self.assertEqual(inserted[0][1]["points"], 0)

    def test_new_slot_receives_points_once(self) -> None:
        inserted = []

        def select(table: str, **_filters):
            if table in {"results", "free_slot_rewards"}:
                return []
            raise AssertionError(table)

        with (
            patch.object(server, "db_select", side_effect=select),
            patch.object(server, "db_insert", side_effect=lambda table, row: inserted.append((table, row))),
        ):
            awarded, transferred = server.claim_free_slot_points(
                "player-1", {"difficulty": "hardcore", "level": 7, "generation": 2}, 40, "g2-x-007"
            )

        self.assertEqual(awarded, 40)
        self.assertFalse(transferred)
        self.assertEqual(inserted[0][1]["points"], 40)

    def test_existing_claim_never_receives_points_again(self) -> None:
        def select(table: str, **_filters):
            if table == "results":
                return []
            if table == "free_slot_rewards":
                return [{"id": "claim-1"}]
            raise AssertionError(table)

        with (
            patch.object(server, "db_select", side_effect=select),
            patch.object(server, "db_insert") as insert,
        ):
            awarded, transferred = server.claim_free_slot_points(
                "player-1", {"difficulty": "medium", "level": 3, "generation": 2}, 20, "g2-m-003"
            )

        self.assertEqual(awarded, 0)
        self.assertTrue(transferred)
        insert.assert_not_called()


class DailyGeneration2MigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        server.load_puzzles.cache_clear()

    def test_primary_bank_switches_at_generation_two_boundary(self) -> None:
        data = server.load_puzzles()
        before = "2026-08-12"
        after = data["dailyGeneration2From"]
        before_index = server.daily_rotation_index(before, 365)
        after_index = server.daily_rotation_index(after, 365)
        self.assertEqual(
            server.expected_daily_puzzle_id(before),
            data["legacyDaily"][-1]["puzzles"][before_index]["id"],
        )
        self.assertEqual(
            server.expected_daily_puzzle_id(after),
            data["daily"][after_index]["id"],
        )

    def test_cached_legacy_and_active_daily_are_valid_for_same_date(self) -> None:
        data = server.load_puzzles()
        daily_date = data["dailyGeneration2From"]
        index = server.daily_rotation_index(daily_date, 365)
        valid = server.valid_daily_puzzle_ids(daily_date)
        self.assertIn(data["daily"][index]["id"], valid)
        self.assertIn(data["legacyDaily"][-1]["puzzles"][index]["id"], valid)
        self.assertEqual(len(valid), 2)

    def test_legacy_daily_id_remains_known_to_server(self) -> None:
        data = server.load_puzzles()
        archived = data["legacyDaily"][-1]["puzzles"][0]
        self.assertTrue(server.puzzle_exists(archived["id"], "daily", archived["difficulty"]))

    def test_unrelated_daily_id_is_rejected_for_date(self) -> None:
        data = server.load_puzzles()
        daily_date = data["dailyGeneration2From"]
        index = server.daily_rotation_index(daily_date, 365)
        wrong = data["daily"][(index + 1) % 365]["id"]
        self.assertFalse(server.daily_puzzle_matches_date(wrong, daily_date))

    def test_only_primary_board_can_replace_archived_result(self) -> None:
        data = server.load_puzzles()
        daily_date = data["dailyGeneration2From"]
        index = server.daily_rotation_index(daily_date, 365)
        active = data["daily"][index]
        archived = data["legacyDaily"][-1]["puzzles"][index]
        payload = server.ResultCreate(
            puzzle_id=active["id"], challenge_key=f"daily:{daily_date}", mode="daily",
            difficulty=active["difficulty"], elapsed_ms=12_000, moves=8, daily_date=daily_date,
        )
        self.assertTrue(server.is_daily_generation_upgrade({"puzzle_id": archived["id"]}, payload))
        self.assertFalse(server.is_daily_generation_upgrade({"puzzle_id": active["id"]}, payload))

        legacy_payload = payload.model_copy(update={"puzzle_id": archived["id"], "difficulty": archived["difficulty"]})
        self.assertFalse(server.is_daily_generation_upgrade({"puzzle_id": active["id"]}, legacy_payload))

    def test_result_upgrade_replaces_board_without_second_xp(self) -> None:
        data = server.load_puzzles()
        daily_date = data["dailyGeneration2From"]
        index = server.daily_rotation_index(daily_date, 365)
        active = data["daily"][index]
        archived = data["legacyDaily"][-1]["puzzles"][index]
        old = {
            "id": "result-1", "puzzle_id": archived["id"], "points": 100,
            "completed_at": f"{daily_date}T00:15:00+02:00",
        }
        payload = server.ResultCreate(
            puzzle_id=active["id"], challenge_key=f"daily:{daily_date}", mode="daily",
            difficulty=active["difficulty"], elapsed_ms=22_000, moves=10,
            daily_date=daily_date, completed_at=f"{daily_date}T09:30:00+02:00",
        )
        updates = []
        with (
            patch.object(server, "auth_player", return_value={"id": "player-1"}),
            patch.object(server, "puzzle_exists", return_value=True),
            patch.object(server, "daily_puzzle_matches_date", return_value=True),
            patch.object(server, "record_puzzle_run"),
            patch.object(server, "db_select", return_value=[old]),
            patch.object(server, "db_update", side_effect=lambda table, where, values: updates.append((table, where, values))),
            patch.object(server, "db_insert") as insert,
            patch.object(server, "player_stats", return_value={"points": 100}),
        ):
            response = server.result(payload, authorization="Bearer test")

        self.assertTrue(response["dailyGenerationUpgrade"])
        self.assertFalse(response["firstCompletion"])
        self.assertEqual(response["awardedPoints"], 0)
        self.assertEqual(updates[0][2]["puzzle_id"], active["id"])
        self.assertNotIn("points", updates[0][2])
        insert.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
