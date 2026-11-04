#!/usr/bin/env python3
"""P0 regression: a released Tajenka can pass result validation and award XP."""

from __future__ import annotations

import hashlib
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


week_eighteen = server.tajenka_puzzle_for_week(18)
assert [a["word"] for a in week_eighteen["answers"]] == ["KDO", "CHVÍLI", "STÁL", "STOJÍ", "OPODÁL"]
with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "current_prague_date", return_value=date(2026, 11, 4)),
):
    result = payload_for(week_eighteen)
    result.moves = 4
    server.validate_result_sanity(result)

# Both client versions must persist the same indices so the database can merge
# a pre-update pause with a finish on the new client without duplicating a word.
for index_offset in (0, 1):
    command = server.play_sessions.SessionCommand(
        action="finish", mode="tajenka", difficulty="medium", puzzle_id=week_eighteen["id"],
        challenge_key=result.challenge_key, attempt_id="week-18-resume",
        owner_id="00000000-0000-4000-8000-000000000099", sequence=2,
        progress={"found": [{"answerIndex": index + index_offset, "path": answer["path"]}
                            for index, answer in enumerate(week_eighteen["answers"][1:])]},
    )
    saved = server.play_sessions.canonical_progress(command, week_eighteen)
    assert [word["answerIndex"] for word in saved["found"]] == [1, 2, 3, 4]
    assert saved["moves"] == 4
    command.progress.found.pop()
    try:
        server.play_sessions.canonical_progress(command, week_eighteen)
    except HTTPException as error:
        assert error.detail == "Deska ještě není dokončená"
    else:
        raise AssertionError("Missing a playable word must still block completion")

print("PASS: released Tajenka result validates, awards 200 XP, and syncs to the account")


with (
    patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
    patch.object(server, "VERCEL_ENV", "production"),
    patch.object(server, "current_prague_date", return_value=date(2027, 4, 1)),
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "auth_player", return_value={"id": "account-a"}),
    patch.object(server, "TAJENKA_RECOVERY_ACTORS", set()) as cohort,
    patch.object(server, "db_select") as select,
):
    key = f"tajenka:{week_eighteen['id']}"
    assert server.tajenka_week_for(date(2027, 4, 1)) is None
    assert server.puzzle_exists(week_eighteen["id"], "tajenka", "medium")
    assert not server.puzzle_exists(week_two["id"], "tajenka", "medium")
    server.validate_result_sanity(result)
    shared = server.shared_puzzle(Mock(), "tajenka", week_eighteen["id"], None)
    assert week_eighteen["id"].encode() in shared.body
    found = [{"answerIndex": i, "word": a["word"], "path": a["path"]}
             for i, a in enumerate(week_eighteen["answers"]) if len(a["word"]) >= 4]
    case = {"created_at": "2026-11-04T12:00:00+00:00", "progress": {"found": found}}
    rows = [case]
    results = []
    anon = "synthetic-installation-uuid"
    guest = "a:" + server.anonymous_hash(anon)

    def read_owned(table, *, columns, **filters):
        if table == "results":
            assert filters == {"player_id": "account-a", "challenge_key": key}
            return results
        assert table == "play_sessions" and columns == "created_at,progress"
        assert filters == {"actor_key": owner, "challenge_key": key, "puzzle_id": week_eighteen["id"],
                           "mode": "tajenka", "finished": False}
        return rows

    select.side_effect = read_owned
    assert server.tajenka_recovery(Mock(), False, "Bearer test", anon) == {"eligible": False, "completed": False}
    select.assert_not_called()
    for owner, token in ((guest, None), ("p:account-a", "Bearer test")):
        cohort.add(hashlib.sha256(owner.encode()).hexdigest())
        assert server.tajenka_recovery(Mock(), False, token, anon) == {"eligible": True, "completed": False}
    rows = []
    assert not server.tajenka_recovery(Mock(), False, token, anon)["eligible"]
    rows = [case]
    case["progress"]["found"] = found[:3]
    assert not server.tajenka_recovery(Mock(), False, token, anon)["eligible"]
    case["progress"]["found"] = found
    case["created_at"] = "2026-11-04T12:37:22.701+00:00"
    assert not server.tajenka_recovery(Mock(), False, token, anon)["eligible"]
    case["created_at"] = "2026-11-04T12:00:00+00:00"
    results = [{"id": "rewarded"}]
    assert server.tajenka_recovery(Mock(), False, token, anon) == {"eligible": False, "completed": True}
    rows = []  # An old local save can outlive the server session.
    cohort.clear()
    assert server.tajenka_recovery(Mock(), True, token, anon) == {"eligible": False, "completed": True}

print("PASS: recovery is owner scoped, excludes already rewarded games and keeps week 18 redeemable after the season")
