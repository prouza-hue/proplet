#!/usr/bin/env python3
"""Promote the playtested Tajenka v2 candidate bank into the runtime bank.

This tool is intentionally NOT a generator. It treats the approved candidate geometry
(mask, letters and answer paths) as immutable master assets and only wraps it in the
runtime schema used by Proplet.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "tajenka_v2_approved.json"
DEFAULT_OUTPUT = ROOT / "data" / "tajenka_weekend_v2.json"
DEFAULT_MANIFEST = ROOT / "data" / "tajenka_v2_freeze_manifest.json"
REWARD_XP = 200


def canonical_geometry(board: dict) -> dict:
    return {
        "mask": board["mask"],
        "letters": board["letters"],
        "answers": [
            {"word": answer["word"], "path": answer["path"]}
            for answer in board["answers"]
        ],
    }


def geometry_sha256(board: dict) -> str:
    payload = json.dumps(
        canonical_geometry(board), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def production_source(board: dict) -> dict | None:
    source = board.get("source")
    if not source:
        return None
    out = dict(source)
    if board.get("id") == "tajenka-v2-c56":
        out.update({"author": "Jan Neruda", "work": "Jen dál!"})
    return out


def promote_board(board: dict, week: int) -> dict:
    answers = []
    for answer in board["answers"]:
        # Preserve the exact tested geometry. Clues are deliberately not invented here;
        # the runtime already has a safe length-based fallback when no editorial clue exists.
        answers.append(
            {
                "word": answer["word"],
                "path": answer["path"],
                "turns": answer.get("turns"),
                "curlRun": answer.get("curlRun", 1),
            }
        )

    phrase = board["displayText"]
    geometry_hash = geometry_sha256(board)
    meta = dict(board.get("meta") or {})
    meta.update(
        {
            "week": week,
            "cells": len(board["mask"]),
            "phraseCells": sum(len(answer["word"]) for answer in answers),
            "targetLetters": sum(len(answer["word"]) for answer in answers),
            "decoyCells": len(board["mask"]) - sum(len(answer["word"]) for answer in answers),
            "rewardXp": REWARD_XP,
            "previewOnly": True,
            "runtimeEnabled": True,
            "geometrySha256": geometry_hash,
            "sourceCandidateId": board["id"],
        }
    )
    return {
        "version": 2,
        "id": f"tajenka-v2-week-{week:02d}",
        "sourceId": board["id"],
        "kind": "weekend_bonus",
        "week": week,
        "title": "Tajenka",
        "description": "Najdi propletená slova mezi falešnými odbočkami. Každé odhalí další část tajenky.",
        "difficulty": "medium",
        "category": board.get("category"),
        "source": production_source(board),
        "rows": board["rows"],
        "cols": board["cols"],
        "mask": board["mask"],
        "letters": board["letters"],
        "lengths": [len(answer["word"]) for answer in answers],
        "answers": answers,
        "tajenka": {
            "phrase": phrase,
            "displayText": phrase,
            "answerOrder": list(range(len(answers))),
            "companions": board.get("companions") or [],
        },
        "meta": meta,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    approved = json.loads(args.source.read_text(encoding="utf-8"))
    boards = approved.get("boards") or []
    failures = approved.get("failures") or []
    if failures:
        raise SystemExit(f"Approved bank unexpectedly contains failures: {failures}")
    if len(boards) != 37:
        raise SystemExit(f"Expected exactly 37 approved boards, found {len(boards)}")

    puzzles = [promote_board(board, week) for week, board in enumerate(boards, 1)]
    bank = {
        "version": 2,
        "kind": "weekend_bonus_bank",
        "weeks": len(puzzles),
        "rewardXp": REWARD_XP,
        "source": "approved-playtest-review1",
        "puzzles": puzzles,
    }
    manifest = {
        "version": 1,
        "kind": "tajenka-v2-freeze-manifest",
        "source": str(args.source.relative_to(ROOT)) if args.source.is_relative_to(ROOT) else str(args.source),
        "boards": [
            {
                "week": week,
                "runtimeId": puzzle["id"],
                "sourceId": board["id"],
                "geometrySha256": geometry_sha256(board),
                "displayText": board["displayText"],
            }
            for week, (board, puzzle) in enumerate(zip(boards, puzzles), 1)
        ],
    }

    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Promoted {len(puzzles)} frozen Tajenka boards -> {args.output}")


if __name__ == "__main__":
    main()
