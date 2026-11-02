"""Append the reviewed Gen6 expansion without migrating any player identities.

Run only after the bank's independent and editorial reviews are complete. This
binds content files; it never contacts a database or publishes a deployment.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import date
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor", "mozkokalypsa")
BATCH = "free-expansion-600-20261102"
DEFAULT_BANK = ROOT / "content/gen6" / BATCH / "bank.json"
PREFIX = "g6-expansion-"


def encoded(value, *, pretty=False):
    return (json.dumps(value, ensure_ascii=False, indent=2 if pretty else None,
                       separators=None if pretty else (",", ":")) + "\n").encode("utf-8")


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def read(path):
    return json.loads(path.read_bytes())


def record_bytes(record, raw):
    record.update(sha256=hashlib.sha256(raw).hexdigest(), sizeBytes=len(raw),
                  gitBlob=hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest())


def integrate(bank_path=DEFAULT_BANK, available_from="2026-11-02"):
    date.fromisoformat(available_from)
    bank = read(bank_path)
    boards = bank["boards"]
    assert bank["contentHash"] == digest(boards), "Manufactured bank hash mismatch"
    independent = read(bank_path.parent / "independent-verification.json")
    editorial = read(bank_path.parent / "editorial-review.json")
    assert independent["allPassed"] and independent["contentHash"] == bank["contentHash"]
    assert editorial["allAccepted"] and editorial["contentHash"] == bank["contentHash"]
    assert {r["id"] for r in independent["checks"]} == {p["id"] for p in boards}
    assert set(editorial["boards"]) == {p["id"] for p in boards}
    assert bank["runtimeGeneration"] == 4 and bank["generatorGeneration"] == 6
    assert len(boards) == 600 and len({p["id"] for p in boards}) == 600
    additions = {d: [p for p in boards if p["difficulty"] == d] for d in DIFFICULTIES}
    assert all(len(items) == 100 for items in additions.values())
    source_path, public_path = ROOT / "data/puzzles.json", ROOT / "public/puzzles.json"
    source, public = read(source_path), read(public_path)
    assert source["free"] == public["free"]
    assert source["contentGeneration"] == source["freeGeneration"] == 4
    assert not any(p["id"].startswith(PREFIX) for items in source["free"].values() for p in items), "Expansion already bound"
    existing_ids = {p["id"] for items in source["free"].values() for p in items}
    reserved = read(ROOT / "data/rolling_content_v1.json")
    existing_ids.update(p["id"] for items in reserved.get("puzzles", {}).values() for p in items)
    assert not existing_ids.intersection(p["id"] for p in boards)
    routes_path = ROOT / "public/content/free-order/shared-pestre-v3.json"
    routes = read(routes_path)
    changed_top = {"free", "freeLevelCounts", "mozkomorUnlock", "freeExpansionRelease"}
    baseline = {
        "sourceMain": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "batchId": BATCH,
        "manufacturedContentHash": bank["contentHash"],
        "free": {d: digest(source["free"][d]) for d in DIFFICULTIES},
        "counts": {d: len(source["free"][d]) for d in DIFFICULTIES},
        "maxLevels": {d: max(p["meta"]["level"] for p in source["free"][d]) for d in DIFFICULTIES},
        "preserved": {k: digest(v) for k, v in source.items() if k not in changed_top},
        "publicPreserved": {k: digest(v) for k, v in public.items() if k not in changed_top},
        "mozkomorUnlock": deepcopy(source["mozkomorUnlock"]),
        "routePrefixes": {d: {"count": len(routes["routes"][d]), "hash": digest(routes["routes"][d])} for d in DIFFICULTIES},
        "rollingSha256": hashlib.sha256((ROOT / "data/rolling_content_v1.json").read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
    }
    released = {}
    for difficulty, items in additions.items():
        assert [p["id"] for p in items] == [f"{PREFIX}{difficulty}-{i:03}" for i in range(1, 101)]
        first_level = baseline["maxLevels"][difficulty] + 1
        assert [p["meta"]["level"] for p in items] == list(range(first_level, first_level + 100))
        released[difficulty] = deepcopy(items)
        for p in released[difficulty]:
            assert p["meta"]["contentGeneration"] == 4 and p["meta"]["generatorGeneration"] == 6
            # Search alternatives and solver traces belong to the immutable
            # authoring bank, not every player's downloaded runtime payload.
            p["meta"].pop("manufacture", None)
            p["meta"].update(releaseCandidate=False, candidateOnly=False, playtestOnly=False,
                             releaseBatch=BATCH, availableFrom=available_from,
                             editorialStatus="ai-reviewed")
        for data in (source, public):
            data["free"][difficulty].extend(deepcopy(released[difficulty]))
            data["freeLevelCounts"][difficulty] = len(data["free"][difficulty])
        routes["routes"][difficulty].extend(p["id"] for p in released[difficulty])
        routes["counts"][difficulty] = len(source["free"][difficulty])
    release = dict(batchId=BATCH, availableFrom=available_from, generatorGeneration=6,
                   runtimeFreeGeneration=4, manufacturedContentHash=bank["contentHash"],
                   releasedContentHash=digest([p for d in DIFFICULTIES for p in released[d]]),
                   newLevelCounts={d: 100 for d in DIFFICULTIES}, totalNewLevels=600)
    for data in (source, public):
        data["mozkomorUnlock"]["levels"] = len(source["free"]["mozkomor"])
        data["freeExpansionRelease"] = release
    routes["asOf"] = available_from
    routes.setdefault("appendBatches", []).append(release)
    for d in DIFFICULTIES:
        assert len(routes["routes"][d]) == len(set(routes["routes"][d]))
        assert set(routes["routes"][d]) == {p["id"] for p in source["free"][d]}
    # Match canonical-build key order: public projection appends datedDaily
    # after every server source field, including this new release descriptor.
    public = {**{key: public[key] for key in source if key in public},
              **{key: value for key, value in public.items() if key not in source}}
    # Public Daily projection and server-only content remain distinct.
    source_raw, public_raw = encoded(source), encoded(public)
    manifest_path = ROOT / "content/generation-manifest.json"
    manifest = read(manifest_path)
    manifest["manifestVersion"] += 1
    manifest["generation"]["mozkomorLevels"] = len(source["free"]["mozkomor"])
    manifest["provenance"]["freeExpansionGen6"] = {
        "batchId": BATCH, "sourceMain": baseline["sourceMain"],
        "manufacturedContentHash": bank["contentHash"], "runtimeGeneration": 4,
    }
    record_bytes(manifest["canonicalBuild"]["source"], source_raw)
    record_bytes(manifest["canonicalBuild"]["output"], public_raw)
    baseline_path = bank_path.parent / "production-boundaries.json"
    assert not baseline_path.exists(), "Boundary evidence already exists"
    baseline_path.write_bytes(encoded(baseline, pretty=True))
    source_path.write_bytes(source_raw)
    public_path.write_bytes(public_raw)
    manifest_path.write_bytes(encoded(manifest, pretty=True))
    routes_path.write_bytes(encoded(routes, pretty=True))
    routes_path.with_suffix(".js").write_bytes(b"window.PROPLET_SHARED_FREE_ORDER_MANIFEST = " + encoded(routes, pretty=True).rstrip() + b";\n")
    print(json.dumps({"batchId": BATCH, "counts": source["freeLevelCounts"], "runtimeGeneration": 4}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank", type=Path, default=DEFAULT_BANK)
    parser.add_argument("--available-from", default="2026-11-02")
    args = parser.parse_args()
    integrate(args.bank, args.available_from)
