#!/usr/bin/env python3
"""Regression test for the branch-scoped, read-only Generation 4 preview."""
from __future__ import annotations

import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["VERCEL_ENV"] = "preview"
os.environ["VERCEL_GIT_COMMIT_REF"] = "agent/v3340-medium-calibration-v3"

from fastapi.testclient import TestClient
import server


def main() -> None:
    assert server.GEN4_CANDIDATE_PREVIEW is True
    assert server.PUZZLES_PATH.name == "puzzles_gen4_candidate_v334.json"
    assert server.ROLLING_CONTENT_PATH.name == "rolling_content_gen4_candidate_v334.json"

    puzzles = server.load_puzzles()
    rolling = server.load_rolling_content()
    assert puzzles.get("contentGeneration") == 4
    assert (puzzles.get("release") or {}).get("status") == "candidate-paused"
    assert rolling.get("contentGeneration") == 4
    assert rolling.get("releaseEnabled") is False

    client = TestClient(server.app)
    database = client.get("/api/puzzle-database")
    assert database.status_code == 200
    assert database.headers.get("cache-control") == "no-store"
    assert database.json().get("contentGeneration") == 4

    blocked = client.post("/api/product-event", json={"event_type": "preview_probe"})
    assert blocked.status_code == 409
    assert "pouze pro čtení" in blocked.json().get("detail", "")

    legacy_id = next(iter(puzzles.get("legacyFreeIndex") or {}))
    archived = client.get("/api/free-archive", params={"puzzle_id": legacy_id})
    assert archived.status_code == 410
    assert archived.json().get("archived") is True
    print("Gen4 preview verified: branch-scoped candidate, no-store reads, writes blocked, legacy tombstone.")


if __name__ == "__main__":
    main()

