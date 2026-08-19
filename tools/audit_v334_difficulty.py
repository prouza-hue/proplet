#!/usr/bin/env python3
"""Audit Proplet Free-board geometry for v3.34.0 difficulty calibration.

This is intentionally read-only. It measures the active Free bank and produces
machine-readable metrics that are closer to the actual player experience than
the historical aggregate difficultyScore alone.

Key v3.34 metrics:
- turns per target word
- zero/low-turn share
- longest straight run inside target words
- answer-boundary adjacency (the current single-path generator makes this 100%)
- endpoint-to-other-start adjacency, a proxy for how easily one solved word points
  at the next one
- vocabulary tier mix
- explicit lexical review candidates (never auto-deleted)

Usage:
    python tools/audit_v334_difficulty.py
    python tools/audit_v334_difficulty.py --json /tmp/v334.json
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import math
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parents[1]
PUZZLES = ROOT / "data" / "puzzles.json"
TIERS = ROOT / "data" / "answer_tiers.json"

DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
BANDS = ((1, 10), (11, 25), (26, 50), (51, 100), (101, 150), (151, 200))
MUST_REVIEW = {"červodíra", "blockchain", "pulsar", "tensor"}


def adjacent(a: int, b: int, cols: int) -> bool:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return abs(ar - br) + abs(ac - bc) == 1


def step_dir(a: int, b: int, cols: int) -> tuple[int, int]:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return br - ar, bc - ac


def longest_straight_run(path: list[int], cols: int) -> int:
    """Longest number of consecutive edges in the same direction."""
    if len(path) < 2:
        return 0
    dirs = [step_dir(a, b, cols) for a, b in zip(path, path[1:])]
    best = run = 1
    for prev, cur in zip(dirs, dirs[1:]):
        if cur == prev:
            run += 1
            best = max(best, run)
        else:
            run = 1
    return best


def puzzle_metrics(puzzle: dict, tier_of: dict[str, str]) -> dict:
    answers = list(puzzle.get("answers") or [])
    cols = int(puzzle.get("cols") or 0)
    turns = [int(a.get("turns") or 0) for a in answers]
    straight_runs = [longest_straight_run(list(a.get("path") or []), cols) for a in answers]
    straight_ratios = []
    for a, run in zip(answers, straight_runs):
        edges = max(1, len(a.get("path") or []) - 1)
        straight_ratios.append(run / edges)

    sequential_pairs = list(zip(answers, answers[1:]))
    boundary_adj = []
    for left, right in sequential_pairs:
        lp = list(left.get("path") or [])
        rp = list(right.get("path") or [])
        if lp and rp:
            boundary_adj.append(adjacent(lp[-1], rp[0], cols))

    starts = [list(a.get("path") or [None])[0] for a in answers if a.get("path")]
    endpoints = [list(a.get("path") or [None])[-1] for a in answers if a.get("path")]
    endpoint_other_start = []
    for i, endpoint in enumerate(endpoints):
        other_starts = [s for j, s in enumerate(starts) if i != j]
        endpoint_other_start.append(any(adjacent(endpoint, s, cols) for s in other_starts))

    tier_counts = Counter(tier_of.get(str(a.get("word") or "").casefold(), "?") for a in answers)
    words = [str(a.get("word") or "").casefold() for a in answers]

    return {
        "id": puzzle.get("id"),
        "level": int((puzzle.get("meta") or {}).get("level") or 0),
        "difficulty": puzzle.get("difficulty"),
        "cells": int((puzzle.get("meta") or {}).get("cells") or len(puzzle.get("mask") or [])),
        "words": len(answers),
        "meanTurns": round(mean(turns), 3) if turns else 0.0,
        "zeroTurnShare": round(sum(t == 0 for t in turns) / len(turns), 3) if turns else 0.0,
        "lowTurnShare": round(sum(t <= 1 for t in turns) / len(turns), 3) if turns else 0.0,
        "meanLongestStraightEdgeShare": round(mean(straight_ratios), 3) if straight_ratios else 0.0,
        "sequentialBoundaryAdjacencyShare": round(sum(boundary_adj) / len(boundary_adj), 3) if boundary_adj else 0.0,
        "endpointTouchesOtherStartShare": round(sum(endpoint_other_start) / len(endpoint_other_start), 3) if endpoint_other_start else 0.0,
        "tierCounts": dict(tier_counts),
        "pathStyle": (puzzle.get("meta") or {}).get("pathStyle"),
        "difficultyScore": (puzzle.get("meta") or {}).get("difficultyScore"),
        "mustReviewWords": sorted(set(words) & MUST_REVIEW),
    }


def summarize(rows: list[dict]) -> dict:
    if not rows:
        return {"levels": 0}
    tiers = Counter()
    for row in rows:
        tiers.update(row["tierCounts"])
    total_words = sum(tiers.values()) or 1
    return {
        "levels": len(rows),
        "meanCells": round(mean(r["cells"] for r in rows), 2),
        "meanWords": round(mean(r["words"] for r in rows), 2),
        "medianDifficultyScore": round(median(float(r["difficultyScore"] or 0) for r in rows), 2),
        "meanTurnsPerWord": round(mean(r["meanTurns"] for r in rows), 3),
        "zeroTurnShare": round(mean(r["zeroTurnShare"] for r in rows), 3),
        "lowTurnShare": round(mean(r["lowTurnShare"] for r in rows), 3),
        "meanLongestStraightEdgeShare": round(mean(r["meanLongestStraightEdgeShare"] for r in rows), 3),
        "sequentialBoundaryAdjacencyShare": round(mean(r["sequentialBoundaryAdjacencyShare"] for r in rows), 3),
        "endpointTouchesOtherStartShare": round(mean(r["endpointTouchesOtherStartShare"] for r in rows), 3),
        "tierShares": {tier: round(count / total_words, 3) for tier, count in sorted(tiers.items())},
        "mustReviewWords": sorted({w for r in rows for w in r["mustReviewWords"]}),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, help="Optional JSON output path")
    args = ap.parse_args()

    pdata = json.loads(PUZZLES.read_text(encoding="utf-8"))
    tdata = json.loads(TIERS.read_text(encoding="utf-8"))
    tier_of = {
        str(word).casefold(): tier
        for tier, words in (tdata.get("tiers") or {}).items()
        for word in words
    }

    all_rows: list[dict] = []
    report = {
        "auditVersion": 1,
        "contentGeneration": int(pdata.get("freeGeneration") or 0),
        "mustReviewSeed": sorted(MUST_REVIEW),
        "bands": {},
    }
    for difficulty in DIFFICULTIES:
        bank = list((pdata.get("free") or {}).get(difficulty) or [])
        rows = [puzzle_metrics(p, tier_of) for p in bank]
        all_rows.extend(rows)
        report["bands"][difficulty] = {}
        for lo, hi in BANDS:
            subset = [r for r in rows if lo <= r["level"] <= hi]
            report["bands"][difficulty][f"{lo}-{hi}"] = summarize(subset)

    report["globalMustReviewHits"] = sorted({w for row in all_rows for w in row["mustReviewWords"]})

    if args.json:
        args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Proplet v3.34 difficulty audit")
    print(f"Active Free generation: {report['contentGeneration']}")
    print()
    print("difficulty  band      turns  zero  <=1   straight  boundary  endpoint→start")
    for difficulty in DIFFICULTIES:
        for band, s in report["bands"][difficulty].items():
            if not s.get("levels"):
                continue
            print(
                f"{difficulty:<11} {band:<9} "
                f"{s['meanTurnsPerWord']:>5.2f}  {s['zeroTurnShare']:>4.2f}  {s['lowTurnShare']:>4.2f}  "
                f"{s['meanLongestStraightEdgeShare']:>8.2f}  {s['sequentialBoundaryAdjacencyShare']:>8.2f}  "
                f"{s['endpointTouchesOtherStartShare']:>14.2f}"
            )
    print()
    print("Must-review words found in active bank:", ", ".join(report["globalMustReviewHits"]) or "none")


if __name__ == "__main__":
    main()
