#!/usr/bin/env python3
"""Fail CI if the focused V3 fixture drifts outside its playtest contract."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.source.read_text(encoding="utf-8"))
    banks = payload.get("puzzles") or {}
    assert payload.get("version") == 3
    assert len(banks.get("medium") or []) == 6
    assert len(banks.get("hard") or []) == 4

    exclusions = {str(word).casefold() for word in payload.get("targetGenerationExclusions") or []}
    assert "lunochod" in exclusions
    assert "frisbee" in exclusions
    assert "rock" in exclusions

    all_words: list[str] = []
    medium_sizes: list[tuple[int, int]] = []
    for difficulty in ("medium", "hard"):
        for puzzle in banks[difficulty]:
            meta = puzzle.get("meta") or {}
            answers = puzzle.get("answers") or []
            words = [str(answer.get("word") or "").casefold() for answer in answers]
            all_words.extend(words)
            assert not (set(words) & exclusions), (puzzle.get("id"), set(words) & exclusions)
            assert meta.get("verifiedUnique") is True
            assert meta.get("wideVerifiedUnique") is True
            assert meta.get("endpointStartAdjacencyShare") == 0.0
            assert meta.get("generationKey") == "free-gen4-calibration-v3"
            isolated_limit = 0 if (puzzle.get("rows"), puzzle.get("cols")) == (7, 7) else 1
            assert meta.get("isolatedCutoutCells", 99) <= isolated_limit
            assert len(puzzle.get("mask") or []) == meta.get("cells")
            if difficulty == "medium":
                medium_sizes.append((puzzle.get("rows"), puzzle.get("cols")))
                assert meta.get("curlPathCount", 99) <= 2
                assert meta.get("maxCurlRun", 99) <= 2
                assert meta.get("meanTurns", 99) <= 2.40
            else:
                assert meta.get("curlPathCount", 99) <= 5
                assert meta.get("maxCurlRun", 99) <= 3
                assert meta.get("meanTurns", 99) <= 3.35

    assert medium_sizes.count((7, 7)) == 3, medium_sizes
    assert medium_sizes.count((8, 8)) == 3, medium_sizes
    assert len(all_words) == len(set(all_words)), "Target words must not repeat across the ten-board fixture"
    print(
        "V3 contract valid: 6 Medium (3x 7x7 + 3x 8x8), 4 Hard, "
        f"{len(all_words)} unique targets, exclusions and geometry guardrails clean."
    )


if __name__ == "__main__":
    main()
