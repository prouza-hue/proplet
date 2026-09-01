"""Regression contract for the Sunday Gen4 Daily sync incident."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server


PUBLIC = json.loads((ROOT / "public" / "puzzles.json").read_text(encoding="utf-8"))
APP = "\n".join(
    (ROOT / path).read_text(encoding="utf-8")
    for path in ("public/app.js", "public/app/content/progression.js")
)
SW = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")


assert server.expected_daily_puzzle_id("2026-08-23") == "g3-d-007"
assert server.expected_daily_puzzle_id("2026-08-24") == "g4-d-001"
assert server.valid_daily_puzzle_ids("2026-08-23") == {"g3-d-007", "g4-d-365"}
assert server.valid_daily_puzzle_ids("2026-08-24") == {"g4-d-001", "g3-d-008"}

original_db_select = server.db_select
try:
    server.db_select = lambda table, **filters: (
        [{"puzzle_id": "g4-d-365"}] if table == "results" else []
    )
    assert server.daily_leaderboard_puzzle_id("2026-08-23", "player") == "g4-d-365"
    assert server.daily_leaderboard_puzzle_id("2026-08-23") == "g3-d-007"
finally:
    server.db_select = original_db_select

# Old v4.00.1 clients rotate from the Gen4 base without understanding its switch
# date. The appended compatibility entry makes their 2026-08-23 modulo lookup
# land on the official Gen3 Sunday board, while Monday remains g4-d-001.
assert len(PUBLIC["daily"]) == 366
assert PUBLIC["daily"][365]["id"] == "g3-d-007"
assert PUBLIC["daily"][0]["id"] == "g4-d-001"
assert PUBLIC["dailyGeneration4From"] == "2026-08-24"
assert PUBLIC["dailyRotationBaseDate"] == "2026-08-24"

assert "dailyGeneration4From" in APP
assert "failedKeys" in APP
assert "applyPendingUpdate" in APP
assert "client.navigate(client.url)" not in SW
assert "PROPLET_SW_UPDATED" in SW
assert "await Promise.all(clients.map(client=>client.navigate" not in SW

print("Proplet v4.00.6 Daily sync P0 contract: OK")
