#!/usr/bin/env python3
"""Production-grade audit for Proplet v3.30 rolling Free content reserve."""
from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
ROLLING_DATA = ROOT / "data" / "rolling_content_v1.json"
GEN = ROOT / "tools" / "generate_puzzles.py"
DIFFS = ("easy", "medium", "hard", "hardcore")
EXPECTED_ADDITIONS = {"easy": 17, "medium": 16, "hard": 16, "hardcore": 16}
FIRST = date(2026, 8, 24)
WEEKS = 13
WIDE_DICTIONARY_SIZE = 12000


def load_generator():
    spec = importlib.util.spec_from_file_location("proplet_generate_puzzles", GEN)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot import puzzle generator")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    reserve = json.loads(ROLLING_DATA.read_text(encoding="utf-8"))
    assert data["version"] == 9 == public["version"] == reserve["basePuzzleVersion"]
    assert {d: len(data["free"][d]) for d in DIFFS} == {d: 200 for d in DIFFS}
    assert public["free"] == data["free"]
    assert reserve["version"] == 1
    assert reserve["levelsPerDrop"] == 5
    assert reserve["firstRelease"] == FIRST.isoformat()
    assert reserve["wideUniquenessDictionarySize"] == WIDE_DICTIONARY_SIZE

    batches = reserve.get("batches") or []
    additions = reserve.get("puzzles") or {}
    assert len(batches) == WEEKS
    assert {d: len(additions.get(d, [])) for d in DIFFS} == EXPECTED_ADDITIONS
    rolling_puzzles = [p for d in DIFFS for p in additions[d]]
    assert len(rolling_puzzles) == 65

    rolling_ids = [p["id"] for p in rolling_puzzles]
    assert len(rolling_ids) == len(set(rolling_ids)), "Collision among rolling-content puzzle IDs"
    rolling_id_set = set(rolling_ids)
    preexisting_ids: set[str] = set()
    for name in ("daily", "rescue"):
        preexisting_ids.update(p["id"] for p in data.get(name, []))
    preexisting_ids.update(p["id"] for p in (data.get("previousDaily") or {}).get("puzzles", []))
    for bank in (data.get("legacyFree") or {}).values():
        preexisting_ids.update(p["id"] for p in bank)
    for d in DIFFS:
        preexisting_ids.update(p["id"] for p in data["free"][d])
    assert not (rolling_id_set & preexisting_ids), f"Rolling ID collision: {sorted(rolling_id_set & preexisting_ids)}"

    rolling_by_id = {p["id"]: p for p in rolling_puzzles}
    previous_release = None
    for i, batch in enumerate(batches):
        release = date.fromisoformat(batch["availableFrom"])
        assert release.weekday() == 0
        assert release == FIRST + timedelta(days=7 * i)
        if previous_release:
            assert (release - previous_release).days == 7
        previous_release = release
        levels = batch.get("levels") or []
        assert len(levels) == 5
        counts = Counter(x["difficulty"] for x in levels)
        assert all(counts[d] >= 1 for d in DIFFS)
        extra = DIFFS[i % 4]
        assert batch["extraDifficulty"] == extra and counts[extra] == 2
        for pos, row in enumerate(levels, start=1):
            p = rolling_by_id[row["id"]]
            meta = p["meta"]
            assert p["difficulty"] == row["difficulty"]
            assert meta["level"] == row["level"]
            assert meta["availableFrom"] == batch["availableFrom"]
            assert meta["releaseBatch"] == batch["id"]
            assert meta["releaseIndex"] == pos
            assert meta["verifiedUnique"] is True
            assert meta["wideVerifiedUnique"] is True
            assert meta["wideUniquenessDictionarySize"] == WIDE_DICTIONARY_SIZE
            assert int(meta.get("rollingSeedRetry") or 0) >= 1
            assert meta["contentGeneration"] == 2 and meta["lexiconVersion"] == 2

    # Intended answer geometry, spelling and exact full coverage.
    for p in rolling_puzzles:
        mask = set(p["mask"])
        assert len(mask) == p["meta"]["cells"]
        used = set()
        for answer in p["answers"]:
            path = answer["path"]
            assert len(path) == len(answer["word"])
            assert all(cell in mask for cell in path)
            assert not (used & set(path))
            used.update(path)
            assert "".join(p["letters"][cell] for cell in path) == answer["word"]
            for a, b in zip(path, path[1:]):
                ar, ac = divmod(a, p["cols"]); br, bc = divmod(b, p["cols"])
                assert abs(ar - br) + abs(ac - bc) == 1
        assert used == mask

    # Independent second solver pass against the same broad 12k corpus.
    freq = gp.load_frequency_words()
    tiers, _ = gp.load_answer_tiers()
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = dictionary[:WIDE_DICTIONARY_SIZE] + [w for w in all_answers if w not in dictionary[:WIDE_DICTIONARY_SIZE]]
    for n, p in enumerate(rolling_puzzles, start=1):
        targets = [a["word"].lower() for a in p["answers"]]
        solver_dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + targets))
        solutions, _, _ = gp.solve_count(
            [x.lower() for x in p["letters"]], p["rows"], p["cols"], p["mask"],
            [len(w) for w in targets], solver_dictionary, limit=2,
        )
        assert solutions == 1, f"{p['id']} has {solutions} exact-cover solutions"
        if n % 10 == 0:
            print(f"uniqueness {n}/{len(rolling_puzzles)}", flush=True)

    # 24-level anti-repeat across the old/new boundary and through the reserve.
    for difficulty in DIFFS:
        bank = list(data["free"][difficulty]) + list(additions[difficulty])
        for idx in range(200, len(bank)):
            words = {a["word"].lower() for a in bank[idx]["answers"]}
            recent = set().union(*[
                {a["word"].lower() for a in p["answers"]}
                for p in bank[max(0, idx - 24):idx]
            ])
            assert not (words & recent), f"24-level repeat in {difficulty} level {idx+1}: {words & recent}"

    print(json.dumps({
        "verification": "PASS",
        "basePuzzleVersion": 9,
        "rollingVersion": 1,
        "newPuzzles": len(rolling_puzzles),
        "weeks": len(batches),
        "firstRelease": batches[0]["availableFrom"],
        "reservedThrough": batches[-1]["availableFrom"],
        "baseCounts": {d: 200 for d in DIFFS},
        "additionCounts": EXPECTED_ADDITIONS,
        "finalCounts": {d: 200 + EXPECTED_ADDITIONS[d] for d in DIFFS},
        "exactCoverVerified": len(rolling_puzzles),
        "wideDictionarySize": WIDE_DICTIONARY_SIZE,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
