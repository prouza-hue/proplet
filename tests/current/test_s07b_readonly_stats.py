"""Sprint 07B read-only stats and explicit repair characterization."""

import copy
from contextlib import ExitStack
from datetime import date
import hashlib
import json
from pathlib import Path
import sys
from threading import Event, Thread
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


TODAY = date(2026, 8, 30)
EMPTY_SLOTS = {
    key: {difficulty: 0 for difficulty in server.FREE_DIFFICULTIES}
    for key in ("effective", "transferred", "current", "baseCurrent")
}
EMPTY_REWARDS = {
    "rewardXp": 0,
    "accountBonusXp": 0,
    "wordDiscoveryXp": 0,
    "otherRewardXp": 0,
    "wordDiscoveryRewards": 0,
    "discoveredWords": 0,
    "accountRewardsIncluded": True,
}


def digest(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
PUZZLES = {
    "freeGeneration": 4,
    "free": {
        "easy": [{"id": "g4-easy-1"}],
        "medium": [],
        "hard": [],
        "hardcore": [],
    },
}


def stats_patches(rows, writes, info_logs=None):
    def select(table, **_filters):
        if table == "results":
            return rows
        raise AssertionError(f"unexpected table: {table}")

    def forbidden_write(*args, **kwargs):
        writes.append((copy.deepcopy(args), copy.deepcopy(kwargs)))
        raise AssertionError(f"stats read attempted a write: {args!r}")

    return (
        patch.object(server, "db_select", side_effect=select),
        patch.object(server, "db_update", side_effect=forbidden_write),
        patch.object(server, "db_insert", side_effect=forbidden_write),
        patch.object(server, "db_delete", side_effect=forbidden_write),
        patch.object(server, "db_rpc", side_effect=forbidden_write),
        patch.object(server, "load_puzzles", return_value=PUZZLES),
        patch.object(server, "load_rolling_content", return_value={"puzzles": {}}),
        patch.object(server, "free_slot_summary", return_value=copy.deepcopy(EMPTY_SLOTS)),
        patch.object(server, "player_reward_stats", return_value=EMPTY_REWARDS),
        patch.object(server, "rescue_rows", return_value=[]),
        patch.object(server, "mozkomor_unlocked_from_rows", return_value=False),
        patch.object(server, "current_prague_date", return_value=TODAY),
        patch.object(
            server.logger,
            "info",
            side_effect=(lambda *args, **_kwargs: info_logs.append(args)) if info_logs is not None else None,
        ),
    )


def read_stats(rows, writes, info_logs=None):
    with ExitStack() as stack:
        for context in stats_patches(rows, writes, info_logs):
            stack.enter_context(context)
        return server.player_stats("p1")


# Inconsistent historical state: a read now projects only persisted values and
# reports the pending repair without identifiers.  It neither writes nor
# mutates the result snapshot.
inconsistent_rows = [
    {
        "id": "old",
        "player_id": "p1",
        "mode": "free",
        "difficulty": "easy",
        "puzzle_id": "g3-easy-1",
        "points": 15,
        "completed_at": "2026-08-01T10:00:00+02:00",
    },
    {
        "id": "current",
        "player_id": "p1",
        "mode": "free",
        "difficulty": "easy",
        "puzzle_id": "g4-easy-1",
        "points": 0,
        "completed_at": "2026-08-23T10:00:00+02:00",
    },
]
before_read = copy.deepcopy(inconsistent_rows)
writes = []
info_logs = []
persisted = read_stats(inconsistent_rows, writes, info_logs)

assert writes == []
assert inconsistent_rows == before_read
assert persisted["resultXp"] == 15
assert persisted["gen4RewardRepairXp"] == 0
assert persisted["gen4ReturnBonusXp"] == 500
assert persisted["gen4ReturnBonusAwardedNow"] == 0
assert info_logs == [("Gen4 reward repair pending rows=%s xp=%s", 1, 515)]
assert "p1" not in repr(info_logs) and "current" not in repr(info_logs)


# Pre-Gen4 compatibility returns an empty plan before touching rolling content.
with (
    patch.object(server, "load_puzzles", return_value={"freeGeneration": 3}),
    patch.object(server, "load_rolling_content", side_effect=AssertionError("must not load rolling content")),
):
    assert server.gen4_free_reward_repair_plan(before_read) == {
        "updates": [],
        "repairedXp": 0,
        "returnBonusXp": 0,
        "bonusAwardedNow": 0,
    }


# A consistent returning-player row performs no write.  The full digest was
# captured from characterization commit f7059d4 before the runtime change.
consistent_rows = copy.deepcopy(inconsistent_rows)
consistent_rows[1]["points"] = 515
writes = []
consistent = read_stats(consistent_rows, writes)

assert writes == []
assert consistent["resultXp"] == 530
assert consistent["gen4RewardRepairXp"] == 0
assert consistent["gen4ReturnBonusXp"] == 500
assert consistent["gen4ReturnBonusAwardedNow"] == 0
assert digest(consistent) == "9edb97ea2f2ea2eafb271374e30a8f428a1d6d507dfb6ae897c9057e7dc6e027"


# The explicit command is dry-run by default, reports a deterministic plan,
# applies compare-and-set updates once, and is a no-op on the second apply.
class FakeResultStore:
    def __init__(self, rows):
        self.rows = copy.deepcopy(rows)
        self.updates = []
        self.before_update = None

    def select(self, table, **_filters):
        assert table == "results"
        return copy.deepcopy(self.rows)

    def update(self, table, filters, values):
        assert table == "results"
        if self.before_update:
            callback, self.before_update = self.before_update, None
            callback()
        for row in self.rows:
            if all(row.get(key) == value for key, value in filters.items()):
                row.update(values)
                self.updates.append((copy.deepcopy(filters), copy.deepcopy(values)))
                return [copy.deepcopy(row)]
        return []


def command(store, *, dry_run, puzzles=PUZZLES):
    with (
        patch.object(server, "db_select", side_effect=store.select),
        patch.object(server, "db_update", side_effect=store.update),
        patch.object(server, "load_puzzles", return_value=puzzles),
        patch.object(server, "load_rolling_content", return_value={"puzzles": {}}),
    ):
        return server.repair_gen4_free_rewards("p1", dry_run=dry_run)


store = FakeResultStore(before_read)
dry_run = command(store, dry_run=True)
assert dry_run == {
    "dryRun": True,
    "candidateRows": 1,
    "appliedRows": 0,
    "conflicts": 0,
    "plannedXp": 515,
    "appliedXp": 0,
    "returnBonusXp": 500,
    "plannedBonusXp": 500,
    "validationErrors": [],
    "updates": [{
        "id": "current",
        "expectedPoints": 0,
        "oldPoints": 0,
        "targetPoints": 515,
        "reason": "base-reward-and-returning-bonus",
    }],
}
assert store.rows == before_read and store.updates == []

applied = command(store, dry_run=False)
assert applied["candidateRows"] == applied["appliedRows"] == 1
assert applied["conflicts"] == 0 and applied["appliedXp"] == 515
assert store.rows[1]["points"] == 515
second = command(store, dry_run=False)
assert second["candidateRows"] == second["appliedRows"] == second["conflicts"] == 0
assert len(store.updates) == 1


# A value changed between planning and PATCH cannot be overwritten.  The
# explicit command reports the CAS conflict and a retry will replan it.
conflict_store = FakeResultStore(before_read)
conflict_store.before_update = lambda: conflict_store.rows[1].update(points=25)
conflicted = command(conflict_store, dry_run=False)
assert conflicted["appliedRows"] == 0 and conflicted["conflicts"] == 1
assert conflicted["plannedXp"] == 515 and conflicted["appliedXp"] == 0
assert conflict_store.rows[1]["points"] == 25


# Schema-invalid stored values are reported, never converted into a misleading
# CAS against zero.  Valid production schema prevents these values, but the
# maintenance command still fails closed for imported/corrupt history.
invalid_rows = copy.deepcopy(before_read)
invalid_rows[1]["points"] = None
invalid_store = FakeResultStore(invalid_rows)
invalid = command(invalid_store, dry_run=False)
assert invalid["appliedRows"] == 0 and invalid["conflicts"] == 1
assert invalid["validationErrors"] == [{"id": "current", "reason": "invalid-stored-points"}]
assert invalid_store.updates == [] and invalid_store.rows[1]["points"] is None


# A partial multi-row apply is safely resumable.  The first row persists the
# returning bonus; retry replans and repairs only the conflicting base reward.
partial_rows = copy.deepcopy(before_read) + [{
    "id": "hard",
    "player_id": "p1",
    "mode": "free",
    "difficulty": "hard",
    "puzzle_id": "g4-hard-1",
    "points": 0,
    "completed_at": "2026-08-23T11:00:00+02:00",
}]
partial_puzzles = copy.deepcopy(PUZZLES)
partial_puzzles["free"]["hard"] = [{"id": "g4-hard-1"}]


class PartialStore(FakeResultStore):
    def __init__(self, rows):
        super().__init__(rows)
        self.fail_hard_once = True

    def update(self, table, filters, values):
        if filters["id"] == "hard" and self.fail_hard_once:
            self.fail_hard_once = False
            return []
        return super().update(table, filters, values)


partial_store = PartialStore(partial_rows)
first_partial = command(partial_store, dry_run=False, puzzles=partial_puzzles)
second_partial = command(partial_store, dry_run=False, puzzles=partial_puzzles)
assert first_partial["appliedRows"] == 1 and first_partial["conflicts"] == 1
assert first_partial["plannedXp"] == 565 and first_partial["appliedXp"] == 515
assert second_partial["appliedRows"] == 1 and second_partial["conflicts"] == 0
assert second_partial["plannedXp"] == second_partial["appliedXp"] == 50
assert [row["points"] for row in partial_store.rows] == [15, 515, 50]


# Deterministic read-vs-result-write interleaving using the real result route:
# stats receives a snapshot, `/api/result` inserts a completion, then stats
# continues.  The read cannot overwrite or remove the new persisted result.
snapshot_taken = Event()
continue_read = Event()
shared_rows = copy.deepcopy(before_read)
thread_result = {}
read_writes = []
result_inserts = []


def concurrent_select(table, **_filters):
    assert table == "results"
    if "challenge_key" in _filters:
        return [
            copy.deepcopy(row)
            for row in shared_rows
            if row.get("challenge_key") == _filters["challenge_key"]
        ]
    snapshot = copy.deepcopy(shared_rows)
    snapshot_taken.set()
    assert continue_read.wait(timeout=3)
    return snapshot


def run_read():
    thread_result["stats"] = server.player_stats("p1")


def result_insert(table, row):
    assert table == "results"
    shared_rows.append(copy.deepcopy(row))
    result_inserts.append(copy.deepcopy(row))
    return copy.deepcopy(row)


def forbidden_update(*args, **kwargs):
    read_writes.append((copy.deepcopy(args), copy.deepcopy(kwargs)))
    raise AssertionError(f"unexpected PATCH during first-completion interleaving: {args!r}")


payload = server.ResultCreate(
    puzzle_id="g4-easy-2",
    challenge_key="free:g4-easy-2",
    mode="free",
    difficulty="easy",
    elapsed_ms=12_000,
    moves=20,
    completed_at="2026-08-30T12:00:00+02:00",
)
request = server.Request({
    "type": "http",
    "method": "POST",
    "path": "/api/result",
    "headers": [],
    "query_string": b"",
})

interleaving_patches = (
    patch.object(server, "db_select", side_effect=concurrent_select),
    patch.object(server, "db_insert", side_effect=result_insert),
    patch.object(server, "db_update", side_effect=forbidden_update),
    patch.object(server, "db_delete", side_effect=forbidden_update),
    patch.object(server, "db_rpc", side_effect=forbidden_update),
    patch.object(server, "load_puzzles", return_value=PUZZLES),
    patch.object(server, "load_rolling_content", return_value={"puzzles": {}}),
    patch.object(server, "free_slot_summary", return_value=copy.deepcopy(EMPTY_SLOTS)),
    patch.object(server, "player_reward_stats", return_value=EMPTY_REWARDS),
    patch.object(server, "rescue_rows", return_value=[]),
    patch.object(server, "mozkomor_unlocked_from_rows", return_value=False),
    patch.object(server, "current_prague_date", return_value=TODAY),
    patch.object(server, "enforce_rate_limit", return_value=None),
    patch.object(server, "auth_player", return_value={"id": "p1"}),
    patch.object(server, "puzzle_exists", return_value=True),
    patch.object(server, "validate_result_sanity", return_value=None),
    patch.object(server, "free_puzzle_info", return_value={
        "puzzle": {"id": "g4-easy-2"},
        "difficulty": "easy",
        "level": 2,
        "generation": 4,
        "legacy": False,
    }),
    patch.object(server, "is_puzzle_released", return_value=True),
    patch.object(server, "claim_free_slot_points", return_value=(15, False)),
    patch.object(server, "record_puzzle_run", return_value=None),
    patch.object(server, "rankings_v2_schema_ready", return_value=False),
)
with ExitStack() as stack:
    for context in interleaving_patches:
        stack.enter_context(context)
    reader = Thread(target=run_read)
    reader.start()
    assert snapshot_taken.wait(timeout=3)
    # The reader is already inside the original function, so this patch affects
    # only the result response's post-write stats refresh.
    with patch.object(server, "player_stats", return_value={"points": 15}):
        result_response = server.result(payload, request, authorization="Bearer test")
    continue_read.set()
    reader.join(timeout=3)

assert not reader.is_alive()
assert result_response["firstCompletion"] is True and result_response["awardedPoints"] == 15
assert len(result_inserts) == 1 and result_inserts[0]["challenge_key"] == "free:g4-easy-2"
assert read_writes == [] and shared_rows[-1]["points"] == 15
assert thread_result["stats"]["resultXp"] == 15  # coherent older snapshot

print("PASS: Sprint 07B read-only stats and explicit repair command")
