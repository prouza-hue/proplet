#!/usr/bin/env python3
"""Assemble validated Generation 4 shards into release-candidate runtime files.

The output is deliberately paused: it has no production activation date and the
rolling bank stays disabled until the final release gate. Historical puzzle
bodies are not copied into runtime output.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path

from validate_gen4_release import canonical_hash


DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
DAILY_CADENCE = ("easy", "easy", "medium", "medium", "medium", "hard", "hard")
DAILY_COUNTS = {"easy": 105, "medium": 156, "hard": 104}
ROLLING_COUNTS = {"easy": 17, "medium": 16, "hard": 16, "hardcore": 16}
ROLLING_EXTRA = ("easy", "medium", "hard", "hardcore")


def load_shards(root: Path) -> dict[tuple[str, str], list[dict]]:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    seen_shards: set[tuple[str, str, int]] = set()
    files = sorted(root.rglob("*.json"))
    if not files:
        raise SystemExit(f"No JSON shards found under {root}")
    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("kind") != "gen4-candidate-shard":
            continue
        if int(payload.get("contentGeneration") or 0) != 4:
            raise SystemExit(f"{path}: not Generation 4")
        bank = str(payload.get("bank") or "")
        difficulty = str(payload.get("difficulty") or "")
        start = int(payload.get("startLevel") or 0)
        shard_key = (bank, difficulty, start)
        if shard_key in seen_shards:
            raise SystemExit(f"Duplicate shard {shard_key}")
        seen_shards.add(shard_key)
        grouped[(bank, difficulty)].extend(deepcopy(payload.get("puzzles") or []))
    for puzzles in grouped.values():
        puzzles.sort(key=lambda puzzle: int((puzzle.get("meta") or {}).get("level") or 0))
    return grouped


def require_levels(grouped: dict, bank: str, difficulty: str, expected: int, start: int = 1) -> list[dict]:
    puzzles = grouped.get((bank, difficulty), [])
    levels = [int((puzzle.get("meta") or {}).get("level") or 0) for puzzle in puzzles]
    wanted = list(range(start, start + expected))
    if levels != wanted:
        raise SystemExit(
            f"{bank}/{difficulty}: expected contiguous levels {start}..{start + expected - 1}, "
            f"got {len(levels)} values ({levels[:4]} ... {levels[-4:]})"
        )
    return puzzles


def target_words(puzzle: dict) -> set[str]:
    return {str(answer.get("word") or "").casefold() for answer in puzzle.get("answers") or []}


def day_before(value: object) -> str | None:
    if not value:
        return None
    try:
        return (date.fromisoformat(str(value)) - timedelta(days=1)).isoformat()
    except ValueError:
        return None


def medium_profile(ordinal: int) -> str:
    if ordinal <= 40:
        return "medium-compact" if (ordinal - 1) % 5 in {0, 2, 4} else "medium-cutout"
    if ordinal <= 120:
        return "medium-compact" if (ordinal - 41) % 4 == 3 else "medium-cutout"
    return "medium-compact" if (ordinal - 121) % 7 == 6 else "medium-cutout"


def take_candidate(remaining: list[dict], recent: deque[set[str]], required_profile: str | None = None) -> dict:
    blocked = set().union(*recent) if recent else set()
    ranked = []
    for index, puzzle in enumerate(remaining):
        profile = str((puzzle.get("meta") or {}).get("generationProfile") or "")
        if required_profile and profile != required_profile:
            continue
        overlap = len(target_words(puzzle) & blocked)
        original_level = int((puzzle.get("meta") or {}).get("level") or 0)
        ranked.append((overlap, original_level, canonical_hash(puzzle), index))
    if not ranked:
        raise SystemExit(f"No candidate remains for required profile {required_profile}")
    overlap, _, _, index = min(ranked)
    if overlap:
        raise SystemExit(
            f"Target-spacing gate failed: best remaining {required_profile or 'candidate'} repeats {overlap} "
            "target(s) inside the previous 12 boards"
        )
    puzzle = remaining.pop(index)
    meta = puzzle.setdefault("meta", {})
    meta["generatedLevel"] = int(meta.get("level") or 0)
    recent.append(target_words(puzzle))
    while len(recent) > 12:
        recent.popleft()
    return puzzle


def ordered_bank(puzzles: list[dict], bank: str, difficulty: str, start_level: int = 1) -> list[dict]:
    remaining = list(puzzles)
    recent: deque[set[str]] = deque()
    ordered = []
    for offset in range(len(puzzles)):
        level = start_level + offset
        required = medium_profile(level) if difficulty == "medium" else None
        puzzle = take_candidate(remaining, recent, required)
        puzzle["id"] = (
            f"rescue-g4-{level:03d}" if bank == "rescue"
            else f"g4-{'emhx'[DIFFICULTIES.index(difficulty)]}-{level:03d}"
        )
        puzzle["meta"]["level"] = level
        ordered.append(puzzle)
    return ordered


def build_daily(grouped: dict) -> list[dict]:
    pools = {
        difficulty: list(require_levels(grouped, "daily", difficulty, expected))
        for difficulty, expected in DAILY_COUNTS.items()
    }
    ordinals = Counter()
    recent: deque[set[str]] = deque()
    daily: list[dict] = []
    for index in range(1, 366):
        difficulty = DAILY_CADENCE[(index - 1) % len(DAILY_CADENCE)]
        ordinals[difficulty] += 1
        required = medium_profile(ordinals[difficulty]) if difficulty == "medium" else None
        puzzle = take_candidate(pools[difficulty], recent, required)
        puzzle["id"] = f"g4-d-{index:03d}"
        meta = puzzle.setdefault("meta", {})
        meta.update({
            "level": index,
            "rotationIndex": index,
            "contentGeneration": 4,
            "generationKey": "daily-gen4-v334",
            "calendarWeekday": (index - 1) % 7,
            "calendarCadence": ",".join(DAILY_CADENCE),
        })
        daily.append(puzzle)
    if any(pools.values()):
        raise SystemExit("Daily cadence did not consume every generated puzzle")
    return daily


def build_rolling(grouped: dict) -> dict:
    pools = {
        difficulty: list(require_levels(grouped, "rolling", difficulty, expected, 201))
        for difficulty, expected in ROLLING_COUNTS.items()
    }
    ordinals = Counter()
    recent: deque[set[str]] = deque()
    by_difficulty: dict[str, list[dict]] = {difficulty: [] for difficulty in DIFFICULTIES}
    batches = []
    release_index = 0
    for week in range(13):
        extra = ROLLING_EXTRA[week % len(ROLLING_EXTRA)]
        week_difficulties = [*DIFFICULTIES, extra]
        levels = []
        for difficulty in week_difficulties:
            ordinals[difficulty] += 1
            required = medium_profile(200 + ordinals[difficulty]) if difficulty == "medium" else None
            puzzle = take_candidate(pools[difficulty], recent, required)
            release_index += 1
            level = 200 + ordinals[difficulty]
            puzzle["id"] = f"g4-{'emhx'[DIFFICULTIES.index(difficulty)]}-{level:03d}"
            puzzle["meta"].update({
                "level": level,
                "contentGeneration": 4,
                "generationKey": "free-gen4-v334",
                "availableFrom": None,
                "releaseBatch": f"pending-gen4-W{week + 1:02d}",
                "releaseIndex": release_index,
                "rollingContent": True,
            })
            by_difficulty[difficulty].append(puzzle)
            levels.append({"id": puzzle["id"], "difficulty": difficulty, "level": level})
        batches.append({
            "id": f"pending-gen4-W{week + 1:02d}",
            "availableFrom": None,
            "count": 5,
            "extraDifficulty": extra,
            "byDifficulty": dict(Counter(week_difficulties)),
            "levels": levels,
        })
    if any(pools.values()):
        raise SystemExit("Rolling schedule did not consume every generated puzzle")
    return {
        "version": 2,
        "basePuzzleVersion": 11,
        "cadence": "weekly",
        "releaseWeekday": "monday",
        "levelsPerDrop": 5,
        "firstRelease": None,
        "weeksReserved": 13,
        "reservedThrough": None,
        "extraRotation": list(ROLLING_EXTRA),
        "generatedAtVersion": "v3.34.0-gen4-candidate",
        "wideUniquenessDictionarySize": 12000,
        "releaseEnabled": False,
        "releasePauseReason": "Awaiting explicit Generation 4 production approval and release-date binding",
        "contentGeneration": 4,
        "batches": batches,
        "puzzles": by_difficulty,
    }


def assemble_runtime(production: dict, grouped: dict) -> dict:
    free = {
        difficulty: ordered_bank(require_levels(grouped, "free", difficulty, 200), "free", difficulty)
        for difficulty in DIFFICULTIES
    }
    daily = build_daily(grouped)
    rescue = ordered_bank(require_levels(grouped, "rescue", "rescue", 30), "rescue", "easy")
    for puzzle in rescue:
        puzzle["difficulty"] = "rescue"
    starter = require_levels(grouped, "starter", "easy", 1)[0]
    starter["meta"]["rewardXp"] = int((production.get("starter") or {}).get("meta", {}).get("rewardXp") or 10)

    body_keys = {"free", "daily", "rescue", "starter", "legacyFree", "legacyDaily", "previousDaily"}
    runtime = {key: deepcopy(value) for key, value in production.items() if key not in body_keys}
    legacy_by_generation = {
        int(bank.get("generation") or 0): bank
        for bank in production.get("legacyDaily") or []
        if bank.get("puzzles")
    }
    previous = production.get("previousDaily") or {}
    if previous.get("puzzles"):
        legacy_by_generation[int(previous.get("generation") or 0)] = previous
    switch2 = production.get("dailyGeneration2From")
    switch3 = production.get("dailyGeneration3From")
    daily_windows = []
    if 1 in legacy_by_generation:
        bank = legacy_by_generation[1]
        daily_windows.append({
            "generation": 1,
            "activeFrom": None,
            "activeUntil": day_before(switch2),
            "rotationBaseDate": bank.get("rotationBaseDate") or "2026-01-01",
            "puzzleIds": [puzzle.get("id") for puzzle in bank.get("puzzles") or []],
        })
    if 2 in legacy_by_generation:
        bank = legacy_by_generation[2]
        daily_windows.append({
            "generation": 2,
            "activeFrom": bank.get("activeFrom") or switch2,
            "activeUntil": bank.get("activeUntil") or day_before(switch3),
            "rotationBaseDate": bank.get("rotationBaseDate") or "2026-01-01",
            "puzzleIds": [puzzle.get("id") for puzzle in bank.get("puzzles") or []],
        })
    daily_windows.append({
        "generation": int(production.get("dailyGeneration") or 3),
        "activeFrom": switch3,
        "activeUntil": None,
        "rotationBaseDate": production.get("dailyRotationBaseDate") or switch3,
        "puzzleIds": [puzzle.get("id") for puzzle in production.get("daily") or []],
    })

    slot_candidates: dict[str, set[tuple[str, int]]] = defaultdict(set)
    generation_candidates: dict[str, set[int]] = defaultdict(set)
    for difficulty in DIFFICULTIES:
        sources = [
            (production.get("free") or {}).get(difficulty) or [],
            (production.get("legacyFree") or {}).get(difficulty) or [],
        ]
        for source in sources:
            for index, puzzle in enumerate(source, 1):
                puzzle_id = str(puzzle.get("id") or "")
                if not puzzle_id:
                    continue
                meta = puzzle.get("meta") or {}
                level = int(meta.get("level") or index)
                generation = int(meta.get("contentGeneration") or production.get("freeGeneration") or 1)
                slot_candidates[puzzle_id].add((difficulty, level))
                generation_candidates[puzzle_id].add(generation)
    legacy_free_index = {}
    for puzzle_id, slots in slot_candidates.items():
        if len(slots) != 1:
            continue
        difficulty, level = next(iter(slots))
        legacy_free_index[puzzle_id] = {
            "difficulty": difficulty,
            "level": level,
            "generation": max(generation_candidates[puzzle_id]),
            "lineageConfidence": "slot-exact",
        }

    runtime.update({
        "version": 11,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dailyRotationSize": 365,
        "free": free,
        "daily": daily,
        "rescue": rescue,
        "starter": starter,
        "legacyFreeIndex": legacy_free_index,
        "freeGeneration": 4,
        "dailyGeneration": 4,
        "contentGeneration": 4,
        "generationKey": "gen4-v334-release-candidate",
        "dailyCadence": {
            "weekdays": list(DAILY_CADENCE),
            "counts": DAILY_COUNTS,
        },
        "archive": {
            "catalogVersion": 1,
            "catalogPath": "data/content_catalog_v334.json",
            "legacyPuzzleBodiesInRuntime": False,
            "historicalStatsPreserved": True,
            "oldChallengeBehavior": "historical-summary-tombstone",
            "coldBackupRequired": True,
            "dailyWindows": daily_windows,
        },
        "release": {
            "status": "candidate-paused",
            "productionApproved": False,
            "dailyGeneration4From": None,
            "rollingFirstRelease": None,
        },
    })
    return runtime


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shards", type=Path, required=True)
    parser.add_argument("--production", type=Path, required=True)
    parser.add_argument("--puzzles-output", type=Path, required=True)
    parser.add_argument("--rolling-output", type=Path, required=True)
    parser.add_argument("--manifest-output", type=Path, required=True)
    args = parser.parse_args()

    grouped = load_shards(args.shards)
    production = json.loads(args.production.read_text(encoding="utf-8"))
    runtime = assemble_runtime(production, grouped)
    rolling = build_rolling(grouped)

    all_puzzles = [
        runtime["starter"],
        *runtime["rescue"],
        *runtime["daily"],
        *(puzzle for difficulty in DIFFICULTIES for puzzle in runtime["free"][difficulty]),
        *(puzzle for difficulty in DIFFICULTIES for puzzle in rolling["puzzles"][difficulty]),
    ]
    ids = Counter(str(puzzle.get("id") or "") for puzzle in all_puzzles)
    hashes = Counter(canonical_hash(puzzle) for puzzle in all_puzzles)
    duplicate_ids = [key for key, count in ids.items() if not key or count > 1]
    duplicate_hashes = [key for key, count in hashes.items() if count > 1]
    if duplicate_ids or duplicate_hashes:
        raise SystemExit(
            f"Cross-bank duplicate gate failed: ids={duplicate_ids[:8]}, boardHashes={len(duplicate_hashes)}"
        )

    args.puzzles_output.parent.mkdir(parents=True, exist_ok=True)
    args.rolling_output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
    args.puzzles_output.write_text(json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    args.rolling_output.write_text(json.dumps(rolling, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "version": 1,
        "kind": "gen4-release-candidate-manifest",
        "contentGeneration": 4,
        "activation": "paused",
        "runtimePuzzleCount": len(all_puzzles) - 65,
        "rollingPuzzleCount": 65,
        "totalPuzzleCount": len(all_puzzles),
        "counts": {
            "starter": 1,
            "rescue": 30,
            "free": {difficulty: len(runtime["free"][difficulty]) for difficulty in DIFFICULTIES},
            "daily": dict(Counter(puzzle["difficulty"] for puzzle in runtime["daily"])),
            "rolling": {difficulty: len(rolling["puzzles"][difficulty]) for difficulty in DIFFICULTIES},
        },
        "duplicateIds": 0,
        "duplicateBoardHashes": 0,
        "legacyPuzzleBodiesInRuntime": False,
    }
    args.manifest_output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
