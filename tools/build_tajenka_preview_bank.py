"""Build the deterministic 10-week Tajenka preview bank.

The generator deliberately treats board shape and path curvature as product
contracts. A generated board is rejected unless every word bends at least
twice, no word contains a long straight run, and the silhouette contains both
unused letters and visible cut-outs.
"""

from __future__ import annotations

import json
import itertools
import random
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "tajenka_weekend_v1.json"
ROWS = COLS = 6
REWARD_XP = 200
LEXICON = ROOT / "data" / "lexicon_v2.json"


DRAFT_PUZZLES = [
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

# Curated copy bank. Every phrase has exactly five distinct 5-7 letter words
# and 27-28 phrase cells, leaving room for four holes and 4-5 intentional
# decoys. The older draft above stays visible in history for auditability, but
# is deliberately not fed into the quality generator.
PUZZLES = [
    {
        "title": "První krok",
        "selectedAttempt": 2,
        "candidatePool": 5,
        "phrase": "KAŽDÁ CESTA ZAČÍNÁ PRVNÍM KROKEM",
        "clues": [
            "Jedna po druhé, bez výjimky.",
            "Trasa vedoucí k cíli.",
            "Má svůj první okamžik.",
            "V pořadí úplně na začátku.",
            "Jedním pohybem při chůzi.",
        ],
    },
    {
        "title": "Vůně domova",
        "selectedAttempt": 3,
        "candidatePool": 6,
        "phrase": "TEPLÝ CHLÉB PROVONÍ CELOU KUCHYŇ",
        "clues": [
            "Mající příjemně vyšší teplotu.",
            "Pečený bochník z mouky.",
            "Naplní příjemnou vůní.",
            "Úplnou, bez vynechané části.",
            "Místnost určená k vaření.",
        ],
    },
    {
        "title": "První tón",
        "selectedAttempt": 1,
        "candidatePool": 6,
        "phrase": "HUDBA RÁZEM PROBUDÍ OSPALÉ HOSTY",
        "clues": [
            "Uspořádané tóny a rytmus.",
            "Náhle a okamžitě.",
            "Vytrhne ze spánku.",
            "Takové, kterým se chce spát.",
            "Pozvané návštěvníky.",
        ],
    },
    {
        "title": "Bílé město",
        "selectedAttempt": 5,
        "candidatePool": 6,
        "phrase": "TICHÉ VLOČKY PROMĚNÍ ZNÁMÉ ULICE",
        "clues": [
            "Nevydávající téměř žádný zvuk.",
            "Jednotlivé krystalky sněhu.",
            "Změní podobu.",
            "Dobře rozpoznatelné z dřívějška.",
            "Cesty mezi městskými domy.",
        ],
    },
    {
        "title": "Kočičí palác",
        "selectedAttempt": 1,
        "candidatePool": 4,
        "phrase": "KOČKA BYDLÍ UVNITŘ STARÉ KRABICE",
        "clues": [
            "Domácí šelma, která často přede.",
            "Má někde svůj domov.",
            "Ve vnitřním prostoru.",
            "Existující nebo používané dlouhou dobu.",
            "Pevná nádoba, často z kartonu.",
        ],
    },
    {
        "title": "Brána příběhů",
        "selectedAttempt": 4,
        "candidatePool": 6,
        "phrase": "KNIHA OTEVÍRÁ BRÁNU ÚPLNĚ JINAM",
        "clues": [
            "Svázané stránky určené ke čtení.",
            "Zpřístupňuje cestu nebo průchod.",
            "Velký vstup nebo průchod.",
            "Beze zbytku, naprosto.",
            "Na jiné místo či jiným směrem.",
        ],
    },
    {
        "title": "Konec snění",
        "selectedAttempt": 4,
        "candidatePool": 5,
        "phrase": "BUDÍK PLAŠÍ ZBYTKY RANNÍHO SNĚNÍ",
        "clues": [
            "Hodiny, které mají zazvonit.",
            "Nutí něco leknout se nebo zmizet.",
            "Malé části, které zůstaly.",
            "Patřícího začátku dne.",
            "Příběhů odehrávajících se ve spánku.",
        ],
    },
    {
        "title": "Tajná trasa",
        "selectedAttempt": 4,
        "candidatePool": 6,
        "phrase": "VČELY ZNAJÍ TAJNOU TRASU KVĚTIN",
        "clues": [
            "Hmyz, který opyluje a vyrábí med.",
            "Dobře se v něčem vyznají.",
            "Skrytou před ostatními.",
            "Předem určenou cestu.",
            "Rostlin pěstovaných pro jejich květy.",
        ],
    },
    {
        "title": "Stopy v písku",
        "selectedAttempt": 3,
        "candidatePool": 6,
        "phrase": "SLANÝ PŘÍBOJ SMAŽE LIDSKÉ STOPY",
        "clues": [
            "Obsahující chuť mořské soli.",
            "Vlny narážející na pobřeží.",
            "Odstraní tak, že nic nezůstane.",
            "Patřící člověku nebo lidem.",
            "Otisky zanechané pohybem.",
        ],
    },
    {
        "title": "Šepot korun",
        "selectedAttempt": 1,
        "candidatePool": 6,
        "phrase": "VÁNEK ZVEDÁ ZELENÉ LISTÍ STROMŮ",
        "clues": [
            "Slabý a příjemný vítr.",
            "Nese vzhůru nebo uvádí do pohybu.",
            "Mající barvu čerstvé trávy.",
            "Souhrn listů rostoucích na větvích.",
            "Vysokých dřevin s kmenem a korunou.",
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


def quadrant(cell: int) -> int:
    row, col = divmod(cell, COLS)
    return (2 if row >= ROWS // 2 else 0) + (1 if col >= COLS // 2 else 0)


@lru_cache(maxsize=None)
def winding_paths(length: int) -> tuple[tuple[int, ...], ...]:
    """Enumerate strongly winding paths once; words later choose independently."""

    result: list[tuple[int, ...]] = []
    for start in range(ROWS * COLS):
        path = [start]
        used = {start}

        def visit() -> None:
            if len(path) == length:
                if turns(path) >= 3 and len({quadrant(cell) for cell in path}) >= 2:
                    result.append(tuple(path))
                return
            previous_direction = direction(path[-2], path[-1]) if len(path) >= 2 else None
            for cell in neighbours(path[-1]):
                if cell in used:
                    continue
                next_direction = direction(path[-1], cell)
                # A path should visibly curl. Even a two-edge straight run made
                # the old boards read as lanes instead of woven words.
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
            pair = tuple(sorted((owner, other_owner)))
            pairs.add(pair)
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


def topology_acceptable(paths: list[list[int]]) -> bool:
    stats = topology_stats(paths)
    return (
        stats["crossWordEdges"] >= 13
        and stats["crossWordPairs"] >= 7
        and stats["nonSequentialEdges"] >= 8
        and stats["sequentialBoundaries"] <= 1
        and stats["quadrantCrossers"] >= 3
        and stats["minWordContacts"] >= 2
    )


def build_independent_paths(words: list[str], seed: int) -> list[list[int]]:
    """Search for five independently placed, genuinely interleaved paths."""

    lengths = [len(word) for word in words]
    if not 27 <= sum(lengths) <= 28:
        raise ValueError(f"Tajenka needs 27-28 phrase cells, got {sum(lengths)} for {lengths}")
    rng = random.Random(seed)
    pools = {length: winding_paths(length) for length in set(lengths)}
    best: tuple[float, list[list[int]]] | None = None
    accepted: list[list[int]] | None = None

    for restart in range(1_600):
        placement_order = list(range(len(lengths)))
        rng.shuffle(placement_order)
        placement_order.sort(key=lambda index: -lengths[index] + rng.random() * 1.6)
        paths: list[list[int] | None] = [None] * len(lengths)
        used: set[int] = set()
        owners: dict[int, int] = {}
        node_budget = [2_200]

        def place(position: int) -> bool:
            nonlocal best, accepted
            if node_budget[0] <= 0:
                return False
            if position == len(placement_order):
                complete = [list(path) for path in paths if path is not None]
                if len(complete) != len(lengths):
                    return False
                base_letters = [""] * (ROWS * COLS)
                for word, path in zip(words, complete):
                    for cell, letter in zip(path, word):
                        base_letters[cell] = letter
                base_mask = {cell for path in complete for cell in path}
                if branch_stats(words, complete, base_letters, base_mask, set())["alternativeFullPaths"]:
                    return False
                score = topology_score(complete)
                if best is None or score > best[0]:
                    best = (score, complete)
                if topology_acceptable(complete):
                    accepted = complete
                    return True
                return False

            word_index = placement_order[position]
            available = []
            pool = pools[lengths[word_index]]
            # Sampling makes restarts explore different geometries without
            # repeatedly sorting every possible winding path.
            sample = rng.sample(pool, min(len(pool), 520))
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
            branch = available[: min(24, len(available))]
            if position == 0:
                rng.shuffle(branch)
            for _, candidate in branch:
                node_budget[0] -= 1
                paths[word_index] = candidate
                used.update(candidate)
                owners.update({cell: word_index for cell in candidate})
                if place(position + 1):
                    return True
                for cell in candidate:
                    used.remove(cell)
                    owners.pop(cell)
                paths[word_index] = None
            return False

        if place(0) and accepted is not None:
            return accepted

    if best is None:
        raise RuntimeError(f"Unable to place independent Tajenka paths for {lengths}")
    raise RuntimeError(
        f"No release-quality topology for {lengths}; best={topology_stats(best[1])} score={best[0]:.1f}"
    )


def cross_word_edges(owners: dict[int, int]) -> int:
    return sum(
        1
        for cell, owner in owners.items()
        for other in neighbours(cell)
        if cell < other and other in owners and owners[other] != owner
    )


def spelling_paths(word: str, letters: list[str], mask: set[int], limit: int = 200) -> list[tuple[int, ...]]:
    """Return all visible paths spelling `word`, capped for pathological boards."""

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


@lru_cache(maxsize=1)
def dictionary_prefixes() -> dict[int, set[str]]:
    payload = json.loads(LEXICON.read_text(encoding="utf-8"))
    words = {
        str(entry.get("word") or "").strip().upper()
        for entry in payload.get("entries", [])
        if entry.get("review") == "approved" and len(str(entry.get("word") or "").strip()) >= 4
    }
    return {
        depth: {word[:depth] for word in words if len(word) > depth}
        for depth in (2, 3)
    }


def plausible_prefix_paths(letters: list[str], mask: set[int], depth: int) -> set[tuple[int, ...]]:
    prefixes = dictionary_prefixes()[depth]
    found: set[tuple[int, ...]] = set()
    for start in mask:
        path = [start]
        used = {start}

        def visit() -> None:
            text = "".join(letters[cell] for cell in path)
            if not any(prefix.startswith(text) for prefix in prefixes):
                return
            if len(path) == depth:
                if text in prefixes:
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


def branch_stats(words: list[str], paths: list[list[int]], letters: list[str], mask: set[int], decoys: set[int]) -> dict:
    legitimate = {
        depth: {tuple(path[:depth]) for path in paths if len(path) >= depth}
        for depth in (2, 3)
    }
    prefix_paths = {
        depth: plausible_prefix_paths(letters, mask, depth) - legitimate[depth]
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


def decorate_with_decoys(words: list[str], paths: list[list[int]], seed: int) -> tuple[list[int], list[str], dict]:
    owners = {cell: owner for owner, path in enumerate(paths) for cell in path}
    base_letters = [""] * (ROWS * COLS)
    for word, path in zip(words, paths):
        for cell, letter in zip(path, word):
            base_letters[cell] = letter
    remaining = [cell for cell in range(ROWS * COLS) if cell not in owners]
    decoy_count = 32 - len(owners)
    if decoy_count not in (4, 5):
        raise ValueError(f"Expected 4-5 decoys, got {decoy_count}")

    # Only letters with a chance to form a real prefix are useful. This keeps
    # decoys from regressing into arbitrary visual noise.
    prefix2 = dictionary_prefixes()[2]
    rng = random.Random(seed)
    best: tuple[float, list[int], list[str], dict] | None = None
    subsets = list(itertools.combinations(remaining, decoy_count))
    rng.shuffle(subsets)

    for subset in subsets:
        decoys = set(subset)
        mask = set(owners) | decoys
        holes = set(range(ROWS * COLS)) - mask
        row_fill = [sum(cell in mask for cell in range(row * COLS, (row + 1) * COLS)) for row in range(ROWS)]
        col_fill = [sum(row * COLS + col in mask for row in range(ROWS)) for col in range(COLS)]
        if len({quadrant(cell) for cell in holes}) < 3 or min(row_fill) < 4 or min(col_fill) < 4:
            continue
        if len({quadrant(cell) for cell in decoys}) < 3:
            continue
        decoy_edges = sum(
            1 for cell in decoys for other in neighbours(cell)
            if cell < other and other in decoys
        )
        if decoy_edges > 1:
            continue
        candidate_letters = {}
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
            candidate_letters[cell] = sorted(options or {letter for word in words for letter in word[:3]})
        for _ in range(260):
            letters = list(base_letters)
            for cell in decoys:
                letters[cell] = rng.choice(candidate_letters[cell])
            stats = branch_stats(words, paths, letters, mask, decoys)
            if stats["alternativeFullPaths"]:
                continue
            score = (
                min(stats["falsePrefixes2"], 14) * 2.0
                + min(stats["falsePrefixes3"], 7) * 4.0
                + stats["meaningfulDecoys"] * 8.0
                + min(stats["falsePrefixStartCells"], 10) * 1.5
                + min(stats["falsePrefixFamilies"], 10) * 1.0
                - max(0, stats["falsePrefixes2"] - 16) * 1.5
            )
            if best is None or score > best[0]:
                stats = {
                    **stats,
                    "holeQuadrants": len({quadrant(cell) for cell in holes}),
                    "decoyQuadrants": len({quadrant(cell) for cell in decoys}),
                    "decoyAdjacencyEdges": decoy_edges,
                    "minRowFill": min(row_fill),
                    "minColFill": min(col_fill),
                }
                best = (score, sorted(mask), letters, stats)
            if (
                stats["falsePrefixes2"] >= 6
                and stats["falsePrefixes3"] >= 2
                and stats["falsePrefixStartCells"] >= 4
                and stats["falsePrefixFamilies"] >= 3
                and stats["meaningfulDecoys"] == decoy_count
            ):
                return sorted(mask), letters, {
                    **stats,
                    "holeQuadrants": len({quadrant(cell) for cell in holes}),
                    "decoyQuadrants": len({quadrant(cell) for cell in decoys}),
                    "decoyAdjacencyEdges": decoy_edges,
                    "minRowFill": min(row_fill),
                    "minColFill": min(col_fill),
                }

    if best is None:
        raise RuntimeError("Unable to place fair Tajenka decoys")
    raise RuntimeError(f"No release-quality decoys; best={best[3]} score={best[0]:.1f}")


def make_puzzle(index: int, source: dict) -> dict:
    words = source["phrase"].split()
    lengths = [len(word) for word in words]
    candidates: list[tuple[float, list[list[int]], tuple[list[int], list[str], dict]]] = []
    last_error: Exception | None = None
    selected_attempt = int(source["selectedAttempt"])
    for attempt in (selected_attempt,):
        try:
            candidate = build_independent_paths(words, seed=41 + index * 97 + attempt * 10_003)
            decoration = decorate_with_decoys(words, candidate, seed=8_100 + index + attempt * 7_919)
            topology = topology_stats(candidate)
            branching = decoration[2]
            score = (
                topology_score(candidate)
                + min(branching["falsePrefixes3"], 45) * 0.6
                + min(branching["falsePrefixStartCells"], 24) * 0.8
                + branching["holeQuadrants"] * 3.0
                + branching["decoyQuadrants"] * 3.0
                - branching["decoyAdjacencyEdges"] * 4.0
            )
            candidates.append((score, candidate, decoration))
        except RuntimeError as error:
            last_error = error
    if not candidates:
        raise RuntimeError(f"Unable to build release-quality board {index}: {last_error}")
    quality_score, paths, decoration = max(candidates, key=lambda item: item[0])
    owners = {cell: answer_index for answer_index, word_path in enumerate(paths) for cell in word_path}
    mask, letters, branching = decoration
    decoy_count = len(mask) - len(owners)
    topology = topology_stats(paths)

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
        "id": f"tajenka-v2-week-{index:02d}",
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
            "phraseCells": len(owners),
            "decoyCells": decoy_count,
            "verified": True,
            "curvyWords": len(words),
            **topology,
            **branching,
            "candidatePool": int(source["candidatePool"]),
            "selectedAttempt": selected_attempt,
            "qualityScore": round(quality_score, 2),
            "pathStyle": "independent_interleaved_with_intentional_decoys",
            "previewOnly": True,
            "rewardXp": REWARD_XP,
        },
    }
    validate_puzzle(puzzle)
    return puzzle


def validate_puzzle(puzzle: dict) -> None:
    assert puzzle["rows"] == puzzle["cols"] == 6
    assert len(puzzle["mask"]) == 32
    assert 36 - len(puzzle["mask"]) == 4
    assert 4 <= puzzle["meta"]["decoyCells"] <= 5
    assert puzzle["meta"]["crossWordEdges"] >= 13
    assert puzzle["meta"]["crossWordPairs"] >= 7
    assert puzzle["meta"]["nonSequentialEdges"] >= 8
    assert puzzle["meta"]["sequentialBoundaries"] <= 1
    assert puzzle["meta"]["minWordContacts"] >= 2
    assert puzzle["meta"]["falsePrefixes2"] >= 6
    assert puzzle["meta"]["falsePrefixes3"] >= 2
    assert puzzle["meta"]["meaningfulDecoys"] == puzzle["meta"]["decoyCells"]
    assert puzzle["meta"]["alternativeFullPaths"] == 0
    assert puzzle["meta"]["holeQuadrants"] >= 3
    assert puzzle["meta"]["decoyQuadrants"] >= 3
    assert puzzle["meta"]["decoyAdjacencyEdges"] <= 1
    assert puzzle["meta"]["minRowFill"] >= 4
    assert puzzle["meta"]["minColFill"] >= 4
    mask = set(puzzle["mask"])
    used: set[int] = set()
    for answer in puzzle["answers"]:
        path = answer["path"]
        assert len(path) == len(answer["word"])
        assert not (used & set(path))
        assert set(path) <= mask
        assert turns(path) == answer["turns"] >= 3
        assert longest_run(path) == answer["curlRun"] == 1
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
            f"pairs={puzzle['meta']['crossWordPairs']}",
            f"nonseq={puzzle['meta']['nonSequentialEdges']}",
            f"prefix2={puzzle['meta']['falsePrefixes2']}",
            f"prefix3={puzzle['meta']['falsePrefixes3']}",
        )


if __name__ == "__main__":
    main()
