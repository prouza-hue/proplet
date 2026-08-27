#!/usr/bin/env python3
"""Generate the locked Generation 4 Mozkomor endgame bank.

Mozkomor deliberately keeps the 10x10 physical board of Mozkozrout. Difficulty
comes from denser exact-cover packing, longer/curvier targets and a bounded
minimum of local ambiguity — not from making letters physically smaller or
leaning on obscure Tier-D vocabulary.

The generator is deterministic and never mutates production data itself.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import random
from statistics import median
import time

import generate_gen4_candidates as g4

ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "data" / "gen4_profiles_v334.json"
PUZZLES_PATH = ROOT / "data" / "puzzles.json"
PROFILE_NAME = "mozkomor-core"
SEED = 2026082701
TARGET_COOLDOWN = 12  # Same spacing discipline as late Gen4 Hard/Mozkozrout.
# v4.01.29 bank is deterministic; reruns with this seed must reproduce the same 100 boards.

MOZKOMOR_POLICY = {
    "allowed": ("A", "B", "C", "D"),
    "weights": {"A": 1, "B": 3, "C": 4, "D": 1},
    "min_fraction": {"B": 0.25, "C": 0.30},
    "max_fraction": {"C": 0.50, "D": 0.18},
    "min_avg_fun": 2.9,
    "min_fun_words": 1,
}

PROFILE = {
    "rows": 10,
    "cols": 10,
    "cells": (72, 80),
    "words": (10, 11),
    "min_len": 5,
    "max_len": 11,
    "turn_bias": 1.42,
    "min_bbox_rows": 9,
    "min_bbox_cols": 9,
    "min_curvy_share": 0.64,
    "max_mean_straight_share": 0.49,
    "geometry_profile": "gen4-mozkomor-endgame-10x10",
    "policy": MOZKOMOR_POLICY,
    "max_curl_paths": 9,
    "max_curl_run": 5,
    "min_mean_turns": 2.90,
    "max_mean_turns": 5.30,
    "max_blank_components": 5,
    "max_isolated_blanks": 0,
    "ambiguity": (12.0, 60.0),
}


def mozkomor_min_turns(length: int, difficulty: str) -> int:
    if difficulty == "hardcore":
        if length >= 9:
            return 3
        if length >= 6:
            return 2
        return 1 if length >= 5 else 0
    return g4.min_turns(length, difficulty)


def current_hardcore_tail(cooldown: int = TARGET_COOLDOWN) -> list[set[str]]:
    """Seed Mozkomor spacing from the final current Mozkozrout boards."""
    try:
        payload = json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))
        bank = list((payload.get("free") or {}).get("hardcore") or [])
    except Exception:
        return []
    tail = []
    for puzzle in bank[-cooldown:]:
        tail.append({
            str(answer.get("word") or "").casefold()
            for answer in puzzle.get("answers") or []
            if str(answer.get("word") or "").strip()
        })
    return tail


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * p)))
    return round(float(ordered[index]), 3)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--start-level", type=int, default=1)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.count < 1:
        raise SystemExit("--count must be positive")

    approved = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    declared = (approved.get("profiles") or {}).get(PROFILE_NAME)
    if approved.get("contentGeneration") != 4 or not declared:
        raise SystemExit("Mozkomor Gen4 profile is not declared")
    contract = {
        "rows": PROFILE["rows"],
        "cols": PROFILE["cols"],
        "activeCells": list(PROFILE["cells"]),
        "targetWords": list(PROFILE["words"]),
        "targetLength": [PROFILE["min_len"], PROFILE["max_len"]],
        "maxCurlPaths": PROFILE["max_curl_paths"],
        "maxCurlRun": PROFILE["max_curl_run"],
        "meanTurns": [PROFILE["min_mean_turns"], PROFILE["max_mean_turns"]],
        "maxBlankComponents": PROFILE["max_blank_components"],
        "maxIsolatedBlanks": PROFILE["max_isolated_blanks"],
        "ambiguityRange": list(PROFILE["ambiguity"]),
    }
    for key, expected in contract.items():
        if declared.get(key) != expected:
            raise SystemExit(f"Declared Mozkomor profile drift at {key}: {declared.get(key)!r} != {expected!r}")

    gp = g4.v3.cal.load_generator()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    frequency = gp.load_frequency_words()
    all_answers = [word for tier in ("A", "B", "C", "D") for word in tiers[tier]]
    dictionary = [word for word, _ in frequency if word not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(
        dictionary[:g4.v3.cal.WIDE_DICTIONARY_SIZE]
        + all_answers
        + sorted(gp.EDITORIAL_VALIDATOR_WORDS)
    ))
    prefixes = g4.prefix_index(set(dictionary))
    pool = g4.v3.cal.weighted_pool(tiers, metadata, MOZKOMOR_POLICY)

    g4.PROFILES[PROFILE_NAME] = deepcopy(PROFILE)
    g4.PREFIXES["mozkomor"] = "z"
    g4.v3.PROFILES[PROFILE_NAME] = deepcopy(PROFILE)
    g4.v3.cal.PROFILES["hardcore"] = deepcopy(PROFILE)
    g4.v3.cal.min_turns_for = mozkomor_min_turns

    rng = random.Random(args.seed)
    recent = current_hardcore_tail()
    puzzles = []
    started = time.time()
    rejection_totals: Counter[str] = Counter()

    for offset in range(args.count):
        level = args.start_level + offset
        avoid = set().union(*recent) if recent else set()
        accepted = None
        build_failures = 0
        rejection_counts: Counter[str] = Counter()
        ambiguity_seen: list[float] = []

        for shape_retry in range(1, 801):
            try:
                candidate = g4.v3.cal.build_puzzle(
                    gp,
                    "hardcore",
                    level,
                    rng,
                    pool,
                    dictionary,
                    tier_of,
                    fun_of,
                    avoid,
                )
            except RuntimeError:
                build_failures += 1
                continue

            g4.annotate(candidate, "free", "mozkomor", level, PROFILE_NAME, prefixes)
            meta = candidate["meta"]
            if meta["cutoutComponents"] > PROFILE["max_blank_components"]:
                rejection_counts["cutout-components"] += 1
                continue
            if meta["isolatedCutoutCells"] > PROFILE["max_isolated_blanks"]:
                rejection_counts["isolated-cutouts"] += 1
                continue
            ambiguity_score = float(meta["localAmbiguityScore"])
            ambiguity_seen.append(ambiguity_score)
            if not PROFILE["ambiguity"][0] <= ambiguity_score <= PROFILE["ambiguity"][1]:
                rejection_counts["ambiguity"] += 1
                continue

            meta.update({
                "shapeRetry": shape_retry,
                "buildFailures": build_failures,
                "endgameTier": True,
                "unlockRequiresDifficulty": "hardcore",
                "unlockRequiresBaseLevels": 200,
                "targetCooldown": TARGET_COOLDOWN,
            })
            accepted = candidate
            break

        rejection_totals.update(rejection_counts)
        if accepted is None:
            seen = (
                f"{min(ambiguity_seen):.3f}..{max(ambiguity_seen):.3f}"
                if ambiguity_seen else "none"
            )
            raise RuntimeError(
                f"No acceptable Mozkomor candidate for level {level}; "
                f"buildFailures={build_failures}, rejections={dict(rejection_counts)}, "
                f"ambiguityRangeSeen={seen}"
            )

        puzzles.append(accepted)
        recent.append({
            str(answer["word"]).casefold()
            for answer in accepted["answers"]
            if str(answer.get("word") or "").strip()
        })
        recent = recent[-TARGET_COOLDOWN:]
        print(
            f"Gen4 Mozkomor {offset + 1}/{args.count} level={level} "
            f"cells={len(accepted['mask'])} words={len(accepted['answers'])} "
            f"turns={accepted['meta'].get('meanTurns')} "
            f"ambiguity={accepted['meta']['localAmbiguityScore']}",
            flush=True,
        )

    ambiguity_values = [float(p["meta"]["localAmbiguityScore"]) for p in puzzles]
    mean_turn_values = [float(p["meta"].get("meanTurns") or 0) for p in puzzles]
    tier_counts = Counter(
        tier_of.get(str(answer.get("word") or "").casefold(), "?")
        for puzzle in puzzles
        for answer in puzzle["answers"]
    )
    payload = {
        "version": 1,
        "kind": "gen4-mozkomor-bank",
        "contentGeneration": 4,
        "difficulty": "mozkomor",
        "seed": args.seed,
        "startLevel": args.start_level,
        "targetCooldown": TARGET_COOLDOWN,
        "unlock": {"difficulty": "hardcore", "baseLevels": 200},
        "puzzles": puzzles,
        "stats": {
            "count": len(puzzles),
            "seconds": round(time.time() - started, 2),
            "tierCounts": dict(tier_counts),
            "ambiguity": {
                "min": round(min(ambiguity_values), 3),
                "median": round(median(ambiguity_values), 3),
                "p75": percentile(ambiguity_values, 0.75),
                "p90": percentile(ambiguity_values, 0.90),
                "max": round(max(ambiguity_values), 3),
            },
            "meanTurns": {
                "min": round(min(mean_turn_values), 3),
                "median": round(median(mean_turn_values), 3),
                "p90": percentile(mean_turn_values, 0.90),
                "max": round(max(mean_turn_values), 3),
            },
            "rejections": dict(rejection_totals),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
