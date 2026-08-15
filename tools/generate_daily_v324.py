#!/usr/bin/env python3
"""Build Daily Generation 3 with a Monday-anchored 2/3/2 weekly cadence.

The switch is intentionally date-boundary based:
- through 2026-08-16 the existing Generation 2 Daily remains primary,
- from Monday 2026-08-17 Generation 3 is primary,
- cached/offline Gen2 clients remain accepted through legacy/transition metadata.

No Free or Rescue puzzle is modified.
"""
from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path
import argparse
import json
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import generate_puzzles as gp  # noqa: E402

SERVER_OUT = ROOT / "data" / "puzzles.json"
PUBLIC_OUT = ROOT / "public" / "puzzles.json"
ARCHIVE_GEN2 = ROOT / "data" / "legacy_daily_gen2.json"
SWITCH_DATE = date(2026, 8, 17)  # Monday
PATTERN = ("easy", "easy", "medium", "medium", "medium", "hard", "hard")
GENERATION = 3
GENERATION_KEY = "daily-gen3"
REPEAT_WINDOW = 24


def signature(puzzle: dict) -> tuple:
    return (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))


def full_archive_payload(old: dict) -> dict:
    return {
        "version": 1,
        "archivedAt": "2026-08-15",
        "generation": int(old.get("dailyGeneration") or 2),
        "generationKey": "daily-gen2",
        "rotationBaseDate": "2026-01-01",
        "activeFrom": old.get("dailyGeneration2From") or "2026-08-13",
        "activeUntil": "2026-08-16",
        "puzzles": json.loads(json.dumps(old.get("daily", []))),
    }


def ensure_compact_legacy_gen2(old: dict, archive: dict) -> list[dict]:
    legacy = list(old.get("legacyDaily", []))
    if not any(int(bank.get("generation") or 0) == 2 for bank in legacy):
        legacy.append({
            "generation": 2,
            "generationKey": "daily-gen2",
            "rotationBaseDate": "2026-01-01",
            "activeFrom": archive["activeFrom"],
            "activeUntil": archive["activeUntil"],
            "puzzles": [
                {"id": p["id"], "difficulty": p["difficulty"]}
                for p in archive["puzzles"]
            ],
        })
    return legacy


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=3240817)
    args = ap.parse_args()

    old = json.loads(SERVER_OUT.read_text(encoding="utf-8"))
    current_generation = int(old.get("dailyGeneration") or 1)
    if current_generation == GENERATION:
        # Deterministic/idempotent reruns are useful in CI after the generated commit.
        bank = old.get("daily", [])
        if (
            old.get("dailyGeneration3From") == SWITCH_DATE.isoformat()
            and old.get("dailyRotationBaseDate") == SWITCH_DATE.isoformat()
            and len(bank) == 365
            and all(p.get("difficulty") == PATTERN[i % 7] for i, p in enumerate(bank))
        ):
            print("Generation 3 already present; nothing to rebuild.")
            return
        raise SystemExit("Daily Generation 3 metadata exists but is inconsistent; refusing to overwrite it.")
    if current_generation != 2:
        raise SystemExit(f"Expected Daily Generation 2, found {current_generation}.")
    if len(old.get("daily", [])) != 365:
        raise SystemExit("Expected the current Generation 2 Daily bank to contain 365 puzzles.")

    archive = full_archive_payload(old)
    ARCHIVE_GEN2.write_text(
        json.dumps(archive, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    legacy_daily = ensure_compact_legacy_gen2(old, archive)

    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in metadata.items()}
    answer_pools = gp.build_answer_pools(tiers, metadata)
    all_answers = [word for tier in ("A", "B", "C", "D") for word in tiers[tier]]

    # data/words.txt is the exact validator lexicon shipped by the current release.
    # Do not depend on the original FrequencyWords source being present in the repo.
    dictionary = gp.WORDS_OUT.read_text(encoding="utf-8").splitlines()
    dictionary = list(dict.fromkeys(dictionary + all_answers))

    used_signatures: set[tuple] = set()
    for bank in old.get("free", {}).values():
        for puzzle in bank:
            used_signatures.add(signature(puzzle))
    for puzzle in old.get("rescue", []):
        used_signatures.add(signature(puzzle))
    for puzzle in archive["puzzles"]:
        used_signatures.add(signature(puzzle))
    gen1_path = ROOT / "data" / "legacy_daily_gen1.json"
    if gen1_path.exists():
        try:
            for puzzle in json.loads(gen1_path.read_text(encoding="utf-8")).get("puzzles", []):
                used_signatures.add(signature(puzzle))
        except Exception:
            pass

    rng = random.Random(args.seed)
    new_daily: list[dict] = []
    recent_daily: list[set[str]] = []
    first_daily: list[set[str]] = []

    for i in range(365):
        difficulty = PATTERN[i % 7]
        while True:
            seed = rng.randrange(1, 2**31 - 1)
            circular_prefix_count = max(0, i - (365 - REPEAT_WINDOW) + 1)
            avoid = set().union(*recent_daily) if recent_daily else set()
            if circular_prefix_count:
                avoid.update(set().union(*first_daily[:circular_prefix_count]))
            try:
                puzzle = gp.create_puzzle(
                    difficulty,
                    seed,
                    answer_pools["daily"],
                    dictionary,
                    f"g3-d-{i + 1:03d}",
                    variant_index=i if difficulty == "hard" else None,
                    tier_of=tier_of,
                    vocab_key="daily",
                    fun_of=fun_of,
                    avoid_words=avoid,
                )
            except RuntimeError:
                continue
            sig = signature(puzzle)
            if sig in used_signatures:
                continue
            used_signatures.add(sig)
            puzzle["meta"]["rotationIndex"] = i + 1
            puzzle["meta"]["contentGeneration"] = GENERATION
            puzzle["meta"]["generationKey"] = GENERATION_KEY
            puzzle["meta"]["lexiconVersion"] = 2
            puzzle["meta"]["calendarWeekday"] = i % 7
            puzzle["meta"]["calendarCadence"] = "easy,easy,medium,medium,medium,hard,hard"
            new_daily.append(puzzle)
            words = {answer["word"].lower() for answer in puzzle["answers"]}
            recent_daily.append(words)
            recent_daily = recent_daily[-REPEAT_WINDOW:]
            if i < REPEAT_WINDOW:
                first_daily.append(words)
            break
        if (i + 1) % 25 == 0 or i == 364:
            print(f"daily Gen3: {i + 1}/365", flush=True)

    payload = dict(old)
    payload.update({
        "version": max(9, int(old.get("version") or 0)),
        "generatedAt": "2026-08-15",
        "daily": new_daily,
        "dailyRotationSize": 365,
        "dailyGeneration": GENERATION,
        "dailyGeneration3From": SWITCH_DATE.isoformat(),
        "dailyRotationBaseDate": SWITCH_DATE.isoformat(),
        "dailyCadence": {
            "anchor": "monday",
            "pattern": list(PATTERN),
            "labels": ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"],
            "activeFrom": SWITCH_DATE.isoformat(),
        },
        "legacyDaily": legacy_daily,
        # Full Gen2 stays in the payload as a short transition bridge so a fresh
        # client deployed before Monday can still render 15–16 Aug correctly.
        "previousDaily": archive,
        "dailyMigration": {
            "strategy": "calendar-week-monday-boundary",
            "leaderboard": "primary-generation-only",
            "history": "preserved",
            "cachedClients": "legacy-generation-accepted",
        },
    })

    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    SERVER_OUT.write_text(raw, encoding="utf-8")
    PUBLIC_OUT.write_text(raw, encoding="utf-8")

    counts = Counter(p["difficulty"] for p in new_daily)
    print("DONE", {
        "switchDate": SWITCH_DATE.isoformat(),
        "dailyGeneration": GENERATION,
        "difficultyCounts": dict(counts),
        "legacyBanks": [int(bank.get("generation") or 0) for bank in legacy_daily],
    })


if __name__ == "__main__":
    main()
