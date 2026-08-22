#!/usr/bin/env python3
"""Generate a small v3.34 calibration bank without touching production content.

The prototype deliberately breaks the old "one global snake split into words"
construction. Target words are packed as disjoint paths into one connected mask.
Every target keeps a unique path and the full board must still pass the existing
broad exact-cover uniqueness solver.

This file is calibration-only. It never writes data/puzzles.json.
"""
from __future__ import annotations

import argparse
from collections import Counter
import importlib.util
import json
import math
from pathlib import Path
import random
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "tools" / "generate_puzzles.py"
DEFAULT_OUTPUT = ROOT / "tmp" / "v334-calibration.json"
SEED = 20260820
WIDE_DICTIONARY_SIZE = 12000
MUST_REVIEW = {"červodíra", "blockchain", "pulsar", "tensor"}

PROFILES = {
    "medium": {
        "rows": 8,
        "cols": 8,
        "cells": (44, 50),
        "words": (8, 9),
        "min_len": 4,
        "max_len": 8,
        "turn_bias": 1.35,
        "min_bbox_rows": 6,
        "min_bbox_cols": 6,
        "min_curvy_share": 0.45,
        "max_mean_straight_share": 0.72,
        "geometry_profile": "v334-medium-independent-v1",
        "policy": {
            "allowed": ("A", "B"),
            "weights": {"A": 2, "B": 3},
            "min_fraction": {"B": 0.45},
            "max_fraction": {"B": 0.75},
            "min_avg_fun": 2.8,
            "min_fun_words": 1,
        },
    },
    "hard": {
        "rows": 9,
        "cols": 9,
        "cells": (54, 62),
        "words": (9, 10),
        "min_len": 4,
        "max_len": 9,
        "turn_bias": 2.05,
        "min_bbox_rows": 7,
        "min_bbox_cols": 7,
        "min_curvy_share": 0.65,
        "max_mean_straight_share": 0.64,
        "geometry_profile": "v334-hard-independent-v1",
        "policy": {
            "allowed": ("A", "B", "C"),
            "weights": {"A": 1, "B": 5, "C": 2},
            "min_fraction": {"A": 0.10, "B": 0.45, "C": 0.20},
            "max_fraction": {"C": 0.35},
            "min_avg_fun": 2.9,
            "min_fun_words": 1,
        },
    },
}


def load_generator():
    spec = importlib.util.spec_from_file_location("proplet_generate_puzzles_v334", GEN)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot import generator")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def direction(a: int, b: int, cols: int) -> tuple[int, int]:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return br - ar, bc - ac


def adjacent(a: int, b: int, cols: int) -> bool:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return abs(ar - br) + abs(ac - bc) == 1


def grid_neighbours(cell: int, rows: int, cols: int):
    r, c = divmod(cell, cols)
    for rr, cc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
        if 0 <= rr < rows and 0 <= cc < cols:
            yield rr * cols + cc


def longest_straight_edges(path: list[int], cols: int) -> int:
    if len(path) < 2:
        return 0
    dirs = [direction(a, b, cols) for a, b in zip(path, path[1:])]
    best = run = 1
    for prev, cur in zip(dirs, dirs[1:]):
        if prev == cur:
            run += 1
            best = max(best, run)
        else:
            run = 1
    return best


def min_turns_for(length: int, difficulty: str) -> int:
    if difficulty == "medium":
        if length >= 7:
            return 2
        if length >= 5:
            return 1
        return 0
    if length >= 7:
        return 2
    if length >= 4:
        return 1
    return 0


def weighted_pool(tiers: dict[str, list[str]], metadata: dict[str, dict], policy: dict) -> list[str]:
    out: list[str] = []
    for tier in policy["allowed"]:
        for word in tiers[tier]:
            if word in MUST_REVIEW:
                continue
            fun = int(metadata.get(word, {}).get("fun", 3))
            fun_weight = {1: 1, 2: 1, 3: 2, 4: 4, 5: 6}.get(fun, 2)
            out.extend([word] * int(policy["weights"].get(tier, 1)) * fun_weight)
    return out


def candidate_starts(
    rows: int,
    cols: int,
    occupied: set[int],
    starts: set[int],
    endpoints: set[int],
    rng: random.Random,
) -> list[int]:
    unused = set(range(rows * cols)) - occupied
    if not occupied:
        center_r = (rows - 1) / 2
        center_c = (cols - 1) / 2
        values = list(unused)
        rng.shuffle(values)
        values.sort(key=lambda cell: abs(divmod(cell, cols)[0] - center_r) + abs(divmod(cell, cols)[1] - center_c))
        return values[: max(12, len(values) // 2)]

    interior = occupied - starts - endpoints
    anchors = interior or occupied
    frontier = {
        cell
        for anchor in anchors
        for cell in grid_neighbours(anchor, rows, cols)
        if cell in unused
        and not any(adjacent(cell, endpoint, cols) for endpoint in endpoints)
    }
    values = list(frontier)
    rng.shuffle(values)
    if values:
        return values

    # Rare fallback: preserve connectivity, but still refuse an obvious old-end -> new-start handoff.
    values = [
        cell for cell in unused
        if any(adjacent(cell, old, cols) for old in occupied)
        and not any(adjacent(cell, endpoint, cols) for endpoint in endpoints)
    ]
    rng.shuffle(values)
    return values


def find_word_path(
    length: int,
    difficulty: str,
    profile: dict,
    occupied: set[int],
    starts: set[int],
    endpoints: set[int],
    rng: random.Random,
) -> list[int] | None:
    rows, cols = profile["rows"], profile["cols"]
    starts_to_try = candidate_starts(rows, cols, occupied, starts, endpoints, rng)
    if not starts_to_try:
        return None

    min_turns = min_turns_for(length, difficulty)
    node_budget = 4200
    nodes = 0

    for start in starts_to_try[:36]:
        trail = [start]
        used = {start}

        def dfs(last_dir: tuple[int, int] | None = None) -> bool:
            nonlocal nodes
            nodes += 1
            if nodes > node_budget:
                return False
            if len(trail) == length:
                # New endpoint must not point directly at an existing word start.
                if any(adjacent(trail[-1], old_start, cols) for old_start in starts):
                    return False
                turns, _ = path_turn_metrics(trail, cols)
                if turns < min_turns:
                    return False
                straight_share = longest_straight_edges(trail, cols) / max(1, length - 1)
                max_share = 0.84 if difficulty == "medium" else 0.76
                return straight_share <= max_share + 1e-9

            cur = trail[-1]
            options = [
                nxt for nxt in grid_neighbours(cur, rows, cols)
                if nxt not in occupied and nxt not in used
            ]
            if not options:
                return False

            ranked = []
            for nxt in options:
                nd = direction(cur, nxt, cols)
                is_turn = int(last_dir is not None and nd != last_dir)
                occupied_contacts = sum(1 for n in grid_neighbours(nxt, rows, cols) if n in occupied)
                self_contacts = sum(1 for n in grid_neighbours(nxt, rows, cols) if n in used and n != cur)
                edge_penalty = int(any(adjacent(nxt, x, cols) for x in starts | endpoints))
                score = (
                    is_turn * float(profile["turn_bias"])
                    - occupied_contacts * 0.14
                    - self_contacts * 0.18
                    - edge_penalty * 0.30
                    + rng.random() * 1.35
                )
                ranked.append((score, nxt, nd))
            ranked.sort(key=lambda item: item[0], reverse=True)

            for _, nxt, nd in ranked:
                trail.append(nxt)
                used.add(nxt)
                if dfs(nd):
                    return True
                used.remove(nxt)
                trail.pop()
            return False

        if dfs():
            return trail.copy()
    return None


def path_turn_metrics(path: list[int], cols: int) -> tuple[int, int]:
    if len(path) < 3:
        return 0, 0
    dirs = [direction(a, b, cols) for a, b in zip(path, path[1:])]
    turns = sum(a != b for a, b in zip(dirs, dirs[1:]))
    signs = []
    for a, b in zip(dirs, dirs[1:]):
        if a == b:
            continue
        cross = a[1] * b[0] - a[0] * b[1]
        signs.append(1 if cross > 0 else -1 if cross < 0 else 0)
    best = cur = 0
    prev = None
    for sign in signs:
        if not sign:
            continue
        cur = cur + 1 if sign == prev else 1
        prev = sign
        best = max(best, cur)
    return turns, best


def pack_paths(words: list[str], difficulty: str, profile: dict, rng: random.Random) -> dict[str, list[int]] | None:
    rows, cols = profile["rows"], profile["cols"]
    indexed = list(enumerate(words))
    indexed.sort(key=lambda item: (-len(item[1]), rng.random()))

    for _ in range(100):
        occupied: set[int] = set()
        starts: set[int] = set()
        endpoints: set[int] = set()
        placed: dict[int, list[int]] = {}
        ok = True

        for index, word in indexed:
            path = find_word_path(len(word), difficulty, profile, occupied, starts, endpoints, rng)
            if path is None:
                ok = False
                break
            placed[index] = path
            occupied.update(path)
            starts.add(path[0])
            endpoints.add(path[-1])

        if not ok:
            continue

        rs = [divmod(cell, cols)[0] for cell in occupied]
        cs = [divmod(cell, cols)[1] for cell in occupied]
        bbox_rows = max(rs) - min(rs) + 1
        bbox_cols = max(cs) - min(cs) + 1
        if bbox_rows < profile["min_bbox_rows"] or bbox_cols < profile["min_bbox_cols"]:
            continue

        turns = [path_turn_metrics(placed[i], cols)[0] for i in range(len(words))]
        curvy_share = sum(t >= 2 for t in turns) / len(turns)
        straight_shares = [
            longest_straight_edges(placed[i], cols) / max(1, len(placed[i]) - 1)
            for i in range(len(words))
        ]
        if curvy_share + 1e-9 < profile["min_curvy_share"]:
            continue
        if sum(straight_shares) / len(straight_shares) > profile["max_mean_straight_share"] + 1e-9:
            continue

        # Explicit chainability gate: no answer endpoint may directly touch another answer start.
        endpoint_start_pairs = 0
        for i in range(len(words)):
            for j in range(len(words)):
                if i != j and adjacent(placed[i][-1], placed[j][0], cols):
                    endpoint_start_pairs += 1
        if endpoint_start_pairs:
            continue

        return {words[i]: placed[i] for i in range(len(words))}
    return None


def build_puzzle(
    gp,
    difficulty: str,
    level: int,
    rng: random.Random,
    pool: list[str],
    dictionary: list[str],
    tier_of: dict[str, str],
    fun_of: dict[str, int],
    avoid_words: set[str],
) -> dict:
    profile = PROFILES[difficulty]
    policy = profile["policy"]

    for retry in range(1, 181):
        cells = rng.randint(*profile["cells"])
        count = rng.randint(*profile["words"])
        words = gp.choose_words(
            cells,
            count,
            rng,
            pool,
            profile["min_len"],
            profile["max_len"],
            2 if difficulty == "hard" else None,
            tier_of=tier_of,
            policy=policy,
            fun_of=fun_of,
            avoid_words=avoid_words | MUST_REVIEW,
        )
        if not words:
            continue

        geometry = pack_paths(words, difficulty, profile, rng)
        if geometry is None:
            continue

        rows, cols = profile["rows"], profile["cols"]
        letters = [""] * (rows * cols)
        answers = []
        for word in words:
            path = geometry[word]
            turns, curl_run = path_turn_metrics(path, cols)
            answers.append({"word": word.upper(), "path": path, "turns": turns, "curlRun": curl_run})
            for ch, cell in zip(word, path):
                if letters[cell]:
                    raise RuntimeError("Calibration geometry overlapped target paths")
                letters[cell] = ch.upper()

        mask = sorted(cell for cell, value in enumerate(letters) if value)
        if len(mask) != cells:
            continue

        target_candidates = gp.enumerate_candidates(
            [x.lower() for x in letters], rows, cols, mask,
            {len(w) for w in words}, words,
        )
        target_paths: dict[str, list[tuple[int, ...]]] = {w: [] for w in words}
        for cand in target_candidates:
            if cand.word in target_paths:
                target_paths[cand.word].append(cand.path)
        expected = {a["word"].lower(): tuple(a["path"]) for a in answers}
        if any(len(target_paths[w]) != 1 or target_paths[w][0] != expected[w] for w in words):
            continue

        solver_dictionary = list(dict.fromkeys(
            dictionary[:WIDE_DICTIONARY_SIZE]
            + words
            + sorted(gp.EDITORIAL_VALIDATOR_WORDS)
        ))
        solutions, candidate_count, search_nodes = gp.solve_count(
            [x.lower() for x in letters], rows, cols, mask,
            [len(w) for w in words], solver_dictionary, limit=2,
        )
        if solutions != 1:
            continue

        answer_order = list(answers)
        rng.shuffle(answer_order)
        turn_values = [a["turns"] for a in answers]
        straight_shares = [
            longest_straight_edges(a["path"], cols) / max(1, len(a["path"]) - 1)
            for a in answers
        ]
        tier_counts = Counter(tier_of[w] for w in words)
        return {
            "id": f"cal-v334-{'m' if difficulty == 'medium' else 'h'}-{level:03d}",
            "difficulty": difficulty,
            "rows": rows,
            "cols": cols,
            "mask": mask,
            "letters": letters,
            "lengths": [len(a["word"]) for a in answer_order],
            "answers": answer_order,
            "meta": {
                "level": level,
                "contentGeneration": 4,
                "generationKey": "free-gen4-calibration-v1",
                "calibrationOnly": True,
                "cells": cells,
                "candidateCount": candidate_count,
                "solverNodes": search_nodes,
                "verifiedUnique": True,
                "wideVerifiedUnique": True,
                "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
                "geometryProfile": profile["geometry_profile"],
                "pathStyle": "independent-packed",
                "meanTurns": round(sum(turn_values) / len(turn_values), 3),
                "meanLongestStraightEdgeShare": round(sum(straight_shares) / len(straight_shares), 3),
                "endpointStartAdjacencyShare": 0.0,
                "vocabTiers": dict(tier_counts),
                "averageFun": round(sum(fun_of.get(w, 3) for w in words) / len(words), 2),
                "seedRetry": retry,
            },
        }
    raise RuntimeError(f"Could not generate calibration {difficulty} level {level}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--medium", type=int, default=8)
    ap.add_argument("--hard", type=int, default=8)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = ap.parse_args()

    gp = load_generator()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    freq = gp.load_frequency_words()
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(
        dictionary[:WIDE_DICTIONARY_SIZE]
        + all_answers
        + sorted(gp.EDITORIAL_VALIDATOR_WORDS)
    ))

    pools = {
        difficulty: weighted_pool(tiers, metadata, PROFILES[difficulty]["policy"])
        for difficulty in ("medium", "hard")
    }

    rng = random.Random(args.seed)
    counts = {"medium": max(0, args.medium), "hard": max(0, args.hard)}
    banks = {"medium": [], "hard": []}
    recent = {"medium": [], "hard": []}
    started = time.time()

    for difficulty in ("medium", "hard"):
        for level in range(1, counts[difficulty] + 1):
            avoid = set().union(*recent[difficulty]) if recent[difficulty] else set()
            puzzle = build_puzzle(
                gp, difficulty, level, rng, pools[difficulty], dictionary,
                tier_of, fun_of, avoid,
            )
            banks[difficulty].append(puzzle)
            recent[difficulty].append({a["word"].lower() for a in puzzle["answers"]})
            recent[difficulty] = recent[difficulty][-8:]
            print(
                f"v3.34 calibration {difficulty} {level}/{counts[difficulty]} "
                f"cells={puzzle['meta']['cells']} cand={puzzle['meta']['candidateCount']} "
                f"turns={puzzle['meta']['meanTurns']}",
                flush=True,
            )

    payload = {
        "version": 1,
        "purpose": "v3.34 calibration only - NOT FOR PRODUCTION",
        "calibrationGeneration": 4,
        "seed": args.seed,
        "mustReviewExcludedFromTargets": sorted(MUST_REVIEW),
        "profiles": {
            key: {k: v for k, v in profile.items() if k != "policy"}
            | {"vocabularyPolicy": profile["policy"]}
            for key, profile in PROFILES.items()
        },
        "puzzles": banks,
        "stats": {
            "counts": {key: len(value) for key, value in banks.items()},
            "seconds": round(time.time() - started, 2),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
