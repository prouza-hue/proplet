#!/usr/bin/env python3
"""Fail closed when a proposed active Generation 4 pack violates its contract."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re


LEGACY_KEYS = {"legacyFree", "legacyDaily", "previousDaily"}
GEN4_ID = re.compile(r"^(?:g4-|gen4-|starter-g4-|rescue-g4-)")


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def neighbours(a: int, b: int, cols: int) -> bool:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return abs(ar - br) + abs(ac - bc) == 1


def canonical_hash(puzzle: dict) -> str:
    body = {
        "rows": puzzle.get("rows"),
        "cols": puzzle.get("cols"),
        "mask": puzzle.get("mask"),
        "letters": puzzle.get("letters"),
        "answers": sorted(
            ({"word": norm(answer.get("word")), "path": answer.get("path")} for answer in puzzle.get("answers") or []),
            key=lambda item: (item["word"], item["path"]),
        ),
    }
    raw = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def iter_active(node: object, path: tuple[str, ...] = ()):
    if isinstance(node, list):
        for index, value in enumerate(node):
            yield from iter_active(value, path + (str(index),))
        return
    if not isinstance(node, dict):
        return
    if node.get("letters") and node.get("answers"):
        yield path, node
        return
    for key, value in node.items():
        if key in LEGACY_KEYS or key in {"archive", "contentCatalog", "profiles", "stats", "meta"}:
            continue
        yield from iter_active(value, path + (str(key),))


def validate_puzzle(
    path: tuple[str, ...],
    puzzle: dict,
    exclusions: set[str],
    allow_calibration_ids: bool = False,
) -> list[str]:
    errors: list[str] = []
    label = "/".join(path) or str(puzzle.get("id"))
    puzzle_id = str(puzzle.get("id") or "")
    rows, cols = int(puzzle.get("rows") or 0), int(puzzle.get("cols") or 0)
    letters = list(puzzle.get("letters") or [])
    mask = {int(cell) for cell in puzzle.get("mask") or []}
    answers = list(puzzle.get("answers") or [])
    meta = puzzle.get("meta") or {}

    if not GEN4_ID.match(puzzle_id) and not (allow_calibration_ids and puzzle_id.startswith("cal-v334-")):
        errors.append(f"{label}: non-Gen4 id {puzzle_id!r}")
    if int(meta.get("contentGeneration") or 0) != 4:
        errors.append(f"{label}: contentGeneration != 4")
    if meta.get("verifiedUnique") is not True or meta.get("wideVerifiedUnique") is not True:
        errors.append(f"{label}: uniqueness evidence missing")
    if float(meta.get("endpointStartAdjacencyShare", -1)) != 0.0:
        errors.append(f"{label}: endpoint/start adjacency is not zero")
    if rows <= 0 or cols <= 0 or len(letters) != rows * cols:
        errors.append(f"{label}: invalid board dimensions")
        return errors
    if mask != {index for index, letter in enumerate(letters) if str(letter)}:
        errors.append(f"{label}: mask does not equal populated letters")

    covered: set[int] = set()
    starts: list[int] = []
    endpoints: list[int] = []
    for answer in answers:
        word = norm(answer.get("word"))
        path_cells = [int(cell) for cell in answer.get("path") or []]
        if word in exclusions:
            errors.append(f"{label}: excluded target {word.upper()}")
        if len(path_cells) != len(word):
            errors.append(f"{label}: {word} length/path mismatch")
            continue
        if len(path_cells) != len(set(path_cells)):
            errors.append(f"{label}: {word} revisits a cell")
        if any(cell not in mask for cell in path_cells):
            errors.append(f"{label}: {word} leaves mask")
        if any(not neighbours(a, b, cols) for a, b in zip(path_cells, path_cells[1:])):
            errors.append(f"{label}: {word} path is not orthogonally contiguous")
        spelled = "".join(norm(letters[cell]) for cell in path_cells if 0 <= cell < len(letters))
        if spelled != word:
            errors.append(f"{label}: {word} path spells {spelled}")
        overlap = covered.intersection(path_cells)
        if overlap:
            errors.append(f"{label}: answer paths overlap at {sorted(overlap)}")
        covered.update(path_cells)
        if path_cells:
            starts.append(path_cells[0])
            endpoints.append(path_cells[-1])

    if covered != mask:
        errors.append(f"{label}: answer paths do not exactly cover mask")
    for i, endpoint in enumerate(endpoints):
        for j, start in enumerate(starts):
            if i != j and neighbours(endpoint, start, cols):
                errors.append(f"{label}: answer {i} endpoint touches answer {j} start")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--rolling", type=Path)
    parser.add_argument("--profiles", type=Path, required=True)
    parser.add_argument("--exclusions", type=Path, required=True)
    parser.add_argument("--strict-counts", action="store_true")
    parser.add_argument("--allow-calibration-ids", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.source.read_text(encoding="utf-8"))
    profiles = json.loads(args.profiles.read_text(encoding="utf-8"))
    exclusion_payload = json.loads(args.exclusions.read_text(encoding="utf-8"))
    exclusions = {norm(word) for word in exclusion_payload.get("remove_from_target_generation") or []}
    errors: list[str] = []

    present_legacy = sorted(LEGACY_KEYS.intersection(payload if isinstance(payload, dict) else {}))
    if present_legacy:
        errors.append(f"runtime pack still contains legacy bodies: {', '.join(present_legacy)}")

    puzzles = list(iter_active(payload))
    rolling_payload = None
    if args.rolling:
        rolling_payload = json.loads(args.rolling.read_text(encoding="utf-8"))
        if rolling_payload.get("releaseEnabled") is not False:
            errors.append("release candidate rolling bank must remain paused")
        if int(rolling_payload.get("contentGeneration") or 0) != 4:
            errors.append("rolling contentGeneration != 4")
        puzzles.extend(iter_active(rolling_payload, ("rolling",)))
    ids: Counter[str] = Counter()
    hashes: Counter[str] = Counter()
    difficulties: Counter[str] = Counter()
    for path, puzzle in puzzles:
        ids[str(puzzle.get("id") or "")] += 1
        hashes[canonical_hash(puzzle)] += 1
        difficulties[str(puzzle.get("difficulty") or "unknown")] += 1
        errors.extend(validate_puzzle(path, puzzle, exclusions, args.allow_calibration_ids))

    duplicates = sorted(key for key, count in ids.items() if not key or count > 1)
    duplicate_hashes = sorted(key for key, count in hashes.items() if count > 1)
    if duplicates:
        errors.append(f"duplicate or empty puzzle ids: {duplicates[:10]}")
    if duplicate_hashes:
        errors.append(f"duplicate board hashes: {len(duplicate_hashes)}")

    if args.strict_counts:
        required = profiles.get("requiredActiveBanks") or {}
        expected_free = required.get("free") or {}
        free = payload.get("free") or {}
        for difficulty, expected in expected_free.items():
            actual = len(free.get(difficulty) or [])
            if actual != int(expected):
                errors.append(f"free/{difficulty}: expected {expected}, got {actual}")
        for bank in ("daily", "rolling"):
            expected = required.get(bank)
            if bank == "rolling" and rolling_payload is not None:
                actual = sum(len(values or []) for values in (rolling_payload.get("puzzles") or {}).values())
            else:
                actual = len(payload.get(bank) or [])
            if isinstance(expected, int) and actual != expected:
                errors.append(f"{bank}: expected {expected}, got {actual}")
        starter = payload.get("starter")
        if not isinstance(starter, dict) or not starter.get("letters"):
            errors.append("starter: expected one active Gen4 puzzle")
        rescue = payload.get("rescue") or []
        if len(rescue) != 30:
            errors.append(f"rescue: expected 30, got {len(rescue)}")

    report = {
        "version": 1,
        "source": str(args.source),
        "puzzleCount": len(puzzles),
        "difficultyCounts": dict(difficulties),
        "excludedTargets": len(exclusions),
        "duplicateIds": len(duplicates),
        "duplicateBoardHashes": len(duplicate_hashes),
        "errors": errors,
        "ok": not errors,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if errors:
        raise SystemExit(f"Gen4 release validation failed with {len(errors)} error(s)")


if __name__ == "__main__":
    main()
