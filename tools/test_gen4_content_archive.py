#!/usr/bin/env python3
"""Unit coverage for metadata-only legacy resolution."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import content_archive


def main() -> None:
    payload = {
        "version": 1,
        "content": [{
            "contentKey": "sha256:old",
            "rows": 8,
            "cols": 8,
            "activeCells": 40,
            "targetCount": 7,
            "contexts": [{
                "puzzleId": "g3-m-001", "generation": 3, "bank": "free",
                "difficulty": "medium", "slot": 1, "sourcePath": "puzzles/free/medium/0",
            }],
        }],
    }
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "catalog.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        catalog = content_archive.load_catalog(str(path))
        info = content_archive.archived_puzzle_info(catalog, "g3-m-001", "medium", "free", 4)
        assert info and info["legacy"] is True and info["archived"] is True
        assert len(info["puzzle"]["mask"]) == 40 and len(info["puzzle"]["answers"]) == 7
        assert "letters" not in info["puzzle"]

    runtime = {"archive": {"dailyWindows": [{
        "generation": 3, "activeFrom": "2026-08-17", "activeUntil": "2026-08-20",
        "rotationBaseDate": "2026-08-17", "puzzleIds": ["g3-d-001", "g3-d-002"],
    }]}}
    assert content_archive.daily_window_id(runtime, "2026-08-17") == "g3-d-001"
    assert content_archive.daily_window_id(runtime, "2026-08-18") == "g3-d-002"
    assert content_archive.daily_window_id(runtime, "2026-08-21") is None
    print("Metadata-only archive resolution verified.")


if __name__ == "__main__":
    main()
