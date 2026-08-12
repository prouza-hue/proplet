#!/usr/bin/env python3
"""Offline regression test for Quality Analytics v2. Does not touch Supabase."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402

TZ = ZoneInfo("Europe/Prague")
now = datetime.now(TZ)
puzzles = server.load_puzzles()["free"]["easy"][:4]
ids = [p["id"] for p in puzzles]
attempts, runs, feedback = [], [], []

for j, pid in enumerate(ids):
    for i in range(25):
        completed = not (j == 1 and i < 9)
        base = [90_000, 240_000, 45_000, 100_000][j]
        attempts.append({
            "id": f"a-{j}-{i}", "player_id": f"p{i}", "puzzle_id": pid,
            "challenge_key": f"free:{pid}", "mode": "free", "difficulty": "easy",
            "started_at": (now - timedelta(days=2)).isoformat(),
            "last_activity_at": (now - timedelta(days=2)).isoformat(),
            "completed_at": now.isoformat() if completed else None,
            "elapsed_ms": base + i * 300 if completed else None,
            "wrong_attempts": [1, 5, 0, 1][j] if completed else 0,
            "hints_used": [0, 2, 0, 0][j] if completed else 0,
            "reset_count": [0, 1, 0, 0][j] if completed else 0,
            "clean_solve": [True, False, True, True][j] if completed else None,
            "first_hint_at_ms": 120_000 if j == 1 and completed else None,
            "first_correct_at_ms": 20_000 if completed else None,
        })
        if completed:
            runs.append({"id": f"r-{j}-{i}", "player_id": f"p{i}", "puzzle_id": pid, "completed_at": now.isoformat()})
    for i in range(10):
        feedback.append({
            "id": f"f-{j}-{i}", "player_id": f"p{i}", "puzzle_id": pid,
            "kind": "difficulty", "rating": [0, 1, -1, 0][j],
        })

# A memorized replay must not improve the main first-exposure model.
attempts.append({
    "id": "replay", "player_id": "p0", "puzzle_id": ids[1], "challenge_key": f"free:{ids[1]}",
    "mode": "free", "difficulty": "easy", "started_at": now.isoformat(), "last_activity_at": now.isoformat(),
    "completed_at": now.isoformat(), "elapsed_ms": 10_000, "wrong_attempts": 0, "hints_used": 0,
    "reset_count": 0, "clean_solve": True,
})
runs.append({"id": "rr", "player_id": "p0", "puzzle_id": ids[1], "completed_at": now.isoformat()})

orig_all, orig_select = server.db_select_all, server.db_select
try:
    def fake_all(table, **kwargs):
        return {
            "puzzle_attempts": attempts,
            "puzzle_feedback": feedback,
            "puzzle_runs": runs,
            "quality_snapshots": [],
        }.get(table, [])
    server.db_select_all = fake_all
    server.db_select = lambda table, **kwargs: []
    report = server.build_quality_report(include_previous=False)
    rows = {r["puzzleId"]: r for r in report["rows"]}
    assert rows[ids[1]]["starts"] == 25
    assert rows[ids[1]]["completions"] == 16
    assert rows[ids[1]]["replays"] == 1
    assert rows[ids[1]]["difficultyIndex"] > 1.25
    assert rows[ids[1]]["status"] == "too_hard"
    assert rows[ids[2]]["difficultyIndex"] < 0
    print("Quality Analytics v2 regression: PASS")
    print("Hard synthetic puzzle index:", rows[ids[1]]["difficultyIndex"])
finally:
    server.db_select_all, server.db_select = orig_all, orig_select
