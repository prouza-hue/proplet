#!/usr/bin/env python3
"""Audit the committed Mozkomor bank for human, not merely geometric, difficulty.

The original Gen4 ambiguity metric stops at four letters and rewards long,
curvy paths.  Human playtests showed that a recognisable long word can become
easy once its opening is found.  This audit therefore follows each real target
through seven letters, measures how many visually plausible spellings survive,
and penalises long forced tails and easy anchor words.

The script never regenerates or mutates the committed 100-board bank.  It emits
an audit report and an isolated ten-board preview sample built only from those
existing boards.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import json
import math
from pathlib import Path
from statistics import mean, median
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
PUZZLES = ROOT / "data" / "puzzles.json"
TIERS = ROOT / "data" / "answer_tiers.json"
REPORT = ROOT / "data" / "audits" / "mozkomor_human_v40131.json"
PLAYTEST = ROOT / "data" / "mozkomor_refresh_playtest.json"
PUBLIC_PLAYTEST = ROOT / "public" / "mozkomor-refresh-playtest.json"
MAX_PREFIX_DEPTH = 7
PLAYTEST_COUNT = 10


def normalise(value: object) -> str:
    return str(value or "").strip().casefold()


def percentile(values: Iterable[float], fraction: float) -> float:
    ordered = sorted(float(value) for value in values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    weight = position - low
    return ordered[low] * (1.0 - weight) + ordered[high] * weight


def distribution(values: Iterable[float]) -> dict[str, float]:
    ordered = sorted(float(value) for value in values)
    return {
        "min": round(ordered[0], 3),
        "p25": round(percentile(ordered, 0.25), 3),
        "median": round(median(ordered), 3),
        "p75": round(percentile(ordered, 0.75), 3),
        "p90": round(percentile(ordered, 0.90), 3),
        "max": round(ordered[-1], 3),
    }


def neighbours(cell: int, rows: int, cols: int, mask: set[int]):
    row, col = divmod(cell, cols)
    for rr, cc in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
        nxt = rr * cols + cc
        if 0 <= rr < rows and 0 <= cc < cols and nxt in mask:
            yield nxt


def path_count_for_text(
    letters: list[str], rows: int, cols: int, mask: set[int], text: str, cap: int = 500
) -> int:
    """Count non-revisiting board paths spelling ``text``, with a safety cap."""
    if not text:
        return 0
    total = 0

    def walk(path: tuple[int, ...]) -> None:
        nonlocal total
        depth = len(path)
        if depth == len(text):
            total += 1
            return
        if total >= cap:
            return
        wanted = text[depth]
        for nxt in neighbours(path[-1], rows, cols, mask):
            if nxt not in path and letters[nxt] == wanted:
                walk(path + (nxt,))
                if total >= cap:
                    return

    for start in sorted(mask):
        if letters[start] == text[0]:
            walk((start,))
            if total >= cap:
                break
    return total


def word_metrics(puzzle: dict, answer: dict, tier: str, lexical: dict) -> dict:
    rows, cols = int(puzzle["rows"]), int(puzzle["cols"])
    letters = [normalise(letter) for letter in puzzle["letters"]]
    mask = {int(cell) for cell in puzzle.get("mask") or []}
    path = tuple(int(cell) for cell in answer.get("path") or [])
    word = normalise(answer.get("word"))
    assert path and len(path) == len(word), (puzzle.get("id"), word, path)

    prefix_alternatives: dict[str, int] = {}
    for depth in range(2, min(MAX_PREFIX_DEPTH, len(word) - 1) + 1):
        matches = path_count_for_text(letters, rows, cols, mask, word[:depth])
        prefix_alternatives[str(depth)] = max(0, matches - 1)

    start_cells = sum(1 for cell in mask if letters[cell] == word[0])
    extra_letter_choices = 0
    tail_steps = 0
    forced_tail_steps = 0
    for index in range(1, len(path)):
        used = set(path[:index])
        candidates = [
            nxt
            for nxt in neighbours(path[index - 1], rows, cols, mask)
            if nxt not in used and letters[nxt] == word[index]
        ]
        assert path[index] in candidates, (puzzle.get("id"), word, index)
        extra_letter_choices += max(0, len(candidates) - 1)
        if index >= 3:
            tail_steps += 1
            if len(candidates) == 1:
                forced_tail_steps += 1

    early_depths = [str(depth) for depth in range(2, min(4, len(word) - 1) + 1)]
    durable_depths = [str(depth) for depth in range(5, min(MAX_PREFIX_DEPTH, len(word) - 1) + 1)]
    early_pressure = mean(
        math.log2(1 + prefix_alternatives.get(depth, 0)) for depth in early_depths
    ) if early_depths else 0.0
    durable_pressure = mean(
        math.log2(1 + prefix_alternatives.get(depth, 0)) for depth in durable_depths
    ) if durable_depths else early_pressure
    spelling_choice_rate = extra_letter_choices / max(1, len(path) - 1)
    forced_tail_share = forced_tail_steps / max(1, tail_steps)
    turn_density = int(answer.get("turns") or 0) / max(1, len(word) - 2)
    tier_bonus = {"A": 0.0, "B": 0.05, "C": 0.12, "D": 0.18}.get(tier, 0.0)
    forced_long_penalty = (
        max(0.0, forced_tail_share - 0.72)
        * max(0, len(word) - 7)
        * 0.42
    )
    decision_pressure = (
        math.log2(max(1, start_cells)) * 0.90
        + early_pressure * 1.60
        + durable_pressure * 0.70
        + spelling_choice_rate * 1.25
        + turn_density * 0.85
        + tier_bonus
        - forced_long_penalty
    )
    return {
        "word": word,
        "length": len(word),
        "tier": tier,
        "fun": int(lexical.get("fun") or 3),
        "familiarity": int(lexical.get("familiarity") or 3),
        "partOfSpeech": str(lexical.get("part_of_speech") or "unknown"),
        "theme": str(lexical.get("theme") or "unknown"),
        "turns": int(answer.get("turns") or 0),
        "startCells": start_cells,
        "prefixAlternatives": prefix_alternatives,
        "earlyPrefixPressure": round(early_pressure, 3),
        "durablePrefixPressure": round(durable_pressure, 3),
        "spellingChoiceRate": round(spelling_choice_rate, 3),
        "forcedTailShare": round(forced_tail_share, 3),
        "turnDensity": round(turn_density, 3),
        "decisionPressure": round(decision_pressure, 4),
    }


def initial_board_metrics(
    puzzle: dict, tier_of: dict[str, str], lexical_metadata: dict[str, dict]
) -> dict:
    words = [
        word_metrics(
            puzzle,
            answer,
            tier_of.get(normalise(answer.get("word")), "?"),
            lexical_metadata.get(normalise(answer.get("word")), {}),
        )
        for answer in puzzle.get("answers") or []
    ]
    pressures = [float(word["decisionPressure"]) for word in words]
    lengths = [int(word["length"]) for word in words]
    starts = Counter(word["word"][0] for word in words)
    collisions = sum(count * (count - 1) // 2 for count in starts.values())
    return {
        "id": str(puzzle.get("id") or ""),
        "level": int((puzzle.get("meta") or {}).get("level") or 0),
        "activeCells": len(puzzle.get("mask") or []),
        "targetCount": len(words),
        "meanTurns": round(float((puzzle.get("meta") or {}).get("meanTurns") or 0), 3),
        "legacyAmbiguity": round(float((puzzle.get("meta") or {}).get("localAmbiguityScore") or 0), 3),
        "wordLength": {
            "min": min(lengths),
            "median": round(median(lengths), 3),
            "mean": round(mean(lengths), 3),
            "max": max(lengths),
        },
        "longWordShare": round(sum(length >= 9 for length in lengths) / len(lengths), 3),
        "mediumWordShare": round(sum(5 <= length <= 7 for length in lengths) / len(lengths), 3),
        "startLetterCollisions": collisions,
        "averageFun": round(mean(word["fun"] for word in words), 3),
        "lowFunCount": sum(int(word["fun"]) <= 2 for word in words),
        "explicitVerbOrAdjectiveCount": sum(
            word["partOfSpeech"] in {"verb", "adjective", "adverb"} for word in words
        ),
        "wordDecisionPressure": {
            "p25": round(percentile(pressures, 0.25), 4),
            "median": round(median(pressures), 4),
            "mean": round(mean(pressures), 4),
        },
        "words": words,
    }


def finish_board_metrics(board: dict, easy_anchor_limit: float) -> dict:
    words = board["words"]
    easy_anchors = [
        word for word in words
        if float(word["decisionPressure"]) <= easy_anchor_limit
        and int(word["startCells"]) <= 2
    ]
    forced_long = [
        word for word in words
        if int(word["length"]) >= 9 and float(word["forcedTailShare"]) >= 0.80
    ]
    start_collision_rate = float(board["startLetterCollisions"]) / max(1, board["targetCount"])
    score = (
        float(board["wordDecisionPressure"]["mean"]) * 0.52
        + float(board["wordDecisionPressure"]["p25"]) * 0.34
        + float(board["wordDecisionPressure"]["median"]) * 0.14
        + start_collision_rate * 0.12
        + math.log2(max(1.0, float(board["activeCells"]) / 64.0)) * 0.18
        - len(easy_anchors) / max(1, board["targetCount"]) * 0.55
        - len(forced_long) / max(1, board["targetCount"]) * 0.35
    )
    board["easyAnchorCount"] = len(easy_anchors)
    board["easyAnchors"] = [word["word"] for word in easy_anchors]
    board["forcedLongWordCount"] = len(forced_long)
    board["forcedLongWords"] = [word["word"] for word in forced_long]
    board["humanDecisionScore"] = round(score, 4)
    return board


def percentile_rank(values: list[float], value: float) -> float:
    below = sum(candidate < value for candidate in values)
    equal = sum(candidate == value for candidate in values)
    return 100.0 * (below + equal * 0.5) / max(1, len(values))


def select_playtest(
    bank: list[dict], rows: list[dict], hardcore_p75: float, count: int
) -> tuple[list[dict], list[dict]]:
    by_id = {str(puzzle["id"]): puzzle for puzzle in bank}
    base_eligible = [
        row for row in rows
        if float(row["humanDecisionScore"]) >= hardcore_p75
        and int(row["easyAnchorCount"]) <= 2
        and float(row["longWordShare"]) <= 0.50
        and int(row["forcedLongWordCount"]) <= 3
        and sum(word["tier"] == "D" for word in row["words"]) <= 1
    ]
    strict = [
        row for row in base_eligible
        if float(row["averageFun"]) >= 3.20
        and int(row["lowFunCount"]) == 0
        and int(row["explicitVerbOrAdjectiveCount"]) == 0
    ]
    relaxed = [
        row for row in base_eligible
        if row not in strict
        and float(row["averageFun"]) >= 3.20
        and int(row["lowFunCount"]) == 0
        and int(row["explicitVerbOrAdjectiveCount"]) <= 1
    ]
    ranking = lambda row: (
        float(row["humanDecisionScore"]),
        float(row["wordDecisionPressure"]["p25"]),
        float(row["mediumWordShare"]),
    )
    strict.sort(
        key=lambda row: (
            float(row["humanDecisionScore"]),
            float(row["wordDecisionPressure"]["p25"]),
            float(row["mediumWordShare"]),
        ),
        reverse=True,
    )
    relaxed.sort(key=ranking, reverse=True)

    selected_rows: list[dict] = []
    selected_words: set[str] = set()
    for group in (strict, relaxed):
        for row in group:
            words = {word["word"] for word in row["words"]}
            if words & selected_words:
                continue
            selected_rows.append(row)
            selected_words.update(words)
            if len(selected_rows) == count:
                break
        if len(selected_rows) == count:
            break
    if len(selected_rows) != count:
        raise RuntimeError(f"Only {len(selected_rows)} eligible refresh playtest boards")

    # A gentle ramp avoids making the first board a fatigue-biased outlier.
    selected_rows.sort(key=lambda row: float(row["humanDecisionScore"]))
    puzzles = []
    for index, row in enumerate(selected_rows, 1):
        puzzle = deepcopy(by_id[row["id"]])
        source_meta = puzzle.setdefault("meta", {})
        source_meta.update({
            "level": index,
            "calibrationOnly": True,
            "playtestProfile": "mozkomor-human-refresh-v40131",
            "refreshSourceId": row["id"],
            "refreshSourceLevel": row["level"],
            "humanDecisionScore": row["humanDecisionScore"],
            "humanPercentileVsMozkozrout": row["humanPercentileVsMozkozrout"],
        })
        puzzle["id"] = f"g4-mr-{index:03d}"
        puzzles.append(puzzle)
    return selected_rows, puzzles


def compact_board(row: dict) -> dict:
    return {key: value for key, value in row.items() if key != "words"} | {
        "words": [
            {
                "word": word["word"],
                "length": word["length"],
                "tier": word["tier"],
                "fun": word["fun"],
                "partOfSpeech": word["partOfSpeech"],
                "startCells": word["startCells"],
                "earlyPrefixPressure": word["earlyPrefixPressure"],
                "durablePrefixPressure": word["durablePrefixPressure"],
                "forcedTailShare": word["forcedTailShare"],
                "decisionPressure": word["decisionPressure"],
            }
            for word in row["words"]
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--puzzles", type=Path, default=PUZZLES)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--playtest", type=Path, default=PLAYTEST)
    parser.add_argument("--public-playtest", type=Path, default=PUBLIC_PLAYTEST)
    parser.add_argument("--playtest-count", type=int, default=PLAYTEST_COUNT)
    args = parser.parse_args()

    payload = json.loads(args.puzzles.read_text(encoding="utf-8"))
    free = payload.get("free") or {}
    hardcore = list(free.get("hardcore") or [])
    mozkomor = list(free.get("mozkomor") or [])
    if len(hardcore) != 200 or len(mozkomor) != 100:
        raise SystemExit(f"Expected 200 Mozkozrout + 100 Mozkomor, got {len(hardcore)} + {len(mozkomor)}")

    tier_payload = json.loads(TIERS.read_text(encoding="utf-8"))
    tiers = tier_payload.get("tiers") or {}
    tier_of = {normalise(word): tier for tier, words in tiers.items() for word in words}
    lexical_metadata = {
        normalise(word): value
        for word, value in (tier_payload.get("metadata") or {}).items()
    }
    hardcore_rows = [
        initial_board_metrics(puzzle, tier_of, lexical_metadata) for puzzle in hardcore
    ]
    mozkomor_rows = [
        initial_board_metrics(puzzle, tier_of, lexical_metadata) for puzzle in mozkomor
    ]
    hardcore_word_pressures = [
        float(word["decisionPressure"])
        for row in hardcore_rows for word in row["words"]
    ]
    easy_anchor_limit = percentile(hardcore_word_pressures, 0.25)
    hardcore_rows = [finish_board_metrics(row, easy_anchor_limit) for row in hardcore_rows]
    mozkomor_rows = [finish_board_metrics(row, easy_anchor_limit) for row in mozkomor_rows]
    hardcore_scores = [float(row["humanDecisionScore"]) for row in hardcore_rows]
    hardcore_p75 = percentile(hardcore_scores, 0.75)

    for row in mozkomor_rows:
        row["humanPercentileVsMozkozrout"] = round(
            percentile_rank(hardcore_scores, float(row["humanDecisionScore"])), 1
        )
        if (
            float(row["humanDecisionScore"]) >= hardcore_p75
            and int(row["easyAnchorCount"]) <= 2
            and float(row["longWordShare"]) <= 0.50
        ):
            row["recommendation"] = "release-candidate"
        elif float(row["humanDecisionScore"]) >= median(hardcore_scores):
            row["recommendation"] = "playtest-or-review"
        else:
            row["recommendation"] = "review"

    selected_rows, playtest_puzzles = select_playtest(
        mozkomor, mozkomor_rows, hardcore_p75, args.playtest_count
    )
    recommendation_counts = Counter(row["recommendation"] for row in mozkomor_rows)
    report = {
        "version": 1,
        "kind": "mozkomor-human-difficulty-refresh-v40131",
        "sourceBankCount": len(mozkomor),
        "regeneratedBoards": 0,
        "method": {
            "maxTargetPrefixDepth": MAX_PREFIX_DEPTH,
            "principle": "reward early and durable player choices; discount long forced tails",
            "easyAnchorThreshold": round(easy_anchor_limit, 4),
            "warning": "ranking signal for playtest curation, not a prediction of completion seconds",
        },
        "comparison": {
            "mozkozroutHumanDecisionScore": distribution(hardcore_scores),
            "mozkomorHumanDecisionScore": distribution(row["humanDecisionScore"] for row in mozkomor_rows),
            "mozkozroutLegacyAmbiguity": distribution(row["legacyAmbiguity"] for row in hardcore_rows),
            "mozkomorLegacyAmbiguity": distribution(row["legacyAmbiguity"] for row in mozkomor_rows),
            "mozkozroutLongWordShare": distribution(row["longWordShare"] for row in hardcore_rows),
            "mozkomorLongWordShare": distribution(row["longWordShare"] for row in mozkomor_rows),
        },
        "recommendations": dict(sorted(recommendation_counts.items())),
        "playtest": {
            "count": len(selected_rows),
            "selection": "existing release candidates only; noun-first vocabulary pass, at most one relaxed form; no repeated target; max one Tier D per board; easy-to-hard ramp",
            "sourceLevels": [row["level"] for row in selected_rows],
            "sourceIds": [row["id"] for row in selected_rows],
            "boards": [compact_board(row) for row in selected_rows],
        },
        "boards": [compact_board(row) for row in sorted(mozkomor_rows, key=lambda item: item["level"])],
    }
    playtest_payload = {
        "version": 1,
        "kind": "mozkomor-human-refresh-playtest",
        "purpose": "isolated preview calibration; not production content",
        "sourceBank": "g4-z-001..g4-z-100",
        "regeneratedBoards": 0,
        "puzzles": playtest_puzzles,
    }

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.playtest.parent.mkdir(parents=True, exist_ok=True)
    args.public_playtest.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.playtest.write_text(json.dumps(playtest_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.public_playtest.write_text(
        json.dumps(playtest_payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "comparison": report["comparison"],
        "recommendations": report["recommendations"],
        "playtestSourceLevels": report["playtest"]["sourceLevels"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
