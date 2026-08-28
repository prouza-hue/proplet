#!/usr/bin/env python3
"""Focused contract checks for the v4.01.32 XP economy preview."""

from pathlib import Path
from zoneinfo import ZoneInfo

from word_recognition_v3330 import (
    WORD_DISCOVERY_BOARD_XP_LIMIT,
    WORD_DISCOVERY_DAILY_XP_LIMIT,
    _discovery_summary,
)
import server


ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("Europe/Prague")


def reward(puzzle: str, word: str, granted_at: str) -> dict:
    return {
        "reward_key": f"word_discovery_v1:{puzzle}:{word}",
        "points": 1,
        "granted_at": granted_at,
    }


rows = [reward("board-a", f"slovo{i}", "2026-08-28T10:00:00+02:00") for i in range(5)]
rows += [reward(f"board-{i}", f"jiné{i}", "2026-08-28T12:00:00+02:00") for i in range(15)]
rows += [reward("board-b", "slovo0", "2026-08-27T12:00:00+02:00")]

summary = _discovery_summary(rows, puzzle_id="board-a", today="2026-08-28", tz=TZ)
assert WORD_DISCOVERY_BOARD_XP_LIMIT == 5
assert WORD_DISCOVERY_DAILY_XP_LIMIT == 20
assert summary["boardDiscoveryXp"] == 5
assert summary["dailyDiscoveryXp"] == 20
assert summary["boardRemainingXp"] == 0
assert summary["dailyRemainingXp"] == 0
assert summary["totalDiscoveryXp"] == 21
assert summary["discoveredWords"] == 20, "same word on another board earns XP again but remains one distinct word"

# Profile XP has one server-side total: result XP + account bonus + discovery rewards.
originals = {
    "db_select": server.db_select,
    "reconcile": server.reconcile_gen4_free_rewards,
    "free_slots": server.free_slot_summary,
    "rescues": server.rescue_rows,
}
result_rows = [
    {"id": "d", "mode": "daily", "difficulty": "easy", "points": 100, "daily_date": "2026-08-28", "best_elapsed_ms": 50000, "clean_solve": True},
    {"id": "f", "mode": "free", "difficulty": "easy", "points": 15, "clean_solve": True},
    {"id": "t", "mode": "tajenka", "difficulty": "medium", "points": 200, "clean_solve": True},
]
reward_rows = [
    {"reward_key": "account_creation_v1", "points": 500},
    reward("board-a", "slovo", "2026-08-28T10:00:00+02:00"),
    reward("board-b", "slovo", "2026-08-28T11:00:00+02:00"),
]
try:
    server.db_select = lambda table, **_filters: result_rows if table == "results" else reward_rows if table == "account_rewards" else []
    server.reconcile_gen4_free_rewards = lambda _player, _rows: {"repairedXp": 0, "returnBonusXp": 0, "bonusAwardedNow": False}
    server.free_slot_summary = lambda _rows: {"effective": {"easy": 1, "medium": 0, "hard": 0, "hardcore": 0}, "transferred": {"easy": 0, "medium": 0, "hard": 0, "hardcore": 0}, "current": {"easy": 1, "medium": 0, "hard": 0, "hardcore": 0}}
    server.rescue_rows = lambda _player: []
    stats = server.player_stats("player")
    assert stats["resultXp"] == 315
    assert stats["accountBonusXp"] == 500
    assert stats["wordDiscoveryXp"] == 2
    assert stats["points"] == 817
    assert stats["xpAuthoritative"] is True
    assert stats["tajenkaCompleted"] == 1
    assert stats["discoveredWords"] == 1
finally:
    server.db_select = originals["db_select"]
    server.reconcile_gen4_free_rewards = originals["reconcile"]
    server.free_slot_summary = originals["free_slots"]
    server.rescue_rows = originals["rescues"]

app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
server = (ROOT / "server.py").read_text(encoding="utf-8")
feedback = (ROOT / "public" / "valid-word-feedback-v3330.js").read_text(encoding="utf-8")
bonus = (ROOT / "public" / "account-bonus-v3331.js").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V4_01_32.sql").read_text(encoding="utf-8")

for xp in (75000, 95000, 120000):
    assert f"xp:{xp}" in app
for group in ("tajenka", "mozkomor", "discovery"):
    assert f"group:'{group}'" in app
for field in ("xpAuthoritative", "resultXp", "accountBonusXp", "wordDiscoveryXp", "discoveredWords"):
    assert f'"{field}"' in server

assert "const missing=Math.max(0,bonusXp-alreadyIncluded)" in bonus
assert "const missing=Math.max(0,xp-included)" in feedback
assert "status:profile()?.token?'pending':'local'" in feedback
assert "pg_advisory_xact_lock" in migration
assert "v_board_xp >= 5" in migration
assert "v_daily_xp >= 20" in migration
assert "grant execute on function public.proplet_claim_word_discovery" in migration
assert "on conflict (player_id, reward_key) do nothing" in migration

print("xp-economy-v40132 regression: PASS")
