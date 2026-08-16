from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"{label}: expected one match, got {n}")
    return text.replace(old, new, 1)


server = read("server.py")
server = replace_once(
    server,
    'PUZZLES_PATH = ROOT / "data" / "puzzles.json"\n',
    'PUZZLES_PATH = ROOT / "data" / "puzzles.json"\nROLLING_CONTENT_PATH = ROOT / "data" / "rolling_content_v1.json"\n',
    "rolling content path",
)
server = replace_once(
    server,
    '@lru_cache(maxsize=1)\ndef load_puzzles() -> dict:\n    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))\n',
    '@lru_cache(maxsize=1)\ndef load_puzzles() -> dict:\n    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))\n\n\n@lru_cache(maxsize=1)\ndef load_rolling_content() -> dict:\n    if not ROLLING_CONTENT_PATH.exists():\n        return {"version": 1, "batches": [], "puzzles": {d: [] for d in ("easy", "medium", "hard", "hardcore")}}\n    return json.loads(ROLLING_CONTENT_PATH.read_text(encoding="utf-8"))\n',
    "rolling content loader",
)
server = replace_once(
    server,
    'def released_free_bank(difficulty: str, as_of: Optional[date] = None) -> list[dict]:\n    return [p for p in load_puzzles().get("free", {}).get(difficulty, []) if is_puzzle_released(p, as_of)]\n',
    'def released_free_bank(difficulty: str, as_of: Optional[date] = None) -> list[dict]:\n    base = list(load_puzzles().get("free", {}).get(difficulty, []))\n    extras = [p for p in load_rolling_content().get("puzzles", {}).get(difficulty, []) if is_puzzle_released(p, as_of)]\n    return base + extras\n',
    "released free bank",
)
server = replace_once(
    server,
    'def _released_batches(as_of: date) -> tuple[list[dict], Optional[str]]:\n    rolling = load_puzzles().get("rollingContent") or {}\n',
    'def _released_batches(as_of: date) -> tuple[list[dict], Optional[str]]:\n    rolling = load_rolling_content()\n',
    "released batch source",
)

# The old full-bank payload helper is intentionally unused, but keep it internally coherent so
# future refactors cannot accidentally expose the reserve incorrectly.
old_payload = '''def released_puzzle_payload(as_of: date) -> dict:
    source = load_puzzles()
    payload = {k: v for k, v in source.items() if k not in {"free", "rollingContent"}}
    payload["free"] = {d: released_free_bank(d, as_of) for d in ("easy", "medium", "hard", "hardcore")}
    rolling = dict(source.get("rollingContent") or {})
    rolling.pop("batches", None)  # never ship future puzzle IDs or batch contents to clients
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    payload["rollingContent"] = rolling
    payload["contentStatus"] = {
        "asOf": as_of.isoformat(),
        "latestBatch": latest,
        "nextRelease": next_release,
        "availableFreeCounts": {d: len(payload["free"][d]) for d in ("easy", "medium", "hard", "hardcore")},
    }
    return payload
'''
new_payload = '''def released_puzzle_payload(as_of: date) -> dict:
    source = load_puzzles()
    payload = {k: v for k, v in source.items() if k != "free"}
    payload["free"] = {d: released_free_bank(d, as_of) for d in ("easy", "medium", "hard", "hardcore")}
    rolling = dict(load_rolling_content())
    rolling.pop("batches", None); rolling.pop("puzzles", None)
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    payload["rollingContent"] = rolling
    payload["contentStatus"] = {
        "asOf": as_of.isoformat(), "latestBatch": latest, "nextRelease": next_release,
        "availableFreeCounts": {d: len(payload["free"][d]) for d in ("easy", "medium", "hard", "hardcore")},
    }
    return payload
'''
server = replace_once(server, old_payload, new_payload, "internal full payload helper")

old_delta = '''def released_rolling_payload(as_of: date) -> dict:
    """Only the release-gated Free additions; the large base bank stays on the CDN."""
    source = load_puzzles()
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    additions = {
        d: [
            p for p in source.get("free", {}).get(d, [])
            if (p.get("meta") or {}).get("rollingContent") and is_puzzle_released(p, as_of)
        ]
        for d in ("easy", "medium", "hard", "hardcore")
    }
    rolling = dict(source.get("rollingContent") or {})
    rolling.pop("batches", None)
    return {
        "version": int(rolling.get("version") or 0),
        "asOf": as_of.isoformat(),
        "latestBatch": latest,
        "nextRelease": next_release,
        "puzzles": additions,
        "availableFreeCounts": {d: 200 + len(additions[d]) for d in additions},
        "meta": rolling,
    }
'''
new_delta = '''def released_rolling_payload(as_of: date) -> dict:
    """Only release-gated additions; the large v9 base bank remains a static CDN asset."""
    source = load_rolling_content()
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    additions = {
        d: [p for p in source.get("puzzles", {}).get(d, []) if is_puzzle_released(p, as_of)]
        for d in ("easy", "medium", "hard", "hardcore")
    }
    meta = {k: v for k, v in source.items() if k not in {"batches", "puzzles"}}
    base = load_puzzles().get("free", {})
    return {
        "version": int(source.get("version") or 0), "asOf": as_of.isoformat(),
        "latestBatch": latest, "nextRelease": next_release, "puzzles": additions,
        "availableFreeCounts": {d: len(base.get(d, [])) + len(additions[d]) for d in additions},
        "meta": meta,
    }
'''
server = replace_once(server, old_delta, new_delta, "rolling delta source")

# Resolve 201+ IDs for result sanity, XP slot claims and leaderboards. Future IDs are resolvable
# internally, while puzzle_exists/result submission still enforce the actual Prague release date.
needle = '''    # Newest archived bank is appended last. This is the best possible mapping for
    # a handful of IDs that had already been reused before Gen2 introduced unique IDs.
'''
rolling_search = '''    reserve = load_rolling_content()
    for diff in difficulties:
        for puzzle in reserve.get("puzzles", {}).get(diff, []):
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {
                    "puzzle": puzzle, "difficulty": diff, "mode": "free",
                    "level": int(meta.get("level") or 0),
                    "generation": int(meta.get("contentGeneration") or 2),
                    "legacy": False, "rolling": True,
                }
    # Newest archived bank is appended last. This is the best possible mapping for
    # a handful of IDs that had already been reused before Gen2 introduced unique IDs.
'''
server = replace_once(server, needle, rolling_search, "free puzzle reserve lookup")
server = replace_once(
    server,
    '    puzzle_data = load_puzzles()\n    maximum_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) for key in difficulties}\n',
    '    puzzle_data = load_puzzles(); reserve = load_rolling_content()\n    maximum_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) + len(reserve.get("puzzles", {}).get(key, [])) for key in difficulties}\n',
    "free slot maximum levels",
)

old_exists = '''    if any(p["id"] == puzzle_id for p in data["free"].get(difficulty, [])):
        return True
    # Keep queued results from older Hard banks syncable after the v3.3 puzzle upgrade.
    return any(p["id"] == puzzle_id for p in data.get("legacyFree", {}).get(difficulty, []))
'''
new_exists = '''    info = free_puzzle_info(puzzle_id, difficulty)
    if info and info.get("legacy") is not True:
        # Never let a guessed future reserve ID enter telemetry/results before its real release.
        return is_puzzle_released(info.get("puzzle") or {}, current_prague_date())
    # Keep queued results from older Hard banks syncable after the v3.3 puzzle upgrade.
    return bool(info and info.get("legacy") is True)
'''
server = replace_once(server, old_exists, new_exists, "release-aware puzzle exists")

# Played-level history and totals use only content that has actually been released to this request.
server = replace_once(
    server,
    '    data = load_puzzles()\n    bank = sorted(data.get("free", {}).get(difficulty, []), key=lambda p: int((p.get("meta") or {}).get("level") or 9999))\n',
    '    data = load_puzzles()\n    bank = sorted(released_free_bank(difficulty, effective_content_date(request)), key=lambda p: int((p.get("meta") or {}).get("level") or 9999))\n',
    "played levels released bank",
)
server = replace_once(
    server,
    'return {"difficulty": difficulty, "total": sum(1 for p in bank if is_puzzle_released(p, effective_content_date(request))), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}',
    'return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}',
    "played levels total",
)

# Health must report the separate reserve rather than looking for metadata in the unchanged base DB.
server = replace_once(
    server,
    '        "rollingContentVersion": int((data.get("rollingContent") or {}).get("version") or 0),\n        "rollingContentCadence": (data.get("rollingContent") or {}).get("cadence"),\n        "rollingContentFirstRelease": (data.get("rollingContent") or {}).get("firstRelease"),\n        "rollingContentReservedThrough": (data.get("rollingContent") or {}).get("reservedThrough"),\n',
    '        "rollingContentVersion": int(load_rolling_content().get("version") or 0),\n        "rollingContentCadence": load_rolling_content().get("cadence"),\n        "rollingContentFirstRelease": load_rolling_content().get("firstRelease"),\n        "rollingContentReservedThrough": load_rolling_content().get("reservedThrough"),\n',
    "health reserve metadata",
)
write("server.py", server)


app = read("public/app.js")
app = replace_once(app, "const EXPECTED_PUZZLE_DB_VERSION=10;", "const EXPECTED_PUZZLE_DB_VERSION=9;", "base DB version stays v9")
write("public/app.js", app)

print("v3.30 separate rolling store finalized")
