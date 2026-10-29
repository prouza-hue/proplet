"""One complete database snapshot for the unchanged quality calibration.

The compact wire format avoids repeating field names across tens of thousands
of rows. A schema/count mismatch is an unavailable source, never an empty report.
"""
from __future__ import annotations

from datetime import datetime
from typing import Callable

from fastapi import HTTPException


MAX_ROWS = 250_000
COLUMNS = {
    "attempts": ("id", "player_id", "anonymous_id", "puzzle_id", "mode", "difficulty", "started_at", "completed_at",
                 "calm_mode", "elapsed_ms", "wrong_attempts", "hints_used", "clean_solve", "first_correct_ms",
                 "reset_count", "resume_count", "first_hint_ms"),
    "feedback": ("puzzle_id", "rating"),
    "word_feedback": ("puzzle_id",),
    "hint_events": ("attempt_id", "source", "complimentary", "hint_level"),
    "helper_events": ("attempt_id", "event_type", "idle_ms", "support_mode"),
}


def unavailable(message="Úplný zdroj kvality se nepodařilo ověřit. Zkus sekci obnovit."):
    return HTTPException(503, message)


def _same_instant(value, expected):
    if not isinstance(value, str):
        return False
    try:
        actual = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    # Cross-zone datetime equality is deliberately false for PEP 495 folds.
    # Compare instants so both Prague occurrences of 02:30 match their UTC wire.
    return actual.tzinfo is not None and expected.tzinfo is not None and actual.timestamp() == expected.timestamp()


def _valid_row(name, row):
    required = {"attempts": ("id", "puzzle_id", "mode", "difficulty", "started_at"),
                "feedback": ("puzzle_id",), "word_feedback": ("puzzle_id",),
                "hint_events": ("attempt_id", "source"), "helper_events": ("attempt_id", "event_type")}
    if any(not isinstance(row.get(key), str) or not row[key] for key in required[name]):
        return False
    for key, value in row.items():
        if value is None:
            continue
        if key in {"elapsed_ms", "wrong_attempts", "hints_used", "first_correct_ms", "reset_count", "resume_count",
                   "first_hint_ms", "rating", "hint_level", "idle_ms"} and type(value) is not int:
            return False
        if key in {"calm_mode", "clean_solve", "complimentary"} and type(value) is not bool:
            return False
        if key in {"started_at", "completed_at"}:
            try:
                if not isinstance(value, str) or datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
                    return False
            except ValueError:
                return False
    return True


def load_quality_dataset(rpc: Callable, start: datetime, until: datetime) -> dict:
    """Exactly one business RPC; no REST paging, sampling or error fallback."""
    try:
        raw = rpc("proplet_quality_dataset_v1", {"p_from": start.isoformat(), "p_until": until.isoformat()})
    except Exception as exc:
        raise unavailable() from exc
    if not isinstance(raw, dict) or raw.get("schemaVersion") != 1 or type(raw.get("ok")) is not bool:
        raise unavailable()
    if not raw["ok"]:
        if raw.get("code") == "dataset_too_large":
            raise unavailable("Úplný souhrn kvality překročil bezpečný rozsah. Data nejsou zkrácena ani nahrazena nulou.")
        raise unavailable()
    period = raw.get("window")
    if (not isinstance(period, dict) or not _same_instant(period.get("from"), start)
            or not _same_instant(period.get("until"), until)):
        raise unavailable()
    columns, datasets, counts = raw.get("columns"), raw.get("datasets"), raw.get("counts")
    if any(not isinstance(value, dict) for value in (columns, datasets, counts)):
        raise unavailable()
    if any(set(value) != set(COLUMNS) for value in (columns, datasets, counts)):
        raise unavailable()
    result = {}
    total = 0
    for name, expected_columns in COLUMNS.items():
        rows, count = datasets.get(name), counts.get(name)
        if (columns.get(name) != list(expected_columns) or not isinstance(rows, list)
                or type(count) is not int or count < 0 or len(rows) != count):
            raise unavailable()
        total += count
        if total > MAX_ROWS:
            raise unavailable()
        converted = []
        for row in rows:
            if not isinstance(row, list) or len(row) != len(expected_columns):
                raise unavailable()
            item = dict(zip(expected_columns, row))
            if not _valid_row(name, item):
                raise unavailable()
            converted.append(item)
        result[name] = converted
    events = raw.get("eventCounts")
    if (not isinstance(events, dict)
            or any(not isinstance(k, str) or type(v) is not int or v < 0 for k, v in events.items())):
        raise unavailable()
    result["event_counts"] = events
    return result
