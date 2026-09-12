#!/usr/bin/env python3
"""Regression test for Tajenka Content Contract v2 dry validation."""

from __future__ import annotations

from validate_tajenka_content_v2 import DEFAULT_CONTENT_DIR, DEFAULT_OVERLAY, load_banks, load_json, validate_banks


def main() -> None:
    report = validate_banks(load_banks(DEFAULT_CONTENT_DIR), load_json(DEFAULT_OVERLAY))

    assert report["total"] == 46, report
    assert report["passed"] == 41, report
    assert report["failed"] == 5, report
    assert report["expectedMismatches"] == [], report["expectedMismatches"]

    failures = {
        item["candidateNo"]: set(item["errors"])
        for item in report["results"]
        if item["status"] == "fail"
    }
    assert set(failures) == {30, 40, 58, 59, 60}, failures
    assert "LETTER_BUDGET" in failures[30]
    assert "ANCHOR_WEAK" in failures[40]
    assert {"ANCHOR_WEAK", "SHORT_ANCHOR_UNJUSTIFIED"} <= failures[58]
    assert "LETTER_BUDGET" in failures[59]
    assert {"ANCHOR_COUNT", "LETTER_BUDGET"} <= failures[60]

    print("PASS: Tajenka Content v2 dry validation = 41 PASS / 5 FAIL")


if __name__ == "__main__":
    main()
