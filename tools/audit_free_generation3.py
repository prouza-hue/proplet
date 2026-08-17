#!/usr/bin/env python3
"""Independent release audit for Free Generation 3 and its progression ladder."""
from __future__ import annotations

from collections import Counter
import importlib.util
import json
import math
from pathlib import Path
import statistics
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
ROLLING = ROOT / "data" / "rolling_content_v1.json"
LEXICON = ROOT / "data" / "lexicon_v2.json"
WORDS = ROOT / "data" / "words.txt"
GEN = ROOT / "tools" / "generate_puzzles.py"
REPORT_JSON = ROOT / "FREE_GENERATION3_AUDIT.json"
REPORT_MD = ROOT / "FREE_GENERATION3_AUDIT_CZ.md"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}
ALLOWED = {"easy": set("A"), "medium": set("AB"), "hard": set("BC"), "hardcore": set("CD")}
REJECTED = {"nocebo", "trebuchet", "sofismus", "černodíra", "perigeum", "aerogel"}


def load_generator():
    spec = importlib.util.spec_from_file_location("audit_gp", GEN)
    mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)
    return mod


def mean(values):
    return round(statistics.mean(values), 3) if values else None


def band_row(puzzles):
    turns = [a.get("turns", 0) for p in puzzles for a in p.get("answers", [])]
    scores = [int((p.get("meta") or {}).get("difficultyScore") or 0) for p in puzzles]
    cells = [len(p.get("mask") or []) for p in puzzles]
    words = [len(p.get("answers") or []) for p in puzzles]
    tiers = Counter()
    for p in puzzles:
        tiers.update((p.get("meta") or {}).get("vocabTiers") or {})
    total_tiers = sum(tiers.values()) or 1
    return {
        "levels": len(puzzles), "meanCells": mean(cells), "meanWords": mean(words),
        "meanDifficultyScore": mean(scores), "medianDifficultyScore": statistics.median(scores) if scores else None,
        "meanTurnsPerWord": mean(turns), "zeroTurnShare": round(sum(t == 0 for t in turns) / len(turns), 3) if turns else None,
        "lowTurnShare": round(sum(t <= 1 for t in turns) / len(turns), 3) if turns else None,
        "tierShares": {k: round(v / total_tiers, 3) for k, v in sorted(tiers.items())},
    }


def main():
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    rolling = json.loads(ROLLING.read_text(encoding="utf-8"))
    lex = json.loads(LEXICON.read_text(encoding="utf-8"))
    meta = {e["word"]: e for e in lex["entries"]}
    dictionary = WORDS.read_text(encoding="utf-8").splitlines()
    assert data.get("free") == public.get("free")
    assert public.get("publicLegacyMode") == "compact-index"
    assert all(not bank for bank in (public.get("legacyFree") or {}).values())
    assert int(data.get("version") or 0) == 10
    app_js = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
    expected_marker = f"const EXPECTED_PUZZLE_DB_VERSION={int(data.get('version') or 0)};"
    assert expected_marker in app_js, (expected_marker, "client/server puzzle schema mismatch")
    assert int(data.get("freeGeneration") or 0) == 3
    assert data.get("freeMigration", {}).get("strategy") == "stable-level-slots"
    assert data.get("freeMigration", {}).get("playerFacingGenerationLabels") is False
    assert not (REJECTED & set(meta))
    assert int(rolling.get("basePuzzleVersion") or 0) == 10
    assert rolling.get("generatedAtVersion") == "3.31.6"

    active_ids = set(); signatures = set(); solved = 0; answer_positions = {}
    summaries = {}
    for diff in DIFFICULTIES:
        bank = data["free"][diff]
        assert len(bank) == 200
        positions = {}
        for level, puzzle in enumerate(bank, start=1):
            assert puzzle["id"] == f"{PREFIX[diff]}-{level:03d}"
            assert puzzle["id"] not in active_ids; active_ids.add(puzzle["id"])
            pm = puzzle["meta"]
            assert int(pm.get("level")) == level and int(pm.get("contentGeneration")) == 3
            assert pm.get("generationKey") == "free-gen3"
            sig = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
            assert sig not in signatures; signatures.add(sig)
            targets = [a["word"].lower() for a in puzzle["answers"]]
            assert not (REJECTED & set(targets))
            assert len(targets) == len(set(targets))
            assert sum(map(len, targets)) == len(puzzle["mask"])
            for word in targets:
                assert word in meta and meta[word]["tier"] in ALLOWED[diff]
                if word in positions:
                    assert level - positions[word] >= 17, (diff, word, positions[word], level)
                positions[word] = level
            solver_dictionary = list(dict.fromkeys(dictionary[:12000] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
            solutions, candidates, nodes = gp.solve_count(
                [x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"],
                puzzle["lengths"], solver_dictionary, limit=2,
            )
            assert solutions == 1, (puzzle["id"], solutions, candidates, nodes)
            solved += 1
            if solved % 100 == 0:
                print(f"Broad exact-cover recheck {solved}/800", flush=True)
        answer_positions[diff] = positions
        summaries[diff] = {
            "1-50": band_row(bank[:50]), "51-100": band_row(bank[50:100]),
            "101-150": band_row(bank[100:150]), "151-200": band_row(bank[150:200]),
        }

    legacy_ids = {p["id"] for bank in (data.get("legacyFree") or {}).values() for p in bank}
    assert not active_ids & legacy_ids
    public_legacy_index = public.get("legacyFreeIndex") or {}
    assert legacy_ids == set(public_legacy_index), (len(legacy_ids), len(public_legacy_index))
    assert DATA.stat().st_size > PUBLIC.stat().st_size

    # Rolling reserve must continue Gen3 numbering and the 16-level anti-repeat window.
    rolling_checked = 0
    for diff in DIFFICULTIES:
        expected = 201
        recent_positions = dict(answer_positions[diff])
        for puzzle in rolling.get("puzzles", {}).get(diff, []):
            level = int((puzzle.get("meta") or {}).get("level") or 0)
            assert level == expected, (diff, expected, level)
            assert puzzle["id"] == f"{PREFIX[diff]}-{level:03d}"
            assert int(puzzle["meta"].get("contentGeneration")) == 3
            targets = [a["word"].lower() for a in puzzle["answers"]]
            assert not (REJECTED & set(targets))
            for word in targets:
                if word in recent_positions:
                    assert level - recent_positions[word] >= 17, (diff, word, recent_positions[word], level)
                recent_positions[word] = level
            solver_dictionary = list(dict.fromkeys(dictionary[:12000] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
            solutions, _, _ = gp.solve_count([x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"], puzzle["lengths"], solver_dictionary, limit=2)
            assert solutions == 1, puzzle["id"]
            expected += 1; rolling_checked += 1

    m = summaries["medium"]; h = summaries["hard"]
    # Ladder guardrails: Medium grows in search area and word count; Hard changes the challenge with winding geometry.
    assert m["51-100"]["meanCells"] > m["1-50"]["meanCells"]
    assert m["151-200"]["meanCells"] > m["1-50"]["meanCells"]
    assert m["151-200"]["meanWords"] > m["1-50"]["meanWords"]
    assert h["1-50"]["meanTurnsPerWord"] >= m["151-200"]["meanTurnsPerWord"]
    assert h["1-50"]["meanCells"] <= m["151-200"]["meanCells"] + 8
    report = {
        "status": "PASS", "freeGeneration": 3, "broadExactCoverRechecked": solved,
        "rollingRechecked": rolling_checked, "rejectedTargetWordsAbsent": sorted(REJECTED),
        "serverPuzzleBytes": DATA.stat().st_size, "publicPuzzleBytes": PUBLIC.stat().st_size,
        "publicLegacyIndexEntries": len(public.get("legacyFreeIndex") or {}),
        "bands": summaries,
        "bridge": {"lateMedium": m["151-200"], "earlyHard": h["1-50"]},
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    labels = {"easy":"Snadná","medium":"Střední","hard":"Těžká","hardcore":"Mozkožrout"}
    lines = ["# Proplet Free Generation 3 — progression audit", "", "**Výsledek: PASS**", "", f"- {solved}/800 aktivních Free desek ověřeno širokým exact-cover solverem.", f"- {rolling_checked} budoucích rolling desek ověřeno včetně anti-repeat přes hranici levelu 200.", "- Hráčský model je pouze obtížnost + číslo úrovně; generace jsou interní implementační detail.", "- Reportovaná nevhodná cílová slova byla odstraněna z target lexikonu.", "", "| Obtížnost | Pásmo | políčka | slova | score | zatáčky/slovo | ≤1 zatáčka |", "|---|---|---:|---:|---:|---:|---:|"]
    for diff in DIFFICULTIES:
        for band, row in summaries[diff].items():
            lines.append(f"| {labels[diff]} | {band} | {row['meanCells']:.1f} | {row['meanWords']:.1f} | {row['meanDifficultyScore']:.1f} | {row['meanTurnsPerWord']:.2f} | {row['lowTurnShare']*100:.0f} % |")
    lines += ["", "## Most Střední → Těžká", "", f"Pozdní Střední: {m['151-200']['meanCells']:.1f} políčka, {m['151-200']['meanTurnsPerWord']:.2f} zatáčky/slovo.", f"První Těžká: {h['1-50']['meanCells']:.1f} políčka, {h['1-50']['meanTurnsPerWord']:.2f} zatáčky/slovo."]
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report["bridge"], ensure_ascii=False, indent=2))
    print("PASS: Free Generation 3 progression audit")


if __name__ == "__main__":
    main()
