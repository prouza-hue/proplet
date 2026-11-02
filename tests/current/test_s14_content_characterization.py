"""Freeze the released content inputs, outputs, and intentional compatibility delta.

This characterization is deliberately stdlib-only and read-only.  It proves
that the current public runtime bank can be reconstructed from the canonical
server bank plus the checked-in v3.33.5 cold archive without regenerating any
puzzles.
"""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

EXPECTED_FILES = {
    "data/puzzles.json": (4679666, "aa787d7acc45d868b79d416647f72b12487790b68f8185f7af77bca7efd6f232"),
    "public/puzzles.json": (4095540, "004b623b5f4d506fa10088a46560f625673fa4d97f2ad00c18b32161fe8433d2"),
    "data/archive/v3.33.5/puzzles.json.gz": (719_689, "b1754c1714827654cf308c3e4042fda119396fba2ebdb3439ca68c9bc670e5d0"),
    "data/words.txt": (1052497, "2548973544b5a3b9ab691804635546fdf4733a464e86614e86fbd62f9d07a456"),
    "public/valid-words-v3328.txt": (1052497, "2548973544b5a3b9ab691804635546fdf4733a464e86614e86fbd62f9d07a456"),
    "data/rolling_content_v1.json": (374_393, "6e956ee5dfe26ee90e23e9c76ff86ec89b7361895c87f2dd9177ea5ea41a1a4c"),
    "data/content_catalog_v334.json": (2_466_583, "bce617335566801cb03142618cecb6f530687b8217c7b1a61d1412bb98a5e6a3"),
    "data/tajenka_weekend_v1.json": (40_393, "bf0b473149330fb882ba1bd0ad1e2b92e34b109c8ff3eed0aca779688fbce0c4"),
    "data/gen4_release_candidate_manifest_v334.json": (819, "9d71afd437300528904739a868111738a0835e0d0fe8b0138d3f3af24afdfd9b"),
}


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_json(payload: object) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


for relative_path, (expected_size, expected_hash) in EXPECTED_FILES.items():
    raw = (ROOT / relative_path).read_bytes()
    if relative_path in {"data/puzzles.json", "public/puzzles.json"}:
        # Verify the reviewed additive release before recovering the exact
        # historical bytes; all original source/output hashes stay protected.
        payload = json.loads(raw)
        expansion = payload.pop("freeExpansionRelease")
        assert expansion["batchId"] == "free-expansion-600-20261102"
        assert expansion["totalNewLevels"] == 600
        boundary = json.loads((ROOT / "content/gen6/free-expansion-600-20261102/production-boundaries.json").read_bytes())
        for difficulty, old_count in boundary["counts"].items():
            added = payload["free"][difficulty][old_count:]
            assert [p["id"] for p in added] == [f"g6-expansion-{difficulty}-{i:03d}" for i in range(1, 101)]
            assert expansion["newLevelCounts"][difficulty] == 100
            assert payload["freeLevelCounts"][difficulty] == old_count + 100
            payload["free"][difficulty] = payload["free"][difficulty][:old_count]
            payload["freeLevelCounts"][difficulty] = old_count
        payload["mozkomorUnlock"] = boundary["mozkomorUnlock"]
        raw = canonical_json(payload)
    assert len(raw) == expected_size, relative_path
    assert sha256(raw) == expected_hash, relative_path

server_raw = (ROOT / "data/puzzles.json").read_bytes()
public_raw = (ROOT / "public/puzzles.json").read_bytes()
server = json.loads(server_raw)
public = json.loads(public_raw)

assert canonical_json(server) == server_raw
assert canonical_json(public) == public_raw
assert len(server["daily"]) == 365
assert len(public["daily"]) == 366
assert server["daily"][:45] == public["daily"][:45]
for original,slim in zip(server["daily"][45:],public["daily"][45:365]):
    assert slim["id"] == original["id"]
    assert slim["meta"]["retiredFutureDaily"] is True
    assert not {"letters","answers","mask","rows","cols"}.intersection(slim)
assert public["daily"][365]["id"] == "g3-d-007"

server_without_daily = dict(server)
public_without_daily = dict(public)
server_without_daily.pop("daily")
public_without_daily.pop("daily")
assert public_without_daily.pop("datedDaily")["cutover"] == "2026-10-08"
assert server_without_daily == public_without_daily

archive_gzip = (ROOT / "data/archive/v3.33.5/puzzles.json.gz").read_bytes()
archive_raw = gzip.decompress(archive_gzip)
assert sha256(archive_raw) == "aabe0e92a48024cf375b11d77cbe7841bd5665f728f553b568128aeb0f76d79a"
archive = json.loads(archive_raw)
compatibility = next(puzzle for puzzle in archive["daily"] if puzzle.get("id") == "g3-d-007")
compatibility_raw = json.dumps(compatibility, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
assert sha256(compatibility_raw) == "0267eddd8fa930f64d7e6a21a16908d7b524a4701d477b0882d5eeec0071f375"
assert compatibility == public["daily"][365]

rebuilt = dict(server)
rebuilt["daily"] = list(server["daily"]) + [compatibility]
assert rebuilt["daily"][:45] == public["daily"][:45]
assert rebuilt["daily"][-1] == public["daily"][-1]
assert (ROOT / "data/words.txt").read_bytes() == (ROOT / "public/valid-words-v3328.txt").read_bytes()

print("Sprint 14 content characterization: PASS")

