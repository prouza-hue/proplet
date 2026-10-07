#!/usr/bin/env python3
"""Read-only independent acceptance of dated Daily Gen6 candidates.

This file deliberately imports no manufacturing or Gen5/Gen6 validation code.
The lexical ledger, calendar, path metrics, trie traversal and exact-cover proof
are recomputed from raw immutable inputs. It writes only the requested report.
The report proves finite full-partition uniqueness, not human difficulty.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import time
import unicodedata
from zoneinfo import ZoneInfo

LEXICON_HASH = "7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277"
PROFILES_HASH = "8dfc273e1e94f3546a0e397c2f1939e91e97c0cce2c19ec58c738dfe27155ba5"
FREQUENCY_HASH = "bfc1eb49c6959a7ebbfa5ee9beff74e377e55f59e783445f99447ef8a8e34610"
START = date(2026, 10, 8)
END = date(2027, 1, 14)
CADENCE = ("easy", "easy", "medium", "medium", "medium", "hard", "hard")
DIFFICULTIES = ("easy", "medium", "hard")
HISTORY_FILES = (
    "public/puzzles.json", "data/puzzles.json", "data/rolling_content_v1.json",
    "data/legacy_daily_gen1.json", "data/legacy_daily_gen2.json",
    "data/tajenka_weekend_v1.json", "data/tajenka_weekend_v2.json",
    "data/tajenka_v2_approved.json", "data/tajenka_v2_board_candidates.json",
    "data/playtests/mozkokalypsa-v1.json", "data/playtests/mozkokalypsa-v2.json",
    "data/playtests/mozkokalypsa-v3.json", "content/gen6/mozkokalypsa-100/bank.json",
    "content/gen6/free-refresh-300/bank.json",
)
BOARD_FIELDS = ("rows", "cols", "letters", "mask", "answers", "lengths")
WORD_RE = re.compile(r"[a-záčďéěíňóřšťúůýž]+\Z")
LETTER_RE = re.compile(r"[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]\Z")


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def norm(value):
    return unicodedata.normalize("NFC", str(value)).strip().casefold()


def acceptable(word):
    return 4 <= len(word) <= 24 and word != "negr" and bool(WORD_RE.fullmatch(word))


def walk_boards(value):
    if isinstance(value, dict):
        if all(key in value for key in ("id", "rows", "cols", "mask", "letters", "answers")):
            yield value
        else:
            for child in value.values():
                yield from walk_boards(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_boards(child)


def targets(board):
    return {norm(a["word"]) for a in board["answers"]}


def board_hash(board):
    return digest({key: board.get(key) for key in BOARD_FIELDS})


def geometry_identity(board):
    """Order-insensitive exact board/solution identity, unlike manufacturing hash."""
    return digest({"rows": board["rows"], "cols": board["cols"], "letters": board["letters"],
        "mask": sorted(board["mask"]), "lengths": sorted(board.get("lengths") or [len(norm(a["word"])) for a in board["answers"]]),
        "answers": sorted((norm(a["word"]), a["path"]) for a in board["answers"])})


def adjacent(left, right, cols):
    lr, lc = divmod(left, cols)
    rr, rc = divmod(right, cols)
    return abs(lr - rr) + abs(lc - rc) == 1


def adjacency(rows, cols, mask):
    out = {}
    for cell in sorted(mask):
        rr, cc = divmod(cell, cols)
        out[cell] = tuple(nr * cols + nc for nr, nc in ((rr - 1, cc), (rr + 1, cc), (rr, cc - 1), (rr, cc + 1))
                          if 0 <= nr < rows and 0 <= nc < cols and nr * cols + nc in mask)
    return out


def component_sizes(cells, neighbours):
    unseen = set(cells)
    sizes = []
    while unseen:
        queue = [unseen.pop()]
        size = 0
        while queue:
            cell = queue.pop()
            size += 1
            for nxt in neighbours[cell]:
                if nxt in unseen:
                    unseen.remove(nxt)
                    queue.append(nxt)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def trace_metrics(path, cols):
    directions = [(b // cols - a // cols, b % cols - a % cols) for a, b in zip(path, path[1:])]
    turns = 0
    longest = current_straight = 1
    same_sign = max_curl = 0
    last_sign = None
    for first, second in zip(directions, directions[1:]):
        if first == second:
            current_straight += 1
            longest = max(longest, current_straight)
        else:
            current_straight = 1
            turns += 1
            cross = first[1] * second[0] - first[0] * second[1]
            sign = 1 if cross > 0 else -1
            same_sign = same_sign + 1 if sign == last_sign else 1
            last_sign = sign
            max_curl = max(max_curl, same_sign)
    return turns, longest / max(1, len(path) - 1), max_curl


def structure(board):
    rows, cols = board["rows"], board["cols"]
    if type(rows) is not int or type(cols) is not int or not (2 <= rows <= 12 and 2 <= cols <= 12):
        raise ValueError("invalid dimensions")
    masklist, letters, answers = board["mask"], board["letters"], board["answers"]
    if not isinstance(masklist, list) or not masklist or any(type(c) is not int or not 0 <= c < rows * cols for c in masklist):
        raise ValueError("invalid mask indices")
    mask = set(masklist)
    if len(mask) != len(masklist) or len(letters) != rows * cols:
        raise ValueError("duplicate mask cells or invalid letter array")
    for i, letter in enumerate(letters):
        if i in mask:
            if not isinstance(letter, str) or unicodedata.normalize("NFC", letter) != letter or not LETTER_RE.fullmatch(letter):
                raise ValueError("invalid active letter")
        elif letter != "":
            raise ValueError("letter outside active mask")
    if not isinstance(answers, list) or not answers:
        raise ValueError("no target answers")
    covered, words, paths, lengths, traces = set(), set(), [], [], []
    for answer in answers:
        raw = answer["word"]
        if not isinstance(raw, str) or unicodedata.normalize("NFC", raw) != raw or raw != raw.upper() or raw.strip() != raw:
            raise ValueError("noncanonical NFC uppercase target")
        word, path = norm(raw), answer["path"]
        if not acceptable(word) or word in words:
            raise ValueError("invalid or duplicated target word")
        if not isinstance(path, list) or len(path) != len(word) or any(type(c) is not int for c in path):
            raise ValueError("invalid target path")
        pathset = set(path)
        if len(pathset) != len(path) or not pathset <= mask or pathset & covered:
            raise ValueError("target overlap, repeated or inactive path cells")
        if any(not adjacent(a, b, cols) for a, b in zip(path, path[1:])):
            raise ValueError("nonorthogonal path")
        if norm("".join(letters[cell] for cell in path)) != word:
            raise ValueError("target spelling does not follow letters")
        covered |= pathset
        words.add(word)
        lengths.append(len(word))
        paths.append(path)
        traces.append(trace_metrics(path, cols))
    if covered != mask or Counter(lengths) != Counter(board["lengths"]):
        raise ValueError("incomplete mask coverage or mismatched length multiset")
    if len(component_sizes(mask, adjacency(rows, cols, mask))) != 1:
        raise ValueError("disconnected active mask")
    blanks = component_sizes(set(range(rows * cols)) - mask, adjacency(rows, cols, set(range(rows * cols))))
    return {"rows": rows, "cols": cols, "cells": len(mask), "wordCount": len(words),
        "fourWords": lengths.count(4), "minLength": min(lengths), "maxLength": max(lengths),
        "minPathTurns": min(t[0] for t in traces), "maxPathTurns": max(t[0] for t in traces),
        "maxPathStraightShare": max(t[1] for t in traces),
        "meanTurns": sum(t[0] for t in traces) / len(traces),
        "meanStraightShare": sum(t[1] for t in traces) / len(traces),
        "curvyShare": sum(t[0] >= 2 for t in traces) / len(traces),
        "maxCurlRun": max(t[2] for t in traces), "curlPathCount": sum(t[2] >= 2 for t in traces),
        "endpointStartPairs": sum(adjacent(a[-1], b[0], cols) for i, a in enumerate(paths) for j, b in enumerate(paths) if i != j),
        "blankComponents": len(blanks), "isolatedBlanks": blanks.count(1),
        "bboxRows": max(c // cols for c in mask) - min(c // cols for c in mask) + 1,
        "bboxCols": max(c % cols for c in mask) - min(c % cols for c in mask) + 1}


def geometry_errors(metrics, profile):
    checks = {
        "dimensions": metrics["rows"] == profile["rows"] and metrics["cols"] == profile["cols"],
        "word_lengths": metrics["minLength"] >= profile["min_len"] and metrics["maxLength"] <= profile["max_len"],
        "path_turns": metrics["minPathTurns"] >= profile["min_path_turns"] and metrics["maxPathTurns"] <= profile["max_path_turns"],
        "path_straight_share": metrics["maxPathStraightShare"] <= profile["max_path_straight_share"],
        "cell_count": profile["cells"][0] <= metrics["cells"] <= profile["cells"][1],
        "word_count": profile["words"][0] <= metrics["wordCount"] <= profile["words"][1],
        "short_word_cap": metrics["fourWords"] <= profile["max_four_words"],
        "mean_turns": profile["min_mean_turns"] <= metrics["meanTurns"] <= profile["max_mean_turns"],
        "straight_share": metrics["meanStraightShare"] <= profile["max_mean_straight_share"],
        "curvy_share": metrics["curvyShare"] >= profile["min_curvy_share"],
        "curl_run": metrics["maxCurlRun"] <= profile["max_curl_run"],
        "curl_count": metrics["curlPathCount"] <= profile["max_curl_paths"],
        "chainable": metrics["endpointStartPairs"] == 0,
        "cutouts": metrics["blankComponents"] <= profile["max_blank_components"],
        "isolated_cutouts": metrics["isolatedBlanks"] <= profile["max_isolated_blanks"],
        "bbox": metrics["bboxRows"] >= profile["min_bbox_rows"] and metrics["bboxCols"] >= profile["min_bbox_cols"],
    }
    return [key for key, valid in checks.items() if not valid]


class BudgetExceeded(Exception):
    pass


class IndependentSolver:
    """A second implementation: iterative path enumeration, memoized cover."""

    def __init__(self, words):
        self.words = tuple(sorted(set(words)))
        self.dictionary_hash = digest(list(self.words))
        self.trie = {}
        for index, word in enumerate(self.words):
            node = self.trie
            for letter in word:
                node = node.setdefault(letter, {})
            node[None] = index

    def verify(self, board, seconds, node_limit):
        deadline = time.monotonic() + seconds
        nodes = enumeration_nodes = cover_nodes = 0
        candidate_count = 0
        solution_count = 0
        target_unique = False
        witnesses = []

        def step():
            nonlocal nodes
            nodes += 1
            if nodes > node_limit or time.monotonic() > deadline:
                raise BudgetExceeded

        try:
            mask = set(board["mask"])
            neighbours = adjacency(board["rows"], board["cols"], mask)
            letters = [norm(c) for c in board["letters"]]
            length_counts = Counter(board["lengths"])
            required = set(length_counts)
            maximum = max(required)
            candidates = []
            for start in sorted(mask):
                frontier = [(start, self.trie, (), 0)]
                while frontier:
                    cell, previous_node, path, bits = frontier.pop()
                    step()
                    enumeration_nodes += 1
                    trie_node = previous_node.get(letters[cell])
                    if trie_node is None:
                        continue
                    traced = path + (cell,)
                    traced_bits = bits | (1 << cell)
                    index = trie_node.get(None)
                    if index is not None and len(traced) in required:
                        candidates.append((index, traced, traced_bits))
                    if len(traced) < maximum:
                        for nxt in neighbours[cell]:
                            if not (traced_bits & (1 << nxt)):
                                frontier.append((nxt, trie_node, traced, traced_bits))
            candidate_count = len(candidates)
            by_cell = defaultdict(list)
            paths_by_word = defaultdict(list)
            for candidate in candidates:
                index, path, bits = candidate
                paths_by_word[self.words[index]].append(path)
                for cell in path:
                    by_cell[cell].append(candidate)
            target_unique = all(paths_by_word[norm(a["word"])] == [tuple(a["path"])] for a in board["answers"])
            all_bits = sum(1 << cell for cell in mask)
            length_order = tuple(sorted(required))
            length_slot = {length: index for index, length in enumerate(length_order)}
            failed = set()

            def exact_cover(used, remaining, used_words, chosen):
                nonlocal solution_count, cover_nodes
                step()
                cover_nodes += 1
                if used == all_bits:
                    if not any(remaining):
                        solution_count += 1
                        witnesses.append([{ "word": self.words[index], "path": list(path)} for index, path, _ in chosen])
                        return True
                    return False
                key = (used, remaining, used_words)
                if key in failed:
                    return False
                available = None
                for cell in sorted(mask):
                    if used & (1 << cell):
                        continue
                    viable = [candidate for candidate in by_cell[cell]
                              if not candidate[2] & used and remaining[length_slot[len(candidate[1])]] > 0
                              and candidate[0] not in used_words]
                    if not viable:
                        failed.add(key)
                        return False
                    if available is None or len(viable) < len(available):
                        available = viable
                        if len(available) == 1:
                            break
                found = False
                for index, path, bits in available:
                    next_remaining = list(remaining)
                    next_remaining[length_slot[len(path)]] -= 1
                    found |= exact_cover(used | bits, tuple(next_remaining), used_words | frozenset((index,)), chosen + [(index, path, bits)])
                    if solution_count >= 2:
                        return True
                if not found:
                    failed.add(key)
                return found

            exact_cover(0, tuple(length_counts[n] for n in length_order), frozenset(), [])
            status = "unique" if solution_count == 1 else "multiple" if solution_count >= 2 else "no-solution"
        except BudgetExceeded:
            status = "budget-exhausted"
        return {"status": status, "solutionsLowerBound": solution_count, "targetPathsUnique": target_unique,
            "candidateCount": candidate_count, "enumerationNodes": enumeration_nodes, "coverNodes": cover_nodes,
            "totalNodes": nodes, "dictionaryHash": self.dictionary_hash, "dictionarySize": len(self.words),
            "witnesses": witnesses, "secondsLimit": seconds, "nodeLimit": node_limit}


def ambiguity(board, prefixes):
    """Recompute the exact pinned depth-4 ranking signal, not solve time."""
    neighbours = adjacency(board["rows"], board["cols"], set(board["mask"]))
    letters = [norm(c) for c in board["letters"]]
    legit = {tuple(a["path"][:n]) for a in board["answers"] for n in range(2, min(4, len(a["path"])) + 1)}
    false = Counter()
    for start in sorted(board["mask"]):
        frontier = [((start,), letters[start])]
        while frontier:
            path, text = frontier.pop()
            n = len(path)
            matching = text in prefixes[n]
            if n >= 2 and matching and path not in legit:
                false[n] += 1
            if n < 4 and matching:
                frontier.extend((path + (nxt,), text + letters[nxt]) for nxt in neighbours[path[-1]] if nxt not in path)
    alternative = sum(letters[a["path"][0]] + letters[nxt] in prefixes[2]
        for a in board["answers"] for nxt in neighbours[a["path"][0]] if nxt != a["path"][1])
    collisions = sum(count * (count - 1) // 2 for count in Counter(letters[a["path"][0]] for a in board["answers"]).values())
    return round((.25 * false[2] + .75 * false[3] + 1.5 * false[4] + 2 * alternative + .5 * collisions) / len(board["answers"]), 3)


def literal_overlay(path):
    for node in ast.parse(Path(path).read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "RECOGNITION_OVERLAY" for target in node.targets):
            return {norm(word) for word in ast.literal_eval(node.value)}
    raise ValueError("current runtime has no literal RECOGNITION_OVERLAY")


def profile_ordinal(base, day, difficulty):
    return sum(CADENCE[(base + timedelta(days=i)).weekday()] == difficulty for i in range((day - base).days + 1))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Original byte-exact free-refresh production snapshot")
    parser.add_argument("--current", type=Path, required=True, help="Current raw source snapshot; missing histories fall back explicitly to source")
    parser.add_argument("--bank", type=Path, required=True)
    parser.add_argument("--recognition", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--schedule", type=Path)
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=30)
    parser.add_argument("--nodes", type=int, default=4000000)
    args = parser.parse_args()
    start_clock = time.monotonic()
    issues = []
    observed = {}

    def observe(path):
        path = Path(path).resolve()
        observed[str(path)] = sha(path)
        return path

    def problem(item, reason):
        issues.append({"item": item, "problem": reason})

    source = args.source.resolve()
    current = args.current.resolve()
    bank = read(observe(args.bank))
    boards = deepcopy(bank["boards"])
    checkpoint = read(observe(args.checkpoint))
    schedule = read(observe(args.schedule)) if args.schedule else None
    production_plan = read(observe(args.plan)) if args.plan else None
    dates_by_id = {}
    hashes_by_id = {}
    if schedule is not None:
        binding_items = schedule.get("bindings", schedule.get("dateBindings", schedule.get("schedule", []))) if isinstance(schedule, dict) else schedule
        for binding in binding_items:
            if isinstance(binding, dict):
                dates_by_id[binding.get("puzzleId", binding.get("id"))] = binding.get("dailyDate", binding.get("date"))
                hashes_by_id[binding.get("puzzleId", binding.get("id"))] = binding.get("contentHash")

    snapshot = read(observe(source / "SOURCE_INPUTS_VERIFIED.json"))
    for record in snapshot["files"]:
        path = observe(source / record["path"])
        raw = path.read_bytes()
        git_blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        if sha(path) != record["sha256"] or git_blob != record["sourceGitBlobSha1"]:
            problem(record["path"], "immutable-original-source-drift")
    current_manifest_path = observe(current / "DAILY_INPUTS_VERIFIED.json")
    current_manifest = read(current_manifest_path)
    if current_manifest["originalSourceManifestSha256"] != sha(source / "SOURCE_INPUTS_VERIFIED.json"):
        problem("DAILY_INPUTS_VERIFIED.json", "unbound-original-source-manifest")
    for record in current_manifest["files"]:
        path = observe(current / record["path"])
        if sha(path) != record["sha256"]:
            problem(record["path"], "current-manifest-input-drift")
        original = source / record["path"]
        if record.get("originalSha256") is not None and (not original.exists() or sha(original) != record["originalSha256"]):
            problem(record["path"], "invalid-original-input-delta-provenance")
        if original.exists() and record.get("originalSha256") is not None and record.get("changed") != (sha(path) != sha(original)):
            problem(record["path"], "misclassified-input-delta")
    remote_path = observe(current / "REMOTE_MAIN_METADATA.json")
    remote = read(remote_path)
    if remote["main"] != current_manifest["sourceMain"]:
        problem("REMOTE_MAIN_METADATA.json", "main-input-manifest-mismatch")
    remote_blobs = {record["path"]: record["sha"] for record in remote["files"] if not record.get("error")}
    remote_blobs.update({"data/puzzles.json": "500522874270670f9f14963474ee07671645654d", "public/puzzles.json": "b0a23e6e4d997df8b595da4c0bbba25ffb5d0838"})
    for relative, expected in remote_blobs.items():
        raw = observe(current / relative).read_bytes()
        actual = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        if actual != expected:
            problem(relative, "current-remote-git-blob-mismatch")
    working = source / "content/lexicon-v3/working"
    lexicon = read(observe(working / "lexicon.json"))
    lexmanifest = read(observe(working / "manifest.json"))
    for name, expected in lexmanifest["outputs_sha256"].items():
        if sha(observe(working / name)) != expected:
            problem(name, "immutable-v3-output-drift")
    if sha(working / "lexicon.json") != LEXICON_HASH:
        problem("lexicon.json", "approved-v3-hash-mismatch")
    entries = {norm(e["word"]): e for e in lexicon["entries"]}
    if len(entries) != 4290 or sum(e.get("target_eligible") is True for e in entries.values()) != 4248:
        problem("lexicon.json", "incomplete-v3-or-42-exclusion-foundation")
    if sum(e.get("source_cohort") == "approved-expansion-1143" for e in entries.values()) != 1143:
        problem("lexicon.json", "incomplete-approved-expansion")
    exclusions = {norm(w) for w in read(observe(source / "data/target_generation_exclusions_v334.json"))["remove_from_target_generation"]}
    exclusions |= {"červodíra", "blockchain", "pulsar", "tensor"}
    exclusions |= {w for w, e in entries.items() if not e["target_eligible"]}
    variants = {}
    for group in read(observe(working / "variant-groups.json"))["groups"]:
        members = {norm(w) for w in group["members"]}
        for word in members:
            variants[word] = members
    profiles_path = observe(source / "content/gen5/profiles.json")
    if sha(profiles_path) != PROFILES_HASH:
        problem("profiles.json", "calibrated-profile-drift")
    profiles = read(profiles_path)["profiles"]
    frequency_path = observe(source / "content/gen6/round3-eight/wordfreq-cs-runtime.txt")
    if sha(frequency_path) != FREQUENCY_HASH:
        problem("wordfreq-cs-runtime.txt", "pinned-frequency-layer-drift")

    # The previous broad frozen set is a minimum; current lexical sources and
    # overlay may enlarge it. Never make an ambiguous board pass by narrowing it.
    recognition_path = observe(args.recognition)
    raw_recognition = recognition_path.read_text(encoding="utf-8").splitlines()
    words = set(raw_recognition)
    if raw_recognition != sorted(words) or any(norm(w) != w or not acceptable(w) for w in words):
        problem("recognition", "recognition-must-be-sorted-unique-canonical-acceptable")
    prior_path = observe(source / "content/gen6/free-refresh-300/recognition-words.txt")
    minimum = set(prior_path.read_text(encoding="utf-8").splitlines())
    if len(minimum) != 103836:
        problem("recognition", "original-full-snapshot-not-103836")
    minimum |= set(entries)
    minimum |= {word for group in variants.values() for word in group}
    minimum |= {norm(word) for word in frequency_path.read_text(encoding="utf-8").splitlines()}
    minimum |= {norm(word) for word in (working / "recognition-words.txt").read_text(encoding="utf-8").splitlines()}
    runtime_path = observe(current / "word_recognition_v3330.py")
    minimum |= literal_overlay(runtime_path)
    for relative in ("data/words.txt", "public/valid-words-v3328.txt"):
        path = current / relative
        if path.exists():
            minimum |= {norm(word) for word in observe(path).read_text(encoding="utf-8").splitlines()}
        else:
            problem(relative, "missing-current-runtime-static-input")
    for relative, key in (("data/lexicon_v2.json", "word"), ("data/lexicon_v2_wikidata_raw.json", "lemma")):
        path = current / relative
        if path.exists():
            for entry in read(observe(path))["entries"]:
                word = str(entry.get(key, "")).strip()
                if key != "lemma" or word == word.lower():
                    minimum.add(norm(word))
        else:
            problem(relative, "missing-current-runtime-lexical-input")
    minimum = {word for word in minimum if acceptable(word)}
    missing = sorted(minimum - words)
    if missing:
        problem("recognition", {"missingFullRuntimeWords": missing, "missingCount": len(missing)})
    if len(words) < 103836:
        problem("recognition", "full-recognition-snapshot-too-small")
    if bank.get("recognitionSha256") != sha(recognition_path) or bank.get("lexiconSha256") != LEXICON_HASH:
        problem("bank", "lexical-or-recognition-bank-binding-mismatch")
    solver = IndependentSolver(words)
    proxy_words = set(entries) | {norm(word) for word in (source / "data/words.txt").read_text(encoding="utf-8").splitlines()}
    prefixes = {length: {word[:length] for word in proxy_words if len(word) >= length} for length in range(1, 5)}

    historical_ids, historical_wordsets, historical_geometries = set(), set(), set()
    historical_files = []
    for root in (source, current):
        for relative in HISTORY_FILES:
            path = root / relative
            if not path.exists():
                continue
            observe(path)
            historical_files.append({"path": str(path), "sha256": sha(path), "basis": "actual-current" if root == current else "immutable-source"})
            for historical in walk_boards(read(path)):
                historical_ids.add(historical["id"])
                historical_wordsets.add(digest(sorted(targets(historical))))
                historical_geometries.add(geometry_identity(historical))
    current_bank_path = observe(current / "data/puzzles.json")
    current_bank = read(current_bank_path)
    rotation_base = date.fromisoformat(current_bank["dailyRotationBaseDate"])
    if rotation_base != date(2026, 8, 24) or current_bank.get("dailyRotationSize") != 365:
        problem("calendar", "unrecognised-active-rotation-baseline")
    if len(current_bank["daily"]) != 365:
        problem("calendar", "current-server-daily-bank-not-365")
    preceding = []
    last_word_dates = {}
    for days_before in range(24, 0, -1):
        day = START - timedelta(days=days_before)
        index = (day - rotation_base).days
        if not 0 <= index < len(current_bank["daily"]):
            raise ValueError("cannot resolve pre-cutover Daily by first-cycle calendar")
        prior = current_bank["daily"][index]
        preceding.append({"dailyDate": day.isoformat(), "puzzleId": prior["id"], "contentHash": board_hash(prior), "words": sorted(targets(prior))})
        for word in targets(prior):
            last_word_dates[word] = day
    if len(boards) != 99 or (END - START).days + 1 != 99:
        problem("bank", "require-exactly-99-complete-calendar-slots")
    if bank.get("contentHash") != digest(boards):
        problem("bank", "whole-bank-contentHash-mismatch")
    if checkpoint.get("contentHash") != digest(checkpoint.get("boards", [])):
        problem("checkpoint", "checkpoint-contentHash-mismatch")
    checkpoint_boards = {b["id"]: b for b in checkpoint.get("boards", [])}
    if len(checkpoint_boards) != len(boards):
        problem("checkpoint", "checkpoint-board-count-mismatch")
    if checkpoint.get("inputs", {}).get("lexicon") not in (None, LEXICON_HASH):
        problem("checkpoint", "checkpoint-lexicon-hash-mismatch")
    if checkpoint.get("inputs", {}).get("recognition") not in (None, sha(recognition_path)):
        problem("checkpoint", "checkpoint-recognition-hash-mismatch")
    if checkpoint.get("inputs", {}).get("sources") != sha(current_manifest_path):
        problem("checkpoint", "checkpoint-current-source-manifest-hash-mismatch")
    code_path = observe(current / "tools/daily_gen6.py")
    if checkpoint.get("inputs", {}).get("ownCode") != sha(code_path):
        problem("checkpoint", "checkpoint-manufacturing-code-hash-mismatch")
    if production_plan is not None:
        if production_plan.get("inputs") != checkpoint.get("inputs"):
            problem("production-plan", "checkpoint-plan-input-guard-mismatch")
        if production_plan.get("cutover") != START.isoformat() or production_plan.get("activeUntil") != END.isoformat() or production_plan.get("count") != 99:
            problem("production-plan", "unapproved-range-or-count")
        if production_plan.get("timeZone") != "Europe/Prague" or production_plan.get("generatorGeneration") != 6:
            problem("production-plan", "unapproved-timezone-or-generator")
        if production_plan.get("cooldownInterveningDays") != 24 or production_plan.get("maxExactOccurrences") != 3:
            problem("production-plan", "silently-relaxed-freshness-policy")
        if checkpoint.get("inputs", {}).get("planHash") != digest(production_plan.get("slots")):
            problem("production-plan", "locked-slot-plan-hash-mismatch")

    counts, occurrences = Counter(), Counter()
    seen_ids, seen_wordsets, seen_geometries = set(), set(), set()
    results = []
    monthly = defaultdict(Counter)
    distance_records = []
    for index, board in enumerate(boards):
        started = time.monotonic()
        errors = []
        day = START + timedelta(days=index)
        expected_difficulty = CADENCE[day.weekday()]
        difficulty = board.get("difficulty")
        meta = board.get("meta", {})
        reported_date = board.get("dailyDate", meta.get("dailyDate", dates_by_id.get(board["id"])))
        if reported_date != day.isoformat():
            errors.append("date-order-or-binding")
        if difficulty != expected_difficulty:
            errors.append("weekday-difficulty-cadence")
        ordinal = profile_ordinal(rotation_base, day, expected_difficulty)
        profile = deepcopy(profiles[expected_difficulty])
        for variant in profile.pop("variants", []):
            if ordinal % variant["every"] == variant["remainder"]:
                profile.update(variant["overrides"])
        for ordinal_key in (meta.get("profileOrdinal"), meta.get("manufacture", {}).get("profileOrdinal")):
            if ordinal_key is not None and ordinal_key != ordinal:
                errors.append("actual-difficulty-slot-ordinal")
        if meta.get("generatorGeneration", bank.get("generatorGeneration")) != 6:
            errors.append("generator-generation")
        if meta.get("geometryProfile") not in (None, profile["geometry_profile"]):
            errors.append("profile-metadata")
        declared_hash = board.get("contentHash", meta.get("contentHash", hashes_by_id.get(board["id"])))
        if declared_hash is None or declared_hash != board_hash(board):
            errors.append("per-board-contentHash-mismatch-or-absent")
        if board["id"] in historical_ids or board["id"] in seen_ids:
            errors.append("historical-or-new-puzzleId-collision")
        wordset = targets(board)
        if digest(sorted(wordset)) in historical_wordsets or digest(sorted(wordset)) in seen_wordsets:
            errors.append("historical-or-new-whole-wordset-collision")
        geometry = geometry_identity(board)
        if geometry in historical_geometries or geometry in seen_geometries:
            errors.append("historical-or-new-exact-geometry-collision")
        if any(word not in entries or word in exclusions or not entries[word].get("target_eligible")
               or entries[word].get("tier") not in profile["policy"]["allowed"]
               or not profile["min_len"] <= len(word) <= profile["max_len"]
               or entries[word].get("fun", 3) < 3 for word in wordset):
            errors.append("v3-target-eligibility")
        tiers = Counter(entries[word]["tier"] for word in wordset if word in entries)
        for tier, fraction in profile["policy"].get("min_fraction", {}).items():
            if tiers[tier] + 1e-9 < fraction * len(wordset):
                errors.append("minimum-tier-fraction:" + tier)
        for tier, fraction in profile["policy"].get("max_fraction", {}).items():
            if tiers[tier] > fraction * len(wordset) + 1e-9:
                errors.append("maximum-tier-fraction:" + tier)
        if any((wordset - {word}) & variants.get(word, {word}) for word in wordset):
            errors.append("same-board-orthographic-variant")
        for word in sorted(wordset):
            previous_day = last_word_dates.get(word)
            if previous_day is not None:
                intervening = (day - previous_day).days - 1
                distance_records.append({"word": word, "previous": previous_day.isoformat(), "current": day.isoformat(), "interveningDaily": intervening})
                if intervening < 24:
                    errors.append("daily-cooldown:" + word + ":" + str(intervening))
            last_word_dates[word] = day
        occurrences.update(wordset)
        if any(occurrences[word] > 3 for word in wordset):
            errors.append("global-new-bank-max3-cap")
        checkpoint_board = checkpoint_boards.get(board["id"])
        if checkpoint_board is None or board_hash(checkpoint_board) != board_hash(board):
            errors.append("checkpoint-final-board-content-drift")
        try:
            metrics = structure(board)
            errors.extend("geometry:" + error for error in geometry_errors(metrics, profile))
            pressure = ambiguity(board, prefixes)
            if not profile["ambiguity"][0] <= pressure <= profile["ambiguity"][1]:
                errors.append("ambiguity-band")
            proof = solver.verify(board, args.seconds, args.nodes)
            if proof["status"] != "unique" or proof["targetPathsUnique"] is not True:
                errors.append("independent-solver:" + proof["status"])
        except (ValueError, TypeError, KeyError, IndexError) as error:
            metrics, pressure, proof = None, None, {"status": "invalid-structure", "error": str(error)}
            errors.append("structural:" + str(error))
        counts[difficulty] += 1
        monthly[day.strftime("%Y-%m")][difficulty] += 1
        result = {"id": board["id"], "dailyDate": day.isoformat(), "difficulty": difficulty,
            "profileOrdinal": ordinal, "geometryProfile": profile["geometry_profile"], "contentHash": board_hash(board),
            "wordCount": len(wordset), "tierCounts": dict(tiers), "words": sorted(wordset),
            "geometry": metrics, "ambiguity": pressure, "proof": proof, "errors": errors,
            "seconds": round(time.monotonic() - started, 4)}
        results.append(result)
        seen_ids.add(board["id"])
        seen_wordsets.add(digest(sorted(wordset)))
        seen_geometries.add(geometry)
        for error in errors:
            problem(board["id"], error)
        if len(results) % 10 == 0:
            print(json.dumps({"audited": len(results), "issues": len(issues), "lastDate": day.isoformat()}), flush=True)
    expected_counts = Counter(CADENCE[(START + timedelta(days=i)).weekday()] for i in range(99))
    if counts != expected_counts or bank.get("counts", dict(expected_counts)) != dict(expected_counts) or bank.get("count", 99) != 99:
        problem("bank", "calendar-difficulty-counts")
    if production_plan is not None and production_plan.get("counts") != dict(expected_counts):
        problem("production-plan", "calendar-difficulty-counts")
    if max(occurrences.values(), default=0) > 3:
        problem("bank", "maximum-exact-word-occurrences-exceeds-three")
    binding_results = []
    if schedule is not None:
        for binding in binding_items:
            daytext = binding.get("dailyDate", binding.get("date"))
            identifier = binding.get("puzzleId", binding.get("id"))
            board = next((candidate for candidate in boards if candidate["id"] == identifier), None)
            if board is None or binding.get("contentHash") != board_hash(board):
                problem(identifier or daytext, "date-binding-contentHash-or-puzzleId")
                continue
            if binding.get("challengeId", binding.get("challengeKey", "daily:" + daytext)) != "daily:" + daytext:
                problem(identifier, "changed-participant-daily-identity")
            local = datetime.combine(date.fromisoformat(daytext), datetime.min.time(), ZoneInfo("Europe/Prague"))
            next_local = datetime.combine(date.fromisoformat(daytext) + timedelta(days=1), datetime.min.time(), ZoneInfo("Europe/Prague"))
            hours = (next_local.timestamp() - local.timestamp()) / 3600
            binding_results.append({"dailyDate": daytext, "puzzleId": identifier, "calendarHours": hours,
                                    "validFromPrague": local.isoformat(), "validUntilPrague": next_local.isoformat()})
        if len(binding_results) != 99 or len(dates_by_id) != 99:
            problem("schedule", "schedule-not-one-to-one-99-dated-bindings")
    for path, expected in observed.items():
        if sha(path) != expected:
            problem(path, "input-changed-while-independent-audit-running")
    report = {"schemaVersion": 1, "kind": "independent-daily-gen6-audit", "asOf": datetime.now(ZoneInfo("Europe/Prague")).isoformat(),
        "scope": "All 99 selected release boards; independent structural/trie/exact-cover algorithms; no manufacturing imports",
        "cutover": START.isoformat(), "lastDate": END.isoformat(), "timezone": "Europe/Prague", "counts": dict(counts),
        "bankFileSha256": observed[str(args.bank.resolve())], "bankContentHash": bank.get("contentHash"),
        "checkpointFileSha256": observed[str(args.checkpoint.resolve())], "lexiconSha256": LEXICON_HASH,
        "dictionarySize": len(words), "dictionaryHash": solver.dictionary_hash, "recognitionPlaintextSha256": sha(recognition_path),
        "requiredUnionSize": len(minimum), "recognitionMissingWords": missing, "allPassed": not issues, "issues": issues,
        "checks": results, "preCutover24Days": preceding, "repeatIntervals": distance_records,
        "maxExactWordOccurrences": max(occurrences.values(), default=0), "occurrenceHistogram": dict(Counter(occurrences.values())),
        "byMonthCounts": {month: dict(values) for month, values in monthly.items()}, "dateBoundaries": binding_results,
        "historySources": historical_files, "inputFilesSha256": observed,
        "sourceFilesVerified": len(snapshot["files"]), "preservedHistoryMeaning": "Raw histories read only; no player/XP/reward data accessed or changed",
        "humanPlaytest": "not performed; AI editorial review is a separate artifact", "releaseState": "content-approved-awaiting-deployment",
        "auditScriptSha256": sha(Path(__file__)), "totalSeconds": round(time.monotonic() - start_clock, 3)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("allPassed", "counts", "dictionarySize", "requiredUnionSize", "totalSeconds", "issues")}, ensure_ascii=False), flush=True)
    raise SystemExit(0 if not issues else 1)


if __name__ == "__main__":
    main()
