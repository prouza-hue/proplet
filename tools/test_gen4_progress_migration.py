#!/usr/bin/env python3
"""Regression coverage for Free/Daily progress across the Gen4 cutover."""
from __future__ import annotations

from copy import deepcopy
from datetime import date
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["VERCEL_ENV"] = "preview"
os.environ["VERCEL_GIT_COMMIT_REF"] = "agent/v3340-medium-calibration-v3"

import server


def result_payload(puzzle_id: str, difficulty: str, daily_date: str, puzzle: dict) -> server.ResultCreate:
    answers = len(puzzle.get("answers") or [])
    cells = len(puzzle.get("mask") or [])
    return server.ResultCreate(
        puzzle_id=puzzle_id,
        challenge_key=f"daily:{daily_date}",
        mode="daily",
        difficulty=difficulty,
        daily_date=daily_date,
        elapsed_ms=max(2500, cells * 90),
        moves=max(1, answers),
    )


def main() -> None:
    candidate = deepcopy(server.load_puzzles())
    candidate["dailyGeneration4From"] = "2026-08-24"
    candidate["dailyRotationBaseDate"] = "2026-08-24"
    candidate["release"] = {
        **(candidate.get("release") or {}),
        "status": "approved-bound",
        "productionApproved": True,
        "approvedBy": "Pavel",
        "dailyGeneration4From": "2026-08-24",
    }
    for window in (candidate.get("archive") or {}).get("dailyWindows") or []:
        if int(window.get("generation") or 0) == 3:
            window["activeUntil"] = "2026-08-23"

    original_load_puzzles = server.load_puzzles
    original_db_select = server.db_select
    original_db_insert = server.db_insert
    try:
        server.load_puzzles = lambda: candidate

        assert server.expected_daily_puzzle_id("2026-08-23") == "g3-d-007"
        assert server.expected_daily_puzzle_id("2026-08-24") == "g4-d-001"
        # Gen3 opened before deployment on cutover day remains syncable afterwards.
        cutover_ids = server.valid_daily_puzzle_ids("2026-08-24")
        assert "g3-d-008" in cutover_ids
        assert all(not puzzle_id.startswith("d-") for puzzle_id in cutover_ids)

        exact_info = server.archived_puzzle_info(
            server.load_content_catalog(), "g3-d-007", None, "daily", 4,
        )
        assert exact_info and exact_info["lineageConfidence"] == "exact"
        exact_difficulty = exact_info["difficulty"]
        assert server.puzzle_exists("g3-d-007", "daily", exact_difficulty)
        server.validate_result_sanity(result_payload(
            "g3-d-007", exact_difficulty, "2026-08-23", exact_info["puzzle"],
        ))

        # Gen1 contains metadata-only source records. They preserve historical
        # identity/statistics without reconstructing or exposing a playable body.
        assert server.expected_daily_puzzle_id("2026-08-11") == "d-223"
        inferred_info = server.archived_puzzle_info(
            server.load_content_catalog(), "d-223", "easy", "daily", 4,
        )
        assert inferred_info and inferred_info["lineageConfidence"] == "inferred"
        assert server.puzzle_exists("d-223", "daily", "easy")
        server.validate_result_sanity(result_payload(
            "d-223", "easy", "2026-08-11", inferred_info["puzzle"],
        ))

        # A completed Gen3 Free slot transfers to Gen4 and can never award XP twice.
        legacy_id = "g3-e-001"
        legacy_info = server.free_puzzle_info(legacy_id, "easy")
        assert legacy_info and legacy_info["legacy"] is True and legacy_info["level"] == 1
        old_result = {
            "id": "old-result", "player_id": "player-1", "puzzle_id": legacy_id,
            "mode": "free", "difficulty": "easy", "points": 15,
        }
        summary = server.free_slot_summary([old_result])
        assert summary["effective"]["easy"] == 1
        assert summary["transferred"]["easy"] == 1

        inserted: list[dict] = []
        server.db_select = lambda table, **filters: (
            [old_result] if table == "results" else []
        )
        server.db_insert = lambda table, payload: inserted.append({"table": table, **payload})
        points, transferred = server.claim_free_slot_points(
            "player-1", legacy_info, 15, legacy_id,
        )
        assert (points, transferred) == (0, True)
        assert inserted and inserted[0]["table"] == "free_slot_rewards"
        assert inserted[0]["points"] == 0
    finally:
        server.load_puzzles = original_load_puzzles
        server.db_select = original_db_select
        server.db_insert = original_db_insert

    print("Gen4 progress migration verified: Daily cutover/cache + Free slot XP continuity.")


if __name__ == "__main__":
    main()
