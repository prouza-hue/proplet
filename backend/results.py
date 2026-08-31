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
RECEIPT_PUBLIC_FIELDS = (
    "firstCompletion",
    "awardedPoints",
    "dailyGenerationUpgrade",
    "transferredSlot",
)


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
    """Return every accepted ResultCreate field including explicit null/defaults."""
    if hasattr(payload, "model_dump"):
        value = payload.model_dump()
    elif isinstance(payload, Mapping):
        value = dict(payload)
    else:
        raise TypeError("payload must be ResultCreate-compatible")
    return {
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
    raw = rpc_fn(RPC_NAME, {
        "p_player_id": command["playerId"],
        "p_idempotency_key": command["idempotencyKey"],
        "p_request_digest": command["requestDigest"],
        "p_command_digest": command["commandDigest"],
        "p_command": command,
    })
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    return validate_receipt(raw)


def public_response(receipt: dict[str, Any], stats: Any, stats_warning: Optional[str]) -> dict[str, Any]:
    checked = validate_receipt(receipt)
    return {
        "ok": True,
        "firstCompletion": checked["firstCompletion"],
        "awardedPoints": checked["awardedPoints"],
        "dailyGenerationUpgrade": checked["dailyGenerationUpgrade"],
        "transferredSlot": checked["transferredSlot"],
        "stats": stats,
        "statsWarning": stats_warning,
    }
