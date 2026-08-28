#!/usr/bin/env python3
"""Deterministic safety contract for the isolated Mozkomor refresh playtest."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def main() -> None:
    source = load("data/puzzles.json")
    public_source = load("public/puzzles.json")
    report = load("data/audits/mozkomor_human_v40131.json")
    playtest = load("data/mozkomor_refresh_playtest.json")
    public_playtest = load("public/mozkomor-refresh-playtest.json")

    source_bank = list((source.get("free") or {}).get("mozkomor") or [])
    public_bank = list((public_source.get("free") or {}).get("mozkomor") or [])
    assert len(source_bank) == len(public_bank) == 100
    assert source_bank == public_bank, "Production and public Mozkomor banks diverged"
    assert [puzzle["id"] for puzzle in source_bank] == [
        f"g4-z-{level:03d}" for level in range(1, 101)
    ]

    assert report["kind"] == "mozkomor-human-difficulty-refresh-v40131"
    assert report["sourceBankCount"] == 100
    assert report["regeneratedBoards"] == 0
    assert sum(report["recommendations"].values()) == 100
    assert report["playtest"]["count"] == 10

    assert playtest == public_playtest
    assert playtest["kind"] == "mozkomor-human-refresh-playtest"
    assert playtest["purpose"] == "isolated preview calibration; not production content"
    assert playtest["regeneratedBoards"] == 0
    puzzles = list(playtest.get("puzzles") or [])
    assert [puzzle["id"] for puzzle in puzzles] == [
        f"g4-mr-{level:03d}" for level in range(1, 11)
    ]

    source_by_id = {puzzle["id"]: puzzle for puzzle in source_bank}
    report_by_id = {board["id"]: board for board in report["playtest"]["boards"]}
    selected_words: set[str] = set()
    previous_score = 0.0
    hardcore_p75 = float(report["comparison"]["mozkozroutHumanDecisionScore"]["p75"])

    for level, puzzle in enumerate(puzzles, 1):
        meta = puzzle.get("meta") or {}
        source_id = str(meta.get("refreshSourceId") or "")
        source_puzzle = source_by_id[source_id]
        board = report_by_id[source_id]

        assert puzzle["difficulty"] == "mozkomor"
        assert meta.get("calibrationOnly") is True
        assert meta.get("playtestProfile") == "mozkomor-human-refresh-v40131"
        assert int(meta.get("level") or 0) == level
        assert int(meta.get("refreshSourceLevel") or 0) == int(source_puzzle["meta"]["level"])
        assert float(meta.get("humanDecisionScore") or 0) == float(board["humanDecisionScore"])

        expected = deepcopy(source_puzzle)
        expected["id"] = f"g4-mr-{level:03d}"
        expected.setdefault("meta", {}).update({
            "level": level,
            "calibrationOnly": True,
            "playtestProfile": "mozkomor-human-refresh-v40131",
            "refreshSourceId": source_id,
            "refreshSourceLevel": int(source_puzzle["meta"]["level"]),
            "humanDecisionScore": board["humanDecisionScore"],
            "humanPercentileVsMozkozrout": board["humanPercentileVsMozkozrout"],
        })
        assert puzzle == expected, f"{puzzle['id']} is not an unchanged source-board copy"

        score = float(board["humanDecisionScore"])
        assert score >= hardcore_p75
        assert score >= previous_score, "Playtest is not ordered easy-to-hard"
        previous_score = score
        assert int(board["easyAnchorCount"]) <= 2
        assert float(board["longWordShare"]) <= 0.50
        assert int(board["lowFunCount"]) == 0
        assert sum(word["tier"] == "D" for word in board["words"]) <= 1

        words = {answer["word"].casefold() for answer in puzzle.get("answers") or []}
        assert not words & selected_words, f"Repeated target in {puzzle['id']}"
        selected_words.update(words)

    print("Mozkomor v4.01.31 human refresh data contract: OK")


if __name__ == "__main__":
    main()
