#!/usr/bin/env python3
"""Regression: legacy feedback with ``puzzle: null`` must not crash admin reports."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


server.require_admin = lambda authorization, write=False: {"player": {"id": "admin"}}
server.puzzle_info = lambda puzzle_id: {
    "puzzle": None,
    "mode": "free",
    "difficulty": "easy",
    "level": None,
    "legacy": True,
}


def fake_select_all(table: str, **filters):
    if table == "puzzle_feedback":
        return [{
            "id": "report-1",
            "kind": "word",
            "status": "new",
            "word": "TEST",
            "puzzle_id": "retired-board",
            "created_at": "2026-08-23T00:35:50+00:00",
        }]
    if table == "players":
        return []
    raise AssertionError((table, filters))


server.db_select_all = fake_select_all

report = server.admin_reports("open", "", 100, "Bearer admin")
assert report["total"] == 1
assert report["reports"][0]["puzzleId"] == "retired-board"
assert report["reports"][0]["level"] is None
assert report["reports"][0]["legacy"] is True

print("Proplet v4.01.8 admin report null-puzzle guard: OK")
