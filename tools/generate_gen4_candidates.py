#!/usr/bin/env python3
"""Generate deterministic Generation 4 candidate shards.

The script never rewrites production data. Full banks are assembled only from
validated shards after cross-bank audit and migration rehearsal.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import json
from pathlib import Path
import random
import time

import generate_v334_calibration_v3 as v3
import measure_gen4_ambiguity as ambiguity


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROFILES = ROOT / "data" / "gen4_profiles_v334.json"
SEED = 20260822

EASY_POLICY = {
    "allowed": ("A",),
    "weights": {"A": 1},
    "min_fraction": {"A": 1.0},
    "max_fraction": {},
    "min_avg_fun": 2.8,
    "min_fun_words": 1,
}

HARDCORE_POLICY = {
    "allowed": ("A", "B", "C", "D"),
    "weights": {"A": 1, "B": 4, "C": 3, "D": 1},
    "min_fraction": {"B": 0.35, "C": 0.18},
    "max_fraction": {"C": 0.38, "D": 0.18},
    "min_avg_fun": 2.9,
    "min_fun_words": 1,
}

PROFILES = {
    "easy-core": {
        "rows": 6,
        "cols": 6,
        "cells": (28, 34),
        "words": (6, 7),
        "min_len": 4,
        "max_len": 7,
        "turn_bias": 0.12,
        "min_bbox_rows": 6,
        "min_bbox_cols": 6,
        "min_curvy_share": 0.0,
        "max_mean_straight_share": 0.90,
        "geometry_profile": "gen4-easy-core-6x6",
        "policy": EASY_POLICY,
        "max_curl_paths": 1,
        "max_curl_run": 1,
        "min_mean_turns": 0.10,
        "max_mean_turns": 1.35,
        "max_blank_components": 3,
        "max_isolated_blanks": 1,
    },
    "medium-compact": deepcopy(v3.PROFILES["medium-compact"]),
    "medium-cutout": deepcopy(v3.PROFILES["medium-cutout"]),
    "hard-bridge": deepcopy(v3.PROFILES["hard-bridge"]),
    "hardcore-core": {
        "rows": 10,
        "cols": 10,
        "cells": (62, 72),
        "words": (9, 11),
        "min_len": 4,
        "max_len": 10,
        "turn_bias": 1.15,
        "min_bbox_rows": 8,
        "min_bbox_cols": 8,
        "min_curvy_share": 0.52,
        "max_mean_straight_share": 0.56,
        "geometry_profile": "gen4-hardcore-core-10x10",
        "policy": HARDCORE_POLICY,
        "max_curl_paths": 7,
        "max_curl_run": 4,
        "min_mean_turns": 2.35,
        "max_mean_turns": 4.60,
        "max_blank_components": 6,
        "max_isolated_blanks": 1,
    },
}

DIFFICULTY_PROFILE = {
    "easy": "easy-core",
    "hard": "hard-bridge",
    "hardcore": "hardcore-core",
}

PREFIXES = {"easy": "e", "medium": "m", "hard": "h", "hardcore": "x"}


def min_turns(length: int, difficulty: str) -> int:
    if difficulty == "easy":
        return 1 if length >= 6 else 0
    if difficulty == "medium":
        return 1 if length >= 7 else 0
    if difficulty == "hardcore":
        return 2 if length >= 8 else 1 if length >= 5 else 0
    return 2 if length >= 8 else 1 if length >= 5 else 0


v3.cal.min_turns_for = min_turns


def medium_variant(level: int) -> str:
    """Deterministic sawtooth matching the approved 60/25/15 compact mix."""
    if level <= 40:
        # Three compact levels in every five.
        return "medium-compact" if (level - 1) % 5 in {0, 2, 4} else "medium-cutout"
    if level <= 120:
        # One compact relief level in every four.
        return "medium-compact" if (level - 41) % 4 == 3 else "medium-cutout"
    # Roughly 15%; six cutouts between compact relief levels.
    return "medium-compact" if (level - 121) % 7 == 6 else "medium-cutout"


def profile_for(difficulty: str, level: int) -> str:
    return medium_variant(level) if difficulty == "medium" else DIFFICULTY_PROFILE[difficulty]


def prefix_index(words: set[str], max_depth: int = 4) -> dict[int, set[str]]:
    out: dict[int, set[str]] = defaultdict(set)
    for word in words:
        for depth in range(1, min(max_depth, len(word) - 1) + 1):
            out[depth].add(word[:depth])
    return out


def puzzle_id(bank: str, difficulty: str, level: int) -> str:
    if bank == "starter":
        return f"starter-g4-{level:03d}"
    if bank == "rescue":
        return f"rescue-g4-{level:03d}"
    if bank == "daily":
        return f"g4-d-{difficulty[0]}-{level:03d}"
    return f"g4-{PREFIXES[difficulty]}-{level:03d}"


def annotate(puzzle: dict, bank: str, difficulty: str, level: int, variant: str, prefixes) -> None:
    profile = PROFILES[variant]
    curls = [int(answer.get("curlRun") or 0) for answer in puzzle.get("answers") or []]
    components = v3.blank_component_sizes(profile, set(puzzle.get("mask") or []))
    puzzle["id"] = puzzle_id(bank, difficulty, level)
    puzzle["difficulty"] = difficulty
    meta = puzzle.setdefault("meta", {})
    meta.update({
        "level": level,
        "contentGeneration": 4,
        "generationKey": f"{bank}-gen4-v334",
        "calibrationOnly": False,
        "generationProfile": variant,
        "curlPathCount": sum(curl >= 2 for curl in curls),
        "maxCurlRun": max(curls, default=0),
        "cutoutCells": profile["rows"] * profile["cols"] - len(puzzle.get("mask") or []),
        "cutoutComponents": len(components),
        "isolatedCutoutCells": sum(size == 1 for size in components),
        "activeDensity": round(len(puzzle.get("mask") or []) / (profile["rows"] * profile["cols"]), 3),
    })
    metric = ambiguity.board_metrics(puzzle, prefixes, 4)
    meta["localAmbiguityMetric"] = "gen4-local-ambiguity-v1"
    meta["localAmbiguityScore"] = metric["localAmbiguityScore"]
    meta["localAmbiguity"] = {
        "falsePrefixes": metric["falsePrefixes"],
        "falseStartCells": metric["falseStartCells"],
        "targetAlternativeBranches": metric["targetAlternativeBranches"],
        "startLetterCollisions": metric["startLetterCollisions"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bank", choices=("free", "daily", "rolling", "starter", "rescue"), required=True)
    parser.add_argument("--difficulty", choices=("easy", "medium", "hard", "hardcore"), required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--start-level", type=int, default=1)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--profiles", type=Path, default=DEFAULT_PROFILES)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("--count must be positive")
    if args.bank == "daily" and args.difficulty == "hardcore":
        raise SystemExit("Daily cadence does not contain Hardcore")

    approved = json.loads(args.profiles.read_text(encoding="utf-8"))
    if approved.get("contentGeneration") != 4:
        raise SystemExit("Profiles do not declare contentGeneration 4")

    gp = v3.cal.load_generator()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    frequency = gp.load_frequency_words()
    all_answers = [word for tier in ("A", "B", "C", "D") for word in tiers[tier]]
    dictionary = [word for word, _ in frequency if word not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(
        dictionary[:v3.cal.WIDE_DICTIONARY_SIZE]
        + all_answers
        + sorted(gp.EDITORIAL_VALIDATOR_WORDS)
    ))
    prefixes = prefix_index(set(dictionary))
    pools = {
        variant: v3.cal.weighted_pool(tiers, metadata, profile["policy"])
        for variant, profile in PROFILES.items()
    }

    rng = random.Random(args.seed)
    recent_by_difficulty: list[set[str]] = []
    puzzles = []
    started = time.time()
    for offset in range(args.count):
        level = args.start_level + offset
        variant = profile_for(args.difficulty, level)
        profile = deepcopy(PROFILES[variant])
        v3.PROFILES[variant] = profile
        v3.cal.PROFILES[args.difficulty] = profile
        avoid = set().union(*recent_by_difficulty) if recent_by_difficulty else set()
        accepted = None
        for shape_retry in range(1, 401):
            candidate = v3.cal.build_puzzle(
                gp,
                args.difficulty,
                level,
                rng,
                pools[variant],
                dictionary,
                tier_of,
                fun_of,
                avoid,
            )
            annotate(candidate, args.bank, args.difficulty, level, variant, prefixes)
            meta = candidate["meta"]
            if meta["cutoutComponents"] > profile["max_blank_components"]:
                continue
            if meta["isolatedCutoutCells"] > profile["max_isolated_blanks"]:
                continue
            meta["shapeRetry"] = shape_retry
            accepted = candidate
            break
        if accepted is None:
            raise RuntimeError(f"No acceptable {args.difficulty} candidate for level {level}")
        puzzles.append(accepted)
        recent_by_difficulty.append({norm for answer in accepted["answers"] if (norm := str(answer["word"]).casefold())})
        recent_by_difficulty = recent_by_difficulty[-12:]
        print(
            f"Gen4 {args.bank}/{args.difficulty} {offset + 1}/{args.count} "
            f"level={level} profile={variant} ambiguity={accepted['meta']['localAmbiguityScore']}",
            flush=True,
        )

    payload = {
        "version": 1,
        "kind": "gen4-candidate-shard",
        "contentGeneration": 4,
        "bank": args.bank,
        "difficulty": args.difficulty,
        "seed": args.seed,
        "startLevel": args.start_level,
        "profilesVersion": approved.get("version"),
        "puzzles": puzzles,
        "stats": {
            "count": len(puzzles),
            "profileCounts": dict(Counter(puzzle["meta"]["generationProfile"] for puzzle in puzzles)),
            "seconds": round(time.time() - started, 2),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
