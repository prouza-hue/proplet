#!/usr/bin/env python3
"""Focused server regressions for the 200-level bank and active-time rescue clock."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import sys
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


def test_free_summary_accepts_second_hundred() -> None:
    rows = [
        {"mode": "free", "difficulty": "easy", "puzzle_id": "g2-e-150"},
        {"mode": "free", "difficulty": "easy", "puzzle_id": "g2-e-201"},
    ]
    mapping = {
        "g2-e-150": {"difficulty": "easy", "level": 150, "generation": 2},
        "g2-e-201": {"difficulty": "easy", "level": 201, "generation": 2},
    }
    banks = {key: [{}] * 200 for key in ("easy", "medium", "hard", "hardcore")}
    with (
        patch.object(server, "load_puzzles", return_value={"free": banks}),
        patch.object(server, "free_puzzle_info", side_effect=lambda puzzle_id, _difficulty: mapping[puzzle_id]),
    ):
        summary = server.free_slot_summary(rows)
    assert summary["effective"]["easy"] == 1
    assert summary["gen2"]["easy"] == 1


def test_rescue_uses_active_time_not_background_wall_time() -> None:
    updated = []
    old_started = (datetime.now(server.TZ) - timedelta(minutes=10)).isoformat()
    row = {"id": "rescue-1", "status": "started", "started_at": old_started, "puzzle_id": "r-001"}
    payload = server.RescueFinish(puzzle_id="r-001", completed=True, elapsed_ms=20_000)
    with (
        patch.object(server, "auth_player", return_value={"id": "player-1"}),
        patch.object(server, "db_select", return_value=[row]),
        patch.object(server, "db_update", side_effect=lambda table, filters, values: updated.append((table, filters, values))),
        patch.object(server, "player_stats", return_value={}),
    ):
        result = server.rescue_finish(payload, authorization="Bearer test")
    assert result["ok"] is True
    assert updated[0][2]["status"] == "passed"
    assert updated[0][2]["elapsed_ms"] == 20_000


def test_release_schema_and_health_metadata() -> None:
    migration = (ROOT / "SUPABASE_MIGRATION_V3_19.sql").read_text(encoding="utf-8")
    assert "level between 1 and 200" in migration
    with patch.object(server, "supabase_ready", return_value=False):
        health = server.health()
    assert health["version"] == "3.19.0"
    assert health["freeLevelsPerDifficulty"] == 200


if __name__ == "__main__":
    test_free_summary_accepts_second_hundred()
    test_rescue_uses_active_time_not_background_wall_time()
    test_release_schema_and_health_metadata()
    print("v3.19 server: 200-level slots, health metadata and active-time rescue clock OK")
