#!/usr/bin/env python3
"""Cheap deterministic contract for the final Mozkomor 100-bank artifact."""
from __future__ import annotations
import json
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "data" / "mozkomor_final_v40132.json"
REPORT = ROOT / "data" / "audits" / "mozkomor_final_v40132.json"


def main() -> None:
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    puzzles = bank.get("puzzles") or []
    assert bank["status"] == "PLAYTEST_ONLY_NOT_FOR_PRODUCTION"
    assert bank["xpPerFirstCompletionPlanned"] == 150
    assert len(puzzles) == 100
    assert [p["id"] for p in puzzles] == [f"g4-z-{i:03d}" for i in range(1, 101)]
    assert len({p["id"] for p in puzzles}) == 100
    assert report["kind"] == "mozkomor-final-bank-human-v40132"
    assert sum(report["selectedSourceCounts"].values()) == 100

    boards = report["boards"]
    assert len(boards) == 100
    cooldown = int(report["selectionRules"]["targetCooldown"])
    for idx, board in enumerate(boards):
        assert board["tierDCount"] <= 1
        assert board["easyAnchorCount"] <= 2
        assert board["longWordShare"] <= 0.50
        assert board["forcedLongWordCount"] <= 3
        assert board["averageFun"] >= 3.20
        words = {w.casefold() for w in board["words"]}
        for prev in boards[max(0, idx - cooldown):idx]:
            assert not words & {w.casefold() for w in prev["words"]}

    band_medians = [float(b["scoreMedian"]) for b in report["bands"]]
    assert band_medians == sorted(band_medians), band_medians
    assert band_medians[0] >= 2.75
    assert band_medians[-1] >= 3.15

    # Refresh #1-3 were the only clearly soft opening feedback and must not be forced in.
    soft = {"g4-z-083", "g4-z-075", "g4-z-008"}
    anchors = set(report["approvedRefreshAnchorsSelected"])
    assert not anchors & soft
    assert len(anchors) >= 5, anchors

    print("Mozkomor v4.01.32 final-bank cheap contract: OK")


if __name__ == "__main__":
    main()
