"""Build the deterministic 10-week Tajenka preview bank.

The generator deliberately treats board shape and path curvature as product
contracts. A generated board is rejected unless every word bends at least
twice, no word contains a long straight run, and the silhouette contains both
unused letters and visible cut-outs.
"""

from __future__ import annotations

import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "tajenka-test.json"
ROWS = COLS = 6
REWARD_XP = 200


PUZZLES = [
    {
        "title": "První krok",
        "phrase": "KAŽDÁ CESTA ZAČÍNÁ PRVNÍM KROKEM",
        "clues": [
            "Platí pro jednu po druhé — bez výjimky.",
            "Vede odněkud někam.",
            "Je to opak toho, když něco končí.",
            "Označuje úplný začátek pořadí.",
            "Uděláš ho, když se vydáš vpřed.",
        ],
    },
    {
        "title": "Roste s tebou",
        "phrase": "ODVAHA ROSTE KAŽDÝM MALÝM KROKEM",
        "clues": [
            "Pomůže vykročit, i když máš obavy.",
            "Postupně se zvětšuje.",
            "Znamená jedním po druhém, bez vynechání.",
            "Není velký, ale pořád se počítá.",
            "Pohybem, kterým se jde vpřed.",
        ],
    },
    {
        "title": "Lehčí cesta",
        "phrase": "TRPĚLIVOST MĚNÍ TĚŽKÉ VĚCI LEHKÝMI",
        "clues": [
            "Schopnost vydržet bez zbytečného spěchu.",
            "Proměňuje něco v něco jiného.",
            "Nejdou snadno a stojí úsilí.",
            "Předměty, úkoly nebo záležitosti.",
            "Takovými, které už tolik netíží.",
        ],
    },
    {
        "title": "Radost se násobí",
        "phrase": "SDÍLENÁ RADOST ROSTE KAŽDÝM ÚSMĚVEM",
        "clues": [
            "Taková, o kterou se podělíš s ostatními.",
            "Příjemný pocit, který chceš předat dál.",
            "Postupně se zvětšuje.",
            "Znamená jedním po druhém, bez vynechání.",
            "Výrazem tváře, který prozradí dobrou náladu.",
        ],
    },
    {
        "title": "Nové světy",
        "phrase": "ZVĚDAVÁ MYSL OTEVÍRÁ NOVÉ SVĚTY",
        "clues": [
            "Taková, která se pořád ptá proč a jak.",
            "Přemýšlí, pamatuje si a hledá souvislosti.",
            "Dělá něco přístupným.",
            "Čerstvé, dosud nepoznané.",
            "Místa, možnosti nebo celé vesmíry.",
        ],
    },
    {
        "title": "Příběh zůstává",
        "phrase": "DOBRÝ PŘÍBĚH ZŮSTÁVÁ DLOUHO ŽIVÝ",
        "clues": [
            "Takový, který se opravdu povedl.",
            "Vyprávění s postavami a dějem.",
            "Nemizí ani neodchází.",
            "Po velkou část času.",
            "Pořád působí, jako by dýchal.",
        ],
    },
    {
        "title": "Nový začátek",
        "phrase": "KAŽDÉ RÁNO NABÍZÍ NOVÝ ZAČÁTEK",
        "clues": [
            "Platí pro jedno po druhém — bez výjimky.",
            "Část dne po probuzení.",
            "Dává možnost vybrat si.",
            "Ještě nepoužitý nebo právě vzniklý.",
            "První část něčeho, co přichází.",
        ],
    },
    {
        "title": "Správný směr",
        "phrase": "CHYBY ČASTO UKAZUJÍ SPRÁVNÝ SMĚR",
        "clues": [
            "Nepovedené kroky, ze kterých se dá poučit.",
            "Děje se to mnohokrát, ne výjimečně.",
            "Pomáhají něco spatřit nebo pochopit.",
            "Takový, který vede k dobrému cíli.",
            "Určuje, kudy se vydat.",
        ],
    },
    {
        "title": "Jasnější řešení",
        "phrase": "KLIDNÁ HLAVA VIDÍ ŘEŠENÍ JASNĚJI",
        "clues": [
            "Taková, kterou nerozhodil stres.",
            "Část těla, ale také obrazně způsob uvažování.",
            "Dokáže něco spatřit.",
            "Odpověď, která odstraní problém.",
            "Srozumitelněji a s menšími pochybami.",
        ],
    },
    {
        "title": "Velké nápady",
        "phrase": "VELKÉ NÁPADY ROSTOU MALÝMI KROKY",
        "clues": [
            "Takové, které se jen tak někam nevejdou.",
            "Myšlenky, ze kterých může něco vzniknout.",
            "Postupně se zvětšují.",
            "Drobnými, ale důležitými.",
            "Pohyby, kterými se jde vpřed.",
        ],
    },
]


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


def turns(path: list[int]) -> int:
    dirs = [direction(a, b) for a, b in zip(path, path[1:])]
    return sum(a != b for a, b in zip(dirs, dirs[1:]))


def longest_run(path: list[int]) -> int:
    dirs = [direction(a, b) for a, b in zip(path, path[1:])]
    longest = current = 1
    for previous, current_dir in zip(dirs, dirs[1:]):
        current = current + 1 if previous == current_dir else 1
        longest = max(longest, current)
    return longest


def segment_bounds(lengths: list[int]) -> list[tuple[int, int]]:
    start = 0
    result = []
    for length in lengths:
        result.append((start, start + length))
        start += length
    return result


def valid_segments(path: list[int], lengths: list[int]) -> bool:
    return all(
        turns(path[start:end]) >= 2 and longest_run(path[start:end]) <= 2
        for start, end in segment_bounds(lengths)
    )


def reachable_capacity(start: int, used: set[int]) -> int:
    seen = {start}
    stack = [start]
    while stack:
        cell = stack.pop()
        for nxt in neighbours(cell):
            if nxt not in used and nxt not in seen:
                seen.add(nxt)
                stack.append(nxt)
    return len(seen)


def build_path(lengths: list[int], seed: int) -> list[int]:
    total = sum(lengths)
    starts = {start for start, _ in segment_bounds(lengths)}
    ends = {end - 1: start for start, end in segment_bounds(lengths)}

    for restart in range(800):
        rng = random.Random(seed * 10_000 + restart)
        path = [rng.randrange(ROWS * COLS)]
        used = {path[0]}

        def search() -> bool:
            index = len(path) - 1
            if len(path) == total:
                return valid_segments(path, lengths)

            candidates = [cell for cell in neighbours(path[-1]) if cell not in used]
            rng.shuffle(candidates)

            def score(cell: int) -> tuple[float, float]:
                next_index = len(path)
                onward = sum(n not in used and n != cell for n in neighbours(cell))
                bend = 0.0
                if next_index not in starts and len(path) >= 2:
                    bend = 2.6 if direction(path[-2], path[-1]) != direction(path[-1], cell) else -1.8
                edge = 0.35 if cell // COLS in (0, ROWS - 1) or cell % COLS in (0, COLS - 1) else 0.0
                return (onward - bend + edge + rng.random() * 0.55, rng.random())

            candidates.sort(key=score)
            for cell in candidates:
                next_index = len(path)
                if next_index not in starts and len(path) >= 3:
                    first = direction(path[-2], path[-1])
                    second = direction(path[-1], cell)
                    if first == second and next_index >= 3:
                        segment_start = max(start for start in starts if start <= next_index)
                        if next_index - segment_start >= 2 and direction(path[-3], path[-2]) == first:
                            continue

                path.append(cell)
                used.add(cell)

                completed_index = len(path) - 1
                segment_start = ends.get(completed_index)
                segment_ok = segment_start is None or (
                    turns(path[segment_start:completed_index + 1]) >= 2
                    and longest_run(path[segment_start:completed_index + 1]) <= 2
                )
                enough_space = True
                remaining = total - len(path)
                if remaining and remaining >= 4:
                    enough_space = reachable_capacity(path[-1], used - {path[-1]}) >= remaining + 1

                if segment_ok and enough_space and search():
                    return True
                used.remove(cell)
                path.pop()
            return False

        if search():
            return path
    raise RuntimeError(f"Unable to generate winding path for {lengths}")


def cross_word_edges(owners: dict[int, int]) -> int:
    return sum(
        1
        for cell, owner in owners.items()
        for other in neighbours(cell)
        if cell < other and other in owners and owners[other] != owner
    )


def make_puzzle(index: int, source: dict) -> dict:
    words = source["phrase"].split()
    lengths = [len(word) for word in words]
    path = build_path(lengths, seed=41 + index * 97)
    bounds = segment_bounds(lengths)
    paths = [path[start:end] for start, end in bounds]
    owners = {cell: answer_index for answer_index, word_path in enumerate(paths) for cell in word_path}

    target_cells = max(32, min(34, len(path) + 6))
    decoy_count = target_cells - len(path)
    rng = random.Random(8_100 + index)
    available = [cell for cell in range(ROWS * COLS) if cell not in owners]
    available.sort(key=lambda cell: (-sum(n in owners for n in neighbours(cell)), rng.random()))
    decoys = available[:decoy_count]
    mask = sorted([*owners, *decoys])

    letters = [""] * (ROWS * COLS)
    for word, word_path in zip(words, paths):
        for cell, letter in zip(word_path, word):
            letters[cell] = letter
    decoy_letters = list("AEIOSTRNLMKPVZČŘŠŽÝÍ")
    rng.shuffle(decoy_letters)
    for cell, letter in zip(decoys, decoy_letters):
        letters[cell] = letter

    answers = [
        {
            "word": word,
            "path": word_path,
            "turns": turns(word_path),
            "curlRun": longest_run(word_path),
            "clue": clue,
        }
        for word, word_path, clue in zip(words, paths, source["clues"])
    ]
    puzzle = {
        "version": 1,
        "id": f"tajenka-week-{index:02d}",
        "kind": "weekend_bonus",
        "week": index,
        "title": source["title"],
        "description": "Najdi pět propletených slov mezi falešnými odbočkami. Každé odhalí další část tajenky.",
        "difficulty": "medium",
        "rows": ROWS,
        "cols": COLS,
        "mask": mask,
        "letters": letters,
        "lengths": lengths,
        "answers": answers,
        "tajenka": {"phrase": source["phrase"], "answerOrder": list(range(len(words)))},
        "meta": {
            "week": index,
            "cells": len(mask),
            "phraseCells": len(path),
            "decoyCells": len(decoys),
            "verified": True,
            "curvyWords": len(words),
            "crossWordEdges": cross_word_edges(owners),
            "pathStyle": "winding_with_decoys",
            "previewOnly": True,
            "rewardXp": REWARD_XP,
        },
    }
    validate_puzzle(puzzle)
    return puzzle


def validate_puzzle(puzzle: dict) -> None:
    assert puzzle["rows"] == puzzle["cols"] == 6
    assert 32 <= len(puzzle["mask"]) <= 34
    assert 2 <= 36 - len(puzzle["mask"]) <= 4
    assert puzzle["meta"]["decoyCells"] >= 3
    assert puzzle["meta"]["crossWordEdges"] >= 4
    mask = set(puzzle["mask"])
    used: set[int] = set()
    for answer in puzzle["answers"]:
        path = answer["path"]
        assert len(path) == len(answer["word"])
        assert not (used & set(path))
        assert set(path) <= mask
        assert turns(path) == answer["turns"] >= 2
        assert longest_run(path) == answer["curlRun"] <= 2
        assert "".join(puzzle["letters"][cell] for cell in path) == answer["word"]
        used.update(path)
    assert len(used) == puzzle["meta"]["phraseCells"]


def main() -> None:
    puzzles = [make_puzzle(index, source) for index, source in enumerate(PUZZLES, 1)]
    bank = {
        "version": 1,
        "kind": "weekend_bonus_bank",
        "weeks": len(puzzles),
        "rewardXp": REWARD_XP,
        "puzzles": puzzles,
    }
    OUTPUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for puzzle in puzzles:
        print(
            puzzle["id"],
            puzzle["tajenka"]["phrase"],
            f"cells={puzzle['meta']['cells']}",
            f"decoys={puzzle['meta']['decoyCells']}",
            f"turns={sum(answer['turns'] for answer in puzzle['answers'])}",
            f"cross={puzzle['meta']['crossWordEdges']}",
        )


if __name__ == "__main__":
    main()
