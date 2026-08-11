#!/usr/bin/env python3
"""Generate Proplet puzzle banks and validate uniqueness with an exact-cover solver.

Dictionary source: hermitdave/FrequencyWords Czech 50k list (CC BY-SA 4.0).
The runtime game ships a filtered ~12k-word validator lexicon plus a curated answer pool.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
import argparse
import json
import random
import re
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source_cs_50k.txt"
WORDS_OUT = ROOT / "data" / "words.txt"
PUZZLES_PUBLIC_OUT = ROOT / "public" / "puzzles.json"
PUZZLES_SERVER_OUT = ROOT / "data" / "puzzles.json"

CZ_RE = re.compile(r"^[a-záčďéěíňóřšťúůýž]+$", re.I)
BAD_SUBSTRINGS = (
    "fuck", "shit", "porn", "sex", "kurev", "kurv", "píč", "pic", "kokot",
    "hovn", "prdel", "mrdat", "šukat", "sukat", "čurák", "curak", "nacist", "hitler",
)
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

# Curated, ordinary Czech answer vocabulary. The large frequency dictionary is still used by
# the solver to reject boards with alternative solutions; this pool keeps intended answers nice.
CURATED = """
auto autobus vlak metro loď lodě kolo kočár cesta silnice most tunel letiště výlet mapa směr zatáčka
město vesnice ulice náměstí park zahrada hřiště škola školka třída lavice tabule sešit kniha dopis pero
tužka pastelka guma pravítko batoh taška kapsa klíč zámek dveře okno střecha pokoj kuchyně koupelna
ložnice sklep půda balkon stůl židle křeslo gauč postel deka polštář skříň police lampa koberec obraz
hrnek sklenice talíř miska lžíce vidlička nůž ubrousek láhev konvice pánev hrnec trouba sporák lednice
jídlo oběd večeře snídaně svačina chléb rohlík houska máslo sýr šunka vejce mléko jogurt tvaroh med
cukr sůl pepř mouka rýže těsto pizza salát polévka omáčka maso kuře ryba párek dort koláč sušenka
čokoláda bonbon zmrzlina ovoce jablko hruška švestka třešeň jahoda malina borůvka banán pomeranč
citron meloun hrozny zelenina mrkev rajče paprika okurka cibule česnek brambor hrášek fazole zelí
strom keř tráva květ kytka růže tulipán list větev kořen les louka pole hora kopec skála kámen písek
řeka potok jezero rybník moře pláž ostrov břeh vlna voda led sníh déšť bouřka mrak duha slunce měsíc
hvězda nebe vítr vzduch oheň kouř stín světlo ráno večer noc den týden měsíc rok jaro léto podzim zima
pes kočka kocour štěně kotě myš králík křeček morče kůň kráva ovce koza prase slepice kohout kachna
husa pták kos sýkora vrabec holub sova orel vrána čáp labuť racek papoušek ryba kapr štika žralok
delfín velryba chobotnice medúza krab želva žába had ještěrka motýl včela vosa mravenec brouk pavouk
lev tygr medvěd vlk liška jelen srna zajíc opice slon žirafa zebra panda klokan velbloud
hlava vlasy čelo oko oči nos ucho ústa zub jazyk krk rameno ruka dlaň prst nehet břicho záda noha
koleno pata chodidlo srdce mozek tělo tvář vousy úsměv hlas dech zdraví síla bolest radost smutek
rodina máma táta mamka taťka babička děda sestra bratr dítě kluk holka kamarád soused učitel doktor
hráč tým parta host člověk lidé jméno věk práce úkol nápad plán cíl chyba pomoc rada otázka odpověď
slovo věta příběh pohádka vtip zpráva tajemství pravda lež sen přání štěstí smůla strach klid odvaha
láska smích pláč nálada chuť vůně zvuk hudba píseň film seriál hra karty kostka míč branka gól závod
sport fotbal hokej tenis squash lyže běh skok plavání kolo lezení výhra prohra bod cena medaile pohár
telefon mobil tablet počítač monitor myš klávesa kabel baterie nabíječka kamera fotka video rádio hodiny
barva červená modrá zelená žlutá bílá černá šedá hnědá růžová fialová zlatá stříbrná světlý tmavý
velký malý dlouhý krátký vysoký nízký široký úzký těžký lehký rychlý pomalý nový starý mladý dobrý
špatný hezký krásný chytrý veselý smutný tichý hlasitý teplý studený horký suchý mokrý čistý špinavý
měkký tvrdý sladký slaný kyselý hořký hladový plný prázdný volný silný slabý snadný těžký blízký
daleký první druhý třetí poslední pravý levý horní dolní rovný křivý kulatý ostrý tupý
běžet chodit jet letět plavat lézt skákat stát sedět ležet spát vstát jíst pít vařit péct krájet míchat
hrát kopat házet chytat držet nést táhnout tlačit otevřít zavřít hledat najít vidět koukat slyšet
mluvit říkat číst psát kreslit malovat učit počítat myslet vědět znát chápat zkusit začít končit
vyhrát prohrát koupit prodat dát vzít poslat přinést odnést přijít odejít vrátit čekat potkat volat
smát se plakat bavit těšit přát chtít mít být dělat umět moct muset růst padat svítit foukat pršet
lesní horský mořský vodní domácí školní dětský český letní zimní ranní večerní denní noční barevný
papír karton dřevo kov sklo plast látka vlna bavlna provaz nit jehla nůžky lepidlo krabice balík dárek
peníze mince bankovka účet obchod trh cena sleva pokladna lístek vstupenka pas kufr hotel stan chata
hrad zámek věž kostel most přístav farma zoo kino divadlo muzeum knihovna restaurace kavárna cukrárna
příroda krajina svět země planeta vesmír raketa robot stroj motor kolo volant brzda světlo semafor
číslo nula jedna dva tři čtyři pět šest sedm osm devět deset sto tisíc pár půl celek část řada kruh
čtverec trojúhelník čára bod roh strana střed začátek konec sever jih východ západ nahoře dole vlevo
vpravo spolu zvlášť doma venku uvnitř kolem blízko daleko brzy pozdě dnes zítra včera chvíle minuta
hodina pondělí úterý středa čtvrtek pátek sobota neděle leden únor březen duben květen červen srpen
září říjen listopad prosinec prázdniny víkend dovolená narozeniny oslava návštěva výprava dobrodružství
""".split()


def clean_word(w: str) -> str | None:
    w = w.strip().lower()
    if not CZ_RE.fullmatch(w):
        return None
    if any(b in w for b in BAD_SUBSTRINGS):
        return None
    if w in NAME_BLOCK:
        return None
    return w


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


def choose_words(total: int, count: int, rng: random.Random, pool: list[str], min_len: int, max_len: int) -> list[str] | None:
    by_len: dict[int, list[str]] = defaultdict(list)
    for w in pool:
        if min_len <= len(w) <= max_len:
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
    "easy": [
        dict(rows=6, cols=6, cells=(28, 32), words=(6, 7), min_len=4, max_len=7, dict_size=6500, cand=(5, 32),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    "medium": [
        dict(rows=7, cols=8, cells=(40, 46), words=(7, 8), min_len=4, max_len=8, dict_size=8500, cand=(8, 55),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    "hard": [
        dict(rows=8, cols=8, cells=(50, 56), words=(9, 10), min_len=4, max_len=9, dict_size=9500, cand=(10, 280),
             style="winding", turn_bias=.28, curl_bias=.16, min_curvy=3, min_spiral=1),
        dict(rows=9, cols=9, cells=(62, 70), words=(10, 12), min_len=4, max_len=9, dict_size=9500, cand=(12, 380),
             style="winding", turn_bias=.30, curl_bias=.18, min_curvy=4, min_spiral=1),
    ],
    "hardcore": [
        dict(rows=10, cols=10, cells=(78, 88), words=(12, 15), min_len=4, max_len=10, dict_size=10500, cand=(18, 650),
             style="winding", turn_bias=.38, curl_bias=.25, min_curvy=6, min_spiral=2),
    ],
}


def spec_for(difficulty: str, variant_index: int | None, rng: random.Random) -> dict:
    variants = SPECS[difficulty]
    if variant_index is None:
        return variants[rng.randrange(len(variants))]
    return variants[variant_index % len(variants)]


def create_puzzle(
    difficulty: str,
    seed: int,
    answer_pool: list[str],
    dictionary: list[str],
    puzzle_id: str,
    *,
    variant_index: int | None = None,
) -> dict:
    rng = random.Random(seed)
    spec = spec_for(difficulty, variant_index, rng)
    lo_cand, hi_cand = spec["cand"]

    for attempt in range(1600):
        cells = rng.randint(*spec["cells"])
        count = rng.randint(*spec["words"])
        words = choose_words(cells, count, rng, answer_pool, spec["min_len"], spec["max_len"])
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
            },
        }
    raise RuntimeError(f"Could not generate {difficulty} puzzle {puzzle_id} from seed {seed}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--free-per-level", type=int, default=50)
    ap.add_argument("--daily", type=int, default=365)
    ap.add_argument("--seed", type=int, default=20260811)
    ap.add_argument("--preserve-existing", action="store_true",
                    help="Keep current Easy/Medium/Daily banks and regenerate Hard + Hardcore.")
    args = ap.parse_args()

    freq = load_frequency_words()
    dictionary = [w for w, _ in freq if w not in FUNCTION_WORDS]
    curated = []
    seen = set()
    for raw in CURATED:
        w = clean_word(raw)
        if not w or not 3 <= len(w) <= 10 or w in FUNCTION_WORDS or w in seen:
            continue
        seen.add(w)
        curated.append(w)
    for w in curated:
        if w not in dictionary:
            dictionary.append(w)
    dictionary = dictionary[:12000] + [w for w in curated if w not in dictionary[:12000]]

    fallback = [w for w, _ in freq[250:6500]
                if w not in FUNCTION_WORDS and w not in NAME_BLOCK and 4 <= len(w) <= 9]
    answer_pool = curated * 12 + fallback[:500]
    WORDS_OUT.write_text("\n".join(dictionary) + "\n", encoding="utf-8")

    old = json.loads(PUZZLES_SERVER_OUT.read_text(encoding="utf-8")) if args.preserve_existing and PUZZLES_SERVER_OUT.exists() else None
    rng = random.Random(args.seed + 33)

    if old:
        free = {"easy": old["free"]["easy"], "medium": old["free"]["medium"], "hard": [], "hardcore": []}
        daily = old["daily"]
        legacy = old.get("legacyFree", {})
        legacy.setdefault("hard", old["free"].get("hard", []))
    else:
        free = {"easy": [], "medium": [], "hard": [], "hardcore": []}
        daily = []
        legacy = {}

    used_signatures = set()
    for bank in free.values():
        for p in bank:
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in daily:
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))

    started = time.time()
    levels_to_generate = ("hard", "hardcore") if old else ("easy", "medium", "hard", "hardcore")
    id_prefix = {"easy": "e", "medium": "m", "hard": "h3", "hardcore": "x"}

    for difficulty in levels_to_generate:
        for i in range(args.free_per_level):
            while True:
                seed = rng.randrange(1, 2**31 - 1)
                p = create_puzzle(
                    difficulty, seed, answer_pool, dictionary,
                    f"{id_prefix[difficulty]}-{i+1:03d}",
                    variant_index=i if difficulty == "hard" else None,
                )
                sig = (p["rows"], p["cols"], tuple(p["letters"]))
                if sig not in used_signatures:
                    used_signatures.add(sig)
                    free[difficulty].append(p)
                    break
            if (i + 1) % 10 == 0:
                print(f"free {difficulty}: {i+1}/{args.free_per_level}")

    if not old:
        mix = ["easy", "medium", "medium", "medium", "hard", "hard"]
        for i in range(args.daily):
            difficulty = mix[i % len(mix)]
            while True:
                seed = rng.randrange(1, 2**31 - 1)
                p = create_puzzle(difficulty, seed, answer_pool, dictionary, f"d-{i+1:03d}")
                sig = (p["rows"], p["cols"], tuple(p["letters"]))
                if sig not in used_signatures:
                    used_signatures.add(sig)
                    daily.append(p)
                    break
            if (i + 1) % 25 == 0:
                print(f"daily: {i+1}/{args.daily}")

    payload = {
        "version": 3,
        "generatedAt": "2026-08-11",
        "dictionarySize": len(dictionary),
        "dailyRotationSize": len(daily),
        "free": free,
        "legacyFree": legacy,
        "daily": daily,
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    PUZZLES_PUBLIC_OUT.write_text(payload_json, encoding="utf-8")
    PUZZLES_SERVER_OUT.write_text(payload_json, encoding="utf-8")
    print(f"Generated/kept {sum(map(len, free.values()))} free + {len(daily)} daily puzzles in {time.time()-started:.1f}s")
    print(f"Dictionary: {len(dictionary)} words; curated answer pool: {len(curated)} words")


if __name__ == "__main__":
    main()
