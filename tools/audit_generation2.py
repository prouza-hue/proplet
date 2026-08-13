#!/usr/bin/env python3
"""Independent release audit for the complete Free Generation 2 bank."""
from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import sys

import generate_puzzles as generator


ROOT = Path(__file__).resolve().parents[1]
PUZZLES = ROOT / "data" / "puzzles.json"
LEXICON = ROOT / "data" / "lexicon_v2.json"
WORDS = ROOT / "data" / "words.txt"
REPORT_JSON = ROOT / "FREE_GENERATION2_AUDIT.json"
REPORT_MD = ROOT / "FREE_GENERATION2_AUDIT_CZ.md"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIXES = {"easy": "g2-e", "medium": "g2-m", "hard": "g2-h", "hardcore": "g2-x"}
ALLOWED_TIERS = {"easy": set("A"), "medium": set("AB"), "hard": set("BC"), "hardcore": set("CD")}
DICT_SIZES = {"easy": 6500, "medium": 8500, "hard": 9500, "hardcore": 10500}
MIN_AVG_FUN = {"easy": 2.7, "medium": 2.8, "hard": 2.9, "hardcore": 3.5}
MIN_HIGH_FUN = {"easy": 0, "medium": 1, "hard": 1, "hardcore": 4}
BLOCKED = set("""
alkohol dealer droga hazard kasino lesba pivo puška rum vodka whisky víno
černoška jump till honda hašiš opium fotr maturiťák číča ňadra prdelka homosexuál
""".split())


def main() -> None:
    data = json.loads(PUZZLES.read_text(encoding="utf-8"))
    lexicon = json.loads(LEXICON.read_text(encoding="utf-8"))
    meta = {entry["word"]: entry for entry in lexicon["entries"]}
    dictionary = WORDS.read_text(encoding="utf-8").splitlines()
    active_ids: set[str] = set()
    active_signatures: set[tuple] = set()
    active_words: set[str] = set()
    difficulties: dict[str, dict] = {}
    solved = 0

    assert int(data.get("version") or 0) >= 6 and data.get("freeGeneration") == 2
    assert data.get("freeMigration", {}).get("strategy") == "transferred-slots"
    assert 3000 <= len(meta) <= 5000

    for difficulty in DIFFICULTIES:
        bank = data["free"][difficulty]
        assert len(bank) == 100
        positions: dict[str, int] = {}
        minimum_repeat_gap = 10**9
        answer_count = 0
        fun_total = 0
        high_fun = 0
        tier_counts: Counter[str] = Counter()

        for index, puzzle in enumerate(bank, start=1):
            assert puzzle["id"] == f"{PREFIXES[difficulty]}-{index:03d}"
            assert puzzle["id"] not in active_ids
            active_ids.add(puzzle["id"])
            signature = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
            assert signature not in active_signatures
            active_signatures.add(signature)
            pmeta = puzzle["meta"]
            assert pmeta["level"] == index and pmeta["contentGeneration"] == 2
            assert pmeta["generationKey"] == "free-gen2" and pmeta["lexiconVersion"] == 2

            targets = [answer["word"].lower() for answer in puzzle["answers"]]
            assert len(targets) == len(set(targets))
            assert sum(map(len, targets)) == len(puzzle["mask"])
            assert set().union(*(set(answer["path"]) for answer in puzzle["answers"])) == set(puzzle["mask"])
            for word in targets:
                assert word in meta and meta[word]["tier"] in ALLOWED_TIERS[difficulty]
                assert word not in BLOCKED
                answer_count += 1
                active_words.add(word)
                tier_counts[meta[word]["tier"]] += 1
                fun_total += int(meta[word]["fun"])
                high_fun += int(meta[word]["fun"] >= 4)
                if word in positions:
                    minimum_repeat_gap = min(minimum_repeat_gap, index - positions[word])
                positions[word] = index

            board_fun = sum(meta[word]["fun"] for word in targets) / len(targets)
            assert board_fun + 1e-9 >= MIN_AVG_FUN[difficulty]
            assert sum(meta[word]["fun"] >= 4 for word in targets) >= MIN_HIGH_FUN[difficulty]

            solver_dictionary = list(dict.fromkeys(dictionary[: DICT_SIZES[difficulty]] + targets))
            solutions, candidate_count, nodes = generator.solve_count(
                [letter.lower() for letter in puzzle["letters"]],
                puzzle["rows"], puzzle["cols"], puzzle["mask"], puzzle["lengths"],
                solver_dictionary, limit=2,
            )
            assert solutions == 1, (puzzle["id"], solutions, candidate_count, nodes)
            solved += 1
            if solved % 50 == 0:
                print(f"Exact-cover recheck: {solved}/400", flush=True)

        assert minimum_repeat_gap >= 25
        difficulties[difficulty] = {
            "levels": len(bank),
            "answers": answer_count,
            "distinctAnswers": len(positions),
            "minimumRepeatGapLevels": minimum_repeat_gap,
            "averageFun": round(fun_total / answer_count, 2),
            "highFunAnswers": high_fun,
            "tierCounts": dict(tier_counts),
        }

    legacy_ids = {puzzle["id"] for bank in data.get("legacyFree", {}).values() for puzzle in bank}
    assert not active_ids & legacy_ids
    assert not active_words & BLOCKED
    assert len(data.get("daily", [])) == 365 and len(data.get("rescue", [])) == 30
    assert (ROOT / "public" / "puzzles.json").read_bytes() == PUZZLES.read_bytes()

    report = {
        "status": "PASS",
        "freeGeneration": 2,
        "exactCoverRechecked": solved,
        "activePuzzleIdsUnique": len(active_ids),
        "activeLegacyIdCollisions": 0,
        "lexiconEntries": len(meta),
        "lexiconTierCounts": lexicon["counts"],
        "tierDHighFunEntries": sum(entry["tier"] == "D" and entry["fun"] >= 4 for entry in meta.values()),
        "legacyCounts": {difficulty: len(data.get("legacyFree", {}).get(difficulty, [])) for difficulty in DIFFICULTIES},
        "dailyGeneration": data.get("dailyGeneration"),
        "dailyActive": len(data["daily"]),
        "rescuePreserved": len(data["rescue"]),
        "difficulties": difficulties,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    labels = {"easy": "Snadná", "medium": "Střední", "hard": "Těžká", "hardcore": "Mozkožrout"}
    lines = [
        "# Proplet Free Generation 2 — release audit",
        "",
        "**Výsledek: PASS**",
        "",
        f"- 400/400 aktivních Free desek znovu ověřeno exact-cover solverem: právě jedno úplné řešení.",
        f"- Lexicon v2: {len(meta)} schválených cílových slov; D s fun 4–5: {report['tierDHighFunEntries']}.",
        "- Aktivní Gen2 ID jsou unikátní a nekolidují s legacy bankou.",
        "- Anti-repeat: stejné slovo se v jedné obtížnosti nevrátí dříve než po 24 mezilehlých úrovních.",
        f"- Daily {len(data['daily'])} a Rescue 30 jsou přítomné; Daily má generaci {data.get('dailyGeneration', 1)}.",
        "",
        "| Obtížnost | Úrovně | Slov celkem | Různých slov | Min. rozestup | Průměr fun | Fun 4–5 | Tier mix |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for key in DIFFICULTIES:
        row = difficulties[key]
        mix = ", ".join(f"{tier} {count}" for tier, count in sorted(row["tierCounts"].items()))
        lines.append(f"| {labels[key]} | {row['levels']} | {row['answers']} | {row['distinctAnswers']} | {row['minimumRepeatGapLevels']} | {row['averageFun']:.2f} | {row['highFunAnswers']} | {mix} |")
    lines += [
        "",
        "## Migrace hráčů",
        "",
        "Gen1 desky jsou v `legacyFree`; aktivní Gen2 používá nové ID. Postup se převádí po dvojici obtížnost + číslo úrovně. XP, hodnosti, achievementy a historické výsledky zůstávají. Dobrovolné dohrání převedené Gen2 desky založí nový čas a nový leaderboard, ale XP za stejný slot už podruhé nepřidá.",
    ]
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"PASS: wrote {REPORT_JSON.name} and {REPORT_MD.name}")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
