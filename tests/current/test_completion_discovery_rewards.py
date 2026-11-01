"""Historical result totals use the reward ledger without altering base XP."""
import ast
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

source = (Path(__file__).resolve().parents[2] / "server.py").read_text(encoding="utf-8")
node = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == "completion_discovery_rewards")
rows = [{"puzzle_id": "special", "reward_key": f"word_discovery_v1:{i}", "points": 1, "granted_at": ("2026-11-01T02:30:00+00:00" if i < 4 else "2026-11-01T04:00:00+00:00")} for i in range(8)]
rows += [
    {"puzzle_id": "special", "reward_key": "word_discovery_v1:old", "points": 1, "granted_at": "2026-10-31T12:00:00+00:00"},
    {"puzzle_id": "special", "reward_key": "word_discovery_v1:next-day", "points": 1, "granted_at": "2026-11-02T04:00:00+00:00"},
    {"puzzle_id": "special", "reward_key": "other", "points": 500, "granted_at": "2026-11-01T02:30:00+00:00"},
]
calls = []
def select(table, **kwargs):
    calls.append((table, kwargs))
    assert kwargs["player_id"] == "player"
    return rows
scope = {"db_select": select, "TZ": ZoneInfo("Europe/Prague"), "parse_timestamp": lambda value: datetime.fromisoformat(value) if value else None}
exec(compile(ast.Module(body=[node], type_ignores=[]), "server.py", "exec"), scope)
records = [{"puzzleId": "special", "dailyDate": "2026-11-01", "completedAt": "2026-11-01T02:34:15+00:00", "points": 200}, {"puzzleId": "other", "completedAt": "2026-11-01T02:34:15+00:00", "points": 100}]
result = scope["completion_discovery_rewards"]("player", records)
assert result[0]["wordDiscoveryXpAwarded"] == 8
assert result[0]["points"] == 200
assert result[1]["wordDiscoveryXpAwarded"] == 0
assert "wordDiscoveryXpAwarded" not in records[0]
assert len(calls) == 1
assert scope["completion_discovery_rewards"]("player", []) == []
assert len(calls) == 1
print("completion discovery rewards: PASS")

undated = scope["completion_discovery_rewards"]("player", [{"puzzleId":"special", "completedAt":"2026-11-01T02:34:15+00:00", "points":100}])
assert undated[0]["wordDiscoveryXpAwarded"] == 5, "undated history retains its completion cutoff"
