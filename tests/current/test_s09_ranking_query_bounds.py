#!/usr/bin/env python3
"""Sprint 09 contracts: stable ranking behavior with bounded database reads."""

from __future__ import annotations

import inspect
from pathlib import Path
import sys
from unittest.mock import patch

from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend import db as backend_db  # noqa: E402
from backend import rankings as ranking_queries  # noqa: E402


# The low-level helper fails closed instead of silently truncating a board.
calls: list[dict] = []


def overflow_request(method, table, **kwargs):
    calls.append(kwargs["params"])
    return [{"id": str(index)} for index in range(3)]


try:
    backend_db.db_select_bounded("events", overflow_request, max_rows=2)
    raise AssertionError("bounded select accepted an overflowing result")
except HTTPException as exc:
    assert exc.status_code == 503
assert calls[0]["limit"] == "3"


# The RPC owns first-run reduction. Its rolling-deploy fallback is one puzzle,
# one mode, one optional day window and a hard row ceiling.
raw_runs = [
    {
        "id": "r1",
        "player_id": "p1",
        "puzzle_id": "daily-1",
        "challenge_key": "daily:2026-08-31",
        "mode": "daily",
        "elapsed_ms": 50_000,
        "moves": 9,
        "hints_used": 0,
        "wrong_attempts": 0,
        "clean_solve": True,
        "calm_mode": False,
        "completed_at": "2026-08-31T08:00:00+02:00",
    },
    {
        "id": "r2",
        "player_id": "p1",
        "puzzle_id": "daily-1",
        "challenge_key": "daily:2026-08-31",
        "mode": "daily",
        "elapsed_ms": 30_000,
        "moves": 7,
        "hints_used": 0,
        "wrong_attempts": 0,
        "clean_solve": True,
        "calm_mode": False,
        "completed_at": "2026-08-31T09:00:00+02:00",
    },
]
bounded_kwargs = {}


def missing_rpc(function, body):
    raise HTTPException(400, "missing function")


def bounded_runs(table, **kwargs):
    bounded_kwargs.update(kwargs)
    return raw_runs


runs, mode = ranking_queries.ranking_runs(
    missing_rpc,
    bounded_runs,
    mode="daily",
    puzzle_id="daily-1",
    daily_date="2026-08-31",
)
assert mode == "bounded-compatibility-v1"
assert [row["id"] for row in runs] == ["r1"]
assert bounded_kwargs["max_rows"] == ranking_queries.RUN_TRANSFER_LIMIT
assert bounded_kwargs["filters"] == {
    "mode": "eq.daily",
    "puzzle_id": "eq.daily-1",
    "calm_mode": "eq.false",
    "challenge_key": "eq.daily:2026-08-31",
}


# The legacy team leaderboard is now four bulk queries regardless of team size.
def exercise_team(member_count: int) -> int:
    players = [
        {
            "id": f"p{index}",
            "name": f"Player {index}",
            "avatar": "🙂",
            "family_code": "TEAM",
            "team_joined_at": "2026-01-01T00:00:00Z",
        }
        for index in range(member_count)
    ]
    results = [
        {
            "id": f"result-{index}",
            "player_id": f"p{index}",
            "puzzle_id": "daily-primary",
            "challenge_key": "daily:2026-08-31",
            "mode": "daily",
            "difficulty": "easy",
            "daily_date": "2026-08-31",
            "best_elapsed_ms": 50_000 + index,
            "best_moves": 9,
            "points": 100,
            "hints_used": 0,
            "clean_solve": True,
            "calm_mode": False,
            "completed_at": "2026-08-31T08:00:00+02:00",
        }
        for index in range(member_count)
    ]
    query_calls: list[str] = []

    def select(table, **kwargs):
        query_calls.append(table)
        return {
            "players": players,
            "results": results,
            "account_rewards": [],
            "streak_rescues": [],
        }[table]

    def stats(player_id, **kwargs):
        assert kwargs["prefetched_results"] is not None
        assert kwargs["prefetched_rewards"] is not None
        assert kwargs["prefetched_rescues"] is not None
        return {"points": sum(row["points"] for row in kwargs["prefetched_results"]), "currentStreak": 1}

    with (
        patch.object(server, "enforce_rate_limit"),
        patch.object(server, "auth_player", return_value=players[0]),
        patch.object(server, "current_prague_date", return_value=__import__("datetime").date(2026, 8, 31)),
        patch.object(server, "expected_daily_puzzle_id", return_value="daily-primary"),
        patch.object(server, "db_select_bounded", side_effect=select),
        patch.object(server, "player_stats", side_effect=stats),
    ):
        response = server.leaderboard(object(), "TEAM", "2026-08-31", "Bearer fixture")
    assert len(response["overall"]) == member_count
    return len(query_calls)


assert exercise_team(2) == 4
assert exercise_team(25) == 4


# Tie ranks and privacy identity are explicit golden rules, independent of query shape.
tied = [{"xp": 100}, {"xp": 100}, {"xp": 50}]
server._ranking_assign_tied_ranks(tied, "xp")
assert [row["rank"] for row in tied] == [1, 1, 3]
public_identity = server._ranking_display_identity(
    {"id": "public", "name": "Veřejný", "avatar": "🐸", "public_rankings": True},
    None,
    "day:2026-08-31",
)
private_identity = server._ranking_display_identity(
    {"id": "private", "name": "Tajné jméno", "avatar": "😎", "public_rankings": False},
    None,
    "day:2026-08-31",
)
assert public_identity == {"name": "Veřejný", "avatar": "🐸", "anonymous": False}
assert private_identity["anonymous"] is True
assert private_identity["name"] != "Tajné jméno" and private_identity["avatar"] != "😎"


# Admin routes are one RPC each; filtering and pagination happen in Postgres.
admin_row = {
    "total_count": 1,
    "id": "p1",
    "name": "Pavel",
    "avatar": "🐲",
    "family_code": "TEAM",
    "team": "Tým",
    "created_at": "2026-01-01T00:00:00Z",
    "last_active_at": "2026-08-31T08:00:00Z",
    "app_version": "4.01.37",
    "support_mode": "none",
    "has_password": True,
    "points": 123,
    "completed": 2,
    "daily_completed": 1,
    "open_word_reports": 0,
}
with patch.object(server, "db_rpc", return_value=[admin_row]) as rpc:
    total, users = server.admin_user_summaries("pav", 60)
assert total == 1 and users[0]["familyCode"] == "TEAM"
rpc.assert_called_once_with(
    "proplet_admin_users_v1",
    {"p_query": "pav", "p_limit": 60, "p_offset": 0},
)


# Guard the exact paths called out by the audit against reintroducing full scans.
for function in (
    server.admin_launch,
    server.admin_support,
    server.admin_overview,
    server.admin_user_summaries,
    server.admin_reports,
    server.admin_audit,
    server.build_quality_report,
    server._family_league_week,
    server.free_global_leaderboard,
    server.daily_global_leaderboard,
    server._ranking_context,
    server.rankings_xp,
    server.rankings_daily,
    server.leaderboard,
):
    assert "db_select_all(" not in inspect.getsource(function), function.__name__


sql = (ROOT / "SUPABASE_MIGRATION_V4_01_39_QUERY_BOUNDS.sql").read_text(encoding="utf-8").lower()
for function in (
    "proplet_ranking_runs_v1",
    "proplet_admin_overview_v1",
    "proplet_admin_users_v1",
):
    assert function in sql
assert sql.count("security invoker") == 3
assert "security definer" not in sql
assert sql.count("grant execute on function") == 3
assert "to service_role" in sql
assert " to anon" not in sql and " to authenticated" not in sql

print("Sprint 09 ranking/admin query-bound contracts: PASS")
