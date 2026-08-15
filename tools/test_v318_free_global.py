#!/usr/bin/env python3
"""Regression checks for anonymous per-level Free global standings."""

from __future__ import annotations

import copy
import hashlib
import sys
from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


TOKEN = "pavel-global-token"
PLAYER_IDS = [f"00000000-0000-0000-0000-00000000000{i}" for i in range(1, 5)]
PUZZLE = server.load_puzzles()["free"]["medium"][0]
PUZZLE_ID = PUZZLE["id"]

tables = {
    "players": [
        {
            "id": player_id,
            "name": name,
            "family_code": "PROUZA" if index < 2 else "OTHER",
            "avatar": "🙂",
            "token_hash": hashlib.sha256(TOKEN.encode()).hexdigest() if index == 0 else f"hash-{index}",
        }
        for index, (player_id, name) in enumerate(zip(PLAYER_IDS, ("Pavel", "Peter", "Eva", "Adam")))
    ],
    "player_sessions": [],
    "puzzle_runs": [
        # Pavel's first completion used two hints. A later clean replay must not improve it.
        {"id": "run-pavel-first", "attempt_id": "attempt-pavel-first", "player_id": PLAYER_IDS[0], "puzzle_id": PUZZLE_ID, "mode": "free", "elapsed_ms": 60_000, "moves": 20, "hints_used": 2, "wrong_attempts": 0, "clean_solve": False, "completed_at": "2026-08-13T08:00:00+02:00"},
        {"id": "run-pavel-replay", "attempt_id": "attempt-pavel-replay", "player_id": PLAYER_IDS[0], "puzzle_id": PUZZLE_ID, "mode": "free", "elapsed_ms": 10_000, "moves": 5, "hints_used": 0, "wrong_attempts": 0, "clean_solve": True, "completed_at": "2026-08-13T09:00:00+02:00"},
        {"id": "run-peter", "attempt_id": "attempt-peter", "player_id": PLAYER_IDS[1], "puzzle_id": PUZZLE_ID, "mode": "free", "elapsed_ms": 90_000, "moves": 30, "hints_used": 0, "wrong_attempts": 0, "clean_solve": True, "completed_at": "2026-08-13T08:10:00+02:00"},
        {"id": "run-eva", "attempt_id": "attempt-eva", "player_id": PLAYER_IDS[2], "puzzle_id": PUZZLE_ID, "mode": "free", "elapsed_ms": 120_000, "moves": 25, "hints_used": 1, "wrong_attempts": 0, "clean_solve": False, "completed_at": "2026-08-13T08:20:00+02:00"},
        {"id": "run-adam", "attempt_id": "attempt-adam", "player_id": PLAYER_IDS[3], "puzzle_id": PUZZLE_ID, "mode": "free", "elapsed_ms": 70_000, "moves": 18, "hints_used": 2, "wrong_attempts": 0, "clean_solve": False, "completed_at": "2026-08-13T08:30:00+02:00"},
    ],
}


def fake_select(table: str, **filters):
    return [
        copy.deepcopy(row)
        for row in tables.get(table, [])
        if all(row.get(key) == value for key, value in filters.items() if value is not None)
    ]


server.db_select = fake_select
server.db_select_all = fake_select

board = server.free_global_leaderboard(PUZZLE_ID, f"Bearer {TOKEN}")
assert board["total"] == 4
assert board["myRank"] == 3
assert board["attemptPolicy"] == "first-completed-only"
assert board["privacy"] == "anonymous-performance-only"
assert [row["rank"] for row in board["rows"]] == [2, 3, 4]
mine = next(row for row in board["rows"] if row["isMine"])
assert mine["elapsedMs"] == 60_000 and mine["hintsUsed"] == 2 and mine["cleanSolve"] is False

# The public response must never expose identity or team membership.
serialized = repr(board).casefold()
for forbidden in ("pavel", "peter", "eva", "adam", "prouza", "player_id", "family_code", "avatar"):
    assert forbidden not in serialized

# Anonymous visitors see only the leading neighbourhood, still without identities.
anonymous = server.free_global_leaderboard(PUZZLE_ID, None)
assert anonymous["myRank"] is None
assert [row["rank"] for row in anonymous["rows"]] == [1, 2, 3]
assert not any(row["isMine"] for row in anonymous["rows"])

# Real routing passes the bearer token into the privacy-safe endpoint.
client = TestClient(server.app)
response = client.get(
    "/api/free-global-leaderboard",
    params={"puzzle_id": PUZZLE_ID},
    headers={"Authorization": f"Bearer {TOKEN}"},
)
assert response.status_code == 200 and response.json()["myRank"] == 3

# Archived boards never mix with the active generation.
legacy_id = server.load_puzzles()["legacyFree"]["medium"][0]["id"]
try:
    server.free_global_leaderboard(legacy_id, f"Bearer {TOKEN}")
    raise AssertionError("legacy Free puzzle entered the active global leaderboard")
except HTTPException as exc:
    assert exc.status_code == 404

app_js = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
admin_js = (ROOT / "public" / "admin.js").read_text(encoding="utf-8")
assert "🌍 Globálně" in app_js and "👥 Můj tým" in app_js
assert "Čisté vyřešení → méně nápověd → čas → tahy" in app_js
assert "Clean →" not in app_js
assert ">Clean<" not in admin_js

print("v3.18 Free global leaderboard, first-attempt fairness and Czech copy: OK")
