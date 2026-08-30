"""Sprint 07A characterization for the pure progress/stats core."""

import copy
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend.progress import calculate_stats  # noqa: E402
from fastapi import HTTPException  # noqa: E402


TODAY = date(2026, 8, 30)
DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor")


def slots(**overrides):
    result = {
        key: {difficulty: 0 for difficulty in DIFFICULTIES}
        for key in ("effective", "transferred", "current", "baseCurrent")
    }
    for key, values in overrides.items():
        result[key].update(values)
    return result


def digest(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# Empty/guest profile: the result is deterministic from the explicit date and
# supplied empty projections; importing this module cannot read the clock.
empty = calculate_stats(
    [], today=TODAY, free_slots=slots(), badges=server.BADGES,
    free_difficulties=DIFFICULTIES,
)
assert digest(empty) == "9a9c622c72a080758b211d6f6e2734572e1eb0d6a059aaa29da95a8e96f5ed69"


# Account profile fixture covers Daily, every Free compatibility difficulty,
# Tajenka, ignored starter/unknown modes, historical rescue rows, malformed
# rescue date, and all reward classes (including duplicate discovered words).
account_rows = [
    {"id": "d-today", "mode": "daily", "points": 100, "daily_date": "2026-08-30", "best_elapsed_ms": 50000, "clean_solve": True},
    {"id": "d-yesterday", "mode": "daily", "points": 100, "daily_date": "2026-08-29T08:00:00+02:00", "best_elapsed_ms": 45000, "clean_solve": False},
    {"id": "f-easy", "mode": "free", "difficulty": "easy", "points": 15, "clean_solve": True},
    {"id": "f-medium", "mode": "free", "difficulty": "medium", "points": 25, "clean_solve": False},
    {"id": "f-hard", "mode": "free", "difficulty": "hard", "points": 50, "clean_solve": True},
    {"id": "f-hardcore", "mode": "free", "difficulty": "hardcore", "points": 100, "clean_solve": False},
    {"id": "f-mozko", "mode": "free", "difficulty": "mozkomor", "points": 150, "clean_solve": True},
    {"id": "taj", "mode": "tajenka", "difficulty": "medium", "points": 200, "clean_solve": True},
    {"id": "starter", "mode": "starter", "points": 10},
    {"id": "unknown", "mode": "other", "points": 9},
]
account = calculate_stats(
    account_rows,
    today=TODAY,
    free_slots=slots(effective={"easy": 1, "medium": 1, "hard": 1, "hardcore": 1, "mozkomor": 1}, current={"easy": 1, "medium": 1, "hard": 1, "hardcore": 1, "mozkomor": 1}, baseCurrent={"easy": 1, "medium": 1, "hard": 1, "hardcore": 1, "mozkomor": 1}),
    reward_rows=[
        {"reward_key": "account_creation_v1", "points": 500},
        {"reward_key": "word_discovery_v1:puzzle:Slovo", "points": 2},
        {"reward_key": "word_discovery_v1:puzzle:slovo", "points": 3},
        {"reward_key": "other_reward", "points": 7},
    ],
    account_rewards_included=True,
    rescue_rows=[
        {"status": "passed", "missed_date": "2026-08-29"},
        {"status": "started", "missed_date": "2026-08-28"},
        {"status": "passed", "missed_date": "not-a-date"},
    ],
    gen4_rewards={"repairedXp": 15, "returnBonusXp": 500, "bonusAwardedNow": 500},
    mozkomor_unlocked=True,
    badges=server.BADGES,
    free_difficulties=DIFFICULTIES,
)
assert digest(account) == "527571429b89c16a7175a2218168be2d2551ce962bddae18cbe4bba60479add8"
assert account["points"] == 1271
assert account["resultXp"] == 759
assert account["dailyCompleted"] == 2 and account["rescuedDays"] == 1
assert account["currentStreak"] == 2 and account["longestStreak"] == 2
assert account["wordDiscoveryXp"] == 5 and account["discoveredWords"] == 1


# Adapter characterization: repair is called immediately after result fetch,
# mutates the rows, and all later derived inputs observe that mutation.
events = []
repair_rows = [{"id": "r", "mode": "free", "difficulty": "easy", "points": 0}]
repair_slots = slots()


def fake_select(table, **_filters):
    events.append("results" if table == "results" else "reward-read")
    return repair_rows if table == "results" else []


def fake_reconcile(_player, rows):
    events.append("repair")
    rows[0]["points"] = 15
    return {"repairedXp": 15, "returnBonusXp": 0, "bonusAwardedNow": 0}


def fake_slots(rows):
    events.append(f"slots:{rows[0]['points']}")
    return repair_slots


def fake_rewards(_player):
    events.append("rewards")
    return {"rewardXp": 0, "accountBonusXp": 0, "wordDiscoveryXp": 0, "otherRewardXp": 0, "wordDiscoveryRewards": 0, "discoveredWords": 0, "accountRewardsIncluded": False}


def fake_rescue(_player):
    events.append("rescue")
    return []


with (
    patch.object(server, "db_select", side_effect=fake_select),
    patch.object(server, "reconcile_gen4_free_rewards", side_effect=fake_reconcile),
    patch.object(server, "free_slot_summary", side_effect=fake_slots),
    patch.object(server, "player_reward_stats", side_effect=fake_rewards),
    patch.object(server, "rescue_rows", side_effect=fake_rescue),
    patch.object(server, "mozkomor_unlocked_from_rows", side_effect=lambda rows, _slots: events.append(f"mozko:{rows[0]['points']}") or False),
    patch.object(server, "current_prague_date", side_effect=lambda: events.append("clock") or TODAY),
):
    repaired = server.player_stats("p1")

assert events == ["results", "repair", "slots:15", "rewards", "rescue", "clock", "mozko:15"]
assert repaired["resultXp"] == 15 and repaired["gen4RewardRepairXp"] == 15


# Golden adapter response captured from origin/main before the extraction.  It
# covers malformed Daily fields, repair mutation, raw reward classes, rescue
# compatibility filtering and the complete public response shape.
legacy_rows = [
    {"id": "d1", "mode": "daily", "points": 100, "daily_date": "2026-08-30", "best_elapsed_ms": 50000, "clean_solve": True},
    {"id": "d2", "mode": "daily", "points": 100, "daily_date": "2026-08-29T08:00:00+02:00", "best_elapsed_ms": 45000, "clean_solve": False},
    {"id": "bad", "mode": "daily", "points": 100, "daily_date": "broken", "best_elapsed_ms": "broken", "clean_solve": True},
    {"id": "old", "mode": "free", "difficulty": "hardcore", "points": 100, "clean_solve": True},
    {"id": "moz", "mode": "free", "difficulty": "mozkomor", "points": 150, "clean_solve": False},
    {"id": "taj", "mode": "tajenka", "points": 200, "clean_solve": True},
]
legacy_rewards = [
    {"reward_key": "account_creation_v1", "points": 500},
    {"reward_key": "word_discovery_v1:p:w", "points": 1, "reward_word": "W"},
    {"reward_key": "other", "points": 7},
]
legacy_rescues = [
    {"status": "passed", "missed_date": "2026-08-28"},
    {"status": "passed", "missed_date": "broken"},
    {"status": "started", "missed_date": "2026-08-27"},
]
legacy_slots = slots(
    effective={"hardcore": 1, "mozkomor": 1},
    transferred={"hardcore": 1},
    current={"mozkomor": 1},
    baseCurrent={"mozkomor": 1},
)
working_rows = copy.deepcopy(legacy_rows)
adapter_events = []
warnings = []


def legacy_select(table, **_filters):
    adapter_events.append(f"select:{table}")
    if table == "results":
        return working_rows
    if table == "account_rewards":
        return copy.deepcopy(legacy_rewards)
    if table == "streak_rescues":
        return copy.deepcopy(legacy_rescues)
    raise AssertionError(table)


def legacy_repair(_player, rows):
    adapter_events.append("repair")
    rows[0]["points"] = 105
    return {"repairedXp": 5, "returnBonusXp": 500, "bonusAwardedNow": 0}


with (
    patch.object(server, "db_select", side_effect=legacy_select),
    patch.object(server, "reconcile_gen4_free_rewards", side_effect=legacy_repair),
    patch.object(server, "free_slot_summary", side_effect=lambda _rows: adapter_events.append("slots") or legacy_slots),
    patch.object(server, "current_prague_date", side_effect=lambda: adapter_events.append("clock") or TODAY),
    patch.object(server, "mozkomor_unlocked_from_rows", side_effect=lambda _rows, _slots: adapter_events.append("mozko") or True),
    patch.object(server.logger, "warning", side_effect=lambda *args, **_kwargs: warnings.append(args)),
):
    legacy_snapshot = server.player_stats("p1")

assert digest(legacy_snapshot) == "3688983c95f26356f0ecdf523582d83e90e9292e3c4e35fa0a1fb8f06d784f49"
assert adapter_events == [
    "select:results", "repair", "slots", "select:account_rewards",
    "select:streak_rescues", "clock", "mozko",
]
assert [warning[0] for warning in warnings] == [
    "Ignoring malformed daily_date for result %s: %r",
    "Ignoring malformed elapsed time for result %s",
]


# Rolling-deploy compatibility: missing reward/rescue tables remain readable
# and explicitly non-authoritative.
def unavailable_tables(table, **_filters):
    if table == "results":
        return []
    raise HTTPException(503, "not migrated")


with (
    patch.object(server, "db_select", side_effect=unavailable_tables),
    patch.object(server, "reconcile_gen4_free_rewards", return_value={"repairedXp": 0, "returnBonusXp": 0, "bonusAwardedNow": 0}),
    patch.object(server, "free_slot_summary", return_value=slots()),
    patch.object(server, "current_prague_date", return_value=TODAY),
    patch.object(server, "mozkomor_unlocked_from_rows", return_value=False),
):
    fallback = server.player_stats("guest")
assert fallback["xpAuthoritative"] is False
assert fallback["accountRewardsIncluded"] is False
assert fallback["rescuedDays"] == 0


# Existing streak invariant across a bounded family of consecutive histories.
for length in range(0, 11):
    consecutive = [
        {"mode": "daily", "points": 100, "daily_date": (TODAY - timedelta(days=offset)).isoformat()}
        for offset in range(length)
    ]
    projected = calculate_stats(
        consecutive,
        today=TODAY,
        free_slots=slots(),
        badges=server.BADGES,
        free_difficulties=DIFFICULTIES,
    )
    assert projected["currentStreak"] == length
    assert projected["longestStreak"] == length
    assert projected["dailyCompleted"] == length
    assert projected["points"] == projected["resultXp"] + projected["rewardXp"]

print("PASS: Sprint 07A pure progress core characterization")
