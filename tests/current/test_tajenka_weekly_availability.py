#!/usr/bin/env python3
"""Regression contract: Tajenka switches from weekly Saturday to Saturday/Wednesday."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


def released_slot(day: date) -> int | None:
    with (
        patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
        patch.object(server, "VERCEL_ENV", "production"),
        patch.object(server, "current_prague_date", return_value=day),
    ):
        if not server.tajenka_is_live(day):
            return None
        response = server.current_tajenka(week=None)
        return int(json.loads(response.body)["week"])


def assert_unavailable(day: date) -> None:
    with (
        patch.object(server, "TAJENKA_RELEASE_ENABLED", True),
        patch.object(server, "VERCEL_ENV", "production"),
        patch.object(server, "current_prague_date", return_value=day),
    ):
        assert server.tajenka_is_live(day) is False
        try:
            server.current_tajenka(week=None)
        except HTTPException as error:
            assert error.status_code == 404
            assert error.detail == "Tajenka zatím není vydaná"
        else:
            raise AssertionError("unreleased Tajenka must not be served")


assert_unavailable(date(2026, 8, 28))

# Keep the two already released Saturday puzzles exactly where players saw them.
for day in (date(2026, 8, 29), date(2026, 9, 2), date(2026, 9, 4)):
    assert released_slot(day) == 1, day
for day in (date(2026, 9, 5), date(2026, 9, 9), date(2026, 9, 11)):
    assert released_slot(day) == 2, day

# Starting 12 Sep, a new puzzle arrives Saturday and Wednesday.
for day in (date(2026, 9, 12), date(2026, 9, 13), date(2026, 9, 15)):
    assert released_slot(day) == 3, day
for day in (date(2026, 9, 16), date(2026, 9, 17), date(2026, 9, 18)):
    assert released_slot(day) == 4, day
assert released_slot(date(2026, 9, 19)) == 5
assert released_slot(date(2026, 10, 7)) == 10
assert_unavailable(date(2026, 10, 10))

# Frontend and backend must use the same transition marker and split-week calculation.
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
assert "TAJENKA_TWICE_WEEKLY_START" in app
assert "function tajenkaReleaseSlotForISO" in app
assert "cadenceOffset%7>=4" in app
assert "TAJENKA_RELEASE_ENABLED&&activeTajenkaWeek" in app

print("PASS: Tajenka keeps slots 1-2, then releases every Saturday and Wednesday")
