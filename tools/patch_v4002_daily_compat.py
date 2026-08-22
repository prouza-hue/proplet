"""Append Sunday's Gen3 board to the public bank for the one-day Gen4 cutover guard."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DB = ROOT / "public" / "puzzles.json"
SOURCE_COMMIT = "a1904574324c714526a5303f6584f3174a789f8e"
PUZZLE_ID = "g3-d-007"


def main() -> None:
    current_text = PUBLIC_DB.read_text(encoding="utf-8")
    current = json.loads(current_text)
    if any(puzzle.get("id") == PUZZLE_ID for puzzle in current.get("daily", [])):
        return

    source_text = subprocess.check_output(
        ["git", "show", f"{SOURCE_COMMIT}:public/puzzles.json"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )
    source = json.loads(source_text)
    puzzle = next(puzzle for puzzle in source["daily"] if puzzle.get("id") == PUZZLE_ID)
    encoded = json.dumps(puzzle, ensure_ascii=False, separators=(",", ":"))
    marker = '],"rescue":['
    if current_text.count(marker) != 1:
        raise RuntimeError("Unexpected public puzzle database shape")
    PUBLIC_DB.write_text(current_text.replace(marker, f",{encoded}{marker}", 1), encoding="utf-8")


if __name__ == "__main__":
    main()
