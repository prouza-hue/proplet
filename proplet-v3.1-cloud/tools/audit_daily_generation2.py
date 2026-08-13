#!/usr/bin/env python3
"""Release audit for the complete Daily Generation 2 rotation."""

from __future__ import annotations

from collections import Counter, defaultdict
import json
from pathlib import Path
import sys

import generate_puzzles as generator


ROOT = Path(__file__).resolve().parents[1]
PUZZLES = ROOT / "data" / "puzzles.json"
PUBLIC_PUZZLES = ROOT / "public" / "puzzles.json"
LEXICON = ROOT / "data" / "lexicon_v2.json"
WORDS = ROOT / "data" / "words.txt"
ARCHIVE = ROOT / "data" / "legacy_daily_gen1.json"
REPORT_JSON = ROOT / "DAILY_GENERATION2_AUDIT.json"
REPORT_MD = ROOT / "DAILY_GENERATION2_AUDIT_CZ.md"
DICT_SIZES = {"easy": 6500, "medium": 8500, "hard": 9500}
EXPECTED_DIFFICULTIES = {"easy": 61, "medium": 183, "hard": 121}


def main() -> None:
    data = json.loads(PUZZLES.read_text(encoding="utf-8"))
    lexicon = json.loads(LEXICON.read_text(encoding="utf-8"))
    metadata = {entry["word"]: entry for entry in lexicon["entries"]}
    dictionary = WORDS.read_text(encoding="utf-8").splitlines()
    bank = data["daily"]

    assert data.get("version") == 7
    assert data.get("dailyGeneration") == 2
    assert data.get("dailyGeneration2From") == "2026-08-13"
    assert data.get("dailyMigration", {}).get("leaderboard") == "active-generation-only"
    assert len(bank) == 365
    assert Counter(p["difficulty"] for p in bank) == Counter(EXPECTED_DIFFICULTIES)
    assert PUBLIC_PUZZLES.read_bytes() == PUZZLES.read_bytes()

    active_ids: set[str] = set()
    active_signatures: set[tuple] = set()
    positions: dict[str, list[int]] = defaultdict(list)
    tier_counts: Counter[str] = Counter()
    difficulty_answers: Counter[str] = Counter()
    fun_total = 0
    high_fun = 0
    solved = 0

    for index, puzzle in enumerate(bank, start=1):
        assert puzzle["id"] == f"g2-d-{index:03d}"
        assert puzzle["id"] not in active_ids
        active_ids.add(puzzle["id"])
        signature = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
        assert signature not in active_signatures
        active_signatures.add(signature)

        pmeta = puzzle["meta"]
        assert pmeta.get("rotationIndex") == index
        assert pmeta.get("contentGeneration") == 2
        assert pmeta.get("generationKey") == "daily-gen2"
        assert pmeta.get("lexiconVersion") == 2
        assert pmeta.get("vocabPolicy") == "daily"

        targets = [answer["word"].lower() for answer in puzzle["answers"]]
        assert len(targets) == len(set(targets))
        assert sum(map(len, targets)) == len(puzzle["mask"])
        assert set().union(*(set(answer["path"]) for answer in puzzle["answers"])) == set(puzzle["mask"])
        assert all(word in metadata for word in targets)

        counts = Counter(metadata[word]["tier"] for word in targets)
        assert set(counts) <= {"A", "B", "C"}
        assert counts["A"] + 1e-9 >= len(targets) * 0.15
        assert counts["B"] + 1e-9 >= len(targets) * 0.35
        assert counts["C"] - 1e-9 <= len(targets) * 0.25
        board_fun = sum(int(metadata[word]["fun"]) for word in targets) / len(targets)
        assert board_fun + 1e-9 >= 3.0
        assert sum(int(metadata[word]["fun"]) >= 4 for word in targets) >= 1

        for word in targets:
            positions[word].append(index - 1)
            tier_counts[metadata[word]["tier"]] += 1
            fun_total += int(metadata[word]["fun"])
            high_fun += int(metadata[word]["fun"] >= 4)
            difficulty_answers[puzzle["difficulty"]] += 1

        solver_dictionary = list(dict.fromkeys(dictionary[: DICT_SIZES[puzzle["difficulty"]]] + targets))
        solutions, candidate_count, nodes = generator.solve_count(
            [letter.lower() for letter in puzzle["letters"]],
            puzzle["rows"], puzzle["cols"], puzzle["mask"], puzzle["lengths"],
            solver_dictionary, limit=2,
        )
        assert solutions == 1, (puzzle["id"], solutions, candidate_count, nodes)
        solved += 1
        if solved % 50 == 0:
            print(f"Exact-cover recheck: {solved}/365", flush=True)

    minimum_gap = len(bank)
    for word, raw_positions in positions.items():
        if len(raw_positions) < 2:
            continue
        ordered = sorted(raw_positions)
        gaps = [b - a for a, b in zip(ordered, ordered[1:])]
        gaps.append(len(bank) - ordered[-1] + ordered[0])
        minimum_gap = min(minimum_gap, min(gaps))
        assert min(gaps) >= 25, (word, min(gaps), ordered)

    archived = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    assert len(archived.get("puzzles", [])) == 365
    compact_banks = data.get("legacyDaily", [])
    assert len(compact_banks) >= 1 and len(compact_banks[-1]["puzzles"]) == 365
    assert [p["id"] for p in archived["puzzles"]] == [p["id"] for p in compact_banks[-1]["puzzles"]]
    legacy_ids = {p["id"] for legacy_bank in compact_banks for p in legacy_bank["puzzles"]}
    other_active_ids = {
        p["id"] for free_bank in data.get("free", {}).values() for p in free_bank
    } | {p["id"] for p in data.get("rescue", [])}
    assert not active_ids & legacy_ids
    assert not active_ids & other_active_ids

    total_answers = sum(tier_counts.values())
    report = {
        "status": "PASS",
        "dailyGeneration": 2,
        "exactCoverRechecked": solved,
        "activeDailyPuzzles": len(bank),
        "legacyDailyPuzzlesArchived": len(archived["puzzles"]),
        "difficultyCounts": dict(Counter(p["difficulty"] for p in bank)),
        "answers": total_answers,
        "distinctAnswers": len(positions),
        "minimumCircularRepeatGapDays": minimum_gap,
        "averageFun": round(fun_total / total_answers, 2),
        "highFunAnswers": high_fun,
        "tierCounts": dict(tier_counts),
        "answersByGeometry": dict(difficulty_answers),
        "activeLegacyIdCollisions": 0,
        "activeOtherBankIdCollisions": 0,
        "publicServerPuzzleCopiesIdentical": True,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Proplet Daily Generation 2 — release audit",
        "",
        "**Výsledek: PASS**",
        "",
        f"- {solved}/365 aktivních Daily desek znovu ověřeno exact-cover solverem: právě jedno úplné řešení.",
        f"- Všechny odpovědi pocházejí z Lexiconu v2 a splňují rodinný mix A/B/C.",
        f"- Každá Daily má průměr `fun` nejméně 3,0 a alespoň jedno slovo s `fun` 4–5.",
        f"- Kruhový anti-repeat má minimální rozestup {minimum_gap} dní, včetně přechodu konec → začátek rotace.",
        f"- Původních {len(archived['puzzles'])} Daily je plně archivováno; staré/offline ID zůstává validní pro správné datum.",
        "- Aktivní leaderboard přijímá jen primární generaci daného data, takže nemíchá výsledky dvou různých desek.",
        "",
        "| Metrika | Výsledek |",
        "|---|---:|",
        f"| Daily úloh | {len(bank)} |",
        f"| Snadná geometrie | {report['difficultyCounts']['easy']} |",
        f"| Střední geometrie | {report['difficultyCounts']['medium']} |",
        f"| Těžká geometrie | {report['difficultyCounts']['hard']} |",
        f"| Odpovědí celkem | {total_answers} |",
        f"| Různých slov | {len(positions)} |",
        f"| Průměr fun | {report['averageFun']:.2f} |",
        f"| Fun 4–5 | {high_fun} |",
        f"| Tier A / B / C | {tier_counts['A']} / {tier_counts['B']} / {tier_counts['C']} |",
    ]
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"PASS: wrote {REPORT_JSON.name} and {REPORT_MD.name}")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
