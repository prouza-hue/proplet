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
    "data/puzzles.json": (2_815_720, "51370983c0f8a831f2706eaf45b6130e44666fe4aa8e57e309868766475ee53a"),
    "public/puzzles.json": (2_817_259, "09b2f3a4545ac1504de0e618a6bfa657f04c0d72f324dfb2b2eadff1b73504c7"),
    "data/archive/v3.33.5/puzzles.json.gz": (719_689, "b1754c1714827654cf308c3e4042fda119396fba2ebdb3439ca68c9bc670e5d0"),
    "data/words.txt": (112_061, "0ce6845aea800582202a618c7da95a16d8eaf3e43921afd1c2d77d718d835047"),
    "public/valid-words-v3328.txt": (112_061, "0ce6845aea800582202a618c7da95a16d8eaf3e43921afd1c2d77d718d835047"),
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
assert server["daily"] == public["daily"][:365]
assert public["daily"][365]["id"] == "g3-d-007"

server_without_daily = dict(server)
public_without_daily = dict(public)
server_without_daily.pop("daily")
public_without_daily.pop("daily")
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
assert canonical_json(rebuilt) == public_raw
assert (ROOT / "data/words.txt").read_bytes() == (ROOT / "public/valid-words-v3328.txt").read_bytes()

print("Sprint 14 content characterization: PASS")
