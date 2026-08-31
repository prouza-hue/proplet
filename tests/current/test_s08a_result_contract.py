#!/usr/bin/env python3
"""Executable Sprint 08A contract model; never imported by production."""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((ROOT / "tests/fixtures/s08a_result_contract_v1.json").read_text())


class InjectedCrash(RuntimeError):
    pass


class IdempotencyConflict(RuntimeError):
    pass


class ResultCommandInvalid(RuntimeError):
    pass


@dataclass
class State:
    commands: dict[tuple[str, str], dict] = field(default_factory=dict)
    runs: dict[tuple[str, str], dict] = field(default_factory=dict)
    run_attempt_ids: set[str] = field(default_factory=set)
    results: dict[tuple[str, str], dict] = field(default_factory=dict)
    rewards: set[tuple[str, str, int]] = field(default_factory=set)
    attempts: dict[str, dict] = field(default_factory=dict)


REQUEST_DEFAULTS = {
    "daily_date": None,
    "hints_used": 0,
    "wrong_attempts": 0,
    "max_hint_level": 0,
    "attempt_id": None,
    "clean_solve": False,
    "completed_at": None,
    "calm_mode": False,
}
REQUEST_REQUIRED = (
    "puzzle_id",
    "challenge_key",
    "mode",
    "difficulty",
    "elapsed_ms",
    "moves",
)


def canonical_digest(value: dict) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def request_digest(value: dict) -> str:
    normalized = {key: value[key] for key in REQUEST_REQUIRED}
    normalized.update({key: value.get(key, default) for key, default in REQUEST_DEFAULTS.items()})
    return canonical_digest(normalized)


def legacy_idempotency_key(player_id: str, request: dict) -> str:
    return f"legacy:{player_id}:{request['challenge_key']}:{request_digest(request)}"


def receipt(
    first: bool,
    points: int,
    attempt_status: str = "created_offline",
    transferred_slot: bool = False,
) -> dict:
    return {
        "firstCompletion": first,
        "awardedPoints": points if first else 0,
        "dailyGenerationUpgrade": False,
        "transferredSlot": transferred_slot,
        "attemptStatus": attempt_status,
    }


def submit_atomic(
    state: State,
    command: dict,
    *,
    crash_after: str | None = None,
) -> dict:
    """Tiny transaction model for the frozen v1 semantics.

    A deep copy is the transaction workspace. No exception can expose a partial
    phase to the caller's durable state.
    """

    key = command["idempotencyKey"]
    ledger_key = (command["playerId"], key)
    request_digest = command["requestDigest"]
    digest = command["commandDigest"]
    previous = state.commands.get(ledger_key)
    if previous:
        if previous["requestDigest"] != request_digest or previous["commandDigest"] != digest:
            raise IdempotencyConflict(key)
        return copy.deepcopy(previous["receipt"])

    tx = copy.deepcopy(state)

    def checkpoint(phase: str) -> None:
        if crash_after == phase:
            raise InjectedCrash(phase)

    tx.commands[ledger_key] = {
        "requestDigest": request_digest,
        "commandDigest": digest,
        "receipt": None,
    }
    checkpoint("command_ledger")

    effective_points = command["points"]
    transferred_slot = False
    reward_slot = command.get("legacyRewardSlot")
    if reward_slot:
        reward_key = (command["playerId"], reward_slot["difficulty"], reward_slot["level"])
        if reward_key in tx.rewards:
            effective_points = 0
            transferred_slot = True
        else:
            tx.rewards.add(reward_key)
    checkpoint("legacy_slot_reward")

    raw_attempt_id = command.get("attemptId") or key
    run_attempt_id = raw_attempt_id
    if run_attempt_id in tx.run_attempt_ids:
        run_attempt_id = f"result:{command['playerId']}:{key}"
    tx.run_attempt_ids.add(run_attempt_id)
    tx.runs[ledger_key] = {
        "playerId": command["playerId"],
        "challengeKey": command["challengeKey"],
        "attemptId": run_attempt_id,
    }
    checkpoint("puzzle_run")

    result_key = (command["playerId"], command["challengeKey"])
    old = tx.results.get(result_key)
    first = old is None
    if first:
        tx.results[result_key] = {
            "puzzleId": command["puzzleId"],
            "completedAt": command["completedAt"],
            "points": effective_points,
        }
    elif old["puzzleId"] == command["puzzleId"] and command["completedAt"] < old["completedAt"]:
        old["completedAt"] = command["completedAt"]
    checkpoint("official_result")

    attempt_id = command.get("attemptId")
    attempt_status = "not_supplied"
    if attempt_id:
        attempt = tx.attempts.get(attempt_id)
        if attempt is None:
            tx.attempts[attempt_id] = {"playerId": command["playerId"], "completed": True}
            attempt_status = "created_offline"
        elif attempt.get("playerId") == command["playerId"]:
            attempt["completed"] = True
            attempt_status = "finalized"
        else:
            attempt_status = "ownership_conflict"
    checkpoint("attempt_finalization")

    stored_receipt = receipt(first, effective_points, attempt_status, transferred_slot)
    tx.commands[ledger_key]["receipt"] = copy.deepcopy(stored_receipt)
    checkpoint("durable_receipt")

    state.commands = tx.commands
    state.runs = tx.runs
    state.run_attempt_ids = tx.run_attempt_ids
    state.results = tx.results
    state.rewards = tx.rewards
    state.attempts = tx.attempts
    return stored_receipt


def submit_via_adapter(state: State, command: dict, *, content_valid: bool) -> dict:
    """Model the receipt lookup that intentionally precedes live content checks."""

    ledger_key = (command["playerId"], command["idempotencyKey"])
    previous = state.commands.get(ledger_key)
    if previous:
        if previous["requestDigest"] != command["requestDigest"]:
            raise IdempotencyConflict(command["idempotencyKey"])
        return copy.deepcopy(previous["receipt"])
    if not content_valid:
        raise ResultCommandInvalid(command["puzzleId"])
    return submit_atomic(state, command)


def command(
    key: str = "attempt:a-123456",
    request_digest_value: str | None = None,
    digest: str | None = None,
    **changes,
) -> dict:
    value = {
        "idempotencyKey": key,
        "playerId": "player-a",
        "puzzleId": "easy-001",
        "challengeKey": "free:easy-001",
        "completedAt": "2026-08-30T12:00:00+00:00",
        "points": 15,
        "attemptId": "a-123456",
        "legacyRewardSlot": {"difficulty": "easy", "level": 1},
    }
    value.update(changes)
    browser_request = {
        "puzzle_id": value["puzzleId"],
        "challenge_key": value["challengeKey"],
        "mode": "free",
        "difficulty": "easy",
        "elapsed_ms": 42_000,
        "moves": 12,
        "attempt_id": value.get("attemptId"),
        "completed_at": value["completedAt"],
    }
    value["requestDigest"] = request_digest_value or request_digest(browser_request)
    value["commandDigest"] = digest or canonical_digest(value)
    return value


def durable_counts(state: State) -> dict:
    return {
        "commands": len(state.commands),
        "runs": len(state.runs),
        "officialResults": len(state.results),
        "rewardClaims": len(state.rewards),
        "receipts": sum(row.get("receipt") is not None for row in state.commands.values()),
    }


def test_fixture_is_complete() -> None:
    assert FIXTURE["contractVersion"] == 1
    expected_states = {
        "first_submit",
        "exact_retry",
        "conflicting_retry",
        "offline_delayed_submit",
        "guest_adoption",
        "unowned_guest_attempt",
        "stale_unknown_puzzle",
        "duplicate_reward",
    }
    assert set(FIXTURE["requiredStates"]) == expected_states
    assert FIXTURE["authorization"] == {
        "caller": "service_role_only",
        "browserRpcAccess": False,
        "playerSource": "authenticated_server_session",
        "anonymousAttemptAutoAdoption": False,
    }
    assert set(FIXTURE["publicResponseKeys"]) == {
        "ok",
        "firstCompletion",
        "awardedPoints",
        "dailyGenerationUpgrade",
        "transferredSlot",
        "stats",
        "statsWarning",
    }


def test_digest_canonicalization_is_stable_and_sensitive() -> None:
    payload = {
        "puzzle_id": "lehké-001",
        "challenge_key": "free:lehké-001",
        "mode": "free",
        "difficulty": "easy",
        "elapsed_ms": 42_000,
        "moves": 12,
    }
    reordered_with_explicit_nulls = {
        "moves": 12,
        "completed_at": None,
        "daily_date": None,
        "difficulty": "easy",
        "mode": "free",
        "challenge_key": "free:lehké-001",
        "puzzle_id": "lehké-001",
        "elapsed_ms": 42_000,
    }
    baseline = request_digest(payload)
    assert baseline == request_digest(reordered_with_explicit_nulls)
    assert len(baseline) == 64

    mutations = {
        "puzzle_id": "lehké-002",
        "challenge_key": "free:lehké-002",
        "mode": "daily",
        "difficulty": "medium",
        "elapsed_ms": 42_001,
        "moves": 13,
        "daily_date": "2026-08-30",
        "hints_used": 1,
        "wrong_attempts": 1,
        "max_hint_level": 1,
        "attempt_id": "attempt-123",
        "clean_solve": True,
        "completed_at": "2026-08-30T12:00:00+00:00",
        "calm_mode": True,
    }
    for field, changed_value in mutations.items():
        assert request_digest({**payload, field: changed_value}) != baseline, field

    utf8_digest = canonical_digest({"text": "Příliš žluťoučký kůň"})
    assert utf8_digest == "c0e0d39244bdb1f9dbbb97d1fcd8311445aab4ab5049425194f28fa18a71d4f4"
    ascii_escaped = hashlib.sha256(
        json.dumps(
            {"text": "Příliš žluťoučký kůň"},
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    assert utf8_digest != ascii_escaped


def test_legacy_fallback_key_is_deterministic_and_player_scoped() -> None:
    request = {
        "puzzle_id": "easy-001",
        "challenge_key": "free:easy-001",
        "mode": "free",
        "difficulty": "easy",
        "elapsed_ms": 42_000,
        "moves": 12,
    }
    first = legacy_idempotency_key("player-a", request)
    assert first == legacy_idempotency_key("player-a", dict(reversed(list(request.items()))))
    assert first != legacy_idempotency_key("player-b", request)
    assert first != legacy_idempotency_key("player-a", {**request, "moves": 13})
    assert first.startswith("legacy:player-a:free:easy-001:")


def test_crash_after_every_current_write_phase_then_exact_retry() -> None:
    for phase in FIXTURE["atomicPhases"]:
        state = State()
        try:
            submit_atomic(state, command(), crash_after=phase)
        except InjectedCrash as exc:
            assert str(exc) == phase
        else:
            raise AssertionError(f"failure injection did not fire after {phase}")
        assert durable_counts(state) == {
            "commands": 0,
            "runs": 0,
            "officialResults": 0,
            "rewardClaims": 0,
            "receipts": 0,
        }

        first = submit_atomic(state, command())
        replay = submit_atomic(state, command())
        assert first == replay
        assert first["firstCompletion"] is True
        assert first["awardedPoints"] == 15
        assert durable_counts(state) == FIXTURE["retryInvariant"]


def test_conflicting_retry_is_write_free() -> None:
    state = State()
    original = submit_atomic(state, command())
    for conflicting in (
        command(request_digest_value="2" * 64),
        command(digest="b" * 64, points=50),
    ):
        before = copy.deepcopy(state)
        try:
            submit_atomic(state, conflicting)
        except IdempotencyConflict:
            pass
        else:
            raise AssertionError("same key with a different digest must conflict")
        assert state == before
    assert submit_atomic(state, command()) == original


def test_stale_new_command_is_write_free_but_committed_retry_survives() -> None:
    state = State()
    try:
        submit_via_adapter(state, command(), content_valid=False)
    except ResultCommandInvalid:
        pass
    else:
        raise AssertionError("new stale/unknown content must be rejected")
    assert durable_counts(state) == {
        "commands": 0,
        "runs": 0,
        "officialResults": 0,
        "rewardClaims": 0,
        "receipts": 0,
    }

    stored = submit_via_adapter(state, command(), content_valid=True)
    replay = submit_via_adapter(state, command(), content_valid=False)
    assert replay == stored
    assert durable_counts(state) == FIXTURE["retryInvariant"]


def test_offline_earlier_completion_and_duplicate_reward() -> None:
    state = State()
    submit_atomic(state, command())
    later_play = command(
        key="attempt:b-123456",
        digest="b" * 64,
        attemptId="b-123456",
        completedAt="2026-08-29T12:00:00+00:00",
    )
    second = submit_atomic(state, later_play)
    assert second["firstCompletion"] is False
    assert second["awardedPoints"] == 0
    assert state.results[("player-a", "free:easy-001")]["completedAt"] == later_play["completedAt"]
    assert len(state.runs) == 2
    assert len(state.rewards) == 1


def test_adopted_and_unowned_guest_attempts() -> None:
    adopted = State(attempts={"guest-adopted": {"playerId": "player-a", "completed": False}})
    adopted_receipt = submit_atomic(
        adopted,
        command(attemptId="guest-adopted", key="attempt:guest-adopted"),
    )
    assert adopted_receipt["attemptStatus"] == "finalized"
    assert adopted.attempts["guest-adopted"]["completed"] is True

    unowned = State(attempts={"guest-other": {"playerId": None, "anonymousId": "anon", "completed": False}})
    before_attempt = copy.deepcopy(unowned.attempts["guest-other"])
    unowned_receipt = submit_atomic(
        unowned,
        command(attemptId="guest-other", key="attempt:guest-other"),
    )
    assert unowned_receipt["attemptStatus"] == "ownership_conflict"
    assert unowned.attempts["guest-other"] == before_attempt
    assert unowned_receipt["firstCompletion"] is True


def test_global_attempt_collision_keeps_both_players_results() -> None:
    state = State()
    shared_attempt = "shared-attempt-123"
    first = command(attemptId=shared_attempt, key=f"attempt:{shared_attempt}")
    submit_atomic(state, first)

    second = command(
        playerId="player-b",
        attemptId=shared_attempt,
        key=f"attempt:{shared_attempt}",
        puzzleId="medium-001",
        challengeKey="free:medium-001",
        legacyRewardSlot={"difficulty": "medium", "level": 1},
    )
    second_receipt = submit_atomic(state, second)
    assert second_receipt["firstCompletion"] is True
    assert second_receipt["attemptStatus"] == "ownership_conflict"
    assert len(state.commands) == 2
    assert len(state.runs) == 2
    assert len(state.run_attempt_ids) == 2
    assert shared_attempt in state.run_attempt_ids
    assert any(value.startswith("result:player-b:") for value in state.run_attempt_ids)
    assert len(state.results) == 2


def test_existing_legacy_slot_reward_across_generation_is_not_paid_twice() -> None:
    state = State(rewards={("player-a", "easy", 1)})
    next_generation = command(
        puzzleId="easy-gen2-001",
        challengeKey="free:easy-gen2-001",
        attemptId="generation-two-attempt",
        key="attempt:generation-two-attempt",
        legacyRewardSlot={"difficulty": "easy", "level": 1},
    )
    result = submit_atomic(state, next_generation)
    assert result["firstCompletion"] is True
    assert result["awardedPoints"] == 0
    assert result["transferredSlot"] is True
    assert len(state.rewards) == 1
    assert state.results[("player-a", "free:easy-gen2-001")]["points"] == 0


if __name__ == "__main__":
    test_fixture_is_complete()
    test_digest_canonicalization_is_stable_and_sensitive()
    test_legacy_fallback_key_is_deterministic_and_player_scoped()
    test_crash_after_every_current_write_phase_then_exact_retry()
    test_conflicting_retry_is_write_free()
    test_stale_new_command_is_write_free_but_committed_retry_survives()
    test_offline_earlier_completion_and_duplicate_reward()
    test_adopted_and_unowned_guest_attempts()
    test_global_attempt_collision_keeps_both_players_results()
    test_existing_legacy_slot_reward_across_generation_is_not_paid_twice()
    print("PASS: Sprint 08A atomic result contract and failure model")
