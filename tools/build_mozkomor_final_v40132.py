#!/usr/bin/env python3
"""Build the final 100-board Mozkomor bank from audited existing + fresh candidates.

The selector follows the successful v4.01.31 refresh lesson:
difficulty is human decision pressure, not long words or raw curvature.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from statistics import mean, median
from typing import Iterable

import audit_mozkomor_human_v40131 as human

TARGET_COUNT = 100
TARGET_COOLDOWN = 12
MIN_SCORE = 2.60\nAPPROVED_ANCHOR_MIN_SCORE = 2.75
BANDS = (
    (1, 20, 2.72, 3.00),
    (21, 40, 2.78, 3.10),
    (41, 60, 2.84, 3.20),
    (61, 80, 2.92, 3.35),
    (81, 100, 3.00, 9.99),
)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def board_signature(puzzle: dict) -> str:
    payload = {
        "rows": int(puzzle["rows"]),
        "cols": int(puzzle["cols"]),
        "mask": [int(x) for x in puzzle.get("mask") or []],
        "letters": [str(x) for x in puzzle.get("letters") or []],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def all_active_puzzles(payload: dict) -> Iterable[dict]:
    for section in ("free", "daily", "rescue", "starter"):
        value = payload.get(section)
        if isinstance(value, dict):
            for items in value.values():
                if isinstance(items, list):
                    yield from (x for x in items if isinstance(x, dict))
        elif isinstance(value, list):
            yield from (x for x in value if isinstance(x, dict))


def tier_d_count(row: dict) -> int:
    return sum(1 for word in row["words"] if word["tier"] == "D")


def eligible(row: dict) -> bool:
    return (
        float(row["humanDecisionScore"]) >= MIN_SCORE
        and int(row["easyAnchorCount"]) <= 2
        and float(row["longWordShare"]) <= 0.50
        and int(row["forcedLongWordCount"]) <= 3
        and float(row["averageFun"]) >= 3.20
        and int(row["lowFunCount"]) == 0
        and int(row["explicitVerbOrAdjectiveCount"]) <= 1
        and tier_d_count(row) <= 1
    )


def band_for(level: int) -> tuple[float, float]:
    for start, end, low, high in BANDS:
        if start <= level <= end:
            return low, high
    raise AssertionError(level)


def desired_score(level: int) -> float:
    return 2.79 + (3.34 - 2.79) * ((level - 1) / 99.0)


def annotate_rows(
    puzzles: list[dict],
    source_kind: str,
    tier_of: dict[str, str],
    lexical_metadata: dict[str, dict],
    easy_anchor_limit: float,
    hardcore_scores: list[float],
    approved_source_ids: set[str],
) -> list[dict]:
    rows = []
    for puzzle in puzzles:
        row = human.initial_board_metrics(puzzle, tier_of, lexical_metadata)
        row = human.finish_board_metrics(row, easy_anchor_limit)
        row["humanPercentileVsMozkozrout"] = round(
            human.percentile_rank(hardcore_scores, float(row["humanDecisionScore"])), 1
        )
        row["_puzzle"] = puzzle
        row["_sourceKind"] = source_kind
        row["_sourceId"] = str(puzzle.get("id") or "")
        row["_approvedRefresh"] = str(puzzle.get("id") or "") in approved_source_ids
        row["_signature"] = board_signature(puzzle)
        rows.append(row)
    return rows


def candidate_cost(row: dict, level: int, word_usage: Counter[str]) -> float:
    score = float(row["humanDecisionScore"])
    target = desired_score(level)
    words = [norm(word["word"]) for word in row["words"]]
    reuse = sum(word_usage[w] for w in words)
    source_bonus = 0.0
    if row["_approvedRefresh"]:
        source_bonus -= 1.25
    elif row["_sourceKind"] == "refresh-original":
        source_bonus -= 0.12
    # Prefer the successful refresh's balanced word-length shape.
    medium_bonus = -0.18 * float(row["mediumWordShare"])
    long_penalty = 0.25 * float(row["longWordShare"])
    return abs(score - target) * 5.0 + reuse * 0.08 + medium_bonus + long_penalty + source_bonus


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current", type=Path, required=True)
    parser.add_argument("--refresh", type=Path, required=True)
    parser.add_argument("--approved", type=Path, required=True)
    parser.add_argument("--generated", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()

    current = load(args.current)
    refresh = load(args.refresh)
    approved = load(args.approved)
    generated = load(args.generated)

    hardcore = list((current.get("free") or {}).get("hardcore") or [])
    if len(hardcore) != 200:
        raise SystemExit(f"Expected 200 current Mozkožrout boards, got {len(hardcore)}")
    old_mozkomor = list((refresh.get("free") or {}).get("mozkomor") or [])
    if len(old_mozkomor) != 100:
        raise SystemExit(f"Expected 100 refresh-source Mozkomor boards, got {len(old_mozkomor)}")
    fresh = list(generated.get("puzzles") or [])
    if len(fresh) < 100:
        raise SystemExit(f"Fresh candidate pool unexpectedly small: {len(fresh)}")

    approved_source_ids = {
        str((puzzle.get("meta") or {}).get("refreshSourceId") or "")
        for puzzle in approved.get("puzzles") or []
        if float((puzzle.get("meta") or {}).get("humanDecisionScore") or 0) >= APPROVED_ANCHOR_MIN_SCORE
    }

    tiers_payload = load(Path(__file__).resolve().parents[1] / "data" / "answer_tiers.json")
    tiers = tiers_payload.get("tiers") or {}
    tier_of = {norm(word): tier for tier, words in tiers.items() for word in words}
    lexical_metadata = {
        norm(word): value for word, value in (tiers_payload.get("metadata") or {}).items()
    }

    hardcore_rows = [
        human.initial_board_metrics(puzzle, tier_of, lexical_metadata) for puzzle in hardcore
    ]
    hardcore_word_pressures = [
        float(word["decisionPressure"]) for row in hardcore_rows for word in row["words"]
    ]
    easy_anchor_limit = human.percentile(hardcore_word_pressures, 0.25)
    hardcore_rows = [human.finish_board_metrics(row, easy_anchor_limit) for row in hardcore_rows]
    hardcore_scores = [float(row["humanDecisionScore"]) for row in hardcore_rows]

    rows = (
        annotate_rows(
            old_mozkomor, "refresh-original", tier_of, lexical_metadata,
            easy_anchor_limit, hardcore_scores, approved_source_ids
        )
        + annotate_rows(
            fresh, "fresh-generated", tier_of, lexical_metadata,
            easy_anchor_limit, hardcore_scores, approved_source_ids
        )
    )

    active_sigs = {board_signature(puzzle) for puzzle in all_active_puzzles(current)}
    eligible_rows = [
        row for row in rows
        if eligible(row) and row["_signature"] not in active_sigs
    ]

    # Deduplicate identical candidate boards, keeping the stronger provenance.
    by_sig: dict[str, dict] = {}
    for row in eligible_rows:
        old = by_sig.get(row["_signature"])
        if old is None:
            by_sig[row["_signature"]] = row
            continue
        rank = (
            int(row["_approvedRefresh"]),
            int(row["_sourceKind"] == "refresh-original"),
            float(row["humanDecisionScore"]),
        )
        old_rank = (
            int(old["_approvedRefresh"]),
            int(old["_sourceKind"] == "refresh-original"),
            float(old["humanDecisionScore"]),
        )
        if rank > old_rank:
            by_sig[row["_signature"]] = row
    pool = list(by_sig.values())

    selected: list[dict] = []
    # Cooldown crosses the difficulty boundary: final Mozkomor level 1 must not
    # reuse a target from the last 12 active Mozkožrout levels.
    recent_words: list[set[str]] = [
        {norm(answer.get("word")) for answer in puzzle.get("answers") or []}
        for puzzle in hardcore[-TARGET_COOLDOWN:]
    ]
    word_usage: Counter[str] = Counter()

    for level in range(1, TARGET_COUNT + 1):
        low, high = band_for(level)
        blocked = set().union(*recent_words[-TARGET_COOLDOWN:]) if recent_words else set()
        choices = []
        for row in pool:
            if row in selected:
                continue
            score = float(row["humanDecisionScore"])
            if not (low <= score <= high):
                continue
            words = {norm(word["word"]) for word in row["words"]}
            if words & blocked:
                continue
            choices.append(row)

        if not choices:
            raise RuntimeError(
                f"No candidate for level {level}; band={low:.2f}..{high:.2f}, "
                f"selected={len(selected)}, pool={len(pool)}"
            )

        chosen = min(choices, key=lambda row: candidate_cost(row, level, word_usage))
        selected.append(chosen)
        words = {norm(word["word"]) for word in chosen["words"]}
        recent_words.append(words)
        word_usage.update(words)

    final_puzzles = []
    selected_details = []
    for level, row in enumerate(selected, 1):
        puzzle = deepcopy(row["_puzzle"])
        source_id = row["_sourceId"]
        puzzle["id"] = f"g4-z-{level:03d}"
        meta = puzzle.setdefault("meta", {})
        meta.update({
            "level": level,
            "contentGeneration": 4,
            "generationKey": "free-gen4-v334",
            "generationProfile": "mozkomor-core",
            "endgameTier": True,
            "unlockRequiresDifficulty": "hardcore",
            "unlockRequiresBaseLevels": 200,
            "targetCooldown": TARGET_COOLDOWN,
            "finalBankProfile": "mozkomor-human-v40132",
            "finalBankSourceKind": row["_sourceKind"],
            "finalBankSourceId": source_id,
            "humanDecisionScore": row["humanDecisionScore"],
            "humanPercentileVsMozkozrout": row["humanPercentileVsMozkozrout"],
            "approvedRefreshAnchor": bool(row["_approvedRefresh"]),
        })
        final_puzzles.append(puzzle)
        selected_details.append({
            "level": level,
            "id": puzzle["id"],
            "sourceKind": row["_sourceKind"],
            "sourceId": source_id,
            "approvedRefreshAnchor": bool(row["_approvedRefresh"]),
            "humanDecisionScore": row["humanDecisionScore"],
            "humanPercentileVsMozkozrout": row["humanPercentileVsMozkozrout"],
            "activeCells": row["activeCells"],
            "targetCount": row["targetCount"],
            "meanTurns": row["meanTurns"],
            "legacyAmbiguity": row["legacyAmbiguity"],
            "longWordShare": row["longWordShare"],
            "mediumWordShare": row["mediumWordShare"],
            "easyAnchorCount": row["easyAnchorCount"],
            "forcedLongWordCount": row["forcedLongWordCount"],
            "averageFun": row["averageFun"],
            "tierDCount": tier_d_count(row),
            "words": [word["word"] for word in row["words"]],
        })

    # Final cooldown contract after renumbering.
    for idx, detail in enumerate(selected_details):
        current_words = {norm(word) for word in detail["words"]}
        for prev in selected_details[max(0, idx - TARGET_COOLDOWN):idx]:
            assert not current_words & {norm(word) for word in prev["words"]}

    def band_summary(start: int, end: int) -> dict:
        items = selected_details[start - 1:end]
        scores = [float(item["humanDecisionScore"]) for item in items]
        return {
            "levels": [start, end],
            "scoreMin": round(min(scores), 4),
            "scoreMedian": round(median(scores), 4),
            "scoreMean": round(mean(scores), 4),
            "scoreMax": round(max(scores), 4),
            "approvedRefreshAnchors": sum(int(item["approvedRefreshAnchor"]) for item in items),
        }

    source_counts = Counter(item["sourceKind"] for item in selected_details)
    report = {
        "version": 1,
        "kind": "mozkomor-final-bank-human-v40132",
        "principle": "human decision pressure over forced long-word difficulty",
        "currentMozkozroutScore": human.distribution(hardcore_scores),
        "candidateCounts": {
            "refreshOriginal": len(old_mozkomor),
            "freshGenerated": len(fresh),
            "eligibleAfterHumanFilterAndDedup": len(pool),
        },
        "selectionRules": {
            "minimumHumanDecisionScore": MIN_SCORE,
            "easyAnchorMax": 2,
            "longWordShareMax": 0.50,
            "forcedLongWordMax": 3,
            "averageFunMin": 3.20,
            "lowFunMax": 0,
            "verbAdjectiveAdverbMax": 1,
            "tierDMax": 1,
            "targetCooldown": TARGET_COOLDOWN,
            "bands": [list(band) for band in BANDS],
        },
        "selectedSourceCounts": dict(sorted(source_counts.items())),
        "approvedRefreshAnchorsRequested": sorted(approved_source_ids),
        "approvedRefreshAnchorsSelected": [
            item["sourceId"] for item in selected_details if item["approvedRefreshAnchor"]
        ],
        "bands": [
            band_summary(1, 20),
            band_summary(21, 40),
            band_summary(41, 60),
            band_summary(61, 80),
            band_summary(81, 100),
        ],
        "boards": selected_details,
    }
    output = {
        "version": 1,
        "kind": "gen4-mozkomor-final-bank",
        "status": "PLAYTEST_ONLY_NOT_FOR_PRODUCTION",
        "contentGeneration": 4,
        "difficulty": "mozkomor",
        "profile": "mozkomor-human-v40132",
        "targetCooldown": TARGET_COOLDOWN,
        "unlock": {"difficulty": "hardcore", "baseLevels": 200},
        "xpPerFirstCompletionPlanned": 150,
        "puzzles": final_puzzles,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "selected": len(final_puzzles),
        "eligiblePool": len(pool),
        "sources": report["selectedSourceCounts"],
        "approvedAnchors": len(report["approvedRefreshAnchorsSelected"]),
        "bands": report["bands"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
