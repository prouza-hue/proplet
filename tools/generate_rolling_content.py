#!/usr/bin/env python3
"""Generate a deterministic, pre-QA'd reserve for weekly Proplet Free content drops.

The existing data/puzzles.json and public/puzzles.json stay byte-for-byte untouched. Future
content lives in data/rolling_content_v1.json and is exposed only as a small release-gated delta.

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
ROLLING_DATA = ROOT / "data" / "rolling_content_v1.json"
GEN = ROOT / "tools" / "generate_puzzles.py"
FIRST_RELEASE = date(2026, 8, 24)
WEEKS = 13
SEED = 20260824
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
ID_PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}
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
    targets = [a["word"].lower() for a in puzzle["answers"]]
    solver_dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + targets))
    solutions, candidate_count, search_nodes = gp.solve_count(
        [x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"],
        [len(w) for w in targets], solver_dictionary, limit=2,
    )
    return solutions == 1, candidate_count, search_nodes


def main() -> None:
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    if int(data.get("version") or 0) != 10 or int(public.get("version") or 0) != 10:
        raise RuntimeError("Rolling content expects Gen3 base puzzle DB v10")
    if int(data.get("freeGeneration") or 0) != 3:
        raise RuntimeError("Rolling content expects Free generation 3")
    counts = {d: len(data.get("free", {}).get(d, [])) for d in DIFFICULTIES}
    if counts != {d: 200 for d in DIFFICULTIES}:
        raise RuntimeError(f"Expected 200 current levels per difficulty, got {counts}")
    if public.get("free") != data.get("free"):
        raise RuntimeError("public/data Free banks must match before reserve generation")

    # Work on an in-memory copy only; base files are never rewritten.
    working = {d: list(data["free"][d]) for d in DIFFICULTIES}

    freq = gp.load_frequency_words()
    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    pools = gp.build_answer_pools(tiers, metadata)
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + all_answers + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))

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

    repeat_window = 16
    recent = {
        d: [{a["word"].lower() for a in p.get("answers", [])} for p in working[d][-repeat_window:]]
        for d in DIFFICULTIES
    }

    rng = random.Random(SEED)
    generated: list[dict] = []
    generated_by_diff = {d: [] for d in DIFFICULTIES}
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
            level = len(working[difficulty]) + 1
            puzzle_id = f"{ID_PREFIX[difficulty]}-{level:03d}"
            vocab_key = gp.free_vocab_key(difficulty, level)
            avoid = set().union(*recent[difficulty]) if recent[difficulty] else set()
            accepted = accepted_sig = None
            for retry in range(1, MAX_SEED_RETRIES + 1):
                seed = rng.randrange(1, 2**31 - 1)
                p = gp.create_puzzle(
                    difficulty, seed, pools[vocab_key], dictionary, puzzle_id,
                    variant_index=gp.progression_variant_index(difficulty, level),
                    tier_of=tier_of, vocab_key=vocab_key, fun_of=fun_of, avoid_words=avoid,
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
                raise RuntimeError(f"Could not generate broad-unique {puzzle_id} after {MAX_SEED_RETRIES} seeds")
            p = accepted
            used_signatures.add(accepted_sig)
            p.setdefault("meta", {}).update({
                "level": level,
                "contentGeneration": 3,
                "generationKey": "free-gen3",
                "lexiconVersion": 2,
                "availableFrom": release.isoformat(),
                "releaseBatch": batch_id,
                "releaseIndex": release_index,
                "rollingContent": True,
            })
            working[difficulty].append(p)
            generated_by_diff[difficulty].append(p)
            recent[difficulty].append({a["word"].lower() for a in p["answers"]})
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

    reserve = {
        "version": 1,
        "basePuzzleVersion": 10,
        "cadence": "weekly",
        "releaseWeekday": "monday",
        "levelsPerDrop": 5,
        "firstRelease": FIRST_RELEASE.isoformat(),
        "weeksReserved": WEEKS,
        "reservedThrough": batch_summaries[-1]["availableFrom"],
        "extraRotation": list(EXTRA_ROTATION),
        "generatedAtVersion": "3.31.6",
        "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
        "batches": batch_summaries,
        "puzzles": generated_by_diff,
    }
    ROLLING_DATA.write_text(json.dumps(reserve, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = {
        "generated": len(generated),
        "weeks": WEEKS,
        "firstRelease": FIRST_RELEASE.isoformat(),
        "reservedThrough": batch_summaries[-1]["availableFrom"],
        "finalCounts": {d: len(working[d]) for d in DIFFICULTIES},
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
