"""P0 account snapshot and fair-play policy cache stay bounded and compatible."""
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient

import server


player = {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Synthetic",
    "family_code": "TEAM",
    "team_joined_at": "2026-09-01T00:00:00+00:00",
    "password_hash": "present",
    "avatar": "🙂",
    "support_mode": "none",
    "public_rankings": True,
}
snapshot = {
    "cursor": "2026-09-28T12:00:00+00:00",
    "leagueName": "Team",
    "completed": [{"challengeKey": "free:g4-l-001"}],
    "stats": {"points": 15, "currentStreak": 1, "longestStreak": 3},
}
rpc_calls = []


def rpc(name, body):
    rpc_calls.append((name, body))
    return snapshot


with patch.object(server, "enforce_rate_limit"), \
     patch.object(server, "auth_player", return_value=player), \
     patch.object(server, "db_rpc", side_effect=rpc), \
     patch.object(server, "load_puzzles", return_value={
         "freeGeneration": 4,
         "release": {"baselineLevelCounts": {"easy": 200, "hardcore": 200}},
     }):
    response = TestClient(server.app).get(
        "/api/account/snapshot?since=2026-09-28T11:00:00Z",
        headers={"Authorization": "Bearer synthetic"},
    )

assert response.status_code == 200, response.text
payload = response.json()
assert payload["completed"] == snapshot["completed"]
assert payload["cursor"] == snapshot["cursor"]
assert payload["stats"]["earnedBadges"][-1]["days"] == 3
assert payload["stats"]["nextBadge"]["days"] == 3
assert rpc_calls == [("proplet_account_snapshot_v1", {
    "p_player": player["id"],
    "p_since": "2026-09-28T13:00:00+02:00",
    "p_active_generation": 4,
    "p_base_levels": {"easy": 200, "hardcore": 200},
    "p_mozkomor_unlock_base": 200,
})]


server._fair_play_policy_for_bucket.cache_clear()
policy_reads = []


def policy_select(table, **filters):
    policy_reads.append((table, filters))
    return [{"enabled": True, "daily_from": "2026-09-01"}]


with patch.object(server, "VERCEL_ENV", "production"), \
     patch.object(server, "db_select", side_effect=policy_select), \
     patch.object(server.time, "time", return_value=120.0):
    first = server.play_session_config()
    second = server.play_session_config()

assert first == second
assert first["heartbeatMs"] == 25_000 and first["leaseMs"] == 45_000
assert len(policy_reads) == 1
assert policy_reads == [("fair_play_policy", {"singleton": True})]
print("PASS compact account snapshot contract and minute-bucket fair-play policy cache")
