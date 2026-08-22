#!/usr/bin/env python3
"""Build a non-playable content catalog and reproducible cold legacy archive.

The runtime may stop shipping old puzzle bodies only after result lineage is
backfilled. This tool prepares the immutable evidence without changing the
source file. Pruning is opt-in and writes to a different path.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re


LEGACY_RUNTIME_KEYS = {"legacyFree", "legacyDaily", "previousDaily"}
GENERATION_ID = re.compile(r"(?:^|[-_])g(?:en)?(\d+)(?:[-_]|$)", re.IGNORECASE)


def norm(value: object) -> str:
    return str(value or "").strip().casefold()


def puzzle_hash(puzzle: dict) -> str:
    body = {
        "rows": puzzle.get("rows"),
        "cols": puzzle.get("cols"),
        "mask": puzzle.get("mask"),
        "letters": puzzle.get("letters"),
        "answers": sorted(
            ({"word": norm(answer.get("word")), "path": answer.get("path")} for answer in puzzle.get("answers") or []),
            key=lambda item: (item["word"], item["path"]),
        ),
    }
    raw = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def infer_generation(puzzle: dict, path: tuple[str, ...], root: dict) -> int | None:
    meta = puzzle.get("meta") or {}
    value = meta.get("contentGeneration") or meta.get("generation")
    if value is not None:
        try:
            return int(value)
        except (TypeError, ValueError):
            pass
    match = GENERATION_ID.search(str(puzzle.get("id") or ""))
    if match:
        return int(match.group(1))
    joined = "/".join(path).casefold()
    for generation in range(1, 10):
        if f"gen{generation}" in joined or f"generation{generation}" in joined:
            return generation
    if path and path[0] == "free":
        return int(root.get("freeGeneration") or 0) or None
    if path and path[0] == "daily":
        return int(root.get("dailyGeneration") or 0) or None
    return None


def infer_bank(path: tuple[str, ...]) -> str:
    joined = "/".join(path).casefold()
    if "rolling" in joined:
        return "rolling"
    if "daily" in joined:
        return "daily"
    if "starter" in joined:
        return "starter"
    if "rescue" in joined:
        return "rescue"
    if "free" in joined:
        return "free"
    return path[0] if path else "unknown"


def iter_puzzles(node: object, path: tuple[str, ...] = ()):
    if isinstance(node, list):
        for index, value in enumerate(node):
            yield from iter_puzzles(value, path + (str(index),))
        return
    if not isinstance(node, dict):
        return
    if node.get("letters") and node.get("answers"):
        yield path, node
        return
    for key, value in node.items():
        yield from iter_puzzles(value, path + (str(key),))


def iter_metadata_tombstones(
    node: object,
    path: tuple[str, ...] = (),
    inherited: dict | None = None,
):
    """Yield archived ID-only records while retaining parent generation metadata."""
    inherited = dict(inherited or {})
    if isinstance(node, list):
        for index, value in enumerate(node):
            yield from iter_metadata_tombstones(value, path + (str(index),), inherited)
        return
    if not isinstance(node, dict):
        return
    for key in ("generation", "generationKey", "rotationBaseDate", "activeFrom", "activeUntil"):
        if node.get(key) is not None:
            inherited[key] = node.get(key)
    if (
        node.get("id")
        and node.get("difficulty") in {"easy", "medium", "hard", "hardcore", "rescue"}
        and not (node.get("letters") and node.get("answers"))
    ):
        yield path, node, inherited
        return
    for key, value in node.items():
        yield from iter_metadata_tombstones(value, path + (str(key),), inherited)


def context(path: tuple[str, ...], puzzle: dict, root: dict) -> dict:
    meta = puzzle.get("meta") or {}
    difficulty = puzzle.get("difficulty")
    if not difficulty:
        difficulty = next((part for part in path if part in {"easy", "medium", "hard", "hardcore"}), None)
    slot = meta.get("level") or puzzle.get("level")
    if slot is None and path and path[-1].isdigit():
        slot = int(path[-1]) + 1
    return {
        "puzzleId": puzzle.get("id"),
        "generation": infer_generation(puzzle, path, root),
        "bank": infer_bank(path),
        "difficulty": difficulty,
        "slot": slot,
        "sourcePath": "/".join(path),
    }


def tombstone_context(path: tuple[str, ...], puzzle: dict, root: dict, inherited: dict) -> dict:
    ctx = context(path, puzzle, root)
    if inherited.get("generation") is not None:
        ctx["generation"] = int(inherited["generation"])
    ctx["reason"] = "metadata-only-source"
    return ctx


def cold_copy(source: Path, destination: Path) -> dict:
    raw = source.read_bytes()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as raw_handle:
        handle = gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=raw_handle, mtime=0)
        try:
            handle.write(raw)
        finally:
            handle.close()
    packed = destination.read_bytes()
    return {
        "source": str(source),
        "archive": str(destination),
        "sourceBytes": len(raw),
        "archiveBytes": len(packed),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "archiveSha256": hashlib.sha256(packed).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--rolling", type=Path)
    parser.add_argument("--active-source", type=Path)
    parser.add_argument("--active-rolling", type=Path)
    parser.add_argument("--source-commit")
    parser.add_argument("--source-blob")
    parser.add_argument("--rolling-blob")
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--cold-dir", type=Path, required=True)
    parser.add_argument("--pruned-runtime", type=Path)
    args = parser.parse_args()

    root = json.loads(args.source.read_text(encoding="utf-8"))
    sources: list[tuple[str, Path, dict, bool]] = [("puzzles", args.source, root, True)]
    if args.rolling:
        rolling = json.loads(args.rolling.read_text(encoding="utf-8"))
        sources.append(("rolling", args.rolling, rolling, True))
    if args.active_source:
        active = json.loads(args.active_source.read_text(encoding="utf-8"))
        sources.append(("active", args.active_source, active, False))
    if args.active_rolling:
        active_rolling = json.loads(args.active_rolling.read_text(encoding="utf-8"))
        sources.append(("active-rolling", args.active_rolling, active_rolling, False))

    records: dict[str, dict] = {}
    duplicate_contexts = 0
    for source_name, _, payload, _ in sources:
        for path, puzzle in iter_puzzles(payload, (source_name,)):
            digest = puzzle_hash(puzzle)
            content_key = f"sha256:{digest}"
            ctx = context(path, puzzle, root)
            record = records.setdefault(content_key, {
                "contentKey": content_key,
                "sha256": digest,
                "rows": puzzle.get("rows"),
                "cols": puzzle.get("cols"),
                "activeCells": len(puzzle.get("mask") or []),
                "targetCount": len(puzzle.get("answers") or []),
                "contexts": [],
            })
            if ctx not in record["contexts"]:
                if record["contexts"]:
                    duplicate_contexts += 1
                record["contexts"].append(ctx)

    body_ids = {
        str(ctx.get("puzzleId"))
        for record in records.values()
        for ctx in record["contexts"]
        if ctx.get("puzzleId")
    }
    tombstones: dict[tuple, dict] = {}
    for source_name, _, payload, _ in sources:
        for path, puzzle, inherited in iter_metadata_tombstones(payload, (source_name,)):
            puzzle_id = str(puzzle.get("id") or "")
            if not puzzle_id or puzzle_id in body_ids:
                continue
            ctx = tombstone_context(path, puzzle, root, inherited)
            key = (
                puzzle_id,
                ctx.get("generation"),
                ctx.get("bank"),
                ctx.get("difficulty"),
                ctx.get("slot"),
            )
            tombstones[key] = ctx

    archives = []
    for source_name, source_path, _, cold_archive in sources:
        if cold_archive:
            archive = cold_copy(source_path, args.cold_dir / f"{source_name}.json.gz")
            archive["repository"] = "prouza-hue/proplet"
            archive["sourceCommit"] = args.source_commit
            archive["sourceBlob"] = args.source_blob if source_name == "puzzles" else args.rolling_blob
            archives.append(archive)

    generations: Counter[str] = Counter()
    banks: Counter[str] = Counter()
    for record in records.values():
        for ctx in record["contexts"]:
            generations[str(ctx.get("generation") or "unknown")] += 1
            banks[str(ctx.get("bank") or "unknown")] += 1

    catalog = {
        "version": 1,
        "kind": "proplet-non-playable-content-catalog",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "contentCount": len(records),
        "contextCount": sum(len(record["contexts"]) for record in records.values()),
        "tombstoneCount": len(tombstones),
        "duplicateContexts": duplicate_contexts,
        "generationContexts": dict(sorted(generations.items())),
        "bankContexts": dict(sorted(banks.items())),
        "coldArchives": archives,
        "tombstones": sorted(
            tombstones.values(),
            key=lambda item: (
                int(item.get("generation") or 0),
                str(item.get("bank") or ""),
                str(item.get("puzzleId") or ""),
            ),
        ),
        "content": sorted(records.values(), key=lambda record: record["contentKey"]),
    }
    args.catalog.parent.mkdir(parents=True, exist_ok=True)
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.pruned_runtime:
        pruned = deepcopy(root)
        for key in LEGACY_RUNTIME_KEYS:
            pruned.pop(key, None)
        pruned.setdefault("archive", {})["catalogVersion"] = catalog["version"]
        pruned["archive"]["legacyPuzzleBodiesInRuntime"] = False
        args.pruned_runtime.parent.mkdir(parents=True, exist_ok=True)
        args.pruned_runtime.write_text(json.dumps(pruned, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(json.dumps({
        "catalog": str(args.catalog),
        "contentCount": catalog["contentCount"],
        "contextCount": catalog["contextCount"],
        "tombstoneCount": catalog["tombstoneCount"],
        "coldArchives": archives,
        "prunedRuntime": str(args.pruned_runtime) if args.pruned_runtime else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
