#!/usr/bin/env python3
"""Build authoring-only Tajenka v2 board candidates.

This adapter deliberately does not touch data/tajenka_weekend_v1.json and is not
imported by runtime. It consumes editorial-approved Tajenka v2 content, places
only anchor words on a 6x6 board, and treats companion text as display metadata.

The geometry is derived from the current Tajenka builder, but v2 adds:
- 4/5-anchor support for explicitly immutable source text;
- length-aware path curvature;
- 24-31 target-letter budgets;
- adaptive 3-8 decoy density;
- scaled topology gates for four-anchor boards.

A generated candidate is authoring output only until it passes the production
lexicon/ambiguity validator and is explicitly promoted.
"""

from __future__ import annotations

import argparse
import itertools
import json
import math
import random
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content" / "tajenka-v2"
LEXICON = ROOT / "data" / "lexicon_v2.json"
OVERLAY = CONTENT_DIR / "lexicon-overlay.json"
DEFAULT_OUTPUT = CONTENT_DIR / "generated-board-candidates.json"
ROWS = COLS = 6

SHARDS = (
    "editorial-observation.json",
    "editorial-fact.json",
    "editorial-czech.json",
    "editorial-proverb.json",
    "editorial-quote.json",
)


def neighbours(cell: int) -> list[int]:
    row, col = divmod(cell, COLS)
    result = []
    for dr, dc in ((-1, 0), (0, 1), (1, 0), (0, -1)):
        nr, nc = row + dr, col + dc
        if 0 <= nr < ROWS and 0 <= nc < COLS:
            result.append(nr * COLS + nc)
    return result


def direction(a: int, b: int) -> tuple[int, int]:
    ar, ac = divmod(a, COLS)
    br, bc = divmod(b, COLS)
    return br - ar, bc - ac


def turns(path: list[int] | tuple[int, ...]) -> int:
    dirs = [direction(a, b) for a, b in zip(path, path[1:])]
    return sum(a != b for a, b in zip(dirs, dirs[1:]))


def longest_run(path: list[int] | tuple[int, ...]) -> int:
    dirs = [direction(a, b) for a, b in zip(path, path[1:])]
    if not dirs:
        return 0
    longest = current = 1
    for previous, current_dir in zip(dirs, dirs[1:]):
        current = current + 1 if previous == current_dir else 1
        longest = max(longest, current)
    return longest


def quadrant(cell: int) -> int:
    row, col = divmod(cell, COLS)
    return (2 if row >= ROWS // 2 else 0) + (1 if col >= COLS // 2 else 0)


def min_turns_for_length(length: int) -> int:
    if length <= 4:
        return 1
    if length <= 8:
        return 2
    return 3


@lru_cache(maxsize=None)
def winding_paths(length: int) -> tuple[tuple[int, ...], ...]:
    """Enumerate visibly winding self-avoiding paths for one word length."""
    required_turns = min_turns_for_length(length)
    result: list[tuple[int, ...]] = []
    for start in range(ROWS * COLS):
        path = [start]
        used = {start}

        def visit() -> None:
            if len(path) == length:
                if turns(path) >= required_turns and len({quadrant(cell) for cell in path}) >= 2:
                    result.append(tuple(path))
                return
            previous_direction = direction(path[-2], path[-1]) if len(path) >= 2 else None
            for cell in neighbours(path[-1]):
                if cell in used:
                    continue
                next_direction = direction(path[-1], cell)
                if previous_direction == next_direction:
                    continue
                path.append(cell)
                used.add(cell)
                visit()
                used.remove(cell)
                path.pop()

        visit()
    return tuple(result)


def topology_stats(paths: list[list[int]]) -> dict:
    owners = {cell: owner for owner, path in enumerate(paths) for cell in path}
    edges: list[tuple[int, int, int, int]] = []
    pairs: set[tuple[int, int]] = set()
    non_sequential = 0
    for cell, owner in owners.items():
        for other in neighbours(cell):
            if cell >= other or other not in owners or owners[other] == owner:
                continue
            other_owner = owners[other]
            pairs.add(tuple(sorted((owner, other_owner))))
            edges.append((cell, other, owner, other_owner))
            if abs(owner - other_owner) > 1:
                non_sequential += 1
    sequential_boundaries = sum(
        int(paths[index + 1][0] in neighbours(paths[index][-1]))
        for index in range(len(paths) - 1)
    )
    quadrant_crossers = sum(len({quadrant(cell) for cell in path}) >= 2 for path in paths)
    pair_degrees = [sum(index in pair for pair in pairs) for index in range(len(paths))]
    return {
        "crossWordEdges": len(edges),
        "crossWordPairs": len(pairs),
        "nonSequentialEdges": non_sequential,
        "sequentialBoundaries": sequential_boundaries,
        "quadrantCrossers": quadrant_crossers,
        "minWordContacts": min(pair_degrees),
        "wordContactDegrees": pair_degrees,
    }


def topology_score(paths: list[list[int]]) -> float:
    stats = topology_stats(paths)
    return (
        stats["crossWordEdges"] * 2.0
        + stats["crossWordPairs"] * 6.0
        + stats["nonSequentialEdges"] * 4.5
        + stats["quadrantCrossers"] * 1.5
        - stats["sequentialBoundaries"] * 18.0
    )


def topology_limits(word_count: int) -> dict[str, int]:
    if word_count == 5:
        return {
            "crossWordEdges": 13,
            "crossWordPairs": 7,
            "nonSequentialEdges": 8,
            "sequentialBoundaries": 1,
            "quadrantCrossers": 3,
            "minWordContacts": 2,
        }
    if word_count == 4:
        return {
            "crossWordEdges": 10,
            "crossWordPairs": 5,
            "nonSequentialEdges": 5,
            "sequentialBoundaries": 1,
            "quadrantCrossers": 3,
            "minWordContacts": 2,
        }
    raise ValueError(f"Unsupported Tajenka v2 anchor count: {word_count}")


def topology_acceptable(paths: list[list[int]]) -> bool:
    stats = topology_stats(paths)
    limits = topology_limits(len(paths))
    return (
        stats["crossWordEdges"] >= limits["crossWordEdges"]
        and stats["crossWordPairs"] >= limits["crossWordPairs"]
        and stats["nonSequentialEdges"] >= limits["nonSequentialEdges"]
        and stats["sequentialBoundaries"] <= limits["sequentialBoundaries"]
        and stats["quadrantCrossers"] >= limits["quadrantCrossers"]
        and stats["minWordContacts"] >= limits["minWordContacts"]
    )


def spelling_paths(word: str, letters: list[str], mask: set[int], limit: int = 200) -> list[tuple[int, ...]]:
    found: list[tuple[int, ...]] = []
    for start in sorted(mask):
        if letters[start] != word[0]:
            continue
        path = [start]
        used = {start}

        def visit(offset: int) -> None:
            if len(found) >= limit:
                return
            if offset == len(word):
                found.append(tuple(path))
                return
            for cell in neighbours(path[-1]):
                if cell in used or cell not in mask or letters[cell] != word[offset]:
                    continue
                path.append(cell)
                used.add(cell)
                visit(offset + 1)
                used.remove(cell)
                path.pop()

        visit(1)
    return found


def load_prefixes() -> dict[int, set[str]]:
    payload = json.loads(LEXICON.read_text(encoding="utf-8"))
    words = {
        str(entry.get("word") or "").strip().upper()
        for entry in payload.get("entries", [])
        if entry.get("review") == "approved" and len(str(entry.get("word") or "").strip()) >= 3
    }
    if OVERLAY.exists():
        overlay = json.loads(OVERLAY.read_text(encoding="utf-8"))
        words.update(str(word).strip().upper() for word in overlay.get("entries", []) if len(str(word).strip()) >= 3)
    return {depth: {word[:depth] for word in words if len(word) > depth} for depth in (2, 3)}


def plausible_prefix_paths(letters: list[str], mask: set[int], depth: int, prefixes: dict[int, set[str]]) -> set[tuple[int, ...]]:
    valid = prefixes[depth]
    found: set[tuple[int, ...]] = set()
    initial_letters = {prefix[0] for prefix in valid}
    for start in mask:
        if letters[start] not in initial_letters:
            continue
        path = [start]
        used = {start}

        def visit() -> None:
            text = "".join(letters[cell] for cell in path)
            if not any(prefix.startswith(text) for prefix in valid):
                return
            if len(path) == depth:
                if text in valid:
                    found.add(tuple(path))
                return
            for cell in neighbours(path[-1]):
                if cell in mask and cell not in used:
                    path.append(cell)
                    used.add(cell)
                    visit()
                    used.remove(cell)
                    path.pop()

        visit()
    return found


def branch_stats(words: list[str], paths: list[list[int]], letters: list[str], mask: set[int], decoys: set[int], prefixes: dict[int, set[str]]) -> dict:
    legitimate = {depth: {tuple(path[:depth]) for path in paths if len(path) >= depth} for depth in (2, 3)}
    prefix_paths = {
        depth: plausible_prefix_paths(letters, mask, depth, prefixes) - legitimate[depth]
        for depth in (2, 3)
    }
    meaningful_decoys: set[int] = set()
    alternative_words: dict[str, int] = {}
    for depth in (2, 3):
        for candidate in prefix_paths[depth]:
            meaningful_decoys.update(set(candidate) & decoys)
    for word, official in zip(words, paths):
        full = spelling_paths(word, letters, mask)
        alternative_words[word] = sum(candidate != tuple(official) for candidate in full)
    false_start_cells = {path[0] for depth in (2, 3) for path in prefix_paths[depth]}
    false_prefix_families = {
        "".join(letters[cell] for cell in path)
        for depth in (2, 3)
        for path in prefix_paths[depth]
    }
    return {
        "falsePrefixes2": len(prefix_paths[2]),
        "falsePrefixes3": len(prefix_paths[3]),
        "falsePrefixStartCells": len(false_start_cells),
        "falsePrefixFamilies": len(false_prefix_families),
        "meaningfulDecoys": len(meaningful_decoys),
        "alternativeFullPaths": sum(alternative_words.values()),
        "alternativeWords": alternative_words,
    }


def build_independent_paths(words: list[str], seed: int) -> list[list[int]]:
    lengths = [len(word) for word in words]
    target_letters = sum(lengths)
    if not 24 <= target_letters <= 31:
        raise ValueError(f"Tajenka v2 needs 24-31 target cells, got {target_letters}: {lengths}")
    if len(words) not in (4, 5):
        raise ValueError(f"Tajenka v2 needs four or five anchors, got {len(words)}")
    rng = random.Random(seed)
    pools = {length: winding_paths(length) for length in set(lengths)}
    best: tuple[float, list[list[int]]] | None = None

    for _restart in range(1_600):
        placement_order = list(range(len(lengths)))
        rng.shuffle(placement_order)
        placement_order.sort(key=lambda index: -lengths[index] + rng.random() * 1.6)
        paths: list[list[int] | None] = [None] * len(lengths)
        used: set[int] = set()
        owners: dict[int, int] = {}
        node_budget = [2_500]

        def place(position: int) -> list[list[int]] | None:
            nonlocal best
            if node_budget[0] <= 0:
                return None
            if position == len(placement_order):
                complete = [list(path) for path in paths if path is not None]
                if len(complete) != len(lengths):
                    return None
                base_letters = [""] * (ROWS * COLS)
                for word, path in zip(words, complete):
                    for cell, letter in zip(path, word):
                        base_letters[cell] = letter
                base_mask = {cell for path in complete for cell in path}
                for word, official in zip(words, complete):
                    if any(candidate != tuple(official) for candidate in spelling_paths(word, base_letters, base_mask)):
                        return None
                score = topology_score(complete)
                if best is None or score > best[0]:
                    best = (score, complete)
                return complete if topology_acceptable(complete) else None

            word_index = placement_order[position]
            pool = pools[lengths[word_index]]
            sample = rng.sample(pool, min(len(pool), 560))
            available: list[tuple[float, list[int]]] = []
            for candidate_tuple in sample:
                candidate = list(candidate_tuple)
                if any(cell in used for cell in candidate):
                    continue
                contact_edges = 0
                contact_pairs: set[int] = set()
                non_seq = 0
                for cell in candidate:
                    for other in neighbours(cell):
                        if other not in owners:
                            continue
                        other_owner = owners[other]
                        contact_edges += 1
                        contact_pairs.add(other_owner)
                        if abs(word_index - other_owner) > 1:
                            non_seq += 1
                boundary_penalty = 0
                if word_index > 0 and paths[word_index - 1] is not None:
                    boundary_penalty += int(candidate[0] in neighbours(paths[word_index - 1][-1]))
                if word_index + 1 < len(paths) and paths[word_index + 1] is not None:
                    boundary_penalty += int(paths[word_index + 1][0] in neighbours(candidate[-1]))
                local_score = (
                    contact_edges * 2.0
                    + len(contact_pairs) * 4.0
                    + non_seq * 4.5
                    - boundary_penalty * 20.0
                    + rng.random() * 5.0
                )
                available.append((local_score, candidate))

            available.sort(key=lambda item: item[0], reverse=True)
            branch = available[: min(26, len(available))]
            if position == 0:
                rng.shuffle(branch)
            for _, candidate in branch:
                node_budget[0] -= 1
                paths[word_index] = candidate
                used.update(candidate)
                owners.update({cell: word_index for cell in candidate})
                result = place(position + 1)
                if result is not None:
                    return result
                for cell in candidate:
                    used.remove(cell)
                    owners.pop(cell)
                paths[word_index] = None
            return None

        result = place(0)
        if result is not None:
            return result

    if best is None:
        raise RuntimeError(f"Unable to place Tajenka v2 paths for {lengths}")
    raise RuntimeError(f"No release-quality topology for {lengths}; best={topology_stats(best[1])} score={best[0]:.1f}")


def decoy_count_for(target_letters: int) -> int:
    return max(3, min(8, 32 - target_letters))


def decorate_with_decoys(words: list[str], paths: list[list[int]], seed: int, prefixes: dict[int, set[str]]) -> tuple[list[int], list[str], dict]:
    owners = {cell: owner for owner, path in enumerate(paths) for cell in path}
    base_letters = [""] * (ROWS * COLS)
    for word, path in zip(words, paths):
        for cell, letter in zip(path, word):
            base_letters[cell] = letter
    remaining = [cell for cell in range(ROWS * COLS) if cell not in owners]
    decoy_count = decoy_count_for(len(owners))
    if decoy_count > len(remaining):
        raise RuntimeError("Not enough board cells for required decoys")

    rng = random.Random(seed)
    prefix2 = prefixes[2]
    best: tuple[float, list[int], list[str], dict] | None = None
    subsets = list(itertools.combinations(remaining, decoy_count))
    rng.shuffle(subsets)

    for subset in subsets:
        decoys = set(subset)
        mask = set(owners) | decoys
        holes = set(range(ROWS * COLS)) - mask
        if not 2 <= len(holes) <= 5:
            continue
        row_fill = [sum(cell in mask for cell in range(row * COLS, (row + 1) * COLS)) for row in range(ROWS)]
        col_fill = [sum(row * COLS + col in mask for row in range(ROWS)) for col in range(COLS)]
        if min(row_fill) < 4 or min(col_fill) < 4:
            continue
        if len({quadrant(cell) for cell in holes}) < min(3, len(holes)):
            continue
        if len({quadrant(cell) for cell in decoys}) < min(3, decoy_count):
            continue
        decoy_edges = sum(1 for cell in decoys for other in neighbours(cell) if cell < other and other in decoys)
        max_decoy_edges = max(1, decoy_count // 3)
        if decoy_edges > max_decoy_edges:
            continue

        candidate_letters: dict[int, list[str]] = {}
        for cell in decoys:
            options = {
                prefix[1]
                for prefix in prefix2
                if any(base_letters[other] == prefix[0] for other in neighbours(cell))
            } | {
                prefix[0]
                for prefix in prefix2
                if any(base_letters[other] == prefix[1] for other in neighbours(cell))
            }
            fallback = {letter for word in words for letter in word[:3]}
            candidate_letters[cell] = sorted(options or fallback)

        for _ in range(320):
            letters = list(base_letters)
            for cell in decoys:
                letters[cell] = rng.choice(candidate_letters[cell])
            stats = branch_stats(words, paths, letters, mask, decoys, prefixes)
            if stats["alternativeFullPaths"]:
                continue
            score = (
                min(stats["falsePrefixes2"], 16) * 2.0
                + min(stats["falsePrefixes3"], 8) * 4.0
                + stats["meaningfulDecoys"] * 8.0
                + min(stats["falsePrefixStartCells"], 12) * 1.5
                + min(stats["falsePrefixFamilies"], 12) * 1.0
                - max(0, stats["falsePrefixes2"] - 18) * 1.5
                - decoy_edges * 2.0
            )
            enriched = {
                **stats,
                "holeQuadrants": len({quadrant(cell) for cell in holes}),
                "decoyQuadrants": len({quadrant(cell) for cell in decoys}),
                "decoyAdjacencyEdges": decoy_edges,
                "minRowFill": min(row_fill),
                "minColFill": min(col_fill),
            }
            if best is None or score > best[0]:
                best = (score, sorted(mask), letters, enriched)
            meaningful_required = max(3, math.ceil(decoy_count * 0.75))
            if (
                stats["falsePrefixes2"] >= 6
                and stats["falsePrefixes3"] >= 2
                and stats["falsePrefixStartCells"] >= 4
                and stats["falsePrefixFamilies"] >= 3
                and stats["meaningfulDecoys"] >= meaningful_required
            ):
                return sorted(mask), letters, enriched

    if best is None:
        raise RuntimeError("Unable to place fair Tajenka v2 decoys")
    raise RuntimeError(f"No release-quality v2 decoys; best={best[3]} score={best[0]:.1f}")


def load_candidates() -> list[dict]:
    candidates: list[dict] = []
    seen: set[str] = set()
    for name in SHARDS:
        path = CONTENT_DIR / name
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("runtimeEnabled") is not False:
            raise ValueError(f"{path}: Tajenka v2 editorial data must stay runtime-disabled")
        for candidate in payload.get("candidates", []):
            candidate_id = str(candidate["id"])
            if candidate_id in seen:
                raise ValueError(f"Duplicate candidate id: {candidate_id}")
            seen.add(candidate_id)
            candidates.append(candidate)
    return sorted(candidates, key=lambda item: int(item["candidateNo"]))


def validate_content_candidate(candidate: dict) -> list[str]:
    errors: list[str] = []
    anchors = candidate.get("anchors", [])
    words = [str(anchor.get("surface") or "").strip().upper() for anchor in anchors]
    target_letters = sum(len(word) for word in words)
    if candidate.get("expectedValidation") != "pass":
        errors.append("EDITORIAL_STRUCTURAL_FAIL")
        return errors
    if len(words) not in (4, 5):
        errors.append("ANCHOR_COUNT")
    if len(words) == 4 and not candidate.get("immutable"):
        errors.append("FOUR_ANCHOR_REQUIRES_IMMUTABLE")
    if not 24 <= target_letters <= 31:
        errors.append("LETTER_BUDGET")
    if len(set(words)) != len(words):
        errors.append("DUPLICATE_ANCHOR")
    short = [word for word in words if len(word) == 3]
    if len(short) > 1 or any(len(word) < 3 for word in words):
        errors.append("ANCHOR_TOO_SHORT")
    if short and not candidate.get("shortAnchorJustification"):
        errors.append("SHORT_ANCHOR_UNJUSTIFIED")
    if any(len(word) > 10 for word in words):
        errors.append("ANCHOR_TOO_LONG")
    if any(anchor.get("suitability") != "strong" for anchor in anchors):
        errors.append("WEAK_ANCHOR")
    if candidate.get("category") in {"fact", "czech", "quote"}:
        source = candidate.get("source") or {}
        if source.get("status") != "verified" or not source.get("url"):
            errors.append("SOURCE_UNVERIFIED")
    return errors


def make_candidate(candidate: dict, attempt_count: int, prefixes: dict[int, set[str]]) -> dict:
    words = [anchor["surface"].strip().upper() for anchor in candidate["anchors"]]
    errors = validate_content_candidate(candidate)
    if errors:
        raise ValueError(f"{candidate['id']}: {', '.join(errors)}")
    best: tuple[float, list[list[int]], tuple[list[int], list[str], dict]] | None = None
    failures: list[str] = []
    candidate_no = int(candidate["candidateNo"])

    for attempt in range(1, attempt_count + 1):
        try:
            paths = build_independent_paths(words, seed=41 + candidate_no * 97 + attempt * 10_003)
            decoration = decorate_with_decoys(
                words,
                paths,
                seed=8_100 + candidate_no + attempt * 7_919,
                prefixes=prefixes,
            )
            topology = topology_stats(paths)
            branching = decoration[2]
            score = (
                topology_score(paths)
                + min(branching["falsePrefixes3"], 45) * 0.6
                + min(branching["falsePrefixStartCells"], 24) * 0.8
                + branching["holeQuadrants"] * 3.0
                + branching["decoyQuadrants"] * 3.0
                - branching["decoyAdjacencyEdges"] * 4.0
            )
            if best is None or score > best[0]:
                best = (score, paths, decoration)
        except RuntimeError as error:
            failures.append(f"attempt {attempt}: {error}")

    if best is None:
        raise RuntimeError(
            f"{candidate['id']}: no candidate after {attempt_count} attempts; "
            + " | ".join(failures[-3:])
        )

    quality_score, paths, decoration = best
    mask, letters, branching = decoration
    topology = topology_stats(paths)
    answers = [
        {"word": word, "path": path, "turns": turns(path), "curlRun": longest_run(path)}
        for word, path in zip(words, paths)
    ]
    result = {
        "schemaVersion": 2,
        "id": candidate["id"],
        "candidateNo": candidate_no,
        "runtimeEnabled": False,
        "status": "board-candidate",
        "category": candidate["category"],
        "displayText": candidate["displayText"],
        "immutable": bool(candidate.get("immutable")),
        "companions": candidate.get("companions", []),
        "rows": ROWS,
        "cols": COLS,
        "mask": mask,
        "letters": letters,
        "answers": answers,
        "source": candidate.get("source"),
        "meta": {
            "targetLetters": sum(len(word) for word in words),
            "cells": len(mask),
            "decoyCells": len(mask) - sum(len(word) for word in words),
            "holes": ROWS * COLS - len(mask),
            **topology,
            **branching,
            "qualityScore": round(quality_score, 2),
            "pathStyle": "v2-independent-interleaved-adaptive-density",
            "previewOnly": True,
            "runtimeEnabled": False,
        },
    }
    validate_board_candidate(result)
    return result


def validate_board_candidate(candidate: dict) -> None:
    assert candidate["runtimeEnabled"] is False
    assert candidate["rows"] == candidate["cols"] == 6
    answers = candidate["answers"]
    words = [answer["word"] for answer in answers]
    target_letters = sum(map(len, words))
    assert 24 <= target_letters <= 31
    assert len(answers) in (4, 5)
    assert 3 <= candidate["meta"]["decoyCells"] <= 8
    assert 2 <= candidate["meta"]["holes"] <= 5
    limits = topology_limits(len(answers))
    assert candidate["meta"]["crossWordEdges"] >= limits["crossWordEdges"]
    assert candidate["meta"]["crossWordPairs"] >= limits["crossWordPairs"]
    assert candidate["meta"]["nonSequentialEdges"] >= limits["nonSequentialEdges"]
    assert candidate["meta"]["sequentialBoundaries"] <= limits["sequentialBoundaries"]
    assert candidate["meta"]["quadrantCrossers"] >= limits["quadrantCrossers"]
    assert candidate["meta"]["minWordContacts"] >= limits["minWordContacts"]
    assert candidate["meta"]["falsePrefixes2"] >= 6
    assert candidate["meta"]["falsePrefixes3"] >= 2
    assert candidate["meta"]["falsePrefixStartCells"] >= 4
    assert candidate["meta"]["falsePrefixFamilies"] >= 3
    assert candidate["meta"]["alternativeFullPaths"] == 0
    assert candidate["meta"]["meaningfulDecoys"] >= max(3, math.ceil(candidate["meta"]["decoyCells"] * 0.75))
    assert candidate["meta"]["holeQuadrants"] >= min(3, candidate["meta"]["holes"])
    assert candidate["meta"]["decoyQuadrants"] >= min(3, candidate["meta"]["decoyCells"])
    assert candidate["meta"]["minRowFill"] >= 4
    assert candidate["meta"]["minColFill"] >= 4
    mask = set(candidate["mask"])
    used: set[int] = set()
    for answer in answers:
        path = answer["path"]
        word = answer["word"]
        assert len(path) == len(word)
        assert not used.intersection(path)
        assert set(path) <= mask
        assert turns(path) == answer["turns"] >= min_turns_for_length(len(word))
        assert longest_run(path) == answer["curlRun"] == 1
        assert "".join(candidate["letters"][cell] for cell in path) == word
        used.update(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--attempts", type=int, default=6)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--ids", nargs="*")
    args = parser.parse_args()
    selected = [candidate for candidate in load_candidates() if candidate.get("expectedValidation") == "pass"]
    if args.ids:
        wanted = set(args.ids)
        selected = [candidate for candidate in selected if candidate["id"] in wanted]
    if args.limit is not None:
        selected = selected[: args.limit]
    prefixes = load_prefixes()
    boards: list[dict] = []
    failures: list[dict] = []
    for candidate in selected:
        try:
            board = make_candidate(candidate, attempt_count=args.attempts, prefixes=prefixes)
            boards.append(board)
            print(
                "PASS",
                candidate["id"],
                f"letters={board['meta']['targetLetters']}",
                f"decoys={board['meta']['decoyCells']}",
                f"cross={board['meta']['crossWordEdges']}",
                f"pairs={board['meta']['crossWordPairs']}",
                f"score={board['meta']['qualityScore']}",
            )
        except (ValueError, RuntimeError, AssertionError) as error:
            failures.append({"id": candidate["id"], "error": str(error)})
            print("FAIL", candidate["id"], str(error))
    payload = {
        "schemaVersion": 2,
        "kind": "tajenka-v2-board-candidate-bank",
        "runtimeEnabled": False,
        "source": "content/tajenka-v2/editorial-*.json",
        "boards": boards,
        "failures": failures,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"SUMMARY pass={len(boards)} fail={len(failures)} output={args.output}")


if __name__ == "__main__":
    main()
