from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "public" / "puzzles.json"
DEFAULT_OUTPUT = ROOT / "public" / "puzzles-bootstrap.json"
HEAVY_KEYS = {"free", "daily", "rescue", "legacyFree", "previousDaily"}
DESCRIPTOR_KEYS = ("id", "difficulty", "meta")


def descriptor(puzzle: dict) -> dict:
    return {key: puzzle[key] for key in DESCRIPTOR_KEYS if key in puzzle}


def build_bootstrap(source: dict, source_bytes: bytes) -> dict:
    if int(source.get("version", 0)) not in {9, 10, 11}:
        raise ValueError("Unsupported puzzle database version")
    if int(source.get("contentGeneration", 0)) != 4 or int(source.get("dailyGeneration", 0)) != 4:
        raise ValueError("Bootstrap generation requires Gen4 content and daily banks")

    bootstrap = {key: value for key, value in source.items() if key not in HEAVY_KEYS}
    bootstrap["bootstrapSchema"] = 1
    bootstrap["bootstrapSource"] = {
        "sha256": hashlib.sha256(source_bytes).hexdigest(),
        "version": source.get("version"),
        "contentGeneration": source.get("contentGeneration"),
        "dailyGeneration": source.get("dailyGeneration"),
        "generatedAt": source.get("generatedAt"),
        "freeGeneration": source.get("freeGeneration"),
        "dailyGeneration4From": source.get("dailyGeneration4From"),
    }

    # Daily and the onboarding starter remain complete so the first useful screen
    # is immediately playable. Free/rescue banks only need identity/progression
    # metadata until the canonical database finishes downloading in the background.
    bootstrap["daily"] = source.get("daily") or []
    if source.get("starter") is not None:
        bootstrap["starter"] = source["starter"]
    bootstrap["free"] = {
        difficulty: [descriptor(puzzle) for puzzle in puzzles]
        for difficulty, puzzles in (source.get("free") or {}).items()
    }
    bootstrap["rescue"] = [descriptor(puzzle) for puzzle in (source.get("rescue") or [])]

    return bootstrap


def validate(source: dict, bootstrap: dict, full_size: int, bootstrap_size: int) -> None:
    if bootstrap.get("bootstrapSchema") != 1:
        raise ValueError("Missing bootstrap schema marker")
    if not bootstrap.get("daily"):
        raise ValueError("Bootstrap daily bank is empty")
    for puzzle in bootstrap["daily"]:
        if not puzzle.get("id") or not puzzle.get("answers") or not puzzle.get("grid"):
            raise ValueError(f"Incomplete daily puzzle in bootstrap: {puzzle.get('id')}")

    starter = bootstrap.get("starter")
    if source.get("starter") is not None and (not starter or not starter.get("answers") or not starter.get("grid")):
        raise ValueError("Starter puzzle was not preserved in full")

    for difficulty, full_bank in (source.get("free") or {}).items():
        slim_bank = bootstrap.get("free", {}).get(difficulty, [])
        if len(slim_bank) != len(full_bank):
            raise ValueError(f"Free bank count mismatch for {difficulty}")
        for puzzle in slim_bank:
            if not puzzle.get("id") or "answers" in puzzle or "grid" in puzzle:
                raise ValueError(f"Invalid free descriptor in {difficulty}")

    if len(bootstrap.get("rescue", [])) != len(source.get("rescue") or []):
        raise ValueError("Rescue bank count mismatch")

    # Fail the build instead of silently carrying a bootstrap that no longer buys
    # meaningful startup time.
    if full_size and bootstrap_size >= full_size * 0.5:
        raise ValueError(
            f"Bootstrap is too large: {bootstrap_size} bytes vs {full_size} bytes canonical"
        )


def generate(source_path: Path, output_path: Path, check_only: bool = False) -> tuple[int, int]:
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    bootstrap = build_bootstrap(source, source_bytes)
    encoded = json.dumps(bootstrap, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    validate(source, bootstrap, len(source_bytes), len(encoded))

    if check_only:
        if not output_path.exists():
            raise ValueError(f"Bootstrap output does not exist: {output_path}")
        current = output_path.read_bytes()
        if current != encoded:
            raise ValueError("Generated bootstrap does not match canonical puzzles.json")
    else:
        output_path.write_bytes(encoded)

    return len(source_bytes), len(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the cold-start Proplet puzzle bootstrap")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    full_size, bootstrap_size = generate(args.source, args.output, args.check)
    ratio = bootstrap_size / full_size if full_size else 0
    mode = "checked" if args.check else "generated"
    print(
        f"puzzles bootstrap {mode}: {bootstrap_size:,} B / {full_size:,} B "
        f"({ratio:.1%} of canonical)"
    )


if __name__ == "__main__":
    main()
