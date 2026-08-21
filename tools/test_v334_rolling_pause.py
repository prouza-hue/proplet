#!/usr/bin/env python3
"""Regression test: approved Gen4 work must not leak reserved Gen3 rolling levels."""
from datetime import date

import server


def main() -> None:
    rolling = server.load_rolling_content()
    assert rolling.get("releaseEnabled") is False
    assert rolling.get("contentGeneration") == 3
    assert server.rolling_content_release_enabled() is False

    future = date(2026, 12, 31)
    base = server.load_puzzles().get("free") or {}
    for difficulty in ("easy", "medium", "hard", "hardcore"):
        assert len(server.released_free_bank(difficulty, future)) == len(base.get(difficulty) or [])

    released, next_release = server._released_batches(future)
    assert released == []
    assert next_release is None
    payload = server.released_rolling_payload(future)
    assert all(not values for values in payload["puzzles"].values())
    assert payload["meta"]["releaseEnabled"] is False
    print("Gen3 rolling pause verified: no reserved puzzle is released at any simulated date.")


if __name__ == "__main__":
    main()
