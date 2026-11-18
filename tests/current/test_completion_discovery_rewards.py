"""Historical result totals use the reward ledger without altering base XP."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import server

rows = [{"puzzle_id": "special", "reward_key": f"word_discovery_v1:{i}", "points": 1, "granted_at": ("2026-11-01T02:30:00+00:00" if i < 4 else "2026-11-01T04:00:00+00:00")} for i in range(8)]
rows += [
    {"puzzle_id": "special", "reward_key": "word_discovery_v1:old", "points": 1, "granted_at": "2026-10-31T12:00:00+00:00"},
    {"puzzle_id": "special", "reward_key": "word_discovery_v1:next-day", "points": 1, "granted_at": "2026-11-02T04:00:00+00:00"},
    {"puzzle_id": "special", "reward_key": "other", "points": 500, "granted_at": "2026-11-01T02:30:00+00:00"},
]
rows.append({"puzzle_id": "earlier", "reward_key": "word_discovery_v1:earlier", "points": 1, "granted_at": "2026-10-01T12:00:00+00:00"})
for index, row in enumerate(rows):
    row["id"] = f"{index:04}"

def request(method, table, *, params):
    assert method == "GET" and table == "account_rewards"
    assert params["player_id"] == "eq.player"
    after = params.get("id", "gt.").removeprefix("gt.")
    return [row for row in rows if row["id"] > after
            and ("puzzle_id" not in params or params["puzzle_id"] == "eq." + row["puzzle_id"])][:3]

records = [{"puzzleId": "special", "dailyDate": "2026-11-01", "completedAt": "2026-11-01T02:34:15+00:00", "points": 200}, {"puzzleId": "other", "completedAt": "2026-11-01T02:34:15+00:00", "points": 100}]
with patch.object(server, "db_request", side_effect=request) as reads:
    assert server.completion_discovery_rewards("player", []) == []
    reads.assert_not_called()
    result = server.completion_discovery_rewards("player", records)
    assert result[0]["wordDiscoveryXpAwarded"] == 8
    assert result[0]["points"] == 200
    assert result[1]["wordDiscoveryXpAwarded"] == 0
    assert "wordDiscoveryXpAwarded" not in records[0]
    assert all("puzzle_id" not in call.kwargs["params"] for call in reads.call_args_list)

    reads.reset_mock()
    undated = server.completion_discovery_rewards("player", [{"puzzleId":"special", "completedAt":"2026-11-01T02:34:15+00:00", "points":100}])
    assert undated[0]["wordDiscoveryXpAwarded"] == 5, "undated history retains its completion cutoff across pages"
    assert all(call.kwargs["params"].get("puzzle_id") == "eq.special" for call in reads.call_args_list)

print("completion discovery rewards: PASS")
