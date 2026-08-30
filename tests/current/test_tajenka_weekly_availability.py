#!/usr/bin/env python3
"""Regression contract: Saturday releases stay playable for the whole week."""

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


def released_week(day: date) -> int | None:
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


# Nothing leaks before the first scheduled Saturday.
assert_unavailable(date(2026, 8, 28))

# A Saturday release remains the active puzzle through Friday.
for day in (
    date(2026, 8, 29),
    date(2026, 8, 30),
    date(2026, 8, 31),
    date(2026, 9, 1),
    date(2026, 9, 4),
):
    assert released_week(day) == 1, day

# The following Saturday advances to the next prepared puzzle.
assert released_week(date(2026, 9, 5)) == 2

# The finite bank still fails closed after its last prepared release.
assert_unavailable(date(2026, 11, 7))

# The frontend must use the released week, not a weekend-only weekday gate.
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
availability = app.split("function refreshTajenkaAvailability", 1)[1].split("refreshTajenkaAvailability();", 1)[0]
assert "weekend" not in availability
assert "TAJENKA_RELEASE_ENABLED&&activeTajenkaWeek" in availability

print("PASS: Tajenka Saturday release remains available through Friday")
