#!/usr/bin/env python3
"""Unit coverage for metadata-only legacy resolution."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
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

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source = root / "puzzles.json"
        catalog_path = root / "catalog.json"
        seed_path = root / "seed.sql"
        source.write_text(json.dumps({
            "freeGeneration": 3,
            "free": {"easy": [{
                "id": "known-1", "difficulty": "easy", "rows": 1, "cols": 1,
                "mask": [0], "letters": ["A"],
                "answers": [{"word": "A", "path": [0]}],
                "meta": {"contentGeneration": 3, "level": 1},
            }]},
            "legacyDaily": [{
                "generation": 1,
                "rotationBaseDate": "2026-01-01",
                "puzzles": [
                    {"id": "known-1", "difficulty": "easy"},
                    {"id": "missing-body-2", "difficulty": "medium"},
                ],
            }],
        }), encoding="utf-8")
        subprocess.run([
            sys.executable, str(ROOT / "tools/build_gen4_archive.py"), str(source),
            "--catalog", str(catalog_path), "--cold-dir", str(root / "cold"),
        ], check=True, capture_output=True, text=True)
        built = json.loads(catalog_path.read_text(encoding="utf-8"))
        assert built["tombstoneCount"] == 1
        assert built["tombstones"] == [{
            "puzzleId": "missing-body-2", "generation": 1, "bank": "daily",
            "difficulty": "medium", "slot": 2,
            "sourcePath": "puzzles/legacyDaily/0/puzzles/1",
            "reason": "metadata-only-source",
        }]
        assert "letters" not in json.dumps(built["tombstones"]).casefold()
        subprocess.run([
            sys.executable, str(ROOT / "tools/build_gen4_catalog_sql.py"), str(catalog_path),
            "--output", str(seed_path),
        ], check=True, capture_output=True, text=True)
        seed = seed_path.read_text(encoding="utf-8")
        assert "insert into public.content_archive_tombstones" in seed
        assert "content_lineage_confidence = 'inferred'" in seed
    print("Metadata-only archive resolution verified.")


if __name__ == "__main__":
    main()
