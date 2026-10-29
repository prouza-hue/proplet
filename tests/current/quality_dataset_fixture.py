"""Small synthetic calibration cohort, independent of the published puzzle bank."""
from copy import deepcopy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

NOW = datetime(2026, 10, 29, 12, tzinfo=ZoneInfo("Europe/Prague"))


def fixture():
    puzzles = {"daily": [], "free": {"easy": [], "medium": [], "hard": [], "hardcore": []}}
    attempts, feedback = [], []
    for difficulty in ("easy", "medium", "hard"):
        for j in range(6):
            pid = f"synthetic-{difficulty}-{j}"
            level = 151 + j if difficulty == "medium" else j + 1
            puzzles["free"][difficulty].append({"id": pid, "difficulty": difficulty, "mask": list(range(9)),
                "answers": [{"word": "PES", "turns": j % 3}, {"word": "LES", "turns": 1}],
                "meta": {"level": level, "cells": 9, "difficultyScore": 20 + j}})
            for i in range(25):
                done = not (j == 1 and i < 9)
                elapsed = [90000, 240000, 45000, 100000, 110000, 120000][j]
                if difficulty == "hard":
                    elapsed *= 3
                attempts.append({"id": f"attempt-{difficulty}-{j}-{i}", "player_id": f"actor-{i}", "anonymous_id": None,
                    "puzzle_id": pid, "difficulty": difficulty, "mode": "free", "calm_mode": False,
                    "started_at": (NOW - timedelta(days=3)).isoformat(), "completed_at": NOW.isoformat() if done else None,
                    "elapsed_ms": elapsed + i * 300 if done else None, "hints_used": 2 if j == 1 else 0,
                    "wrong_attempts": 5 if j == 1 else 0, "clean_solve": j != 1 if done else None,
                    "first_correct_ms": 20000 if done else None, "first_hint_ms": 120000 if j == 1 else None,
                    "reset_count": 1 if j == 1 else 0, "resume_count": i % 2})
            feedback.extend({"puzzle_id": pid, "rating": 1 if j == 1 else -1 if j == 2 else 0} for _ in range(10))
    # Separate calm calibration, a retired ID and a future completion cutoff.
    calm = deepcopy(attempts[0]); calm.update(id="calm", calm_mode=True, elapsed_ms=900000)
    retired = deepcopy(attempts[1]); retired.update(id="retired", puzzle_id="retired-id", elapsed_ms=9999999)
    future = deepcopy(attempts[2]); future.update(id="future", player_id=None, anonymous_id="new-guest",
        completed_at=(NOW + timedelta(days=1)).isoformat())
    replay = deepcopy(attempts[0]); replay.update(id="replay", started_at=NOW.isoformat(), elapsed_ms=1000)
    attempts.extend([calm, retired, future, replay])
    return {"puzzles": puzzles, "attempts": attempts, "feedback": feedback,
        "word_feedback": [{"puzzle_id": "synthetic-easy-1"}, {"puzzle_id": "synthetic-easy-1"}],
        "hint_events": [
            {"attempt_id": "attempt-easy-1-12", "hint_level": 2, "source": "manual", "complimentary": True},
            {"attempt_id": "calm", "hint_level": 1, "source": "helper", "complimentary": False}],
        "helper_events": [
            {"attempt_id": "attempt-easy-1-12", "event_type": "offered", "support_mode": "older", "idle_ms": 70000},
            {"attempt_id": "attempt-easy-1-12", "event_type": "accepted", "support_mode": "older", "idle_ms": 70000},
            {"attempt_id": "attempt-hard-0-2", "event_type": "dismissed", "support_mode": "younger", "idle_ms": 45000}],
        "event_counts": {"app_open": 30, "account_authenticated": 20}}
