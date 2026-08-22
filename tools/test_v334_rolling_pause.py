#!/usr/bin/env python3
"""Regression test: Gen4 Rolling stays hidden until the approved 31 August release."""
from datetime import date
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


def main() -> None:
    rolling = server.load_rolling_content()
    assert rolling.get("releaseEnabled") is True
    assert rolling.get("contentGeneration") == 4
    assert rolling.get("firstRelease") == "2026-08-31"
    assert server.rolling_content_release_enabled() is True

    before = date(2026, 8, 30)
    base = server.load_puzzles().get("free") or {}
    for difficulty in ("easy", "medium", "hard", "hardcore"):
        assert len(server.released_free_bank(difficulty, before)) == len(base.get(difficulty) or [])

    released, next_release = server._released_batches(before)
    assert released == []
    assert next_release == "2026-08-31"
    payload = server.released_rolling_payload(before)
    assert all(not values for values in payload["puzzles"].values())
    assert payload["meta"]["releaseEnabled"] is True

    launch = date(2026, 8, 31)
    released, next_release = server._released_batches(launch)
    assert len(released) == 1
    assert released[0]["availableFrom"] == "2026-08-31"
    assert next_release == "2026-09-07"
    assert sum(len(values) for values in server.released_rolling_payload(launch)["puzzles"].values()) == 5

    future = date(2026, 12, 31)
    released, next_release = server._released_batches(future)
    assert len(released) == 13
    assert next_release is None
    assert sum(len(values) for values in server.released_rolling_payload(future)["puzzles"].values()) == 65
    print("Gen4 Rolling schedule verified: first five-level Back to School batch releases 2026-08-31.")


if __name__ == "__main__":
    main()
