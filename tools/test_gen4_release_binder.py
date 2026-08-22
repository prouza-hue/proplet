#!/usr/bin/env python3
"""Rehearse the approval-only date binder and validate the bound release."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp)
        puzzles = target / "puzzles.json"
        rolling = target / "rolling.json"
        subprocess.run([
            sys.executable, str(ROOT / "tools/bind_gen4_release.py"),
            "--puzzles", str(ROOT / "data/puzzles_gen4_candidate_v334.json"),
            "--rolling", str(ROOT / "data/rolling_content_gen4_candidate_v334.json"),
            "--release-date", "2026-08-24", "--approved-by", "Pavel",
            "--puzzles-output", str(puzzles), "--rolling-output", str(rolling),
        ], check=True, capture_output=True, text=True)
        subprocess.run([
            sys.executable, str(ROOT / "tools/validate_gen4_release.py"), str(puzzles),
            "--rolling", str(rolling),
            "--profiles", str(ROOT / "data/gen4_profiles_v334.json"),
            "--exclusions", str(ROOT / "data/target_generation_exclusions_v334.json"),
            "--strict-counts", "--approved-release",
        ], check=True, capture_output=True, text=True)
        bound = json.loads(puzzles.read_text(encoding="utf-8"))
        schedule = json.loads(rolling.read_text(encoding="utf-8"))
        assert bound["release"]["dailyGeneration4From"] == "2026-08-24"
        assert bound["archive"]["dailyWindows"][-1]["activeUntil"] == "2026-08-23"
        assert schedule["firstRelease"] == "2026-08-31"
        assert schedule["reservedThrough"] == "2026-11-23"
        assert len(schedule["batches"]) == 13
    print("Approval-only Gen4 release binder verified.")


if __name__ == "__main__":
    main()
