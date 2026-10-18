"""Atomic result command adapter for Sprint 08B.

The browser contract remains ``ResultCreate``.  This module owns deterministic
canonicalization, replay lookup and the single-RPC command boundary; it does
not authenticate players, resolve content or calculate rewards.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

from fastapi import HTTPException


CONTRACT_VERSION = 1
RPC_NAME = "proplet_submit_result_v1"
SPECIAL_RPC_NAME = "proplet_submit_daily_special_v1"
OFFLINE_RPC_NAME = "proplet_submit_offline_result_v1"
OFFLINE_SPECIAL_RPC_NAME = "proplet_submit_offline_daily_special_v1"
RECEIPT_PUBLIC_FIELDS = (
    "firstCompletion",
    "awardedPoints",
    "dailyGenerationUpgrade",
    "transferredSlot",
)


def preserve_recorded_attempt_flags(payload: Any, recorded: Mapping[str, Any]) -> Any:
    """Never let delayed client data erase recorded assistance/calm mode.

    This is corroboration of an existing attempt, not proof of human play.
    Keep the original payload intact: its digest identifies old queued retries.
    """
    hints = max(payload.hints_used, int(recorded.get("hints_used") or 0))
    level = max(payload.max_hint_level, int(recorded.get("max_hint_level") or 0))
    return payload.model_copy(update={
        "calm_mode": bool(payload.calm_mode or recorded.get("calm_mode") is True),
        "hints_used": hints,
        "max_hint_level": level,
        "clean_solve": bool(payload.clean_solve and hints == 0 and level == 0),
    })


@dataclass(frozen=True, slots=True)
class ResultIdentity:
    player_id: str
    idempotency_key: str
    request_digest: str


def canonical_json(value: Mapping[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_digest(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def canonical_request(payload: Any) -> dict[str, Any]:
    """Stable legacy fields and, for special commands only, the declared hash."""
    if hasattr(payload, "model_dump"):
        value = payload.model_dump()
    elif isinstance(payload, Mapping):
        value = dict(payload)
    else:
        raise TypeError("payload must be ResultCreate-compatible")
    request = {
        "puzzle_id": value["puzzle_id"],
        "challenge_key": value["challenge_key"],
        "mode": value["mode"],
        "difficulty": value["difficulty"],
        "elapsed_ms": value["elapsed_ms"],
        "moves": value["moves"],
        "daily_date": value.get("daily_date"),
        "hints_used": value.get("hints_used", 0),
        "wrong_attempts": value.get("wrong_attempts", 0),
        "max_hint_level": value.get("max_hint_level", 0),
        "attempt_id": value.get("attempt_id"),
        "clean_solve": value.get("clean_solve", False),
        "completed_at": value.get("completed_at"),
        "calm_mode": value.get("calm_mode", False),
    }
    # Preserve every historical Daily/Free request digest exactly. New special
    # commands bind the client's declared hash into their idempotency identity.
    if value["mode"] == "daily_special":
        request["content_hash"] = value.get("content_hash")
    # Optional Archive evidence changes only new Archive identities. Preserve
    # every pre-Archive retry digest (including an explicit null field).
    if value.get("archive_solution") is not None:
        request["archive_solution"] = value["archive_solution"]
    # Absent/false keeps every previously queued identity byte-for-byte. True
    # is immutable evidence of lower trust and cannot share an online digest.
    if value.get("timing_unverified") is True:
        request["timing_unverified"] = True
    return request


def result_identity(player_id: str, payload: Any) -> ResultIdentity:
    request = canonical_request(payload)
    digest = canonical_digest(request)
    attempt_id = request.get("attempt_id")
    key = (
        f"attempt:{attempt_id}"
        if attempt_id
        else f"legacy:{player_id}:{request['challenge_key']}:{digest}"
    )
    return ResultIdentity(str(player_id), key, digest)


def _receipt_object(value: Any) -> Optional[dict[str, Any]]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise HTTPException(503, "Uložené potvrzení výsledku je dočasně nedostupné") from exc
    if not isinstance(value, dict):
        raise HTTPException(503, "Uložené potvrzení výsledku je dočasně nedostupné")
    return dict(value)


def existing_receipt(
    identity: ResultIdentity,
    select_fn: Callable[..., list[dict]],
) -> Optional[dict[str, Any]]:
    rows = select_fn(
        "result_commands",
        player_id=identity.player_id,
        idempotency_key=identity.idempotency_key,
    )
    if not rows:
        return None
    row = rows[0]
    if row.get("request_digest") != identity.request_digest:
        raise HTTPException(409, "IDEMPOTENCY_CONFLICT")
    receipt = _receipt_object(row.get("receipt"))
    if receipt is None:
        # A committed row without a receipt is an invariant violation.  It must
        # never fall through to the legacy writer or manufacture a second run.
        raise HTTPException(503, "Výsledek se teď nepodařilo bezpečně potvrdit")
    return validate_receipt(receipt)


def committed_attempt_result(
    player_id: str, attempt_id: str, puzzle_id: str, challenge_key: str,
    mode: str, difficulty: str, select_fn: Callable[..., list[dict]],
) -> Optional[dict[str, Any]]:
    """Read-only recovery: require both a durable receipt and the owned run.

    A matching challenge alone is not evidence that this queued attempt was
    committed. Never resubmit, mutate a receipt, or grant rewards here.
    """
    commands = select_fn("result_commands", player_id=player_id,
                         idempotency_key=f"attempt:{attempt_id}")
    if not commands:
        return None
    validate_receipt(commands[0].get("receipt"))
    binding = dict(player_id=player_id, puzzle_id=puzzle_id,
                   challenge_key=challenge_key, mode=mode, difficulty=difficulty)
    if not select_fn("puzzle_runs", attempt_id=attempt_id, **binding):
        return None
    rows = select_fn("results", **binding)
    return rows[0] if rows else None


def build_command(
    identity: ResultIdentity,
    payload: Any,
    *,
    completed_at: str,
    points: int,
    content_generation: Optional[int],
    free_level: Optional[int],
    legacy_reward_slot: Optional[dict[str, Any]],
    team_code_at_completion: Optional[str],
) -> dict[str, Any]:
    command = {
        "contractVersion": CONTRACT_VERSION,
        "playerId": identity.player_id,
        "idempotencyKey": identity.idempotency_key,
        "requestDigest": identity.request_digest,
        "puzzleId": payload.puzzle_id,
        "challengeKey": payload.challenge_key,
        "mode": payload.mode,
        "difficulty": payload.difficulty,
        "dailyDate": payload.daily_date,
        "completedAt": completed_at,
        "elapsedMs": int(payload.elapsed_ms),
        "moves": int(payload.moves),
        "hintsUsed": int(payload.hints_used),
        "wrongAttempts": int(payload.wrong_attempts),
        "maxHintLevel": int(payload.max_hint_level),
        "cleanSolve": bool(payload.clean_solve and payload.hints_used == 0),
        "calmMode": bool(payload.calm_mode),
        "attemptId": payload.attempt_id,
        "points": int(points),
        "contentGeneration": int(content_generation) if content_generation is not None else None,
        "freeLevel": int(free_level) if free_level is not None else None,
        "legacyRewardSlot": legacy_reward_slot,
        "teamCodeAtCompletion": team_code_at_completion,
    }
    if getattr(payload, "timing_unverified", False) is True:
        command["timingUnverified"] = True
    command["commandDigest"] = canonical_digest(command)
    return command


def map_atomic_rpc_error(status_code: int, payload: dict) -> HTTPException:
    material = " ".join(str(payload.get(key) or "") for key in ("code", "message", "details", "hint"))
    if "IDEMPOTENCY_CONFLICT" in material:
        return HTTPException(409, "IDEMPOTENCY_CONFLICT")
    if "RESULT_COMMAND_INVALID" in material:
        return HTTPException(400, "Výsledek se nepodařilo ověřit")
    return HTTPException(503, "Výsledek se teď nepodařilo bezpečně uložit. Zkus synchronizaci znovu.")


def validate_receipt(value: Any) -> dict[str, Any]:
    receipt = _receipt_object(value)
    if receipt is None:
        raise HTTPException(503, "Databáze nevrátila potvrzení výsledku")
    for field in RECEIPT_PUBLIC_FIELDS:
        if field not in receipt:
            raise HTTPException(503, "Databáze vrátila neúplné potvrzení výsledku")
    if not isinstance(receipt["firstCompletion"], bool):
        raise HTTPException(503, "Databáze vrátila neplatné potvrzení výsledku")
    if not isinstance(receipt["awardedPoints"], int) or isinstance(receipt["awardedPoints"], bool):
        raise HTTPException(503, "Databáze vrátila neplatné potvrzení výsledku")
    if not isinstance(receipt["dailyGenerationUpgrade"], bool) or not isinstance(receipt["transferredSlot"], bool):
        raise HTTPException(503, "Databáze vrátila neplatné potvrzení výsledku")
    return receipt


def submit_atomic(command: dict[str, Any], rpc_fn: Callable[[str, dict], Any]) -> dict[str, Any]:
    special = command.get("mode") == "daily_special"
    if command.get("timingUnverified") is True:
        # This new entry point exists only with the timing-safe migration.
        # Never fall back to the older writer, which silently ignores trust.
        routine = OFFLINE_SPECIAL_RPC_NAME if special else OFFLINE_RPC_NAME
        body = {"p_command": command}
    else:
        routine = SPECIAL_RPC_NAME if special else RPC_NAME
        body = {
            "p_player_id": command["playerId"],
            "p_idempotency_key": command["idempotencyKey"],
            "p_request_digest": command["requestDigest"],
            "p_command_digest": command["commandDigest"],
            "p_command": command,
        }
    raw = rpc_fn(routine, body)
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    return validate_receipt(raw)


def public_response(receipt: dict[str, Any], stats: Any, stats_warning: Optional[str]) -> dict[str, Any]:
    checked = validate_receipt(receipt)
    return {
        "ok": True,
        **({"practice": True} if checked.get("practice") is True else {}),
        "firstCompletion": checked["firstCompletion"],
        "awardedPoints": checked["awardedPoints"],
        "dailyGenerationUpgrade": checked["dailyGenerationUpgrade"],
        "transferredSlot": checked["transferredSlot"],
        "stats": stats,
        "statsWarning": stats_warning,
    }


