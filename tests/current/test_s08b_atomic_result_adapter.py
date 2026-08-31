#!/usr/bin/env python3
"""Sprint 08B Python adapter contracts; no real database access."""

from __future__ import annotations

import sys
from contextlib import ExitStack
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend import results as result_domain  # noqa: E402


assert result_domain.canonical_digest({"text": "Příliš žluťoučký kůň"}) == (
    "c0e0d39244bdb1f9dbbb97d1fcd8311445aab4ab5049425194f28fa18a71d4f4"
)


def request_for(payload):
    return SimpleNamespace(
        headers={},
        state=SimpleNamespace(request_id="s08b-atomic"),
        client=SimpleNamespace(host="127.0.0.1"),
        url=SimpleNamespace(path="/api/result"),
    )


def submitted_payload(attempt_id="attempt-atomic-0001"):
    return server.ResultCreate(
        puzzle_id="g4-e-001",
        challenge_key="free:g4-e-001",
        mode="free",
        difficulty="easy",
        elapsed_ms=42_000,
        moves=12,
        attempt_id=attempt_id,
        completed_at="2026-08-30T12:00:00+00:00",
    )


player = {"id": "00000000-0000-4000-8000-000000000001", "family_code": "SOLO_TEST"}
receipt = {
    "commandId": "00000000-0000-4000-8000-000000000010",
    "firstCompletion": True,
    "awardedPoints": 15,
    "dailyGenerationUpgrade": False,
    "transferredSlot": False,
    "attemptStatus": "created_offline",
}


def common_patches(payload, select_fn, rpc_fn):
    return (
        patch.object(server, "ATOMIC_RESULT_V1_ENABLED", True),
        patch.object(server, "enforce_rate_limit", lambda *args, **kwargs: None),
        patch.object(server, "auth_player", lambda authorization: player),
        patch.object(server, "puzzle_exists", lambda *args: True),
        patch.object(server, "validate_result_sanity", lambda submitted: None),
        patch.object(server, "free_puzzle_info", lambda *args: {
            "puzzle": {"id": payload.puzzle_id},
            "difficulty": "easy",
            "level": 1,
            "generation": 4,
            "legacy": False,
        }),
        patch.object(server, "is_puzzle_released", lambda *args: True),
        patch.object(server, "effective_content_date", lambda req: date(2026, 8, 30)),
        patch.object(server, "load_puzzles", lambda: {"freeGeneration": 4}),
        patch.object(server, "db_select", select_fn),
        patch.object(server, "db_atomic_result_rpc", rpc_fn),
        patch.object(server, "rankings_v2_schema_ready", lambda: False),
        patch.object(server, "player_stats", lambda player_id: {"xp": 15}),
    )


# New command: one RPC, no legacy writer, same seven-key public response.
payload = submitted_payload()
rpc_calls = []
legacy_calls = []


def select_new(table, **filters):
    if table == "result_commands":
        return []
    if table == "puzzle_attempts":
        return []
    raise AssertionError((table, filters))


def fake_rpc(function, body):
    rpc_calls.append((function, body))
    return receipt


patches = common_patches(payload, select_new, fake_rpc) + (
    patch.object(server, "record_puzzle_run", lambda *args: legacy_calls.append("run")),
    patch.object(server, "claim_free_slot_points", lambda *args: legacy_calls.append("claim")),
    patch.object(server, "db_insert", lambda *args: legacy_calls.append("insert")),
    patch.object(server, "db_update", lambda *args: legacy_calls.append("update")),
)
with ExitStack() as stack:
    for active_patch in patches:
        stack.enter_context(active_patch)
    response = server.result(payload, request_for(payload), "Bearer test")

assert response == {
    "ok": True,
    "firstCompletion": True,
    "awardedPoints": 15,
    "dailyGenerationUpgrade": False,
    "transferredSlot": False,
    "stats": {"xp": 15},
    "statsWarning": None,
}
assert legacy_calls == []
assert len(rpc_calls) == 1
function, rpc_body = rpc_calls[0]
assert function == "proplet_submit_result_v1"
command = rpc_body["p_command"]
assert rpc_body["p_player_id"] == player["id"] == command["playerId"]
assert rpc_body["p_idempotency_key"] == f"attempt:{payload.attempt_id}"
assert rpc_body["p_request_digest"] == command["requestDigest"]
assert rpc_body["p_command_digest"] == command["commandDigest"]
assert command["points"] == 15
assert command["contentGeneration"] == 4
assert command["freeLevel"] == 1
assert command["legacyRewardSlot"] is None


# Durable replay is returned before a retired puzzle is looked up or validated.
replay_payload = submitted_payload()
identity = result_domain.result_identity(player["id"], replay_payload)
validation_calls = []


def select_replay(table, **filters):
    assert table == "result_commands"
    return [{"request_digest": identity.request_digest, "receipt": receipt}]


with (
    patch.object(server, "ATOMIC_RESULT_V1_ENABLED", True),
    patch.object(server, "enforce_rate_limit", lambda *args, **kwargs: None),
    patch.object(server, "auth_player", lambda authorization: player),
    patch.object(server, "db_select", select_replay),
    patch.object(server, "puzzle_exists", lambda *args: validation_calls.append("puzzle")),
    patch.object(server, "validate_result_sanity", lambda *args: validation_calls.append("sanity")),
    patch.object(server, "player_stats", lambda player_id: {"xp": 15}),
):
    replay_response = server.result(replay_payload, request_for(replay_payload), "Bearer test")
assert replay_response == response
assert validation_calls == []


# Same player/key but a different browser request is a write-free HTTP 409.
conflicting = submitted_payload()
conflicting.moves = 13
conflicting_identity = result_domain.result_identity(player["id"], conflicting)
try:
    result_domain.existing_receipt(
        conflicting_identity,
        lambda *args, **kwargs: [{"request_digest": identity.request_digest, "receipt": receipt}],
    )
except HTTPException as exc:
    assert exc.status_code == 409
    assert exc.detail == "IDEMPOTENCY_CONFLICT"
else:
    raise AssertionError("conflicting retry must fail before any write")


for material, expected in (
    ({"message": "IDEMPOTENCY_CONFLICT"}, 409),
    ({"message": "RESULT_COMMAND_INVALID"}, 400),
    ({"message": "database timeout"}, 503),
):
    assert result_domain.map_atomic_rpc_error(400, material).status_code == expected

print("PASS: Sprint 08B atomic result adapter")
