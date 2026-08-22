"""Runtime helpers for non-playable historical content metadata.

No function in this module reconstructs letters, answers or paths. Exact
catalog matches are sufficient for history, slot continuity and sanity bounds;
ambiguous reused IDs remain explicitly unresolved.
"""
from __future__ import annotations

from datetime import date
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional


@lru_cache(maxsize=4)
def load_catalog(path_value: str) -> dict:
    path = Path(path_value)
    if not path.exists():
        return {"version": 0, "content": [], "byPuzzleId": {}, "tombstonesByPuzzleId": {}}
    payload = json.loads(path.read_text(encoding="utf-8"))
    index: dict[str, list[dict]] = {}
    for record in payload.get("content") or []:
        for context in record.get("contexts") or []:
            puzzle_id = str(context.get("puzzleId") or "")
            if puzzle_id:
                index.setdefault(puzzle_id, []).append({
                    "contentKey": record.get("contentKey"),
                    "activeCells": record.get("activeCells"),
                    "targetCount": record.get("targetCount"),
                    "rows": record.get("rows"),
                    "cols": record.get("cols"),
                    **context,
                })
    payload["byPuzzleId"] = index
    tombstone_index: dict[str, list[dict]] = {}
    for tombstone in payload.get("tombstones") or []:
        puzzle_id = str(tombstone.get("puzzleId") or "")
        if puzzle_id:
            tombstone_index.setdefault(puzzle_id, []).append(tombstone)
    payload["tombstonesByPuzzleId"] = tombstone_index
    return payload


def exact_context(
    catalog: dict,
    puzzle_id: str,
    difficulty: Optional[str] = None,
    bank: Optional[str] = None,
    before_generation: Optional[int] = None,
) -> Optional[dict]:
    contexts = list((catalog.get("byPuzzleId") or {}).get(str(puzzle_id), []))
    if difficulty:
        contexts = [ctx for ctx in contexts if ctx.get("difficulty") == difficulty]
    if bank:
        contexts = [ctx for ctx in contexts if ctx.get("bank") == bank]
    if before_generation is not None:
        contexts = [ctx for ctx in contexts if int(ctx.get("generation") or 0) < before_generation]
    # Reserved rolling puzzles that were never released are not historical playables.
    contexts = [ctx for ctx in contexts if "rolling" not in str(ctx.get("sourcePath") or "").casefold()]
    keys = {str(ctx.get("contentKey") or "") for ctx in contexts if ctx.get("contentKey")}
    if len(keys) != 1:
        return None
    contexts.sort(key=lambda ctx: (int(ctx.get("generation") or 0), int(ctx.get("slot") or 0)), reverse=True)
    return contexts[0] if contexts else None


def archived_puzzle_info(
    catalog: dict,
    puzzle_id: str,
    difficulty: Optional[str],
    bank: str,
    active_generation: int,
) -> Optional[dict]:
    context = exact_context(catalog, puzzle_id, difficulty, bank, active_generation)
    confidence = "exact"
    if not context:
        tombstones = list((catalog.get("tombstonesByPuzzleId") or {}).get(str(puzzle_id), []))
        tombstones = [item for item in tombstones if item.get("bank") == bank]
        if difficulty:
            tombstones = [item for item in tombstones if item.get("difficulty") == difficulty]
        tombstones = [item for item in tombstones if int(item.get("generation") or 0) < active_generation]
        identities = {
            (
                int(item.get("generation") or 0),
                str(item.get("bank") or ""),
                str(item.get("difficulty") or ""),
                int(item.get("slot") or 0),
            )
            for item in tombstones
        }
        if len(tombstones) != 1 or len(identities) != 1:
            return None
        context = tombstones[0]
        confidence = "inferred"
    resolved_difficulty = str(context.get("difficulty") or difficulty or "")
    # Minimal internal-only shape for anti-forgery sanity limits. It is never
    # returned as a playable puzzle and contains no lexical content.
    summary = {
        "id": puzzle_id,
        "difficulty": resolved_difficulty,
        "rows": int(context.get("rows") or 0),
        "cols": int(context.get("cols") or 0),
        "mask": [None] * int(context.get("activeCells") or 0),
        "answers": [{} for _ in range(int(context.get("targetCount") or 0))],
        "meta": {
            "contentKey": context.get("contentKey"),
            "contentGeneration": context.get("generation"),
            "level": context.get("slot"),
            "archiveSummaryOnly": True,
            "lineageConfidence": confidence,
        },
    }
    return {
        "puzzle": summary,
        "difficulty": resolved_difficulty,
        "mode": bank,
        "level": int(context.get("slot") or 0),
        "generation": int(context.get("generation") or 0),
        "legacy": True,
        "archived": True,
        "contentKey": context.get("contentKey"),
        "lineageConfidence": confidence,
    }


def daily_window_puzzle_id(window: dict, daily_date: str) -> Optional[str]:
    try:
        selected = date.fromisoformat(daily_date)
        base = date.fromisoformat(str(window.get("rotationBaseDate") or "2026-01-01"))
    except ValueError:
        return None
    ids = list(window.get("puzzleIds") or [])
    return str(ids[(selected - base).days % len(ids)]) if ids else None


def daily_window_id(runtime: dict, daily_date: str) -> Optional[str]:
    try:
        selected = date.fromisoformat(daily_date)
    except ValueError:
        return None
    windows = ((runtime.get("archive") or {}).get("dailyWindows") or [])
    for window in sorted(windows, key=lambda item: int(item.get("generation") or 0), reverse=True):
        start_raw, end_raw = window.get("activeFrom"), window.get("activeUntil")
        try:
            start = date.fromisoformat(start_raw) if start_raw else date.min
            end = date.fromisoformat(end_raw) if end_raw else date.max
        except ValueError:
            continue
        if start <= selected <= end:
            return daily_window_puzzle_id(window, daily_date)
    return None


def is_archived_daily_id(runtime: dict, puzzle_id: str, daily_date: str) -> bool:
    return bool(puzzle_id and daily_window_id(runtime, daily_date) == puzzle_id)
