"""Regression coverage for the derived cold-start puzzle bootstrap."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools.generate_puzzles_bootstrap import (  # noqa: E402
    PUZZLE_PAYLOAD_KEYS,
    build_bootstrap,
    is_playable_puzzle,
    validate,
)


def load_source() -> tuple[bytes, dict]:
    raw = (ROOT / "public" / "puzzles.json").read_bytes()
    return raw, json.loads(raw)


def test_bootstrap_is_small_and_preserves_progress_identity() -> None:
    raw, source = load_source()
    bootstrap = build_bootstrap(source, raw, today=date(2026, 9, 12))
    encoded = json.dumps(bootstrap, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    validate(source, bootstrap, len(raw), len(encoded))
    assert len(encoded) < len(raw) * 0.35
    assert bootstrap["legacyFreeIndex"] == source["legacyFreeIndex"]
    assert [p["id"] for p in bootstrap["daily"]] == [p["id"] for p in source["daily"]]


def test_bootstrap_keeps_only_runtime_metadata_for_nonplayable_banks() -> None:
    raw, source = load_source()
    bootstrap = build_bootstrap(source, raw, today=date(2026, 9, 12))

    for difficulty, bank in bootstrap["free"].items():
        assert len(bank) == len(source["free"][difficulty])
        for puzzle in bank:
            assert puzzle["id"]
            assert puzzle["meta"].get("level") is not None
            assert not any(key in puzzle for key in PUZZLE_PAYLOAD_KEYS)

    assert len(bootstrap["rescue"]) == len(source.get("rescue") or [])
    assert all(not any(key in puzzle for key in PUZZLE_PAYLOAD_KEYS) for puzzle in bootstrap["rescue"])


def test_bootstrap_daily_window_is_fully_playable() -> None:
    raw, source = load_source()
    bootstrap = build_bootstrap(source, raw, today=date(2026, 9, 12))

    playable = [puzzle for puzzle in bootstrap["daily"] if is_playable_puzzle(puzzle)]
    assert playable
    assert is_playable_puzzle(bootstrap["starter"])
    assert bootstrap["bootstrapValidFrom"] == "2026-09-11"
    assert bootstrap["bootstrapValidThrough"] == "2026-09-20"
