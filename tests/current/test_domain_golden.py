"""Execute the shared domain vectors against the real Python runtime helpers."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend import content  # noqa: E402


FIXTURE = json.loads((ROOT / "contracts" / "domain-golden-v1.json").read_text(encoding="utf-8"))
DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor")
POINTS = {"daily": 100, "easy": 15, "medium": 25, "hard": 50, "hardcore": 100, "mozkomor": 150}


def test_xp_vectors() -> None:
    for vector in FIXTURE["xp"]:
        assert content.xp_for(
            vector["mode"], vector.get("difficulty"), POINTS,
            reward_xp=vector.get("rewardXp"),
        ) == vector["expected"]


def test_challenge_key_vectors() -> None:
    for vector in FIXTURE["challengeKeys"]:
        assert content.challenge_key(
            vector["mode"], vector["puzzleId"], vector.get("dailyDate"),
        ) == vector["expected"]


def test_streak_vectors() -> None:
    for vector in FIXTURE["streak"]:
        current, longest = content.streaks(vector["dates"], date.fromisoformat(vector["today"]))
        assert (current, longest) == (vector["current"], vector["longest"])


def test_unlock_vectors() -> None:
    for vector in FIXTURE["unlock"]:
        slots = {"baseCurrent": {"hardcore": vector["baseCurrentHardcore"]}}
        assert content.mozkomor_unlocked_from_rows(vector["rows"], slots) is vector["expected"]


def test_rank_vectors() -> None:
    rows = [vector["serverRow"] for vector in FIXTURE["rank"]]
    assert [list(content.run_rank_tuple(row)) for row in rows] == [vector["expected"] for vector in FIXTURE["rank"]]
    assert content.competition_ranks(rows) == [1, 1, 3, 4]


def test_daily_vectors() -> None:
    for vector in FIXTURE["daily"]:
        assert content.expected_daily_puzzle_id(vector["data"], vector["date"]) == vector["expected"]


def test_free_selection_vectors() -> None:
    selection = FIXTURE["freeSelection"]
    for vector in selection["cases"]:
        resolved = content.free_puzzle_info(
            selection["data"], selection["rolling"], vector["id"], DIFFICULTIES,
        )
        expected = vector["expected"]
        if expected is None:
            assert resolved is None
        else:
            assert {key: resolved.get(key) for key in expected} == expected


def test_release_vectors() -> None:
    for vector in FIXTURE["release"]:
        puzzle = {"meta": {"availableFrom": vector["availableFrom"]}}
        assert content.is_puzzle_released(puzzle, date.fromisoformat(vector["asOf"])) is vector["expected"]


def test_intentional_content_source_delta() -> None:
    server = json.loads((ROOT / "data" / "puzzles.json").read_text(encoding="utf-8"))
    public = json.loads((ROOT / "public" / "puzzles.json").read_text(encoding="utf-8"))
    assert len(server["daily"]) == FIXTURE["contentSources"]["serverDailyCount"]
    assert len(public["daily"]) == FIXTURE["contentSources"]["publicDailyCount"]


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"domain golden vectors (Python): {len(tests)} PASS")
