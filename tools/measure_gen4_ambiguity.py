#!/usr/bin/env python3
"""Measure local false-path pressure for Generation 4 boards.

The exact-cover solver proves that a board has one complete solution. It does
not tell us how many locally plausible wrong ideas a player sees. This audit
counts dictionary prefixes on short non-revisiting paths and separates the
legitimate prefixes of target paths from tempting alternatives.

The score is deliberately a ranking signal, not a prediction of seconds. It is
used together with geometry, vocabulary and human calibration anchors.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import statistics


def normalise_word(value: object) -> str:
    return str(value or "").strip().casefold()


def load_words(path: Path) -> set[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    words: set[str] = set()
    if isinstance(payload, dict):
        for entry in payload.get("entries") or []:
            if isinstance(entry, dict):
                word = normalise_word(entry.get("word") or entry.get("lemma"))
                if word:
                    words.add(word)
        for values in (payload.get("tiers") or {}).values():
            for value in values or []:
                word = normalise_word(value)
                if word:
                    words.add(word)
    if not words:
        raise SystemExit(f"No vocabulary words found in {path}")
    return words


def iter_puzzles(payload: object):
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict) and item.get("letters"):
                yield item
        return
    if not isinstance(payload, dict):
        return
    if payload.get("letters"):
        yield payload
        return
    for key, value in payload.items():
        if key in {"legacyFree", "legacyDaily", "previousDaily"}:
            continue
        yield from iter_puzzles(value)


def neighbours(cell: int, rows: int, cols: int, mask: set[int]):
    row, col = divmod(cell, cols)
    for rr, cc in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
        nxt = rr * cols + cc
        if 0 <= rr < rows and 0 <= cc < cols and nxt in mask:
            yield nxt


def legitimate_prefix_paths(puzzle: dict, max_depth: int) -> set[tuple[int, ...]]:
    out: set[tuple[int, ...]] = set()
    for answer in puzzle.get("answers") or []:
        path = tuple(int(cell) for cell in answer.get("path") or [])
        for depth in range(2, min(max_depth, len(path)) + 1):
            out.add(path[:depth])
    return out


def board_metrics(puzzle: dict, prefixes: dict[int, set[str]], max_depth: int) -> dict:
    rows, cols = int(puzzle["rows"]), int(puzzle["cols"])
    letters = [normalise_word(letter) for letter in puzzle["letters"]]
    mask = {int(cell) for cell in puzzle.get("mask") or range(rows * cols) if letters[int(cell)]}
    legitimate = legitimate_prefix_paths(puzzle, max_depth)
    false_by_depth: Counter[int] = Counter()
    false_start_cells: set[int] = set()
    all_matching_paths: set[tuple[int, ...]] = set()

    def walk(path: tuple[int, ...], text: str) -> None:
        depth = len(path)
        if depth >= 2 and text in prefixes.get(depth, set()):
            all_matching_paths.add(path)
            if path not in legitimate:
                false_by_depth[depth] += 1
                false_start_cells.add(path[0])
        if depth == max_depth or text not in prefixes.get(depth, set()):
            return
        for nxt in neighbours(path[-1], rows, cols, mask):
            if nxt not in path:
                walk(path + (nxt,), text + letters[nxt])

    for start in sorted(mask):
        walk((start,), letters[start])

    target_alt_branches = 0
    target_starts: list[str] = []
    for answer in puzzle.get("answers") or []:
        path = [int(cell) for cell in answer.get("path") or []]
        if not path:
            continue
        target_starts.append(letters[path[0]])
        legitimate_second = path[1] if len(path) > 1 else None
        for nxt in neighbours(path[0], rows, cols, mask):
            if nxt == legitimate_second:
                continue
            if letters[path[0]] + letters[nxt] in prefixes.get(2, set()):
                target_alt_branches += 1

    collisions = sum(count * (count - 1) // 2 for count in Counter(target_starts).values())
    target_count = max(1, len(puzzle.get("answers") or []))
    weighted = (
        false_by_depth[2] * 0.25
        + false_by_depth[3] * 0.75
        + false_by_depth[4] * 1.50
        + false_by_depth.get(5, 0) * 2.50
        + target_alt_branches * 2.0
        + collisions * 0.5
    )
    meta = puzzle.get("meta") or {}
    return {
        "id": puzzle.get("id"),
        "difficulty": puzzle.get("difficulty"),
        "level": meta.get("level"),
        "profile": meta.get("calibrationVariant") or meta.get("geometryProfile"),
        "targetCount": len(puzzle.get("answers") or []),
        "falsePrefixes": {str(depth): false_by_depth[depth] for depth in range(2, max_depth + 1)},
        "falseStartCells": len(false_start_cells),
        "targetAlternativeBranches": target_alt_branches,
        "startLetterCollisions": collisions,
        "matchingShortPaths": len(all_matching_paths),
        "localAmbiguityScore": round(weighted / target_count, 3),
    }


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    weight = position - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--lexicon", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--max-depth", type=int, default=4, choices=(3, 4, 5))
    args = parser.parse_args()

    words = load_words(args.lexicon)
    prefixes: dict[int, set[str]] = defaultdict(set)
    for word in words:
        for depth in range(1, min(args.max_depth, len(word) - 1) + 1):
            prefixes[depth].add(word[:depth])

    source = json.loads(args.source.read_text(encoding="utf-8"))
    boards = [board_metrics(puzzle, prefixes, args.max_depth) for puzzle in iter_puzzles(source)]
    groups: dict[str, list[float]] = defaultdict(list)
    for board in boards:
        key = str(board.get("profile") or board.get("difficulty") or "unknown")
        groups[key].append(float(board["localAmbiguityScore"]))

    summary = {}
    for key, values in sorted(groups.items()):
        summary[key] = {
            "count": len(values),
            "min": round(min(values), 3),
            "median": round(statistics.median(values), 3),
            "p75": round(percentile(values, 0.75), 3),
            "max": round(max(values), 3),
        }
    report = {
        "version": 1,
        "metric": "gen4-local-ambiguity-v1",
        "source": str(args.source),
        "lexicon": str(args.lexicon),
        "maxDepth": args.max_depth,
        "boardCount": len(boards),
        "summary": summary,
        "boards": boards,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
