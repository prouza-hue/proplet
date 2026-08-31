#!/usr/bin/env python3
"""P0 regression: a released Tajenka can pass result validation and award XP."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend.contracts import ResultCreate  # noqa: E402


def payload_for(puzzle: dict) -> ResultCreate:
    return ResultCreate(
        puzzle_id=puzzle["id"],
        challenge_key=f"tajenka:{puzzle['id']}",
        mode="tajenka",
        difficulty=puzzle["difficulty"],
        elapsed_ms=60_000,
        moves=len(puzzle["answers"]),
        hints_used=0,
        wrong_attempts=0,
        max_hint_level=0,
        clean_solve=True,
        completed_at="2026-08-31T10:00:00+02:00",
    )


week_one = server.tajenka_puzzle_for_week(1)
week_two = server.tajenka_puzzle_for_week(2)
assert week_one and week_two

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "current_prague_date", return_value=date(2026, 8, 31)),
):
    resolved = server.resolved_puzzle(week_one["id"], "tajenka", week_one["difficulty"])
    assert resolved and resolved["id"] == week_one["id"]
    server.validate_result_sanity(payload_for(week_one))

    # A future prepared week remains unavailable until its scheduled release.
    assert server.resolved_puzzle(week_two["id"], "tajenka", week_two["difficulty"]) is None

with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", False),
    patch.object(server, "current_prague_date", return_value=date(2026, 8, 31)),
):
    assert server.resolved_puzzle(week_one["id"], "tajenka", week_one["difficulty"]) is None


inserted: list[tuple[str, dict]] = []


def fake_insert(table: str, values: dict):
    inserted.append((table, values))
    return [values]


with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "current_prague_date", return_value=date(2026, 8, 31)),
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "auth_player", return_value={"id": "00000000-0000-0000-0000-000000000001", "name": "Test"}),
    patch.object(server, "db_select", return_value=[]),
    patch.object(server, "db_insert", side_effect=fake_insert),
    patch.object(server, "record_puzzle_run"),
    patch.object(server, "rankings_v2_schema_ready", return_value=False),
    patch.object(server, "player_stats", return_value={"xp": 200}),
):
    response = server.result(payload_for(week_one), Mock(), "Bearer test")

assert response["ok"] is True
assert response["firstCompletion"] is True
assert response["awardedPoints"] == 200
assert response["statsWarning"] is None
result_rows = [values for table, values in inserted if table == "results"]
assert len(result_rows) == 1
assert result_rows[0]["mode"] == "tajenka"
assert result_rows[0]["points"] == 200


with (
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "auth_player", return_value={"id": "00000000-0000-0000-0000-000000000001"}),
    patch.object(server, "db_select", return_value=[result_rows[0]]),
):
    synced = server.progress(Mock(), "Bearer test")["completed"]

assert len(synced) == 1
assert synced[0]["mode"] == "tajenka"
assert synced[0]["puzzleId"] == week_one["id"]
assert synced[0]["challengeKey"] == f"tajenka:{week_one['id']}"
assert synced[0]["points"] == 200


with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "current_prague_date", return_value=date(2026, 8, 31)),
):
    try:
        server.validate_result_sanity(payload_for(week_two))
    except HTTPException as error:
        assert error.status_code == 400
        assert error.detail == "Neznámá úloha"
    else:
        raise AssertionError("future Tajenka must remain rejected")


print("PASS: released Tajenka result validates, awards 200 XP, and syncs to the account")
