#!/usr/bin/env python3
"""Keep generated v3.24 puzzle JSON reviewable and consistent with the repository."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    ROOT / "data" / "puzzles.json",
    ROOT / "public" / "puzzles.json",
    ROOT / "data" / "legacy_daily_gen2.json",
)


def main() -> None:
    for path in FILES:
        payload = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Formatted {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
