from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


DATE = "2026-08-23"
PUZZLE_ID = "g4-d-365"
PLAYERS = {
    "michael": {"id": "michael", "name": "Michael", "avatar": "🐸"},
    "agatha": {"id": "agatha", "name": "Agatha", "avatar": "😎"},
    "me": {"id": "me", "name": "Pavel", "avatar": "🐲"},
}


def run(player_id: str, elapsed_ms: int, completed_at: str, mode: str = "daily") -> dict:
    return {
        "id": f"run-{player_id}-{mode}",
        "player_id": player_id,
        "puzzle_id": PUZZLE_ID,
        "challenge_key": f"daily:{DATE}" if mode == "daily" else f"free:{PUZZLE_ID}",
        "mode": mode,
        "difficulty": "easy",
        "elapsed_ms": elapsed_ms,
        "moves": 9,
        "hints_used": 0,
        "wrong_attempts": 0,
        "clean_solve": True,
        "calm_mode": False,
        "completed_at": completed_at,
    }


def identity(player, viewer_id, scope, used_aliases):
    return {
        "name": "Ty" if player["id"] == viewer_id else player["name"],
        "avatar": player["avatar"],
        "anonymous": player["id"] != viewer_id,
    }


daily_runs = [
    run("michael", 129_000, "2026-08-23T00:20:00+02:00"),
    run("agatha", 119_000, "2026-08-23T00:30:00+02:00"),
    run("me", 54_000, "2026-08-23T01:39:00+02:00"),
]


def daily_rows(table: str, **filters):
    if table == "puzzle_runs":
        return daily_runs
    if table == "players":
        return list(PLAYERS.values())
    return []


with (
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "auth_player", return_value=PLAYERS["me"]),
    patch.object(server, "daily_leaderboard_puzzle_id", return_value=PUZZLE_ID),
    patch.object(server, "db_select_all", side_effect=daily_rows),
    patch.object(server, "_ranking_display_identity", side_effect=identity),
):
    daily = server.daily_global_leaderboard(object(), DATE, "Bearer test")

assert [row["elapsedMs"] for row in daily["rows"]] == [54_000, 119_000, 129_000], daily
assert [row["rank"] for row in daily["rows"]] == [1, 2, 3], daily
assert daily["myRank"] == 1, daily


free_runs = [dict(row, mode="free", challenge_key=f"free:{PUZZLE_ID}") for row in daily_runs]


def free_rows(table: str, **filters):
    if table == "puzzle_runs":
        return free_runs
    if table == "players":
        return list(PLAYERS.values())
    return []


with (
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "auth_player", return_value=PLAYERS["me"]),
    patch.object(server, "free_puzzle_info", return_value={"difficulty": "easy", "level": 1, "generation": 4, "legacy": False}),
    patch.object(server, "db_select_all", side_effect=free_rows),
    patch.object(server, "_ranking_display_identity", side_effect=identity),
):
    free = server.free_global_leaderboard(object(), PUZZLE_ID, "Bearer test")

assert [row["elapsedMs"] for row in free["rows"]] == [54_000, 119_000, 129_000], free
assert free["myRank"] == 1, free

print("Proplet v4.00.4 Daily and Free rank order: OK")
