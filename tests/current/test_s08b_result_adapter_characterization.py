#!/usr/bin/env python3
"""Pre-runtime characterization for the Sprint 08B result adapter.

This test is intentionally written against the legacy route before the atomic
adapter exists.  The rollout flag must leave this exact write order and public
response available as the bounded rollback path.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


payload = server.ResultCreate(
    puzzle_id="g4-e-001",
    challenge_key="free:g4-e-001",
    mode="free",
    difficulty="easy",
    elapsed_ms=42_000,
    moves=12,
    hints_used=1,
    wrong_attempts=2,
    max_hint_level=1,
    attempt_id="attempt-characterization-001",
    clean_solve=True,
    completed_at="2026-08-30T12:00:00+00:00",
    calm_mode=False,
)
player = {"id": "00000000-0000-4000-8000-000000000001", "family_code": "SOLO_TEST"}
bound_attempt = {
    "id": payload.attempt_id,
    "player_id": player["id"],
    "puzzle_id": payload.puzzle_id,
    "challenge_key": payload.challenge_key,
    "mode": payload.mode,
    "difficulty": payload.difficulty,
}
request = SimpleNamespace(
    headers={},
    state=SimpleNamespace(request_id="s08b-characterization"),
    client=SimpleNamespace(host="127.0.0.1"),
    url=SimpleNamespace(path="/api/result"),
)

events: list[tuple] = []


def fake_select(table: str, **filters):
    events.append(("select", table, filters))
    if table == "puzzle_attempts":
        return [bound_attempt]
    if table == "results":
        return []
    raise AssertionError(f"unexpected read: {table} {filters}")


def fake_insert(table: str, row: dict):
    events.append(("insert", table, row))
    return row


def fake_update(table: str, filters: dict, values: dict):
    events.append(("update", table, filters, values))
    return [{**filters, **values}]


def fake_record_run(player_id: str, submitted, effective_clean: bool):
    events.append(("run", player_id, submitted.challenge_key, effective_clean))


stats_fixture = {"xp": 15, "streak": 0}
with (
    patch.object(server, "enforce_rate_limit", lambda *args, **kwargs: None),
    patch.object(server, "auth_player", lambda authorization: player),
    patch.object(server, "puzzle_exists", lambda *args: True),
    patch.object(server, "validate_result_sanity", lambda submitted: None),
    patch.object(server, "free_puzzle_info", lambda *args: {
        "puzzle": {"id": payload.puzzle_id},
        "difficulty": "easy",
        "level": 1,
        "generation": 4,
        "legacy": False,
    }),
    patch.object(server, "is_puzzle_released", lambda *args: True),
    patch.object(server, "effective_content_date", lambda req: __import__("datetime").date(2026, 8, 30)),
    patch.object(server, "claim_free_slot_points", lambda *args: (15, False)),
    patch.object(server, "record_puzzle_run", fake_record_run),
    patch.object(server, "db_select", fake_select),
    patch.object(server, "db_insert", fake_insert),
    patch.object(server, "db_update", fake_update),
    patch.object(server, "rankings_v2_schema_ready", lambda: False),
    patch.object(server, "player_stats", lambda player_id: stats_fixture),
):
    response = server.result(payload, request, "Bearer test")


assert response == {
    "ok": True,
    "firstCompletion": True,
    "awardedPoints": 15,
    "dailyGenerationUpgrade": False,
    "transferredSlot": False,
    "stats": stats_fixture,
    "statsWarning": None,
}
assert events[0] == (
    "select",
    "puzzle_attempts",
    {"id": payload.attempt_id, "player_id": player["id"]},
)
assert events[1] == ("run", player["id"], payload.challenge_key, False)
assert events[2] == (
    "select",
    "results",
    {"player_id": player["id"], "challenge_key": payload.challenge_key},
)
assert events[3][0:2] == ("insert", "results")
assert events[3][2]["points"] == 15
assert events[3][2]["clean_solve"] is False
assert events[4][0:2] == ("select", "puzzle_attempts")
assert events[5][0:2] == ("update", "puzzle_attempts")

print("PASS: Sprint 08B legacy adapter characterization")
