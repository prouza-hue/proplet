#!/usr/bin/env python3
"""Historical pool boundaries and safe result commands; no external transport."""
from contextlib import ExitStack
from datetime import date
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import server

def fail(*args, **kwargs):
    raise AssertionError("unexpected history or legacy write")

rows = [
    {"id": "later", "mode": "free", "difficulty": "hard",
     "puzzle_id": "g4-h-029", "points": 550},
]
def info(puzzle_id, difficulty=None):
    return {"difficulty": "hard", "level": 29,
            "generation": 4 if puzzle_id.startswith("g4") else 3, "legacy": True}

with patch.object(server, "db_select", return_value=rows), patch.object(server, "free_puzzle_info", side_effect=info):
    assert not server.free_slot_already_rewarded("player", "hard", 29)
    rows.append({"id": "legacy", "mode": "free", "difficulty": "hard",
                 "puzzle_id": "h3-029", "points": 50})
    assert server.free_slot_already_rewarded("player", "hard", 29)

# Per-board rewards remain independent even when that board becomes an archive.
with patch.object(server, "db_select", side_effect=fail), patch.object(server, "db_insert", side_effect=fail):
    assert server.claim_free_slot_points("player", {"generation": 4, "legacy": True}, 50, "g4-h-029") == (50, False)
    assert server.claim_free_slot_points("player", {"generation": 6, "legacy": False}, 50, "g6-h-029") == (50, False)
    try:
        server.claim_free_slot_points("player", {"generation": 3, "legacy": True}, 50, "h3-029")
    except HTTPException as exc:
        assert exc.status_code == 503
    else:
        raise AssertionError("historical non-atomic writer must fail closed")

payload = server.ResultCreate(
    puzzle_id="h3-029", challenge_key="free:h3-029", mode="free", difficulty="hard",
    elapsed_ms=42000, moves=12, attempt_id="archive-boundary-command",
    completed_at="2026-10-04T10:00:00+00:00",
)
player = {"id": "00000000-0000-4000-8000-000000000001", "family_code": "SOLO_TEST"}
request = SimpleNamespace(headers={"X-Proplet-Result-Receipt": "1"},
    state=SimpleNamespace(request_id="archive-boundary"), client=SimpleNamespace(host="127.0.0.1"),
    url=SimpleNamespace(path="/api/result"))
calls = []
receipt = {"commandId": "00000000-0000-4000-8000-000000000010",
    "firstCompletion": True, "awardedPoints": 0, "dailyGenerationUpgrade": False,
    "transferredSlot": True, "attemptStatus": "created_offline"}
def select(table, **filters):
    if table in ("result_commands", "puzzle_attempts"):
        return []
    raise AssertionError(("unexpected full history", table, filters))
def rpc(name, body):
    calls.append((name, body))
    return receipt
with ExitStack() as stack:
    for item in (
        patch.object(server, "ATOMIC_RESULT_V1_ENABLED", True),
        patch.object(server, "HISTORICAL_FREE_REWARDS_ENABLED", True),
        patch.object(server, "enforce_rate_limit"),
        patch.object(server, "auth_player", return_value=player),
        patch.object(server, "puzzle_exists", return_value=True),
        patch.object(server, "validate_result_sanity"),
        patch.object(server, "free_puzzle_info", return_value={"puzzle": {"id": "h3-029"}, **info("h3-029")}),
        patch.object(server, "is_puzzle_released", return_value=True),
        patch.object(server, "effective_content_date", return_value=date(2026, 10, 4)),
        patch.object(server, "db_select", side_effect=select),
        patch.object(server, "db_atomic_result_rpc", side_effect=rpc),
        patch.object(server, "rankings_v2_schema_ready", return_value=False),
        patch.object(server, "player_stats", side_effect=fail),
        patch.object(server, "free_slot_already_rewarded", side_effect=fail),
        patch.object(server, "claim_free_slot_points", side_effect=fail),
        patch.object(server, "db_insert", side_effect=fail),
        patch.object(server, "db_update", side_effect=fail),
    ):
        stack.enter_context(item)
    result = server.result(payload, request, "Bearer test")
    server.HISTORICAL_FREE_REWARDS_ENABLED = False
    try:
        server.result(payload, request, "Bearer test")
    except HTTPException as exc:
        assert exc.status_code == 503
    else:
        raise AssertionError("closed historical gate unexpectedly accepted")
    assert len(calls) == 1
assert result["awardedPoints"] == 0 and result["transferredSlot"] is True
assert len(calls) == 1
command = calls[0][1]["p_command"]
assert command["points"] == 50
assert command["legacyRewardSlot"] == {"difficulty": "hard", "level": 29}
assert command["contentGeneration"] == 3
print("PASS historical pool: G4 separate, legacy fallback denied, atomic claim owns XP without history read")

# Preparation defaults closed; opt-in never makes non-atomic writing safe.
from backend.config import load_settings
with patch.dict("os.environ", {"PROPLET_HISTORICAL_FREE_REWARDS_ENABLED": "false"}):
    assert load_settings().historical_free_rewards_enabled is False
with patch.dict("os.environ", {"PROPLET_HISTORICAL_FREE_REWARDS_ENABLED": "true"}):
    assert load_settings().historical_free_rewards_enabled is True
