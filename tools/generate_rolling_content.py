#!/usr/bin/env python3
"""Append a deterministic, pre-QA'd reserve for weekly Proplet Free content drops.

The server-side data/puzzles.json contains the full reserve. public/puzzles.json deliberately
remains the current baseline fallback; clients receive released content through /api/puzzles.

Rolling content uses a stricter uniqueness gate than the historical generator: every accepted
candidate is re-solved against the broad 12k-word dictionary used by the independent audit.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
import importlib.util
import json
from pathlib import Path
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
GEN = ROOT / "tools" / "generate_puzzles.py"
FIRST_RELEASE = date(2026, 8, 24)
WEEKS = 13
SEED = 20260824
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
ID_PREFIX = {"easy": "g2-e", "medium": "g2-m", "hard": "g2-h", "hardcore": "g2-x"}
EXTRA_ROTATION = DIFFICULTIES
WIDE_DICTIONARY_SIZE = 12000
MAX_SEED_RETRIES = 400


def load_generator():
    spec = importlib.util.spec_from_file_location("proplet_generate_puzzles", GEN)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot import tools/generate_puzzles.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def broad_uniqueness(gp, puzzle: dict, dictionary: list[str]) -> tuple[bool, int, int]:
    """Re-solve a candidate with the broad dictionary; return unique/candidates/nodes."""
    targets = [a["word"].lower() for a in puzzle["answers"]]
    solver_dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + targets))
    solutions, candidate_count, search_nodes = gp.solve_count(
        [x.lower() for x in puzzle["letters"]],
        puzzle["rows"],
        puzzle["cols"],
        puzzle["mask"],
        [len(w) for w in targets],
        solver_dictionary,
        limit=2,
    )
    return solutions == 1, candidate_count, search_nodes


def main() -> None:
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    baseline = json.loads(PUBLIC.read_text(encoding="utf-8"))
    if int(data.get("version") or 0) != 9:
        raise RuntimeError(f"Expected puzzle DB v9, got {data.get('version')}")
    if int(data.get("freeGeneration") or 0) != 2:
        raise RuntimeError("Rolling content expects Free generation 2")
    counts = {d: len(data.get("free", {}).get(d, [])) for d in DIFFICULTIES}
    if counts != {d: 200 for d in DIFFICULTIES}:
        raise RuntimeError(f"Expected 200 current levels per difficulty before first rolling reserve, got {counts}")
    if baseline.get("free") != data.get("free"):
        raise RuntimeError("public/data Free banks must match before rolling reserve generation")

    freq = gp.load_frequency_words()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    pools = gp.build_answer_pools(tiers, metadata)
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = dictionary[:WIDE_DICTIONARY_SIZE] + [w for w in all_answers if w not in dictionary[:WIDE_DICTIONARY_SIZE]]

    used_signatures: set[tuple] = set()
    for bank_name in ("free", "legacyFree"):
        for bank in (data.get(bank_name) or {}).values():
            for p in bank:
                used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for bank_name in ("daily", "rescue"):
        for p in data.get(bank_name, []):
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    previous = data.get("previousDaily") or {}
    for p in previous.get("puzzles", []):
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))

    repeat_window = 24
    recent: dict[str, list[set[str]]] = {}
    for difficulty in DIFFICULTIES:
        recent[difficulty] = [
            {a["word"].lower() for a in p.get("answers", [])}
            for p in data["free"][difficulty][-repeat_window:]
        ]

    rng = random.Random(SEED)
    generated: list[dict] = []
    batch_summaries: list[dict] = []
    rejected_broad = Counter()
    rejected_signature = Counter()

    for week in range(WEEKS):
        release = FIRST_RELEASE + timedelta(days=7 * week)
        iso = release.isocalendar()
        batch_id = f"{iso.year}-W{iso.week:02d}"
        extra = EXTRA_ROTATION[week % len(EXTRA_ROTATION)]
        order = ["easy", "medium", "hard", "hardcore", extra]
        batch_counts = Counter(order)
        batch_rows = []
        for release_index, difficulty in enumerate(order, start=1):
            level = len(data["free"][difficulty]) + 1
            puzzle_id = f"{ID_PREFIX[difficulty]}-{level:03d}"
            vocab_key = "hardcore_conservative" if difficulty == "hardcore" else difficulty
            avoid = set().union(*recent[difficulty]) if recent[difficulty] else set()
            # Deterministic retry loop. create_puzzle first applies the historical per-difficulty
            # solver gate; every returned candidate is then re-solved with the broad 12k corpus.
            accepted = None
            accepted_sig = None
            for retry in range(1, MAX_SEED_RETRIES + 1):
                seed = rng.randrange(1, 2**31 - 1)
                p = gp.create_puzzle(
                    difficulty,
                    seed,
                    pools[vocab_key],
                    dictionary,
                    puzzle_id,
                    variant_index=level - 1 if difficulty == "hard" else None,
                    tier_of=tier_of,
                    vocab_key=vocab_key,
                    fun_of=fun_of,
                    avoid_words=avoid,
                )
                sig = (p["rows"], p["cols"], tuple(p["letters"]))
                if sig in used_signatures:
                    rejected_signature[difficulty] += 1
                    continue
                unique, broad_candidates, broad_nodes = broad_uniqueness(gp, p, dictionary)
                if not unique:
                    rejected_broad[difficulty] += 1
                    if retry <= 3 or retry % 25 == 0:
                        print(f"reject broad ambiguity {puzzle_id} retry={retry}", flush=True)
                    continue
                p.setdefault("meta", {}).update({
                    "wideVerifiedUnique": True,
                    "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
                    "wideCandidateCount": broad_candidates,
                    "wideSolverNodes": broad_nodes,
                    "rollingSeedRetry": retry,
                })
                accepted, accepted_sig = p, sig
                break
            if accepted is None or accepted_sig is None:
                raise RuntimeError(f"Could not generate broad-unique rolling puzzle {puzzle_id} after {MAX_SEED_RETRIES} seeds")
            p = accepted
            used_signatures.add(accepted_sig)
            p.setdefault("meta", {}).update({
                "level": level,
                "contentGeneration": 2,
                "generationKey": "free-gen2",
                "lexiconVersion": 2,
                "availableFrom": release.isoformat(),
                "releaseBatch": batch_id,
                "releaseIndex": release_index,
                "rollingContent": True,
            })
            data["free"][difficulty].append(p)
            word_set = {a["word"].lower() for a in p["answers"]}
            recent[difficulty].append(word_set)
            recent[difficulty] = recent[difficulty][-repeat_window:]
            generated.append(p)
            batch_rows.append({"id": puzzle_id, "difficulty": difficulty, "level": level})
        batch_summaries.append({
            "id": batch_id,
            "availableFrom": release.isoformat(),
            "count": 5,
            "extraDifficulty": extra,
            "byDifficulty": dict(batch_counts),
            "levels": batch_rows,
        })
        print(f"{batch_id} {release}: {', '.join(x['id'] for x in batch_rows)}", flush=True)

    data["rollingContent"] = {
        "version": 1,
        "cadence": "weekly",
        "releaseWeekday": "monday",
        "levelsPerDrop": 5,
        "firstRelease": FIRST_RELEASE.isoformat(),
        "weeksReserved": WEEKS,
        "reservedThrough": batch_summaries[-1]["availableFrom"],
        "extraRotation": list(EXTRA_ROTATION),
        "generatedAtVersion": "3.30.0",
        "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
        "batches": batch_summaries,
    }
    # Bump schema version because clients now understand release metadata and /api/puzzles.
    data["version"] = 10
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Keep the public static fallback deliberately free of unreleased reserve content.
    baseline["version"] = 10
    baseline["rollingContent"] = {
        k: v for k, v in data["rollingContent"].items() if k != "batches"
    }
    baseline["rollingContent"]["batches"] = []
    PUBLIC.write_text(json.dumps(baseline, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "generated": len(generated),
        "weeks": WEEKS,
        "firstRelease": FIRST_RELEASE.isoformat(),
        "reservedThrough": batch_summaries[-1]["availableFrom"],
        "finalCounts": {d: len(data["free"][d]) for d in DIFFICULTIES},
        "generatedCounts": dict(Counter(p["difficulty"] for p in generated)),
        "broadAmbiguityRejects": dict(rejected_broad),
        "signatureRejects": dict(rejected_signature),
        "batches": batch_summaries,
    }
    (ROOT / "ROLLING_CONTENT_V3_30_AUDIT.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
