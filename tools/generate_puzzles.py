#!/usr/bin/env python3
"""Generate Proplet puzzle banks and validate uniqueness with an exact-cover solver.

Dictionary source: hermitdave/FrequencyWords Czech 50k list (CC BY-SA 4.0).
The runtime game ships a filtered ~12k-word validator lexicon plus a manually curated A–D answer vocabulary.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
import argparse
import json
import random
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from proplet_content.io import atomic_write_text

SOURCE = ROOT / "data" / "source_cs_50k.txt"
WORDS_OUT = ROOT / "data" / "words.txt"
ANSWER_TIERS = ROOT / "data" / "answer_tiers.json"
PUZZLES_SERVER_OUT = ROOT / "data" / "puzzles.json"

CZ_RE = re.compile(r"^[a-záčďéěíňóřšťúůýž]+$", re.I)
BAD_SUBSTRINGS = (
    "fuck", "shit", "porn", "sex", "kurev", "kurv", "píč", "kokot",
    "hovno", "prdel", "mrdat", "šukat", "sukat", "čurák", "curak", "nacist", "hitler",
)

# Words removed editorially from target answers still belong in the validator.
# The solver must see them so an accidental alternative path cannot slip through.
EDITORIAL_VALIDATOR_WORDS = {"nocebo", "trebuchet", "sofismus", "černodíra", "perigeum", "aerogel"}
FUNCTION_WORDS = set("""
aby abych abys abyso abyste ale ani ano asi bez bude budou byl byla byli bylo byly bych bychom
byste co což do ho i já jak jaká jaké jaký je jeho jej její jsem jsi jsme jste jsou když kdo kde
kam která které který mi mě mu my na nad nám nás ne než nic o od on ona oni ono pak po pod pro
před při se si s ta tak tam ten ti to tu ty u už v ve vy z za ze že
""".split())

# Common names are legal Czech strings but make poor family word-puzzle answers.
NAME_BLOCK = set("""
jack john mike michael david peter paul james george tom thomas sam charlie frank steve steven
robert bob bill william richard rick mark matt dan daniel chris kevin brian jerry kyle ryan
johnny jim jimmy joe joey tony nick harry henry ben alex max luke lucas adam eric alan
mary sarah anna anne jane kate katie emma lisa linda susan karen laura jessica rachel rose
monica nicole angela barbara maria julie julia lucy emily amy alice
jan jana petr petra pavel martin tomáš tomas jiří jiri josef josefka karel eva hana lenka
lucie veronika martin ondřej ondrej michal david jakub lukáš lukas
""".split())

# Intended answers live in data/answer_tiers.json.  The FrequencyWords corpus below is
# deliberately *validator-only*: it helps the exact-cover solver discover accidental Czech
# words on a board, but it is never allowed to leak subtitle/dialogue forms into target answers.

VOCAB_POLICIES = {
    "rescue": {
        "allowed": ("A",), "weights": {"A": 1}, "min_avg_fun": 2.7,
    },
    "easy": {
        "allowed": ("A",), "weights": {"A": 1}, "min_avg_fun": 2.7,
    },
    "medium": {
        "allowed": ("A", "B"), "weights": {"A": 2, "B": 5},
        "min_fraction": {"B": 0.45}, "min_avg_fun": 2.8, "min_fun_words": 1,
    },
    "hard_bridge": {
        "allowed": ("B", "C"), "weights": {"B": 4, "C": 3},
        "min_fraction": {"C": 0.30}, "max_fraction": {"C": 0.60},
        "min_avg_fun": 2.9, "min_fun_words": 1,
    },
    "hard": {
        "allowed": ("B", "C"), "weights": {"B": 2, "C": 5},
        "min_fraction": {"C": 0.45}, "min_avg_fun": 2.9, "min_fun_words": 1,
    },
    "hardcore": {
        "allowed": ("C", "D"), "weights": {"C": 2, "D": 5},
        "min_fraction": {"D": 0.50}, "min_avg_fun": 3.50, "min_fun_words": 4,
    },
    # The second hundred of Mozkožrout levels keeps the difficult geometry but
    # uses a calmer vocabulary profile.  Roughly a third to two fifths of a
    # board comes from a hand-reviewed, recognisable subset of D; the rest is C.
    # This deliberately excludes specialist curiosities such as NOCEBO or
    # MASTABA without turning Mozkožrout into another Hard bank.
    "hardcore_conservative": {
        "allowed": ("C", "D"), "weights": {"C": 5, "D": 2},
        "min_fraction": {"D": 0.32}, "max_fraction": {"D": 0.43},
        "min_avg_fun": 3.20, "min_fun_words": 3,
    },
    # Daily is deliberately family-wide: mostly B, with easy anchors from A and a restrained C share.
    "daily": {
        "allowed": ("A", "B", "C"), "weights": {"A": 3, "B": 5, "C": 1},
        "min_fraction": {"A": 0.15, "B": 0.35}, "max_fraction": {"C": 0.25},
        "min_avg_fun": 3.0, "min_fun_words": 1,
    },
}

# A word may be perfectly legitimate and still be a poor surprise in a family
# game.  This allowlist is intentionally editorial rather than frequency-only:
# it keeps terms that are broadly recognisable or immediately evocative, while
# omitting narrow linguistic, archaeological and scientific terminology.
CONSERVATIVE_D_WORDS = set("""
abstrakce absurdita adaptace akustika almanach ambice amnézie anagram analogie
analýza anomálie antihmota apokalypsa archetyp argument arkáda artefakt aspekt
astronaut asymetrie atom atribut automat autonomie autorita axiom axolotl
balista bazilišek bilance biochemie biometrie bionika biosféra biočip blockchain
buňka centimetr chaos charisma dedukce deficit definice dilema disciplína
diverzita dynamika dystopie echolokace efekt efektivita ekonomie element empatie
entita entropie estetika etika etymologie evidence faktor fenomén feromon fikce
fraktál frekvence funkce geolog grafit groteska gyroskop harmonie hierarchie
hieroglyf hromosvod hyperbola idea identita ideologie imaginace impuls index
instinkt integrál intuice ironie izotop kamufláž kapacita katapult kodex koloseum
kometa komplex komplexita kompromis koncepce koncept konflikt konsenzus kontext
kontrast kosmonaut kreativita kritika kritérium kryptoměna krystal kvantum kvark
limit logaritmus logika lunochod magnet materie mechanika menhir meteoroid model
mohyla molekula monolit morálka motiv mumie mystérium nanobot narval nekromant
neutrino norma nuance obelisk objekt observatoř odchylka optimum orbita organismus
osciloskop oxymóron palindrom panteon parabola paradigma paradox paralela parametr
patogen pentagram piktogram placebo plankton podstata polarita polygon poměr
potenciál praxe predátor preference premisa princip priorita proces pseudonym
ptakopysk radiace radon realita reflexe relativita rezonance režim rovnováha
rozpor rámec samizdat sarkofág schéma scénář sextant signál simulátor sklípkan
sloučenina spektrum spirála stabilita standard steampunk stoicismus struktura
subjekt symbol symetrie syntax syntéza systém sémantika taktika telepatie teleport
tendence teorie teze trend tsunami téma validita variace varianta vektor verze
vize vnímání vombat vzorec vědomí xenon závěr červodíra šotek žánr
""".split())



def clean_word(w: str) -> str | None:
    w = w.strip().lower()
    if not CZ_RE.fullmatch(w):
        return None
    # "sextant" is a perfectly suitable Czech target; only the standalone
    # explicit term is blocked, while the other stems remain substring guards.
    if w == "sex" or any(b in w for b in BAD_SUBSTRINGS if b != "sex"):
        return None
    if w in NAME_BLOCK:
        return None
    return w


def load_answer_tiers() -> tuple[dict[str, list[str]], dict[str, str]]:
    payload = json.loads(ANSWER_TIERS.read_text(encoding="utf-8"))
    raw_tiers = payload.get("tiers") or {}
    tiers: dict[str, list[str]] = {}
    tier_of: dict[str, str] = {}
    for tier in ("A", "B", "C", "D"):
        words: list[str] = []
        for raw in raw_tiers.get(tier, []):
            word = clean_word(str(raw))
            if not word or not 4 <= len(word) <= 10:
                raise RuntimeError(f"Invalid Tier {tier} answer: {raw!r}")
            if word in FUNCTION_WORDS or word in NAME_BLOCK:
                raise RuntimeError(f"Blocked Tier {tier} answer: {word}")
            if word in tier_of:
                raise RuntimeError(f"Answer appears in both Tier {tier_of[word]} and {tier}: {word}")
            tier_of[word] = tier
            words.append(word)
        tiers[tier] = words
    if any(len(tiers[t]) < 40 for t in tiers):
        raise RuntimeError(f"Answer tiers unexpectedly small: { {t: len(v) for t, v in tiers.items()} }")
    return tiers, tier_of


def load_answer_metadata() -> dict[str, dict]:
    payload = json.loads(ANSWER_TIERS.read_text(encoding="utf-8"))
    return {str(word): dict(meta) for word, meta in (payload.get("metadata") or {}).items()}


def build_answer_pools(tiers: dict[str, list[str]], metadata: dict[str, dict] | None = None) -> dict[str, list[str]]:
    pools: dict[str, list[str]] = {}
    for key, policy in VOCAB_POLICIES.items():
        weighted: list[str] = []
        for tier in policy["allowed"]:
            tier_weight = int(policy.get("weights", {}).get(tier, 1))
            tier_words = tiers[tier]
            if key == "hardcore_conservative" and tier == "D":
                tier_words = [word for word in tier_words if word in CONSERVATIVE_D_WORDS]
            for word in tier_words:
                fun = int((metadata or {}).get(word, {}).get("fun", 3))
                fun_weight = {1: 1, 2: 1, 3: 2, 4: 4, 5: 6}.get(fun, 2)
                weighted.extend([word] * tier_weight * fun_weight)
        pools[key] = weighted
    return pools


def tier_mix_ok(words: list[str], tier_of: dict[str, str], policy: dict) -> bool:
    if not words:
        return False
    counts = Counter(tier_of[w] for w in words)
    allowed = set(policy.get("allowed") or ())
    if any(t not in allowed for t in counts):
        return False
    n = len(words)
    for tier, fraction in (policy.get("min_fraction") or {}).items():
        if counts[tier] + 1e-9 < n * float(fraction):
            return False
    for tier, fraction in (policy.get("max_fraction") or {}).items():
        if counts[tier] - 1e-9 > n * float(fraction):
            return False
    return True


def load_frequency_words() -> list[tuple[str, int]]:
    rows: list[tuple[str, int]] = []
    seen: set[str] = set()
    with SOURCE.open(encoding="utf-8") as f:
        for line in f:
            try:
                word, count_s = line.rstrip().rsplit(" ", 1)
                count = int(count_s)
            except ValueError:
                continue
            word = clean_word(word)
            if not word or word in seen or not 3 <= len(word) <= 9:
                continue
            seen.add(word)
            rows.append((word, count))
    return rows


class TrieNode(dict):
    __slots__ = ("word",)
    def __init__(self):
        super().__init__()
        self.word: str | None = None


def build_trie(words: list[str], lengths: set[int]) -> TrieNode:
    root = TrieNode()
    for word in words:
        if len(word) not in lengths:
            continue
        node = root
        for ch in word:
            nxt = node.get(ch)
            if nxt is None:
                nxt = TrieNode()
                node[ch] = nxt
            node = nxt
        node.word = word
    return root


def neighbours(cell: int, rows: int, cols: int, mask: set[int]):
    r, c = divmod(cell, cols)
    for rr, cc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
        if 0 <= rr < rows and 0 <= cc < cols:
            j = rr * cols + cc
            if j in mask:
                yield j


def dense_random_path(rows: int, cols: int, size: int, rng: random.Random) -> list[int] | None:
    """Create a jagged, non-rectangular board with a guaranteed Hamiltonian path.

    Each row is one active interval. Their left/right edges wander independently, while
    alternating rows share the endpoint needed for a continuous serpentine path. This gives
    visibly irregular silhouettes without expensive path-search during generation.
    """
    min_width = 3 if cols <= 6 else 4
    for _ in range(5000):
        left: list[int] = []
        right: list[int] = []
        l0 = rng.randint(0, max(0, cols - min_width))
        r0 = rng.randint(l0 + min_width - 1, cols - 1)
        left.append(l0); right.append(r0)
        for r in range(1, rows):
            if r % 2 == 1:
                rr = right[-1]
                max_left = rr - min_width + 1
                ll = rng.randint(0, max_left)
            else:
                ll = left[-1]
                min_right = ll + min_width - 1
                rr = rng.randint(min_right, cols - 1)
            left.append(ll); right.append(rr)
        widths = [rr - ll + 1 for ll, rr in zip(left, right)]
        if sum(widths) != size:
            continue
        # Reject shapes that are effectively plain rectangles.
        if len(set(left)) < 2 or len(set(right)) < 2:
            continue
        path: list[int] = []
        for r, (ll, rr) in enumerate(zip(left, right)):
            cs = range(ll, rr + 1) if r % 2 == 0 else range(rr, ll - 1, -1)
            path.extend(r * cols + c for c in cs)
        return path
    return None

def _direction(a: int, b: int, cols: int) -> tuple[int, int]:
    ar, ac = divmod(a, cols)
    br, bc = divmod(b, cols)
    return br - ar, bc - ac


def _turn_sign(d1: tuple[int, int] | None, d2: tuple[int, int]) -> int:
    if d1 is None or d1 == d2:
        return 0
    cross = d1[1] * d2[0] - d1[0] * d2[1]
    return 1 if cross > 0 else -1 if cross < 0 else 0


def winding_random_path(
    rows: int,
    cols: int,
    size: int,
    rng: random.Random,
    *,
    turn_bias: float = 0.28,
    curl_bias: float = 0.16,
    node_limit: int = 12_000,
) -> list[int] | None:
    """Create a dense self-avoiding path with many bends and occasional spiral-like curls."""
    all_cells = set(range(rows * cols))
    center = ((rows - 1) / 2, (cols - 1) / 2)

    for _ in range(18):
        start = rng.randrange(rows * cols)
        trail = [start]
        used = {start}
        nodes = 0

        def dfs(last_dir: tuple[int, int] | None = None, last_turn: int = 0) -> bool:
            nonlocal nodes
            nodes += 1
            if len(trail) == size:
                return True
            if nodes > node_limit:
                return False

            cur = trail[-1]
            options = [n for n in neighbours(cur, rows, cols, all_cells) if n not in used]
            rng.shuffle(options)
            ranked: list[tuple[float, int, tuple[int, int], int]] = []

            for nxt in options:
                nd = _direction(cur, nxt, cols)
                onward = sum(1 for x in neighbours(nxt, rows, cols, all_cells) if x not in used and x != cur)
                touching = sum(1 for x in neighbours(nxt, rows, cols, all_cells) if x in used and x != cur)
                nr, nc = divmod(nxt, cols)
                dist_center = abs(nr - center[0]) + abs(nc - center[1])
                is_turn = int(last_dir is not None and nd != last_dir)
                ts = _turn_sign(last_dir, nd)
                same_curl = int(ts != 0 and last_turn != 0 and ts == last_turn)

                score = (
                    onward * 0.35
                    - is_turn * turn_bias
                    - same_curl * curl_bias
                    - min(touching, 2) * 0.14
                    + dist_center * 0.018
                    + rng.random() * 0.25
                )
                if onward == 0 and len(trail) + 1 < size:
                    score += 50
                ranked.append((score, nxt, nd, ts or last_turn))

            ranked.sort(key=lambda x: x[0])
            for _, nxt, nd, new_turn in ranked:
                trail.append(nxt)
                used.add(nxt)
                if dfs(nd, new_turn):
                    return True
                used.remove(nxt)
                trail.pop()
            return False

        if dfs():
            return trail.copy()
    return None


def path_turn_metrics(path: list[int], cols: int) -> tuple[int, int]:
    """Return (turn_count, longest run of turns in the same direction)."""
    if len(path) < 3:
        return 0, 0
    dirs = [_direction(a, b, cols) for a, b in zip(path, path[1:])]
    signs: list[int] = []
    turns = 0
    for d1, d2 in zip(dirs, dirs[1:]):
        if d1 != d2:
            turns += 1
            sign = _turn_sign(d1, d2)
            if sign:
                signs.append(sign)

    longest = cur = 0
    prev = None
    for sign in signs:
        if sign == prev:
            cur += 1
        else:
            cur = 1
            prev = sign
        longest = max(longest, cur)
    return turns, longest


def choose_words(total: int, count: int, rng: random.Random, pool: list[str], min_len: int, max_len: int, max_short_words: int | None = None, *, tier_of: dict[str, str] | None = None, policy: dict | None = None, fun_of: dict[str, int] | None = None, avoid_words: set[str] | None = None) -> list[str] | None:
    by_len: dict[int, list[str]] = defaultdict(list)
    for w in pool:
        if min_len <= len(w) <= max_len and w not in (avoid_words or set()):
            by_len[len(w)].append(w)
    for _ in range(2500):
        lengths: list[int] = []
        remaining = total
        for k in range(count - 1):
            left = count - k - 1
            lo = max(min_len, remaining - max_len * left)
            hi = min(max_len, remaining - min_len * left)
            if lo > hi:
                break
            length = rng.randint(lo, hi)
            lengths.append(length)
            remaining -= length
        if len(lengths) != count - 1 or not min_len <= remaining <= max_len:
            continue
        lengths.append(remaining)
        if max_short_words is not None and sum(1 for x in lengths if x == min_len) > max_short_words:
            continue
        chosen: list[str] = []
        used: set[str] = set()
        ok = True
        for length in lengths:
            choices = [w for w in by_len[length] if w not in used]
            if not choices:
                ok = False
                break
            w = rng.choice(choices)
            used.add(w)
            chosen.append(w)
        if not ok or (tier_of is not None and policy is not None and not tier_mix_ok(chosen, tier_of, policy)):
            continue
        if policy and fun_of:
            scores = [int(fun_of.get(word, 3)) for word in chosen]
            if sum(scores) / len(scores) + 1e-9 < float(policy.get("min_avg_fun", 0)):
                continue
            if sum(score >= 4 for score in scores) < int(policy.get("min_fun_words", 0)):
                continue
        if ok:
            return chosen
    return None


@dataclass(frozen=True)
class Candidate:
    word: str
    path: tuple[int, ...]
    length: int


def enumerate_candidates(letters: list[str], rows: int, cols: int, mask_list: list[int], required_lengths: set[int], dictionary: list[str]) -> list[Candidate]:
    mask = set(mask_list)
    trie = build_trie(dictionary, required_lengths)
    max_len = max(required_lengths)
    adjacency = {i: list(neighbours(i, rows, cols, mask)) for i in mask}
    candidates: list[Candidate] = []
    seen: set[tuple[str, tuple[int, ...]]] = set()

    def dfs(cell: int, node: TrieNode, path: list[int], used: set[int]):
        ch = letters[cell]
        nxt = node.get(ch)
        if nxt is None:
            return
        node = nxt
        path.append(cell)
        used.add(cell)
        if node.word and len(path) in required_lengths:
            key = (node.word, tuple(path))
            if key not in seen:
                seen.add(key)
                candidates.append(Candidate(node.word, tuple(path), len(path)))
        if len(path) < max_len:
            for nb in adjacency[cell]:
                if nb not in used:
                    dfs(nb, node, path, used)
        used.remove(cell)
        path.pop()

    for cell in mask_list:
        dfs(cell, trie, [], set())
    return candidates


def solve_count(letters: list[str], rows: int, cols: int, mask_list: list[int], lengths: list[int], dictionary: list[str], limit: int = 2) -> tuple[int, int, int]:
    """Count exact-cover solutions up to `limit`; returns solutions, candidate count, search nodes."""
    candidates = enumerate_candidates(letters, rows, cols, mask_list, set(lengths), dictionary)
    all_cells = set(mask_list)
    required = Counter(lengths)
    by_cell: dict[int, list[int]] = defaultdict(list)
    for ci, cand in enumerate(candidates):
        for cell in cand.path:
            by_cell[cell].append(ci)

    solutions = 0
    nodes = 0

    def rec(covered: set[int], remaining: Counter[int], used_words: set[str]):
        nonlocal solutions, nodes
        nodes += 1
        # Ambiguous boards can explode combinatorially; treat an excessive search as rejected.
        if nodes > 5000:
            solutions = limit
            return
        if solutions >= limit:
            return
        if len(covered) == len(all_cells):
            if all(v == 0 for v in remaining.values()):
                solutions += 1
            return

        viable_best: list[int] | None = None
        for cell in all_cells - covered:
            viable: list[int] = []
            for ci in by_cell[cell]:
                cand = candidates[ci]
                if remaining[cand.length] <= 0 or cand.word in used_words:
                    continue
                if any(x in covered for x in cand.path):
                    continue
                viable.append(ci)
            if not viable:
                return
            if viable_best is None or len(viable) < len(viable_best):
                viable_best = viable
                if len(viable) == 1:
                    break

        assert viable_best is not None
        for ci in viable_best:
            cand = candidates[ci]
            remaining[cand.length] -= 1
            used_words.add(cand.word)
            rec(covered | set(cand.path), remaining, used_words)
            used_words.remove(cand.word)
            remaining[cand.length] += 1
            if solutions >= limit:
                return

    rec(set(), required.copy(), set())
    return solutions, len(candidates), nodes


SPECS = {
    "rescue": [
        dict(rows=6, cols=6, cells=(20, 24), words=(4, 5), min_len=4, max_len=6, dict_size=5000, cand=(4, 28),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    "easy": [
        dict(rows=6, cols=6, cells=(28, 32), words=(6, 7), min_len=4, max_len=7, dict_size=6500, cand=(5, 40),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    # Medium has its own identity: paths stay readable, while search area and the
    # number of words grow every 50 levels. This raises difficulty without making
    # Medium feel like a smaller Hard board.
    "medium": [
        dict(rows=8, cols=8, cells=(46, 52), words=(8, 9), min_len=4, max_len=8, dict_size=8750, cand=(8, 180),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=8, cols=9, cells=(52, 58), words=(8, 10), min_len=4, max_len=9, dict_size=9000, cand=(10, 240),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=9, cols=9, cells=(58, 64), words=(9, 10), min_len=4, max_len=9, dict_size=9250, cand=(10, 300),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=9, cols=9, cells=(62, 68), words=(10, 11), min_len=4, max_len=9, dict_size=9500, cand=(12, 380),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    # Hard starts at roughly the same board scale as late Medium, then changes the
    # nature of the challenge: winding geometry appears gradually and the vocabulary
    # begins with a gentler B/C bridge before moving to the normal Hard mix.
    "hard": [
        dict(rows=9, cols=9, cells=(64, 70), words=(10, 11), min_len=4, max_len=9, dict_size=9500, cand=(12, 480),
             style="winding", turn_bias=.18, curl_bias=.08, min_curvy=3, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(66, 72), words=(10, 12), min_len=4, max_len=9, dict_size=9750, cand=(12, 580),
             style="winding", turn_bias=.24, curl_bias=.13, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(68, 74), words=(11, 12), min_len=4, max_len=9, dict_size=10000, cand=(14, 700),
             style="winding", turn_bias=.30, curl_bias=.18, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=10, cols=10, cells=(72, 80), words=(11, 13), min_len=4, max_len=9, dict_size=10250, cand=(14, 850),
             style="winding", turn_bias=.34, curl_bias=.22, min_curvy=5, min_spiral=2, max_short_words=2),
    ],
    "hardcore": [
        dict(rows=10, cols=10, cells=(72, 80), words=(11, 13), min_len=4, max_len=10, dict_size=10250, cand=(16, 540),
             style="winding", turn_bias=.42, curl_bias=.29, min_curvy=6, min_spiral=2, max_short_words=2),
    ],
}


def progression_variant_index(difficulty: str, level: int) -> int | None:
    if difficulty not in ("medium", "hard"):
        return None
    if level <= 50:
        return 0
    if level <= 100:
        return 1
    if level <= 150:
        return 2
    return 3


def free_vocab_key(difficulty: str, level: int) -> str:
    if difficulty == "hardcore":
        return "hardcore_conservative"
    if difficulty == "hard" and level <= 50:
        return "hard_bridge"
    return difficulty


def spec_for(difficulty: str, variant_index: int | None, rng: random.Random) -> dict:
    variants = SPECS[difficulty]
    if variant_index is None:
        return variants[rng.randrange(len(variants))]
    return variants[max(0, min(int(variant_index), len(variants) - 1))]


def create_puzzle(
    difficulty: str,
    seed: int,
    answer_pool: list[str],
    dictionary: list[str],
    puzzle_id: str,
    *,
    variant_index: int | None = None,
    tier_of: dict[str, str] | None = None,
    vocab_key: str | None = None,
    fun_of: dict[str, int] | None = None,
    avoid_words: set[str] | None = None,
) -> dict:
    rng = random.Random(seed)
    spec = spec_for(difficulty, variant_index, rng)
    lo_cand, hi_cand = spec["cand"]

    for attempt in range(1600):
        cells = rng.randint(*spec["cells"])
        count = rng.randint(*spec["words"])
        policy = VOCAB_POLICIES.get(vocab_key or difficulty)
        words = choose_words(cells, count, rng, answer_pool, spec["min_len"], spec["max_len"], spec.get("max_short_words"), tier_of=tier_of, policy=policy, fun_of=fun_of, avoid_words=avoid_words)
        if words is None:
            continue
        rng.shuffle(words)

        if spec["style"] == "winding":
            path = winding_random_path(
                spec["rows"], spec["cols"], cells, rng,
                turn_bias=spec.get("turn_bias", .28),
                curl_bias=spec.get("curl_bias", .16),
            )
        else:
            path = dense_random_path(spec["rows"], spec["cols"], cells, rng)
        if path is None:
            continue

        letters = [""] * (spec["rows"] * spec["cols"])
        answers = []
        pos = 0
        curvy = 0
        spiral_like = 0

        for word in words:
            segment = path[pos: pos + len(word)]
            pos += len(word)
            turns, curl_run = path_turn_metrics(segment, spec["cols"])
            curvy += int(turns >= 2)
            spiral_like += int(curl_run >= 2)
            answers.append({"word": word.upper(), "path": segment, "turns": turns, "curlRun": curl_run})
            for ch, cell in zip(word, segment):
                letters[cell] = ch.upper()

        if curvy < spec.get("min_curvy", 0) or spiral_like < spec.get("min_spiral", 0):
            continue

        # Fairness guard: every target word must itself have exactly one valid path on the board.
        # This prevents the player from spelling a correct target word along a different route
        # that cannot belong to the unique full-board solution.
        target_candidates = enumerate_candidates(
            [x.lower() for x in letters], spec["rows"], spec["cols"], path,
            {len(w) for w in words}, words,
        )
        target_paths: dict[str, list[tuple[int, ...]]] = defaultdict(list)
        for cand in target_candidates:
            if cand.word in words:
                target_paths[cand.word].append(cand.path)
        if any(len(target_paths[w]) != 1 for w in words):
            continue
        expected = {a["word"].lower(): tuple(a["path"]) for a in answers}
        if any(target_paths[w][0] != expected[w] for w in words):
            continue

        solver_dictionary = list(dict.fromkeys(dictionary[: spec["dict_size"]] + words))
        solutions, candidate_count, search_nodes = solve_count(
            [x.lower() for x in letters], spec["rows"], spec["cols"], path,
            [len(w) for w in words], solver_dictionary, limit=2,
        )
        if solutions != 1:
            continue
        if not (lo_cand <= candidate_count <= hi_cand):
            continue

        score = round(candidate_count + search_nodes / 10 + max(0, cells - 28) * 0.7 + curvy * 2.2 + spiral_like * 3.5)
        return {
            "id": puzzle_id,
            "difficulty": difficulty,
            "rows": spec["rows"],
            "cols": spec["cols"],
            "mask": sorted(path),
            "letters": letters,
            "lengths": [len(w) for w in words],
            "answers": answers,
            "meta": {
                "cells": cells,
                "candidateCount": candidate_count,
                "solverNodes": search_nodes,
                "difficultyScore": score,
                "generatorSeed": seed,
                "verifiedUnique": True,
                "curvyWords": curvy,
                "spiralWords": spiral_like,
                "pathStyle": spec["style"],
                "vocabTiers": dict(Counter(tier_of[w] for w in words)) if tier_of else None,
                "averageFun": round(sum(fun_of.get(w, 3) for w in words) / len(words), 2) if fun_of else None,
                "highFunWords": sum(fun_of.get(w, 3) >= 4 for w in words) if fun_of else None,
                "vocabPolicy": vocab_key or difficulty,
            },
        }
    raise RuntimeError(f"Could not generate {difficulty} puzzle {puzzle_id} from seed {seed}")


def write_outputs(
    *,
    output: Path,
    puzzle_payload: str,
    words_output: Path | None,
    words_payload: str,
    legacy_daily_output: Path | None,
    legacy_daily_payload: str | None,
) -> None:
    """Write auxiliaries first so their failure cannot advance the main bank."""
    if words_output is not None:
        atomic_write_text(words_output, words_payload)
    if legacy_daily_output is not None and legacy_daily_payload is not None:
        atomic_write_text(legacy_daily_output, legacy_daily_payload)
    atomic_write_text(output, puzzle_payload)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        type=Path,
        default=PUZZLES_SERVER_OUT,
        help="Existing canonical bank to read for preserve/top-up modes (read-only).",
    )
    ap.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Explicit path for the generated canonical puzzle bank.",
    )
    ap.add_argument(
        "--words-output",
        type=Path,
        help="Optional explicit path for the generated validator word list.",
    )
    ap.add_argument(
        "--legacy-daily-output",
        type=Path,
        help="Explicit archive path required with --daily-generation-2.",
    )
    ap.add_argument("--free-per-level", type=int, default=100)
    ap.add_argument("--daily", type=int, default=365)
    ap.add_argument("--rescue", type=int, default=30)
    ap.add_argument("--seed", type=int, default=20260811)
    ap.add_argument("--generation-2", action="store_true",
                    help="Archive the complete active Free bank and generate a new Gen2 bank with new IDs.")
    ap.add_argument("--daily-generation-2", action="store_true",
                    help="Archive the active Daily rotation and generate 365 Lexicon-v2 Daily puzzles with new IDs.")
    ap.add_argument("--preserve-existing", action="store_true",
                    help="Keep current Easy/Medium/Daily banks and regenerate Hard + Hardcore.")
    ap.add_argument("--preserve-existing-all", action="store_true",
                    help="Keep all current free/daily banks and only add/regenerate the rescue bank.")
    ap.add_argument("--top-up-existing", action="store_true",
                    help="Keep all existing banks and append new free puzzles until --free-per-level is reached.")
    ap.add_argument("--conservative-hardcore-extension", action="store_true",
                    help="Use the calmer reviewed D profile for appended Hardcore levels.")
    args = ap.parse_args()

    if args.daily_generation_2 and args.legacy_daily_output is None:
        ap.error("--daily-generation-2 requires --legacy-daily-output")
    if args.legacy_daily_output is not None and not args.daily_generation_2:
        ap.error("--legacy-daily-output is only valid with --daily-generation-2")
    explicit_outputs = [
        path.resolve()
        for path in (args.output, args.words_output, args.legacy_daily_output)
        if path is not None
    ]
    if len(explicit_outputs) != len(set(explicit_outputs)):
        ap.error("output paths must be distinct")
    for output in explicit_outputs:
        if not output.parent.is_dir():
            ap.error(f"output directory does not exist: {output.parent}")

    freq = load_frequency_words()
    tiers, tier_of = load_answer_tiers()
    missing_conservative = CONSERVATIVE_D_WORDS - set(tiers["D"])
    if missing_conservative:
        raise RuntimeError(f"Conservative D allowlist contains unknown/non-D words: {sorted(missing_conservative)}")
    answer_metadata = load_answer_metadata()
    fun_of = {word: int(meta.get("fun", 3)) for word, meta in answer_metadata.items()}
    answer_pools = build_answer_pools(tiers, answer_metadata)
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]

    dictionary = [w for w, _ in freq if w not in FUNCTION_WORDS]
    # Every intended answer must be recognized by the solver even when absent from the frequency corpus.
    dictionary = list(dict.fromkeys(dictionary[:12000] + [w for w in all_answers if w not in dictionary[:12000]] + sorted(EDITORIAL_VALIDATOR_WORDS)))
    words_payload = "\n".join(dictionary) + "\n"

    preserve_any = args.generation_2 or args.daily_generation_2 or args.preserve_existing or args.preserve_existing_all or args.top_up_existing
    old = json.loads(args.input.read_text(encoding="utf-8")) if preserve_any and args.input.exists() else None
    rng = random.Random(args.seed + 33)

    if args.daily_generation_2 and not old:
        raise RuntimeError("--daily-generation-2 requires an existing puzzle bank to archive")

    legacy_daily = list((old or {}).get("legacyDaily", []))
    archived_daily_puzzles: list[dict] = []
    legacy_daily_archive_payload: str | None = None

    if old and args.daily_generation_2:
        free = {k: list(old.get("free", {}).get(k, [])) for k in ("easy", "medium", "hard", "hardcore")}
        daily = []
        rescue = list(old.get("rescue", []))
        legacy = {k: list(old.get("legacyFree", {}).get(k, [])) for k in ("easy", "medium", "hard", "hardcore")}
        if int(old.get("dailyGeneration") or 1) < 2:
            archived_daily_puzzles = json.loads(json.dumps(old.get("daily", [])))
            archive_payload = {
                "version": 1,
                "archivedAt": "2026-08-13",
                "generation": int(old.get("dailyGeneration") or 1),
                "generationKey": "daily-gen1",
                "rotationBaseDate": "2026-01-01",
                "puzzles": archived_daily_puzzles,
            }
            legacy_daily_archive_payload = json.dumps(
                archive_payload, ensure_ascii=False, separators=(",", ":")
            )
            legacy_daily.append({
                "generation": 1,
                "generationKey": "daily-gen1",
                "rotationBaseDate": "2026-01-01",
                "puzzles": [
                    {"id": p["id"], "difficulty": p["difficulty"]}
                    for p in archived_daily_puzzles
                ],
            })
    elif old and args.generation_2:
        free = {k: [] for k in ("easy", "medium", "hard", "hardcore")}
        daily = list(old.get("daily", []))
        rescue = list(old.get("rescue", []))
        legacy = {k: list(old.get("legacyFree", {}).get(k, [])) for k in ("easy", "medium", "hard", "hardcore")}
        # Re-running the deterministic Gen2 build replaces an unfinished/test
        # Gen2 bank, but never archives it as another legacy generation.
        if int(old.get("freeGeneration") or 1) < 2:
            for difficulty in ("easy", "medium", "hard", "hardcore"):
                for index, puzzle in enumerate(old.get("free", {}).get(difficulty, []), start=1):
                    archived = json.loads(json.dumps(puzzle))
                    archived.setdefault("meta", {})["contentGeneration"] = int(archived.get("meta", {}).get("contentGeneration", 1))
                    archived["meta"].setdefault("level", index)
                    archived["meta"]["legacy"] = True
                    legacy[difficulty].append(archived)
    elif old and args.top_up_existing:
        free = {k: list(old["free"].get(k, [])) for k in ("easy", "medium", "hard", "hardcore")}
        daily = list(old["daily"])
        legacy = old.get("legacyFree", {})
        rescue = list(old.get("rescue", []))
    elif old and args.preserve_existing_all:
        free = {k: list(old["free"].get(k, [])) for k in ("easy", "medium", "hard", "hardcore")}
        daily = list(old["daily"])
        legacy = old.get("legacyFree", {})
        rescue = []
    elif old:
        free = {"easy": old["free"]["easy"], "medium": old["free"]["medium"], "hard": [], "hardcore": []}
        daily = old["daily"]
        legacy = old.get("legacyFree", {})
        legacy.setdefault("hard", old["free"].get("hard", []))
        rescue = []
    else:
        free = {"easy": [], "medium": [], "hard": [], "hardcore": []}
        daily = []
        legacy = {}
        rescue = []

    used_signatures = set()
    for bank in free.values():
        for p in bank:
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in daily:
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in archived_daily_puzzles:
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in old.get("rescue", []) if old else []:
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for bank in legacy.values():
        for p in bank:
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))

    started = time.time()
    levels_to_generate = (() if args.daily_generation_2 else (("easy", "medium", "hard", "hardcore") if (old and (args.generation_2 or args.top_up_existing)) else (() if (old and args.preserve_existing_all) else (("hard", "hardcore") if old else ("easy", "medium", "hard", "hardcore")))))
    active_free_generation = 2 if args.generation_2 else int((old or {}).get("freeGeneration", 1))
    id_prefix = {"easy": "g2-e", "medium": "g2-m", "hard": "g2-h", "hardcore": "g2-x"} if active_free_generation >= 2 else {"easy": "e", "medium": "m", "hard": "h3", "hardcore": "x"}
    repeat_window = 24
    recent_free: dict[str, list[set[str]]] = {key: [] for key in free}
    if old and args.top_up_existing:
        # Anti-repeat must cross the old/new boundary.  Starting with an empty
        # window would allow level 101 to reuse a word from level 100.
        for difficulty, bank in free.items():
            recent_free[difficulty] = [
                {answer["word"].lower() for answer in puzzle["answers"]}
                for puzzle in bank[-repeat_window:]
            ]

    for difficulty in levels_to_generate:
        start_i = len(free[difficulty]) if (old and args.top_up_existing) else 0
        for i in range(start_i, args.free_per_level):
            while True:
                seed = rng.randrange(1, 2**31 - 1)
                conservative_extension = difficulty == "hardcore" and args.conservative_hardcore_extension and i >= start_i
                vocab_key = "hardcore_conservative" if conservative_extension else difficulty
                p = create_puzzle(
                    difficulty, seed, answer_pools[vocab_key], dictionary,
                    f"{id_prefix[difficulty]}-{i+1:03d}",
                    variant_index=i if difficulty == "hard" else None,
                    tier_of=tier_of,
                    vocab_key=vocab_key,
                    fun_of=fun_of,
                    avoid_words=set().union(*recent_free[difficulty]) if recent_free[difficulty] else set(),
                )
                sig = (p["rows"], p["cols"], tuple(p["letters"]))
                if sig not in used_signatures:
                    used_signatures.add(sig)
                    p["meta"]["level"] = i + 1
                    p["meta"]["contentGeneration"] = active_free_generation
                    p["meta"]["generationKey"] = f"free-gen{active_free_generation}"
                    p["meta"]["lexiconVersion"] = 2
                    free[difficulty].append(p)
                    recent_free[difficulty].append({answer["word"].lower() for answer in p["answers"]})
                    recent_free[difficulty] = recent_free[difficulty][-repeat_window:]
                    break
            if (i + 1) % 10 == 0:
                print(f"free {difficulty}: {i+1}/{args.free_per_level}", flush=True)

    if not old or args.daily_generation_2:
        mix = ["easy", "medium", "medium", "medium", "hard", "hard"]
        recent_daily: list[set[str]] = []
        first_daily: list[set[str]] = []
        for i in range(args.daily):
            difficulty = mix[i % len(mix)]
            while True:
                seed = rng.randrange(1, 2**31 - 1)
                circular_prefix_count = max(0, i - (args.daily - repeat_window) + 1) if args.daily_generation_2 else 0
                avoid = set().union(*recent_daily) if recent_daily else set()
                if circular_prefix_count:
                    avoid.update(set().union(*first_daily[:circular_prefix_count]))
                p = create_puzzle(
                    difficulty, seed, answer_pools["daily"], dictionary,
                    f"{'g2-d' if args.daily_generation_2 else 'd'}-{i+1:03d}",
                    variant_index=i if difficulty == "hard" else None,
                    tier_of=tier_of, vocab_key="daily", fun_of=fun_of,
                    avoid_words=avoid,
                )
                sig = (p["rows"], p["cols"], tuple(p["letters"]))
                if sig not in used_signatures:
                    used_signatures.add(sig)
                    p["meta"]["rotationIndex"] = i + 1
                    p["meta"]["contentGeneration"] = 2 if args.daily_generation_2 else 1
                    p["meta"]["generationKey"] = "daily-gen2" if args.daily_generation_2 else "daily-gen1"
                    p["meta"]["lexiconVersion"] = 2
                    daily.append(p)
                    word_set = {answer["word"].lower() for answer in p["answers"]}
                    recent_daily.append(word_set)
                    recent_daily = recent_daily[-repeat_window:]
                    if i < repeat_window:
                        first_daily.append(word_set)
                    break
            if (i + 1) % 25 == 0:
                print(f"daily: {i+1}/{args.daily}")


    # Streak rescue bank: intentionally short 6×6 boards that are solvable under a 30s pressure timer.
    while len(rescue) < args.rescue:
        i = len(rescue)
        seed = rng.randrange(1, 2**31 - 1)
        p = create_puzzle("rescue", seed, answer_pools["rescue"], dictionary, f"r-{i+1:03d}", tier_of=tier_of, vocab_key="rescue", fun_of=fun_of)
        sig = (p["rows"], p["cols"], tuple(p["letters"]))
        if sig in used_signatures:
            continue
        used_signatures.add(sig)
        rescue.append(p)
        if len(rescue) % 10 == 0:
            print(f"rescue: {len(rescue)}/{args.rescue}")

    payload = {
        "version": 8 if args.top_up_existing and args.free_per_level > 100 else (7 if args.daily_generation_2 else (6 if args.generation_2 else int((old or {}).get("version", 5)))),
        "generatedAt": "2026-08-13",
        "dictionarySize": len(dictionary),
        "dailyRotationSize": len(daily),
        "free": free,
        "legacyFree": legacy,
        "daily": daily,
        "legacyDaily": legacy_daily,
        "rescue": rescue,
        "freeGeneration": active_free_generation,
        "freeLevelsPerDifficulty": min((len(bank) for bank in free.values()), default=0),
        "dailyGeneration": 2 if args.daily_generation_2 else int((old or {}).get("dailyGeneration", 1)),
        "lexiconVersion": 2,
        "vocabularyVersion": 2,
        "vocabularyTierCounts": {tier: len(tiers[tier]) for tier in ("A", "B", "C", "D")},
        "tieredDailyFrom": "2026-08-13" if args.daily_generation_2 else (old or {}).get("tieredDailyFrom", "2026-08-13"),
        "dailyGeneration2From": "2026-08-13" if args.daily_generation_2 else (old or {}).get("dailyGeneration2From"),
        "dailyTieredFromVersion": "3.16.1" if args.daily_generation_2 else (old or {}).get("dailyTieredFromVersion"),
        "dailyMigration": {"strategy": "date-boundary-with-legacy-validation", "leaderboard": "active-generation-only", "history": "preserved"} if args.daily_generation_2 else (old or {}).get("dailyMigration"),
        "freeTieredFromVersion": "3.16" if args.generation_2 else (old or {}).get("freeTieredFromVersion"),
        "freeExtendedFromVersion": "3.19" if args.top_up_existing and args.free_per_level > 100 else (old or {}).get("freeExtendedFromVersion"),
        "freeMigration": {"strategy": "transferred-slots", "xpPolicy": "once-per-difficulty-level-slot"} if args.generation_2 else (old or {}).get("freeMigration"),
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    write_outputs(
        output=args.output,
        puzzle_payload=payload_json,
        words_output=args.words_output,
        words_payload=words_payload,
        legacy_daily_output=args.legacy_daily_output,
        legacy_daily_payload=legacy_daily_archive_payload,
    )
    print(f"Generated/kept {sum(map(len, free.values()))} free + {len(daily)} daily + {len(rescue)} rescue puzzles in {time.time()-started:.1f}s")
    print(f"Dictionary: {len(dictionary)} words; tiered answers: {sum(len(v) for v in tiers.values())} "
          f"(A={len(tiers['A'])}, B={len(tiers['B'])}, C={len(tiers['C'])}, D={len(tiers['D'])})")


if __name__ == "__main__":
    main()
