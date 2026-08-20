#!/usr/bin/env python3
"""Generate the focused v3.34 V3 playtest (6 Medium + 4 Hard).

V3 keeps the independent-path construction proved by the earlier lab, but
turns the playtest findings into explicit, auditable geometry limits:

* Medium alternates compact 7x7 and cut-out 8x8 boards.
* Medium allows at most two visibly snail-like paths and no long curl run.
* Empty cells must form readable cut-outs instead of isolated visual noise.
* Hard is a bridge profile, not a near-Mozkozrout profile.

This module is calibration-only. It never writes production content banks.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import random
import time

import generate_v334_calibration as cal

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "tmp" / "v334-calibration-v3.json"
LEXICAL_DECISIONS = ROOT / "data" / "target_generation_exclusions_v334.json"
SEED = 20260821


def load_exclusions() -> set[str]:
    payload = json.loads(LEXICAL_DECISIONS.read_text(encoding="utf-8"))
    return {
        str(word).casefold()
        for word in payload.get("remove_from_target_generation", [])
        if str(word).strip()
    }


TARGET_EXCLUSIONS = load_exclusions()
cal.MUST_REVIEW |= TARGET_EXCLUSIONS

MEDIUM_POLICY = deepcopy(cal.PROFILES["medium"]["policy"])
HARD_POLICY = deepcopy(cal.PROFILES["hard"]["policy"])

PROFILES = {
    "medium-compact": {
        "rows": 7,
        "cols": 7,
        "cells": (33, 37),
        "words": (7, 7),
        "min_len": 4,
        "max_len": 8,
        "turn_bias": 0.28,
        "min_bbox_rows": 5,
        "min_bbox_cols": 5,
        "min_curvy_share": 0.14,
        "max_mean_straight_share": 0.66,
        "geometry_profile": "v334-medium-independent-v3-compact-7x7",
        "policy": MEDIUM_POLICY,
        "max_curl_paths": 2,
        "max_curl_run": 2,
        "min_mean_turns": 0.75,
        "max_mean_turns": 2.40,
        "max_blank_components": 3,
        "max_isolated_blanks": 0,
    },
    "medium-cutout": {
        "rows": 8,
        "cols": 8,
        "cells": (38, 42),
        "words": (7, 8),
        "min_len": 4,
        "max_len": 8,
        "turn_bias": 0.24,
        "min_bbox_rows": 7,
        "min_bbox_cols": 7,
        "min_curvy_share": 0.14,
        "max_mean_straight_share": 0.68,
        "geometry_profile": "v334-medium-independent-v3-cutout-8x8",
        "policy": MEDIUM_POLICY,
        "max_curl_paths": 2,
        "max_curl_run": 2,
        "min_mean_turns": 0.70,
        "max_mean_turns": 2.35,
        "max_blank_components": 3,
        "max_isolated_blanks": 0,
    },
    "hard-bridge": {
        "rows": 9,
        "cols": 9,
        "cells": (50, 56),
        "words": (8, 9),
        "min_len": 4,
        "max_len": 9,
        "turn_bias": 0.72,
        "min_bbox_rows": 7,
        "min_bbox_cols": 7,
        "min_curvy_share": 0.38,
        "max_mean_straight_share": 0.59,
        "geometry_profile": "v334-hard-independent-v3-bridge-9x9",
        "policy": HARD_POLICY,
        "max_curl_paths": 5,
        "max_curl_run": 3,
        "min_mean_turns": 1.80,
        "max_mean_turns": 3.35,
        "max_blank_components": 5,
        "max_isolated_blanks": 1,
    },
}

MEDIUM_SCHEDULE = (
    "medium-compact",
    "medium-cutout",
    "medium-compact",
    "medium-cutout",
    "medium-compact",
    "medium-cutout",
)
HARD_SCHEDULE = ("hard-bridge",) * 4


def balanced_min_turns(length: int, difficulty: str) -> int:
    if difficulty == "medium":
        return 1 if length >= 7 else 0
    if length >= 8:
        return 2
    if length >= 5:
        return 1
    return 0


cal.min_turns_for = balanced_min_turns
_base_pack_paths = cal.pack_paths


def blank_component_sizes(profile: dict, occupied: set[int]) -> list[int]:
    rows, cols = int(profile["rows"]), int(profile["cols"])
    remaining = set(range(rows * cols)) - occupied
    sizes: list[int] = []
    while remaining:
        todo = [remaining.pop()]
        size = 0
        while todo:
            cell = todo.pop()
            size += 1
            for neighbour in cal.grid_neighbours(cell, rows, cols):
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    todo.append(neighbour)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def guarded_pack_paths(words, difficulty, profile, rng):
    geometry = _base_pack_paths(words, difficulty, profile, rng)
    if geometry is None:
        return None

    metrics = [cal.path_turn_metrics(path, profile["cols"]) for path in geometry.values()]
    turns = [item[0] for item in metrics]
    curls = [item[1] for item in metrics]
    mean_turns = sum(turns) / len(turns)
    if mean_turns < profile["min_mean_turns"] or mean_turns > profile["max_mean_turns"]:
        return None
    if sum(curl >= 2 for curl in curls) > profile["max_curl_paths"]:
        return None
    if max(curls, default=0) > profile["max_curl_run"]:
        return None

    return geometry


cal.pack_paths = guarded_pack_paths


def annotate(puzzle: dict, variant: str) -> None:
    profile = PROFILES[variant]
    answers = list(puzzle.get("answers") or [])
    curls = [int(answer.get("curlRun") or 0) for answer in answers]
    components = blank_component_sizes(profile, set(puzzle.get("mask") or []))
    meta = puzzle["meta"]
    meta.update({
        "generationKey": "free-gen4-calibration-v3",
        "calibrationVersion": 3,
        "calibrationVariant": variant,
        "curlPathCount": sum(curl >= 2 for curl in curls),
        "maxCurlRun": max(curls, default=0),
        "cutoutCells": profile["rows"] * profile["cols"] - len(puzzle.get("mask") or []),
        "cutoutComponents": len(components),
        "isolatedCutoutCells": sum(size == 1 for size in components),
        "activeDensity": round(len(puzzle.get("mask") or []) / (profile["rows"] * profile["cols"]), 3),
    })


def public_profile(profile: dict) -> dict:
    hidden = {"policy", "max_curl_paths", "max_curl_run", "min_mean_turns", "max_mean_turns", "max_blank_components", "max_isolated_blanks"}
    return {key: value for key, value in profile.items() if key not in hidden} | {
        "vocabularyPolicy": profile["policy"],
        "guardrails": {
            "maxCurlPaths": profile["max_curl_paths"],
            "maxCurlRun": profile["max_curl_run"],
            "meanTurns": [profile["min_mean_turns"], profile["max_mean_turns"]],
            "maxBlankComponents": profile["max_blank_components"],
            "maxIsolatedBlanks": profile["max_isolated_blanks"],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--medium", type=int, default=6)
    parser.add_argument("--hard", type=int, default=4)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.medium != 6 or args.hard != 4:
        raise SystemExit("V3 playtest is intentionally fixed at 6 Medium + 4 Hard")

    gp = cal.load_generator()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    freq = gp.load_frequency_words()
    all_answers = [word for tier in ("A", "B", "C", "D") for word in tiers[tier]]
    dictionary = [word for word, _ in freq if word not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(
        dictionary[:cal.WIDE_DICTIONARY_SIZE]
        + all_answers
        + sorted(gp.EDITORIAL_VALIDATOR_WORDS)
    ))

    pools = {
        "medium": cal.weighted_pool(tiers, metadata, MEDIUM_POLICY),
        "hard": cal.weighted_pool(tiers, metadata, HARD_POLICY),
    }
    schedules = {"medium": MEDIUM_SCHEDULE, "hard": HARD_SCHEDULE}
    counts = {"medium": args.medium, "hard": args.hard}
    banks = {"medium": [], "hard": []}
    used_targets: set[str] = set()
    rng = random.Random(args.seed)
    started = time.time()

    for difficulty in ("medium", "hard"):
        for level in range(1, counts[difficulty] + 1):
            variant = schedules[difficulty][level - 1]
            cal.PROFILES[difficulty] = deepcopy(PROFILES[variant])
            puzzle = None
            # Shape readability is deliberately a second-stage retry. Putting
            # it inside path packing made small 7x7 candidates needlessly rare.
            for shape_retry in range(1, 31):
                candidate = cal.build_puzzle(
                    gp,
                    difficulty,
                    level,
                    rng,
                    pools[difficulty],
                    dictionary,
                    tier_of,
                    fun_of,
                    used_targets,
                )
                annotate(candidate, variant)
                meta = candidate["meta"]
                if meta["cutoutComponents"] > PROFILES[variant]["max_blank_components"]:
                    continue
                if meta["isolatedCutoutCells"] > PROFILES[variant]["max_isolated_blanks"]:
                    continue
                puzzle = candidate
                meta["shapeRetry"] = shape_retry
                break
            if puzzle is None:
                raise RuntimeError(f"Could not generate readable shape for {difficulty} level {level}")
            banks[difficulty].append(puzzle)
            used_targets |= {answer["word"].casefold() for answer in puzzle["answers"]}
            print(
                f"V3 {difficulty} {level}/{counts[difficulty]} {variant} "
                f"cells={puzzle['meta']['cells']} turns={puzzle['meta']['meanTurns']} "
                f"curls={puzzle['meta']['curlPathCount']}",
                flush=True,
            )

    payload = {
        "version": 3,
        "purpose": "v3.34 focused calibration V3 - NOT FOR PRODUCTION",
        "fixtureId": f"v334-calibration-v3-{args.seed}",
        "calibrationGeneration": 4,
        "seed": args.seed,
        "targetGenerationExclusions": sorted(TARGET_EXCLUSIONS),
        "testDesign": {
            "medium": list(MEDIUM_SCHEDULE),
            "hard": list(HARD_SCHEDULE),
            "primaryQuestion": "Does board readability plus a two-curl cap fix Medium without restoring the old global snake?",
        },
        "profiles": {key: public_profile(profile) for key, profile in PROFILES.items()},
        "puzzles": banks,
        "stats": {
            "counts": {key: len(value) for key, value in banks.items()},
            "uniqueTargets": len(used_targets),
            "seconds": round(time.time() - started, 2),
            "tierCounts": dict(Counter(
                tier_of[answer["word"].casefold()]
                for bank in banks.values()
                for puzzle in bank
                for answer in puzzle["answers"]
            )),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
