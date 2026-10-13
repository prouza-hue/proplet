"""Pinned Archive catalogue and finite editorial solution allowlist.

No dictionary/frequency service can extend these covers at runtime. Loading
checks the original bytes, board identities and all complete covers. Rewards
remain the existing atomic G1–G3 ledger's responsibility.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
from functools import lru_cache
import gzip
import hashlib
import json
from pathlib import Path
import unicodedata

EDITION = "free-gen3-v1"
REVISION = "g3-reviewed-covers-20261008-r3"
REWARDS = {"easy": 15, "medium": 25, "hard": 50, "hardcore": 100}


def normalized_word(value: str) -> str:
    return unicodedata.normalize("NFC", value).strip().upper()


def trace_key(trace: dict) -> tuple:
    return normalized_word(trace["word"]), tuple(trace["path"])


def cover_key(cover: list[dict]) -> tuple:
    return tuple(sorted(trace_key(trace) for trace in cover))


def content_key(puzzle: dict) -> str:
    body = {key: puzzle[key] for key in ("rows", "cols", "mask", "letters")}
    body["answers"] = sorted(
        ({"word": answer["word"].strip().casefold(), "path": answer["path"]}
         for answer in puzzle["answers"]), key=lambda item: (item["word"], item["path"]))
    raw = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(raw.encode()).hexdigest()


def validate_cover(puzzle: dict, cover: list[dict]) -> None:
    if not isinstance(cover, list) or len(cover) != len(puzzle["answers"]):
        raise ValueError("archive-invalid-target-count")
    if sorted(len(normalized_word(a["word"])) for a in cover) != sorted(len(a["word"]) for a in puzzle["answers"]):
        raise ValueError("archive-invalid-lengths")
    active, used, words = set(puzzle["mask"]), set(), set()
    for answer in cover:
        word, path = normalized_word(answer["word"]), answer["path"]
        if (not word or word in words or not isinstance(path, list) or len(path) != len(word)
                or any(type(cell) is not int or cell not in active or cell in used for cell in path)
                or len(set(path)) != len(path)):
            raise ValueError("archive-invalid-word-path")
        if "".join(puzzle["letters"][cell] for cell in path) != word:
            raise ValueError("archive-invalid-letters")
        for previous, cell in zip(path, path[1:]):
            distance = abs(cell // puzzle["cols"] - previous // puzzle["cols"]) + abs(cell % puzzle["cols"] - previous % puzzle["cols"])
            if distance != 1:
                raise ValueError("archive-nonorthogonal-path")
        words.add(word)
        used.update(path)
    if used != active:
        raise ValueError("archive-incomplete-cover")


@lru_cache(maxsize=1)
def load_edition(root_value: str) -> dict:
    root = Path(root_value)
    base = root / "content/archives" / EDITION
    manifest = json.loads((base / "manifest.json").read_text())
    approved = json.loads((base / "approved-solutions.json").read_text())
    decisions = json.loads((base / "editorial-decisions.json").read_text())
    if (manifest["editionId"] != EDITION or approved["editionId"] != EDITION
            or approved["solutionPolicyRevision"] != REVISION
            or manifest["solutionPolicyRevision"] != REVISION
            or approved["status"] != "editorial-policy-approved"
            or approved["gameplayScope"] != "archive"):
        raise ValueError("archive-editorial-revision-mismatch")
    raw = (root / manifest["originalBank"]["path"]).read_bytes()
    blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    if blob != manifest["originalBank"]["gitBlobSha"]:
        raise ValueError("archive-original-bytes-changed")
    bank = json.loads(gzip.decompress(raw))
    rows, by_id, slots, alternatives = [], {}, set(), set()
    for row in manifest["boards"]:
        puzzle = bank
        for key in row["sourcePointer"].strip("/").split("/"):
            puzzle = puzzle[int(key)] if isinstance(puzzle, list) else puzzle[key]
        puzzle_id, difficulty, level = row["puzzleId"], row["difficulty"], row["historicalLevel"]
        slot = f"legacy-free:{difficulty}:{level}"
        if (difficulty not in REWARDS or type(level) is not int or not 1 <= level <= 200
                or puzzle["id"] != puzzle_id or puzzle["difficulty"] != difficulty
                or row["generation"] != 3 or puzzle["meta"]["contentGeneration"] != 3
                or puzzle["meta"]["level"] != level or row["rewardSlotKey"] != slot
                or row["rewardXp"] != REWARDS[difficulty]
                or puzzle_id in by_id or slot in slots or content_key(puzzle) != row["originalContentKey"]):
            raise ValueError("archive-board-identity-mismatch")
        entry = deepcopy(approved["boards"].get(puzzle_id, {
            "puzzleId": puzzle_id, "gameplayScope": "archive",
            "solutionPolicyRevision": REVISION, "solutionSets": [puzzle["answers"]],
        }))
        if (entry["puzzleId"] != puzzle_id or entry["gameplayScope"] != "archive"
                or entry["solutionPolicyRevision"] != REVISION
                or (entry.get("originalContentKey") and entry["originalContentKey"] != row["originalContentKey"])):
            raise ValueError("archive-solution-identity-mismatch")
        entry["solutionSets"].extend(deepcopy(approved.get("additionalApprovedCovers", {}).get(puzzle_id, [])))
        covers = entry["solutionSets"]
        if not covers or cover_key(covers[0]) != cover_key(puzzle["answers"]):
            raise ValueError("archive-canonical-original-mismatch")
        keys = set()
        for index, cover in enumerate(covers):
            validate_cover(puzzle, cover)
            key = cover_key(cover)
            if key in keys:
                raise ValueError("archive-duplicate-cover")
            keys.add(key)
            if index:
                alternatives.add((puzzle_id, key))
        result = {"puzzle": puzzle, "level": level, "difficulty": difficulty,
                  "rewardXp": REWARDS[difficulty], "rewardSlotKey": slot, "solutions": entry}
        rows.append(result)
        by_id[puzzle_id] = result
        slots.add(slot)
    if (len(rows) != 800 or Counter(row["difficulty"] for row in rows) != Counter({key: 200 for key in REWARDS})
            or sum(len(row["solutions"]["solutionSets"]) for row in rows) != 879):
        raise ValueError("archive-catalogue-count-mismatch")
    editorial = {(row["puzzleId"], cover_key(row["completeSolution"])) for row in decisions["decisions"]
                 if row["projectPreparationDecision"] == "approve"}
    if alternatives != editorial or len(alternatives) != 79:
        raise ValueError("archive-editorial-allowlist-mismatch")
    if set(approved["boards"]) - set(by_id) or set(approved.get("additionalApprovedCovers", {})) - set(by_id):
        raise ValueError("archive-orphan-approval")
    return {"editionId": EDITION, "solutionPolicyRevision": REVISION, "completeCovers": 879,
            "boards": rows, "byId": by_id}


def validate_completion(entry: dict, evidence: dict) -> None:
    if evidence.get("editionId") != EDITION or evidence.get("solutionPolicyRevision") != REVISION:
        raise ValueError("archive-solution-policy-mismatch")
    found = evidence.get("found")
    if not isinstance(found, list):
        raise ValueError("archive-complete-solution-required")
    validate_cover(entry["puzzle"], found)
    if cover_key(found) not in {cover_key(cover) for cover in entry["solutions"]["solutionSets"]}:
        raise ValueError("archive-unapproved-complete-solution")


def catalogue(edition: dict) -> dict:
    return {key: edition[key] for key in ("editionId", "solutionPolicyRevision", "completeCovers")} | {
        "boards": [{"puzzleId": row["puzzle"]["id"], **{key: row[key] for key in
                    ("level", "difficulty", "rewardXp", "rewardSlotKey")}} for row in edition["boards"]]}
