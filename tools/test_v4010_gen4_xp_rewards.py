#!/usr/bin/env python3
"""Focused regression tests for the v4.01 Gen4 per-board XP repair."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def fake_info(puzzle_id: str, difficulty: str | None = None):
    mapping = {
        "old-easy-1": {"difficulty": "easy", "level": 1, "generation": 3, "legacy": True},
        "g4-easy-1": {"difficulty": "easy", "level": 1, "generation": 4, "legacy": False},
        "g4-hard-2": {"difficulty": "hard", "level": 2, "generation": 4, "legacy": False},
    }
    return mapping.get(puzzle_id)


original_load_puzzles = server.load_puzzles
original_free_puzzle_info = server.free_puzzle_info
original_db_update = server.db_update
original_load_rolling_content = server.load_rolling_content
try:
    server.load_puzzles = lambda: {
        "freeGeneration": 4,
        "free": {
            "easy": [{"id": "g4-easy-1"}],
            "medium": [],
            "hard": [{"id": "g4-hard-2"}],
            "hardcore": [],
        },
    }
    server.load_rolling_content = lambda: {"puzzles": {}}
    server.free_puzzle_info = fake_info
    updates = []
    server.db_update = lambda table, filters, values: updates.append((table, filters, values)) or [values]

    rows = [
        {"id": "old", "player_id": "p1", "mode": "free", "difficulty": "easy", "puzzle_id": "old-easy-1", "points": 15, "completed_at": "2026-08-01T10:00:00+02:00"},
        {"id": "new-easy", "player_id": "p1", "mode": "free", "difficulty": "easy", "puzzle_id": "g4-easy-1", "points": 0, "completed_at": "2026-08-23T00:10:00+02:00"},
        {"id": "new-hard", "player_id": "p1", "mode": "free", "difficulty": "hard", "puzzle_id": "g4-hard-2", "points": 0, "completed_at": "2026-08-23T00:20:00+02:00"},
    ]
    repair = server.reconcile_gen4_free_rewards("p1", rows)
    assert repair == {"repairedXp": 565, "returnBonusXp": 500, "bonusAwardedNow": 500}
    assert rows[1]["points"] == 515
    assert rows[2]["points"] == 50
    assert len(updates) == 2

    updates.clear()
    second = server.reconcile_gen4_free_rewards("p1", rows)
    assert second == {"repairedXp": 0, "returnBonusXp": 500, "bonusAwardedNow": 0}
    assert updates == []

    new_player = [
        {"id": "new-only", "player_id": "p2", "mode": "free", "difficulty": "easy", "puzzle_id": "g4-easy-1", "points": 0, "completed_at": "2026-08-23T00:30:00+02:00"},
    ]
    no_bonus = server.reconcile_gen4_free_rewards("p2", new_player)
    assert no_bonus == {"repairedXp": 15, "returnBonusXp": 0, "bonusAwardedNow": 0}
    assert new_player[0]["points"] == 15

    awarded, transferred = server.claim_free_slot_points(
        "p1", {"difficulty": "easy", "level": 1, "generation": 4, "legacy": False}, 15, "g4-easy-1"
    )
    assert (awarded, transferred) == (15, False)
finally:
    server.load_puzzles = original_load_puzzles
    server.load_rolling_content = original_load_rolling_content
    server.free_puzzle_info = original_free_puzzle_info
    server.db_update = original_db_update

print("Proplet v4.01.4 Gen4 XP reward contract: OK")
