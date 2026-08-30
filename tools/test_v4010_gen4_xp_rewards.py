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
original_db_select = server.db_select
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
    rows = [
        {"id": "old", "player_id": "p1", "mode": "free", "difficulty": "easy", "puzzle_id": "old-easy-1", "points": 15, "completed_at": "2026-08-01T10:00:00+02:00"},
        {"id": "new-easy", "player_id": "p1", "mode": "free", "difficulty": "easy", "puzzle_id": "g4-easy-1", "points": 0, "completed_at": "2026-08-23T00:10:00+02:00"},
        {"id": "new-hard", "player_id": "p1", "mode": "free", "difficulty": "hard", "puzzle_id": "g4-hard-2", "points": 0, "completed_at": "2026-08-23T00:20:00+02:00"},
    ]
    updates = []
    server.db_select = lambda table, **filters: [dict(row) for row in rows]

    def update(table, filters, values):
        for row in rows:
            if all(row.get(key) == value for key, value in filters.items()):
                row.update(values)
                updates.append((table, filters, values))
                return [dict(row)]
        return []

    server.db_update = update
    dry_run = server.repair_gen4_free_rewards("p1")
    assert dry_run["dryRun"] is True and dry_run["candidateRows"] == 2
    assert dry_run["plannedXp"] == 565 and dry_run["plannedBonusXp"] == 500
    assert dry_run["appliedXp"] == 0
    assert rows[1]["points"] == 0 and rows[2]["points"] == 0 and updates == []

    repair = server.repair_gen4_free_rewards("p1", dry_run=False)
    assert repair["appliedRows"] == 2 and repair["conflicts"] == 0
    assert repair["plannedXp"] == repair["appliedXp"] == 565
    assert rows[1]["points"] == 515 and rows[2]["points"] == 50
    assert len(updates) == 2

    second = server.repair_gen4_free_rewards("p1", dry_run=False)
    assert second["candidateRows"] == second["appliedRows"] == 0
    assert len(updates) == 2

    new_player = [
        {"id": "new-only", "player_id": "p2", "mode": "free", "difficulty": "easy", "puzzle_id": "g4-easy-1", "points": 0, "completed_at": "2026-08-23T00:30:00+02:00"},
    ]
    server.db_select = lambda table, **filters: [dict(row) for row in new_player]
    no_bonus = server.repair_gen4_free_rewards("p2")
    assert no_bonus["plannedXp"] == 15 and no_bonus["returnBonusXp"] == 0
    assert new_player[0]["points"] == 0

    server.db_select = lambda table, **filters: []
    awarded, transferred = server.claim_free_slot_points(
        "p1", {"difficulty": "easy", "level": 1, "generation": 4, "legacy": False}, 15, "g4-easy-1"
    )
    assert (awarded, transferred) == (15, False)
finally:
    server.load_puzzles = original_load_puzzles
    server.load_rolling_content = original_load_rolling_content
    server.free_puzzle_info = original_free_puzzle_info
    server.db_select = original_db_select
    server.db_update = original_db_update

print("Proplet v4.01.7 Gen4 XP reward contract: OK")
