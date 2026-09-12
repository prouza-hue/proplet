from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "public" / "puzzles.json"
DEFAULT_OUTPUT = ROOT / "public" / "puzzles-bootstrap.json"
HEAVY_KEYS = {"free", "daily", "rescue", "legacyFree", "previousDaily"}
DESCRIPTOR_KEYS = ("id", "difficulty", "meta")
PUZZLE_PAYLOAD_KEYS = ("answers", "letters", "mask", "rows", "cols")
BOOTSTRAP_DAYS_BEHIND = 1
BOOTSTRAP_DAYS_AHEAD = 8


def descriptor(puzzle: dict) -> dict:
    return {key: puzzle[key] for key in DESCRIPTOR_KEYS if key in puzzle}


def is_playable_puzzle(puzzle: object) -> bool:
    if not isinstance(puzzle, dict) or not puzzle.get("id"):
        return False
    answers = puzzle.get("answers")
    letters = puzzle.get("letters")
    mask = puzzle.get("mask")
    rows = puzzle.get("rows")
    cols = puzzle.get("cols")
    if not isinstance(answers, list) or not answers:
        return False
    if not isinstance(letters, list) or not isinstance(mask, list):
        return False
    if not isinstance(rows, int) or not isinstance(cols, int) or rows <= 0 or cols <= 0:
        return False
    return len(letters) == rows * cols and bool(mask)


def parse_iso(value: str) -> date:
    return date.fromisoformat(value)


def day_offset(iso: str, base: str) -> int:
    return (parse_iso(iso) - parse_iso(base)).days


def active_daily_bank(source: dict, iso: str) -> tuple[list[dict], str]:
    active = source.get("daily") or []
    gen4_from = source.get("dailyGeneration4From") or (source.get("release") or {}).get("dailyGeneration4From")
    if gen4_from and iso >= gen4_from:
        bank = [puzzle for puzzle in active if int((puzzle.get("meta") or {}).get("contentGeneration", 4)) == 4]
        return bank, source.get("dailyRotationBaseDate") or gen4_from

    # Bootstrap is deliberately scoped to current/future Gen4 play. If a build is
    # somehow generated before the Gen4 switch, fail and use the canonical path.
    raise ValueError(f"Bootstrap window starts before active Gen4 daily content: {iso}")


def daily_puzzle_id(source: dict, iso: str) -> str:
    bank, base = active_daily_bank(source, iso)
    if not bank:
        raise ValueError("Active Daily bank is empty")
    index = day_offset(iso, base) % len(bank)
    puzzle_id = bank[index].get("id")
    if not puzzle_id:
        raise ValueError(f"Daily puzzle has no id for {iso}")
    return puzzle_id


def build_bootstrap(source: dict, source_bytes: bytes, today: date | None = None) -> dict:
    if int(source.get("version", 0)) not in {9, 10, 11}:
        raise ValueError("Unsupported puzzle database version")
    if int(source.get("contentGeneration", 0)) != 4 or int(source.get("dailyGeneration", 0)) != 4:
        raise ValueError("Bootstrap generation requires Gen4 content and daily banks")

    today = today or datetime.now(ZoneInfo("Europe/Prague")).date()
    valid_from = today - timedelta(days=BOOTSTRAP_DAYS_BEHIND)
    valid_through = today + timedelta(days=BOOTSTRAP_DAYS_AHEAD)
    full_daily_ids = {
        daily_puzzle_id(source, (valid_from + timedelta(days=offset)).isoformat())
        for offset in range((valid_through - valid_from).days + 1)
    }

    bootstrap = {key: value for key, value in source.items() if key not in HEAVY_KEYS}
    bootstrap["bootstrapSchema"] = 1
    bootstrap["bootstrapValidFrom"] = valid_from.isoformat()
    bootstrap["bootstrapValidThrough"] = valid_through.isoformat()
    bootstrap["bootstrapSource"] = {
        "sha256": hashlib.sha256(source_bytes).hexdigest(),
        "version": source.get("version"),
        "contentGeneration": source.get("contentGeneration"),
        "dailyGeneration": source.get("dailyGeneration"),
        "generatedAt": source.get("generatedAt"),
        "freeGeneration": source.get("freeGeneration"),
        "dailyGeneration4From": source.get("dailyGeneration4From"),
    }

    # Preserve Daily ordering and metadata so the canonical rotation math is
    # unchanged. Only puzzles reachable during the bootstrap validity window keep
    # their full board payload; all other Daily entries become light descriptors.
    bootstrap["daily"] = [
        puzzle if puzzle.get("id") in full_daily_ids else descriptor(puzzle)
        for puzzle in (source.get("daily") or [])
    ]
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
    valid_from = bootstrap.get("bootstrapValidFrom")
    valid_through = bootstrap.get("bootstrapValidThrough")
    if not valid_from or not valid_through or valid_from > valid_through:
        raise ValueError("Invalid bootstrap date window")

    daily = bootstrap.get("daily") or []
    canonical_daily = source.get("daily") or []
    if len(daily) != len(canonical_daily):
        raise ValueError("Daily bank count changed in bootstrap")
    if [p.get("id") for p in daily] != [p.get("id") for p in canonical_daily]:
        raise ValueError("Daily bank ordering changed in bootstrap")

    cursor = parse_iso(valid_from)
    end = parse_iso(valid_through)
    by_id = {puzzle.get("id"): puzzle for puzzle in daily}
    while cursor <= end:
        puzzle_id = daily_puzzle_id(source, cursor.isoformat())
        if not is_playable_puzzle(by_id.get(puzzle_id)):
            raise ValueError(f"Bootstrap Daily is not playable for {cursor.isoformat()}: {puzzle_id}")
        cursor += timedelta(days=1)

    starter = bootstrap.get("starter")
    if source.get("starter") is not None and not is_playable_puzzle(starter):
        raise ValueError("Starter puzzle was not preserved in full")

    for difficulty, full_bank in (source.get("free") or {}).items():
        slim_bank = bootstrap.get("free", {}).get(difficulty, [])
        if len(slim_bank) != len(full_bank):
            raise ValueError(f"Free bank count mismatch for {difficulty}")
        for puzzle in slim_bank:
            if not puzzle.get("id") or any(key in puzzle for key in PUZZLE_PAYLOAD_KEYS):
                raise ValueError(f"Invalid free descriptor in {difficulty}")

    if len(bootstrap.get("rescue", [])) != len(source.get("rescue") or []):
        raise ValueError("Rescue bank count mismatch")
    for puzzle in bootstrap.get("rescue", []):
        if not puzzle.get("id") or any(key in puzzle for key in PUZZLE_PAYLOAD_KEYS):
            raise ValueError("Invalid rescue descriptor")

    # Fail the build instead of silently carrying a bootstrap that no longer buys
    # meaningful startup time.
    if full_size and bootstrap_size >= full_size * 0.35:
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
