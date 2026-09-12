#!/usr/bin/env python3
"""Dry structural validator for Tajenka Content Contract v2.

This tool validates the authoring-only Tajenka v2 candidate shards. It does not
build boards and does not touch the active Tajenka v1 runtime bank.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTENT_DIR = ROOT / "content" / "tajenka-v2"
DEFAULT_OVERLAY = DEFAULT_CONTENT_DIR / "lexicon-overlay.json"
DEFAULT_GLOB = "editorial-*.json"

WORD_RE = re.compile(r"[^\W\d_]+|\d+", re.UNICODE)
SOURCE_REQUIRED = {"fact", "czech", "quote"}


def normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value).upper()


def word_tokens(value: str) -> list[str]:
    return [normalize(token) for token in WORD_RE.findall(value)]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_banks(content_dir: Path) -> list[dict[str, Any]]:
    paths = sorted(content_dir.glob(DEFAULT_GLOB))
    if not paths:
        raise ValueError(f"No Tajenka v2 editorial shards found in {content_dir}")
    return [load_json(path) for path in paths]


def overlay_words(overlay: dict[str, Any]) -> set[str]:
    return {normalize(entry) for entry in overlay.get("entries", [])}


def companion_word_count(companion: dict[str, Any]) -> int:
    return len(WORD_RE.findall(companion["text"]))


def validate_candidate(
    candidate: dict[str, Any],
    *,
    approved_overlay: set[str],
    seen_texts: set[str],
) -> dict[str, Any]:
    errors: set[str] = set()

    anchors = candidate.get("anchors", [])
    surfaces = [normalize(anchor["surface"]) for anchor in anchors]
    total_letters = sum(len(surface) for surface in surfaces)
    immutable = bool(candidate.get("immutable"))

    if len(anchors) == 5:
        if not 24 <= total_letters <= 31:
            errors.add("LETTER_BUDGET")
    elif len(anchors) == 4 and immutable:
        if not 24 <= total_letters <= 30:
            errors.add("LETTER_BUDGET")
    else:
        errors.add("ANCHOR_COUNT")
        if not 24 <= total_letters <= 31:
            errors.add("LETTER_BUDGET")

    if len(set(surfaces)) != len(surfaces):
        errors.add("DUPLICATE_ANCHOR")

    display_tokens = word_tokens(candidate["displayText"])
    short_count = 0
    for anchor, surface in zip(anchors, surfaces):
        length = len(surface)
        if length < 3:
            errors.add("ANCHOR_TOO_SHORT")
        if length > 10:
            errors.add("ANCHOR_TOO_LONG")
        if length == 3:
            short_count += 1
            if (
                anchor.get("suitability") != "strong"
                or not candidate.get("shortAnchorJustification")
            ):
                errors.add("SHORT_ANCHOR_UNJUSTIFIED")
        if anchor.get("suitability") == "weak":
            errors.add("ANCHOR_WEAK")
        if surface not in display_tokens:
            errors.add("ANCHOR_NOT_IN_TEXT")
        if surface not in approved_overlay:
            errors.add("LEXICON_UNAPPROVED")

    if short_count > 1:
        errors.add("TOO_MANY_SHORT_ANCHORS")

    companions = candidate.get("companions", [])
    if sum(companion_word_count(item) for item in companions) > 5:
        errors.add("COMPANION_OVERLOAD")

    per_anchor = Counter(normalize(item["revealWith"]) for item in companions)
    if any(count > 2 for count in per_anchor.values()):
        errors.add("COMPANION_PER_ANCHOR")

    if sum(bool(item.get("significant")) for item in companions) > 1:
        errors.add("SIGNIFICANT_COMPANION_OVERLOAD")

    for companion in companions:
        if normalize(companion["revealWith"]) not in surfaces:
            errors.add("COMPANION_BAD_TARGET")

    if candidate.get("category") in SOURCE_REQUIRED:
        source = candidate.get("source")
        if not source or source.get("status") != "verified" or not source.get("url"):
            errors.add("SOURCE_UNVERIFIED")

    text_key = " ".join(word_tokens(candidate["displayText"]))
    if text_key in seen_texts:
        errors.add("DUPLICATE_TEXT")
    else:
        seen_texts.add(text_key)

    return {
        "id": candidate["id"],
        "candidateNo": candidate["candidateNo"],
        "displayText": candidate["displayText"],
        "totalLetters": total_letters,
        "status": "fail" if errors else "pass",
        "errors": sorted(errors),
    }


def validate_banks(banks: list[dict[str, Any]], overlay: dict[str, Any]) -> dict[str, Any]:
    for bank in banks:
        if bank.get("schemaVersion") != 2:
            raise ValueError(f"{bank.get('bankId', '<unknown>')}: schemaVersion must be 2")
        if bank.get("runtimeEnabled") is not False:
            raise ValueError(f"{bank.get('bankId', '<unknown>')}: runtimeEnabled must stay false")

    if overlay.get("scope") != "tajenka-v2-only":
        raise ValueError("Lexicon overlay must be scoped to tajenka-v2-only")
    if overlay.get("runtimeEnabled") is not False:
        raise ValueError("Tajenka lexicon overlay must remain runtimeEnabled=false")

    candidates = [candidate for bank in banks for candidate in bank.get("candidates", [])]
    candidates.sort(key=lambda item: item["candidateNo"])

    ids = [candidate["id"] for candidate in candidates]
    numbers = [candidate["candidateNo"] for candidate in candidates]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate Tajenka v2 candidate id")
    if len(numbers) != len(set(numbers)):
        raise ValueError("Duplicate Tajenka v2 candidateNo")

    approved_overlay = overlay_words(overlay)
    seen_texts: set[str] = set()
    results = [
        validate_candidate(
            candidate,
            approved_overlay=approved_overlay,
            seen_texts=seen_texts,
        )
        for candidate in candidates
    ]

    by_id = {candidate["id"]: candidate for candidate in candidates}
    expected_mismatches = []
    for result in results:
        expected = by_id[result["id"]]["expectedValidation"]
        if result["status"] != expected:
            expected_mismatches.append(
                {
                    "id": result["id"],
                    "expected": expected,
                    "actual": result["status"],
                    "errors": result["errors"],
                }
            )

    return {
        "total": len(results),
        "passed": sum(item["status"] == "pass" for item in results),
        "failed": sum(item["status"] == "fail" for item in results),
        "expectedMismatches": expected_mismatches,
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--overlay", type=Path, default=DEFAULT_OVERLAY)
    parser.add_argument("--json", action="store_true", help="Print full report as JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = validate_banks(load_banks(args.content_dir), load_json(args.overlay))

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(
            f"Tajenka Content v2: {report['passed']} PASS / "
            f"{report['failed']} FAIL / {report['total']} total"
        )
        for item in report["results"]:
            if item["status"] == "fail":
                print(
                    f"  #{item['candidateNo']:02d} {item['id']}: "
                    f"{', '.join(item['errors'])}"
                )
        if report["expectedMismatches"]:
            print("Expected-validation mismatches:")
            for mismatch in report["expectedMismatches"]:
                print(
                    f"  {mismatch['id']}: expected {mismatch['expected']}, "
                    f"got {mismatch['actual']} ({', '.join(mismatch['errors'])})"
                )

    return 1 if report["expectedMismatches"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
