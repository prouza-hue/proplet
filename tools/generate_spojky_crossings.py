#!/usr/bin/env python3
"""Build the weekly Spojky bank and the four previously published pilot boards."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date, timedelta
import json
from pathlib import Path
import random

from generate_puzzles import BAD_SUBSTRINGS, enumerate_candidates, neighbours, path_turn_metrics
from proplet_content.io import atomic_write_text


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/spojky/crossings.json"
OUTPUT = ROOT / "public/design/spojky/boards.js"
BANK = ROOT / "data/spojky_weeks.json"
PILOT_IDS = tuple(f"spojky-cross-{number:02d}-v1" for number in range(1, 5))


def draw_path(word, tiles, graph, rng, anchors, accept):
    """Grow both halves from a matching letter, without revisiting a cell."""
    rng.shuffle(anchors)
    for pivot, anchor in anchors[:14]:
        slots = list(range(pivot + 1, len(word))) + list(range(pivot - 1, -1, -1))
        path = [-1] * len(word)
        path[pivot] = anchor

        def extend(position):
            if position == len(slots):
                return tuple(path) if accept(path) else None
            slot = slots[position]
            previous = path[slot - 1 if slot > pivot else slot + 1]
            choices = list(graph[previous])
            rng.shuffle(choices)
            for cell in choices:
                if cell in path or tiles[cell] not in ("", word[slot]):
                    continue
                path[slot] = cell
                result = extend(position + 1)
                if result is not None:
                    return result
                path[slot] = -1
            return None

        result = extend(0)
        if result is not None:
            return result
    return None


def plant(word, path, tiles):
    for letter, cell in zip(word, path):
        tiles[cell] = letter


def place_words(words, tiles, graph, cols, rng):
    order = list(range(len(words)))
    rng.shuffle(order)
    paths = [()] * len(words)
    for number, index in enumerate(order):
        word = words[index]
        if number == 0:
            anchors = [(0, cell) for cell in range(len(tiles))]
        else:
            anchors = [(offset, cell) for offset, letter in enumerate(word)
                       for cell, old in enumerate(tiles) if old == letter]
        path = draw_path(word, tiles, graph, rng, anchors,
                         lambda trace: path_turn_metrics(list(trace), cols)[0] >= 1)
        if path is None:
            return None
        plant(word, path, tiles)
        paths[index] = path
    return paths


def add_false_starts(words, paths, depths, tiles, graph, rng):
    for word, solution, depth in zip(words, paths, depths):
        # Start each decoy on a different physical copy of the opening letter.
        anchors = [(0, cell) for cell, old in enumerate(tiles)
                   if cell != solution[0] and old in ("", word[0])]
        decoy = draw_path(word[:depth], tiles, graph, rng, anchors,
                          lambda trace: sum(a != b for a, b in zip(trace, solution)) >= 2)
        if decoy is None:
            return False
        plant(word, decoy, tiles)
    return True


def layout(spec):
    rows, cols = spec["height"], spec["width"]
    words = [answer["word"] for answer in spec["answers"]]
    if len(words) != 3 or len(set(words)) != 3:
        raise ValueError(f"{spec['id']}: zadej tři různá slova.")
    for word in words:
        other_letters = set("".join(other for other in words if other != word))
        if other_letters.isdisjoint(word):
            raise ValueError(f"{spec['id']}: {word} nesdílí s ostatními slovy žádné písmeno "
                             "se stejnou diakritikou. Zvol jinou spojku.")
    depths = [min(len(word) - 1, spec["falseStartLength"]) for word in words]
    rng = random.Random(spec["seed"])
    cells = list(range(rows * cols))
    mask = set(cells)
    graph = [list(neighbours(cell, rows, cols, mask)) for cell in cells]
    forbidden = set(spec["avoid"]) | {word.upper() for word in BAD_SUBSTRINGS}
    forbidden.update("PÍČA PÍČO KUNDA KURVA ČURÁK KOKOT HOVNO SRAČ MRDKA MRDÁ DEBIL".split())
    for blocked in sorted(forbidden):
        if any(blocked in word or blocked[::-1] in word for word in words):
            raise ValueError(f"{spec['id']}: vyloučenému výrazu {blocked} se nelze vyhnout "
                             "na cestě některé ze spojek.")
    screened = sorted(forbidden | set(words))
    lengths = {len(word) for word in screened}
    alphabet = "".join(words) + "AEIOKLNRST"

    for _ in range(25000):
        tiles = [""] * len(cells)
        paths = place_words(words, tiles, graph, cols, rng)
        if paths is None:
            continue
        occupancy = Counter(cell for path in paths for cell in path)
        shared = {cell for cell, count in occupancy.items() if count > 1}
        if len(occupancy) == len(cells):
            continue
        if len(shared) < spec["minShared"] or any(shared.isdisjoint(path) for path in paths):
            continue
        if len({cell // cols for cell in occupancy}) < rows - 1 or len({cell % cols for cell in occupancy}) < cols - 1:
            continue
        if not add_false_starts(words, paths, depths, tiles, graph, rng):
            continue
        tiles = [old or rng.choice(alphabet) for old in tiles]
        candidates = enumerate_candidates(tiles, rows, cols, cells, lengths, screened)
        counts = Counter(candidate.word for candidate in candidates)
        # With exactly one complete path each, every planted alternative start
        # is a genuine dead end and every last word has to reuse a found tile.
        if counts == Counter(words):
            return {**{key: spec[key] for key in ("id", "start", "chain", "shuffle")},
                    "rows": ["".join(tiles[i:i + cols]) for i in range(0, len(tiles), cols)],
                    "answers": [dict(answer, path=list(path)) for answer, path in zip(spec["answers"], paths)]}
    raise ValueError(f"{spec['id']}: pro daná slova a rozměry se nepodařilo umístit křížení a slepé cesty.")


def render(boards, launch_date=None):
    def js(value):
        return json.dumps(value, ensure_ascii=False)

    lines = ["// Generated by tools/generate_spojky_crossings.py from content/spojky/crossings.json."]
    if launch_date is not None:
        lines.append(f"export const launchDate = {js(launch_date)};")
    lines.append("export const boards = [")
    for board in boards:
        lines.append("  {")
        for key in ("id", "start", "rows", "chain", "shuffle"):
            lines.append(f"    {key}: {js(board[key])},")
        lines.append("    answers: [")
        for answer in board["answers"]:
            lines.append("      {")
            for key in ("word", "clue", "explanation", "path"):
                lines.append(f"        {key}: {js(answer[key])},")
            lines.append("      },")
        lines.extend(["    ],", "  },"])
    return "\n".join([*lines, "];", ""])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, help="write a standalone JS export; only the pilot may be public")
    parser.add_argument("--bank-output", type=Path, help="write the server-side weekly bank")
    parser.add_argument("--check", action="store_true", help="verify that the checked-in grids can be reproduced")
    args = parser.parse_args()
    if args.output is None and args.bank_output is None:
        args.output, args.bank_output = OUTPUT, BANK
    specs = json.loads(args.input.read_text(encoding="utf-8"))
    if not specs:
        parser.error("The editorial source must contain at least one week.")
    boards = [layout(spec) for spec in specs]
    outputs = {}
    if args.output is not None:
        if args.output.resolve().is_relative_to(ROOT / "public"):
            by_id = {board["id"]: board for board in boards}
            outputs[args.output] = render([by_id[board_id] for board_id in PILOT_IDS], specs[0]["launchDate"])
        else:
            outputs[args.output] = render(boards)
    if args.bank_output is not None:
        if args.bank_output.resolve().is_relative_to(ROOT / "public"):
            parser.error("The weekly bank belongs outside public/.")
        starts = [date.fromisoformat(board["start"]) for board in boards]
        launch = date.fromisoformat(specs[0]["launchDate"])
        if (starts[0].weekday() != 0 or not 0 <= (starts[0] - launch).days <= 6
                or any(b - a != timedelta(days=7) for a, b in zip(starts, starts[1:]))
                or len({board["id"] for board in boards}) != len(boards)):
            parser.error("Each board needs a stable unique ID and a consecutive Monday; check the opening week.")
        bank = {"launchDate": launch.isoformat(), "boards": boards}
        outputs[args.bank_output] = json.dumps(bank, ensure_ascii=False, indent=2) + "\n"
    for path, result in outputs.items():
        if args.check:
            if path.read_text(encoding="utf-8") != result:
                raise SystemExit(f"Generated boards differ from {path}")
        else:
            atomic_write_text(path, result)


if __name__ == "__main__":
    main()
