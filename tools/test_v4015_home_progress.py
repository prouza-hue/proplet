#!/usr/bin/env python3
"""Focused contract for the v4.01.5 home progress redesign and XP parity."""
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


root = Path(__file__).resolve().parents[1]
home_js = (root / "public" / "home-layout.js").read_text(encoding="utf-8")
home_css = (root / "public" / "home-layout.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
account_bonus = (root / "public" / "account-bonus-v3331.js").read_text(encoding="utf-8")

for phrase in (
    "Tvůj postup",
    "TVOJE HODNOST",
    "CELKEM ZÍSKÁNO",
    "GLOBÁLNÍ POŘADÍ",
    "AKTUÁLNÍ SÉRIE",
    "Špička žebříčku",
):
    assert phrase in home_js, phrase
for selector in (
    ".home-progress-level",
    ".home-progress-metrics",
    ".home-progress-total",
    ".home-ranking-list",
    ".home-ranking-you",
):
    assert selector in home_css, selector
assert "accountBonusLeaderboardIncludedV4015:true" in runtime
assert "homeProgressHierarchyV4015:true" in runtime
assert "data.accountRewardsIncluded===true" in account_bonus

player = {"id": "pavel", "name": "Pavel", "avatar": "🐉", "public_rankings": True}
result = {
    "id": "result-1",
    "player_id": "pavel",
    "mode": "free",
    "difficulty": "hard",
    "points": 11_995,
    "calm_mode": False,
    "completed_at": "2026-08-23T10:00:00+02:00",
}
reward = {
    "id": "reward-1",
    "player_id": "pavel",
    "reward_key": "account_creation_v1",
    "points": 500,
    "granted_at": "2026-08-23T10:01:00+02:00",
}


def identity(row, viewer_id, scope, used_aliases):
    return {"name": row["name"], "avatar": row["avatar"], "anonymous": False}


with (
    patch.object(server, "enforce_rate_limit"),
    patch.object(server, "_ranking_viewer", return_value=player),
    patch.object(server, "_ranking_context", return_value=([player], [result], [], {"pavel": player}, {}, {})),
    patch.object(server, "db_select_all", side_effect=lambda table: [reward] if table == "account_rewards" else []),
    patch.object(server, "_ranking_display_identity", side_effect=identity),
    patch.object(server, "_ranking_visibility_ready", return_value=True),
):
    ranking = server.rankings_xp(object(), "all", "Bearer test")

assert ranking["accountRewardsIncluded"] is True
assert ranking["scoring"] == "all-awarded-player-xp"
assert ranking["players"][0]["xp"] == 12_495
assert ranking["players"][0]["lifetimePoints"] == 12_495
assert ranking["players"][0]["rank"] == 1

print("Proplet v4.01.5 home progress and total-XP leaderboard contract: OK")
