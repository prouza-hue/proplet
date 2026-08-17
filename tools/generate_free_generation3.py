#!/usr/bin/env python3
"""Build Free Generation 3 with stable player-facing level slots and a progressive difficulty ladder."""
from __future__ import annotations

from collections import Counter
import importlib.util
import json
from pathlib import Path
import random
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
GEN = ROOT / "tools" / "generate_puzzles.py"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}
TARGET_LEVELS = 200
SEED = 20260817
WIDE_DICTIONARY_SIZE = 12000
MAX_RETRIES = 450


def load_generator():
    spec = importlib.util.spec_from_file_location("proplet_generate_puzzles", GEN)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot import generator")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def broad_unique(gp, puzzle, dictionary):
    targets = [a["word"].lower() for a in puzzle["answers"]]
    solver_dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
    solutions, candidates, nodes = gp.solve_count(
        [x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"],
        [len(w) for w in targets], solver_dictionary, limit=2,
    )
    return solutions == 1, candidates, nodes


def main():
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    if public.get("free") != data.get("free"):
        raise RuntimeError("public/data Free banks differ before Gen3 build")
    current_generation = int(data.get("freeGeneration") or 1)
    if current_generation not in (2, 3):
        raise RuntimeError(f"Expected Free generation 2 or an idempotent Gen3 rebuild, got {current_generation}")

    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {w: int(m.get("fun", 3)) for w, m in metadata.items()}
    pools = gp.build_answer_pools(tiers, metadata)
    freq = gp.load_frequency_words()
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + all_answers + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))

    legacy = {d: list((data.get("legacyFree") or {}).get(d, [])) for d in DIFFICULTIES}
    if current_generation < 3:
        for difficulty in DIFFICULTIES:
            for index, puzzle in enumerate(data.get("free", {}).get(difficulty, []), start=1):
                archived = json.loads(json.dumps(puzzle))
                meta = archived.setdefault("meta", {})
                meta.setdefault("level", index)
                meta.setdefault("contentGeneration", current_generation)
                meta.setdefault("generationKey", f"free-gen{current_generation}")
                meta["legacy"] = True
                legacy[difficulty].append(archived)

    used_signatures = set()
    for bank in legacy.values():
        for p in bank:
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for key in ("daily", "rescue"):
        for p in data.get(key, []):
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in (data.get("previousDaily") or {}).get("puzzles", []):
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for bank in data.get("legacyDaily", []):
        for p in bank.get("puzzles", []):
            if p.get("rows") and p.get("cols") and p.get("letters"):
                used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))

    rng = random.Random(SEED)
    free = {d: [] for d in DIFFICULTIES}
    recent = {d: [] for d in DIFFICULTIES}
    broad_rejects = Counter()
    signature_rejects = Counter()
    started = time.time()

    for difficulty in DIFFICULTIES:
        for level in range(1, TARGET_LEVELS + 1):
            avoid = set().union(*recent[difficulty]) if recent[difficulty] else set()
            vocab_key = gp.free_vocab_key(difficulty, level)
            variant = gp.progression_variant_index(difficulty, level)
            accepted = None
            for retry in range(1, MAX_RETRIES + 1):
                seed = rng.randrange(1, 2**31 - 1)
                puzzle = gp.create_puzzle(
                    difficulty, seed, pools[vocab_key], dictionary,
                    f"{PREFIX[difficulty]}-{level:03d}",
                    variant_index=variant, tier_of=tier_of, vocab_key=vocab_key,
                    fun_of=fun_of, avoid_words=avoid,
                )
                sig = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
                if sig in used_signatures:
                    signature_rejects[difficulty] += 1
                    continue
                unique, candidates, nodes = broad_unique(gp, puzzle, dictionary)
                if not unique:
                    broad_rejects[difficulty] += 1
                    continue
                puzzle.setdefault("meta", {}).update({
                    "level": level,
                    "contentGeneration": 3,
                    "generationKey": "free-gen3",
                    "lexiconVersion": 2,
                    "progressionPhase": variant + 1 if variant is not None else 1,
                    "wideVerifiedUnique": True,
                    "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
                    "wideCandidateCount": candidates,
                    "wideSolverNodes": nodes,
                    "gen3SeedRetry": retry,
                })
                accepted = puzzle
                used_signatures.add(sig)
                break
            if accepted is None:
                raise RuntimeError(f"Could not generate {difficulty} level {level} after {MAX_RETRIES} retries")
            free[difficulty].append(accepted)
            recent[difficulty].append({a["word"].lower() for a in accepted["answers"]})
            recent[difficulty] = recent[difficulty][-16:]
            if level % 25 == 0:
                print(f"Gen3 {difficulty}: {level}/{TARGET_LEVELS}", flush=True)

    payload = json.loads(json.dumps(data))
    payload.update({
        "version": 10,
        "generatedAt": "2026-08-17",
        "free": free,
        "legacyFree": legacy,
        "freeGeneration": 3,
        "freeLevelsPerDifficulty": TARGET_LEVELS,
        "lexiconVersion": 2,
        "vocabularyVersion": 2,
        "vocabularyTierCounts": {tier: len(tiers[tier]) for tier in ("A", "B", "C", "D")},
        "freeMigration": {
            "strategy": "stable-level-slots",
            "xpPolicy": "once-per-difficulty-level-slot",
            "activeGeneration": 3,
            "playerFacingGenerationLabels": False,
            "inProgressLegacyFinishAllowed": True,
        },
        "freeProgression": {
            "version": 3,
            "mediumPhases": [50, 100, 150, 200],
            "hardPhases": [50, 100, 150, 200],
            "playerFacingModel": "difficulty-plus-level-only",
        },
    })
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    DATA.write_text(encoded, encoding="utf-8")

    # New players download only active content. Historical Free boards remain server-side
    # for old results and the rare in-progress migration. A compact id -> level index is
    # enough for local stable-slot bookkeeping without leaking generation concepts into UI.
    legacy_index = {}
    for difficulty in DIFFICULTIES:
        for puzzle in legacy[difficulty]:
            meta = puzzle.get("meta") or {}
            legacy_index[puzzle["id"]] = {
                "difficulty": difficulty,
                "level": int(meta.get("level") or 0),
                "generation": int(meta.get("contentGeneration") or 1),
            }
    public_payload = json.loads(json.dumps(payload))
    public_payload["legacyFreeIndex"] = legacy_index
    public_payload["legacyFree"] = {difficulty: [] for difficulty in DIFFICULTIES}
    public_payload["publicLegacyMode"] = "compact-index"
    PUBLIC.write_text(json.dumps(public_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "freeGeneration": 3,
        "counts": {d: len(free[d]) for d in DIFFICULTIES},
        "broadRejects": dict(broad_rejects),
        "signatureRejects": dict(signature_rejects),
        "seconds": round(time.time() - started, 1),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
