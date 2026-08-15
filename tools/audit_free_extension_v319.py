#!/usr/bin/env python3
"""Independent release audit for Free levels 101–200 introduced in v3.19."""
from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

import generate_puzzles as generator


ROOT = Path(__file__).resolve().parents[1]
PUZZLES = ROOT / "data" / "puzzles.json"
PUBLIC_PUZZLES = ROOT / "public" / "puzzles.json"
LEXICON = ROOT / "data" / "lexicon_v2.json"
WORDS = ROOT / "data" / "words.txt"
REPORT_JSON = ROOT / "FREE_EXTENSION_V3_19_AUDIT.json"
REPORT_MD = ROOT / "FREE_EXTENSION_V3_19_AUDIT_CZ.md"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIXES = {"easy": "g2-e", "medium": "g2-m", "hard": "g2-h", "hardcore": "g2-x"}
LABELS = {"easy": "Snadná", "medium": "Střední", "hard": "Těžká", "hardcore": "Mozkožrout"}
ALLOWED_TIERS = {"easy": set("A"), "medium": set("AB"), "hard": set("BC"), "hardcore": set("CD")}
DICT_SIZES = {"easy": 6500, "medium": 8500, "hard": 9500, "hardcore": 10500}
BASELINE_HASHES = {
    "originalFree100": "97c52581b472395b234d8433b0021b0caddd9f3c0024d10e124d156750432a45",
    "daily": "0c0e66cdfec9de832a169ef8953a7b5e6eb081432c45b701d12e2e8425f45f1c",
    "legacyFree": "854fa0e30380f1c2345781c8a69307b20d775ab63cd00bd3d7bd79415991674a",
    "rescue": "9c6cf5e9e2207199024f705c712f61e1863b9381bc847c2c393d6441d760a2b4",
}
EXPLICITLY_TOO_OBSCURE = {
    "nocebo", "mastaba", "anafora", "epifora", "synekdocha", "pareidolie",
    "ekliptika", "ikosaedr", "dodekaedr", "kryogenika", "seizmika", "triréma",
    "zikkurat", "metonymie", "skalár", "sofismus", "tautologie",
}


def canonical_hash(value: object) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    data = json.loads(PUZZLES.read_text(encoding="utf-8"))
    lexicon = json.loads(LEXICON.read_text(encoding="utf-8"))
    metadata = {entry["word"]: entry for entry in lexicon["entries"]}
    dictionary = WORDS.read_text(encoding="utf-8").splitlines()
    policies = generator.VOCAB_POLICIES

    assert data.get("freeGeneration") == 2
    assert data.get("freeLevelsPerDifficulty") == 200
    assert data.get("freeExtendedFromVersion") == "3.19"
    assert PUBLIC_PUZZLES.read_bytes() == PUZZLES.read_bytes()
    assert canonical_hash({key: data["free"][key][:100] for key in DIFFICULTIES}) == BASELINE_HASHES["originalFree100"]
    assert canonical_hash(data["daily"]) == BASELINE_HASHES["daily"]
    assert canonical_hash(data["legacyFree"]) == BASELINE_HASHES["legacyFree"]
    assert canonical_hash(data["rescue"]) == BASELINE_HASHES["rescue"]

    baseline_puzzles = [
        puzzle for difficulty in DIFFICULTIES for puzzle in data["free"][difficulty][:100]
    ] + [
        puzzle for bank in data["legacyFree"].values() for puzzle in bank
    ] + list(data["daily"]) + list(data["rescue"])
    baseline_ids = {puzzle["id"] for puzzle in baseline_puzzles}
    baseline_signatures = {
        (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"])) for puzzle in baseline_puzzles
    }
    new_ids: set[str] = set()
    new_signatures: set[tuple] = set()
    for difficulty in DIFFICULTIES:
        for puzzle in data["free"][difficulty][100:]:
            assert puzzle["id"] not in baseline_ids and puzzle["id"] not in new_ids
            new_ids.add(puzzle["id"])
            signature = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
            assert signature not in baseline_signatures and signature not in new_signatures
            new_signatures.add(signature)

    solved = 0
    report_difficulties: dict[str, dict] = {}
    all_new_words: set[str] = set()
    new_d_words: set[str] = set()
    for difficulty in DIFFICULTIES:
        bank = data["free"][difficulty]
        assert len(bank) == 200
        positions: dict[str, int] = {}
        minimum_gap = 10**9
        new_word_count = 0
        new_unique: set[str] = set()
        tier_counts: Counter[str] = Counter()
        fun_total = 0
        high_fun = 0

        for index, puzzle in enumerate(bank, start=1):
            assert puzzle["id"] == f"{PREFIXES[difficulty]}-{index:03d}"
            targets = [answer["word"].lower() for answer in puzzle["answers"]]
            for word in targets:
                if word in positions:
                    minimum_gap = min(minimum_gap, index - positions[word])
                positions[word] = index
            if index <= 100:
                continue

            pmeta = puzzle["meta"]
            assert pmeta["level"] == index
            assert pmeta["contentGeneration"] == 2
            assert pmeta["generationKey"] == "free-gen2"
            assert pmeta["lexiconVersion"] == 2
            assert len(targets) == len(set(targets))
            assert sum(map(len, targets)) == len(puzzle["mask"])
            assert set().union(*(set(answer["path"]) for answer in puzzle["answers"])) == set(puzzle["mask"])

            for answer, word in zip(puzzle["answers"], targets):
                assert word in metadata
                assert metadata[word]["tier"] in ALLOWED_TIERS[difficulty]
                assert len(answer["path"]) == len(word)
                assert "".join(puzzle["letters"][cell] for cell in answer["path"]).casefold() == word
                new_word_count += 1
                new_unique.add(word)
                all_new_words.add(word)
                tier = metadata[word]["tier"]
                tier_counts[tier] += 1
                fun_total += int(metadata[word]["fun"])
                high_fun += int(metadata[word]["fun"] >= 4)
                if tier == "D":
                    new_d_words.add(word)

            policy_key = "hardcore_conservative" if difficulty == "hardcore" else difficulty
            policy = policies[policy_key]
            assert generator.tier_mix_ok(targets, {word: metadata[word]["tier"] for word in targets}, policy)
            scores = [int(metadata[word]["fun"]) for word in targets]
            assert sum(scores) / len(scores) + 1e-9 >= float(policy["min_avg_fun"])
            assert sum(score >= 4 for score in scores) >= int(policy.get("min_fun_words", 0))
            if difficulty == "hardcore":
                assert pmeta["vocabPolicy"] == "hardcore_conservative"
                assert all(word in generator.CONSERVATIVE_D_WORDS for word in targets if metadata[word]["tier"] == "D")
                assert not set(targets) & EXPLICITLY_TOO_OBSCURE

            intended_candidates = generator.enumerate_candidates(
                [letter.lower() for letter in puzzle["letters"]], puzzle["rows"], puzzle["cols"],
                puzzle["mask"], set(puzzle["lengths"]), targets,
            )
            paths_by_word: dict[str, list[tuple[int, ...]]] = {}
            for candidate in intended_candidates:
                paths_by_word.setdefault(candidate.word, []).append(candidate.path)
            assert all(len(paths_by_word.get(word, [])) == 1 for word in targets)

            solver_dictionary = list(dict.fromkeys(dictionary[:DICT_SIZES[difficulty]] + targets))
            solutions, _, _ = generator.solve_count(
                [letter.lower() for letter in puzzle["letters"]], puzzle["rows"], puzzle["cols"],
                puzzle["mask"], puzzle["lengths"], solver_dictionary, limit=2,
            )
            assert solutions == 1, (puzzle["id"], solutions)
            solved += 1
            if solved % 25 == 0:
                print(f"Exact-cover recheck: {solved}/400", flush=True)

        assert minimum_gap >= 25
        report_difficulties[difficulty] = {
            "newLevels": 100,
            "newAnswers": new_word_count,
            "newDistinctAnswers": len(new_unique),
            "minimumRepeatGapAcrossLevels1To200": minimum_gap,
            "averageFun": round(fun_total / new_word_count, 2),
            "highFunAnswers": high_fun,
            "tierCounts": dict(sorted(tier_counts.items())),
        }

    assert solved == 400
    assert not new_d_words & EXPLICITLY_TOO_OBSCURE
    report = {
        "status": "PASS",
        "release": "3.19",
        "newLevels": 400,
        "totalActiveFreeLevels": 800,
        "exactCoverRechecked": solved,
        "originalContentPreserved": True,
        "dailyLegacyRescuePreserved": True,
        "uniqueNewAnswersAcrossDifficulties": len(all_new_words),
        "conservativeTierDAllowlistSize": len(generator.CONSERVATIVE_D_WORDS),
        "tierDWordsActuallyUsed": sorted(new_d_words),
        "explicitlyRejectedTierDWords": sorted(EXPLICITLY_TOO_OBSCURE),
        "difficulties": report_difficulties,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Proplet v3.19 — audit rozšíření Free banky",
        "",
        "**Výsledek: PASS**",
        "",
        "- Přidáno 400 nových úrovní 101–200; aktivní Free banka má nyní 800 desek.",
        "- Všech 400 nových desek bylo nezávisle znovu ověřeno exact-cover solverem.",
        "- Původní úrovně 1–100, Daily, Rescue i celý legacy archiv zůstaly datově beze změny.",
        "- Anti-repeat platí i přes hranici 100/101: stejné slovo se vrací nejdříve po 24 mezilehlých úrovních.",
        "- Nový Mozkožrout používá ručně zúžený Tier D; NOCEBO, MASTABA a další úzké termíny jsou v této sadě výslovně vyloučené.",
        "",
        "| Obtížnost | Nové úrovně | Odpovědí | Různých slov | Min. rozestup | Průměr fun | Fun 4–5 | Tier mix |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for difficulty in DIFFICULTIES:
        row = report_difficulties[difficulty]
        mix = ", ".join(f"{tier} {count}" for tier, count in row["tierCounts"].items())
        lines.append(
            f"| {LABELS[difficulty]} | 100 | {row['newAnswers']} | {row['newDistinctAnswers']} | "
            f"{row['minimumRepeatGapAcrossLevels1To200']} | {row['averageFun']:.2f} | {row['highFunAnswers']} | {mix} |"
        )
    lines += [
        "",
        "## Tier D v nové stovce Mozkožroutů",
        "",
        f"Použito {len(new_d_words)} různých slov z konzervativního allowlistu o {len(generator.CONSERVATIVE_D_WORDS)} položkách:",
        "",
        ", ".join(word.upper() for word in sorted(new_d_words)),
    ]
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"PASS: wrote {REPORT_JSON.name} and {REPORT_MD.name}")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
