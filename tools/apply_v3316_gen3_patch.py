#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REJECTED = {"nocebo", "trebuchet", "sofismus", "černodíra", "perigeum", "aerogel"}


def replace_one(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, got {count}: {old[:120]!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def patch_lexicon_builder() -> None:
    p = ROOT / "tools" / "build_lexicon_v2.py"
    replace_one(
        p,
        "vole zadek zadnice zabiják zabíjení znásilnění zvrhlost zvrhlý\nbody homosexuál house love prdelka union",
        "vole zadek zadnice zabiják zabíjení znásilnění zvrhlost zvrhlý\n"
        "nocebo trebuchet sofismus černodíra perigeum aerogel\n"
        "body homosexuál house love prdelka union",
    )
    replace_one(
        p,
        "        if not CZ_WORD.fullmatch(word):\n            raise RuntimeError(f\"Invalid reviewed seed answer: {word!r}\")\n        entries[word] = enrich(",
        "        if not CZ_WORD.fullmatch(word):\n            raise RuntimeError(f\"Invalid reviewed seed answer: {word!r}\")\n"
        "        if word in TARGET_BLOCK:\n            continue\n"
        "        entries[word] = enrich(",
    )


def patch_canonical_lexicon() -> None:
    lex_path = ROOT / "data" / "lexicon_v2.json"
    lex = json.loads(lex_path.read_text(encoding="utf-8"))
    lex["entries"] = [e for e in lex.get("entries", []) if str(e.get("word", "")).casefold() not in REJECTED]
    lex["counts"] = dict(sorted(Counter(e["tier"] for e in lex["entries"]).items()))
    lex["fun_counts"] = {str(k): v for k, v in sorted(Counter(int(e["fun"]) for e in lex["entries"]).items())}
    lex_path.write_text(json.dumps(lex, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    tiers_path = ROOT / "data" / "answer_tiers.json"
    tiers = json.loads(tiers_path.read_text(encoding="utf-8"))
    for tier, words in tiers.get("tiers", {}).items():
        tiers["tiers"][tier] = [w for w in words if str(w).casefold() not in REJECTED]
    for word in list((tiers.get("metadata") or {}).keys()):
        if word.casefold() in REJECTED:
            tiers["metadata"].pop(word, None)
    tiers_path.write_text(json.dumps(tiers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_generator() -> None:
    p = ROOT / "tools" / "generate_puzzles.py"
    replace_one(
        p,
        "BAD_SUBSTRINGS = (\n    \"fuck\", \"shit\", \"porn\", \"sex\", \"kurev\", \"kurv\", \"píč\", \"kokot\",\n    \"hovno\", \"prdel\", \"mrdat\", \"šukat\", \"sukat\", \"čurák\", \"curak\", \"nacist\", \"hitler\",\n)\n",
        "BAD_SUBSTRINGS = (\n    \"fuck\", \"shit\", \"porn\", \"sex\", \"kurev\", \"kurv\", \"píč\", \"kokot\",\n    \"hovno\", \"prdel\", \"mrdat\", \"šukat\", \"sukat\", \"čurák\", \"curak\", \"nacist\", \"hitler\",\n)\n\n"
        "# Words removed editorially from target answers still belong in the validator.\n"
        "# The solver must see them so an accidental alternative path cannot slip through.\n"
        "EDITORIAL_VALIDATOR_WORDS = {\"nocebo\", \"trebuchet\", \"sofismus\", \"černodíra\", \"perigeum\", \"aerogel\"}\n",
    )
    replace_one(
        p,
        "    \"hard\": {\n        \"allowed\": (\"B\", \"C\"), \"weights\": {\"B\": 2, \"C\": 5},\n        \"min_fraction\": {\"C\": 0.45}, \"min_avg_fun\": 2.9, \"min_fun_words\": 1,\n    },",
        "    \"hard_bridge\": {\n        \"allowed\": (\"B\", \"C\"), \"weights\": {\"B\": 4, \"C\": 3},\n        \"min_fraction\": {\"C\": 0.30}, \"max_fraction\": {\"C\": 0.60},\n        \"min_avg_fun\": 2.9, \"min_fun_words\": 1,\n    },\n"
        "    \"hard\": {\n        \"allowed\": (\"B\", \"C\"), \"weights\": {\"B\": 2, \"C\": 5},\n        \"min_fraction\": {\"C\": 0.45}, \"min_avg_fun\": 2.9, \"min_fun_words\": 1,\n    },",
    )
    old_specs = '''SPECS = {
    "rescue": [
        dict(rows=6, cols=6, cells=(20, 24), words=(4, 5), min_len=4, max_len=6, dict_size=5000, cand=(4, 28),
             style="dense", min_curvy=0, min_spiral=0),
    ],
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
             style="winding", turn_bias=.28, curl_bias=.16, min_curvy=3, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(62, 70), words=(10, 12), min_len=4, max_len=9, dict_size=9500, cand=(12, 380),
             style="winding", turn_bias=.30, curl_bias=.18, min_curvy=4, min_spiral=1, max_short_words=2),
    ],
    "hardcore": [
        dict(rows=10, cols=10, cells=(78, 88), words=(12, 15), min_len=4, max_len=10, dict_size=10500, cand=(18, 650),
             style="winding", turn_bias=.38, curl_bias=.25, min_curvy=6, min_spiral=2, max_short_words=2),
    ],
}


def spec_for(difficulty: str, variant_index: int | None, rng: random.Random) -> dict:
    variants = SPECS[difficulty]
    if variant_index is None:
        return variants[rng.randrange(len(variants))]
    return variants[variant_index % len(variants)]
'''
    new_specs = '''SPECS = {
    "rescue": [
        dict(rows=6, cols=6, cells=(20, 24), words=(4, 5), min_len=4, max_len=6, dict_size=5000, cand=(4, 28),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    "easy": [
        dict(rows=6, cols=6, cells=(28, 32), words=(6, 7), min_len=4, max_len=7, dict_size=6500, cand=(5, 40),
             style="dense", min_curvy=0, min_spiral=0),
    ],
    # Medium is intentionally progressive. Its first half becomes harder mainly through
    # search area and word count; only later do winding paths gradually enter the mix.
    "medium": [
        dict(rows=7, cols=8, cells=(40, 46), words=(7, 8), min_len=4, max_len=8, dict_size=8500, cand=(8, 90),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=8, cols=8, cells=(46, 52), words=(8, 9), min_len=4, max_len=8, dict_size=8750, cand=(10, 140),
             style="dense", min_curvy=0, min_spiral=0),
        dict(rows=8, cols=8, cells=(50, 56), words=(8, 10), min_len=4, max_len=8, dict_size=9000, cand=(10, 240),
             style="winding", turn_bias=.12, curl_bias=.05, min_curvy=2, min_spiral=0, max_short_words=3),
        dict(rows=8, cols=9, cells=(56, 62), words=(9, 10), min_len=4, max_len=9, dict_size=9250, cand=(12, 360),
             style="winding", turn_bias=.18, curl_bias=.09, min_curvy=3, min_spiral=1, max_short_words=3),
    ],
    # Hard now starts where late Medium ends instead of jumping straight to the old cliff.
    "hard": [
        dict(rows=8, cols=9, cells=(58, 64), words=(10, 11), min_len=4, max_len=9, dict_size=9500, cand=(12, 420),
             style="winding", turn_bias=.20, curl_bias=.10, min_curvy=3, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(62, 68), words=(10, 12), min_len=4, max_len=9, dict_size=9500, cand=(12, 520),
             style="winding", turn_bias=.25, curl_bias=.14, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(66, 72), words=(11, 12), min_len=4, max_len=9, dict_size=9750, cand=(14, 650),
             style="winding", turn_bias=.30, curl_bias=.18, min_curvy=4, min_spiral=1, max_short_words=2),
        dict(rows=9, cols=9, cells=(68, 74), words=(11, 13), min_len=4, max_len=9, dict_size=10000, cand=(14, 800),
             style="winding", turn_bias=.34, curl_bias=.22, min_curvy=5, min_spiral=2, max_short_words=2),
    ],
    "hardcore": [
        dict(rows=10, cols=10, cells=(78, 88), words=(12, 15), min_len=4, max_len=10, dict_size=10500, cand=(18, 700),
             style="winding", turn_bias=.38, curl_bias=.25, min_curvy=6, min_spiral=2, max_short_words=2),
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
'''
    replace_one(p, old_specs, new_specs)
    replace_one(
        p,
        '    dictionary = dictionary[:12000] + [w for w in all_answers if w not in dictionary[:12000]]',
        '    dictionary = list(dict.fromkeys(dictionary[:12000] + [w for w in all_answers if w not in dictionary[:12000]] + sorted(EDITORIAL_VALIDATOR_WORDS)))',
    )


def write_gen3_generator() -> None:
    p = ROOT / "tools" / "generate_free_generation3.py"
    p.write_text(r'''#!/usr/bin/env python3
"""Build Free Generation 3 with stable player-facing level slots and a progressive difficulty ladder."""
from __future__ import annotations

from collections import Counter
import importlib.util
import json
from pathlib import Path
import random
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
GEN = ROOT / "tools" / "generate_puzzles.py"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}
TARGET_LEVELS = 200
SEED = 20260817
WIDE_DICTIONARY_SIZE = 12000
MAX_RETRIES = 450


def load_generator():
    spec = importlib.util.spec_from_file_location("proplet_generate_puzzles", GEN)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot import generator")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def broad_unique(gp, puzzle, dictionary):
    targets = [a["word"].lower() for a in puzzle["answers"]]
    solver_dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
    solutions, candidates, nodes = gp.solve_count(
        [x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"],
        [len(w) for w in targets], solver_dictionary, limit=2,
    )
    return solutions == 1, candidates, nodes


def main():
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    if public.get("free") != data.get("free"):
        raise RuntimeError("public/data Free banks differ before Gen3 build")
    current_generation = int(data.get("freeGeneration") or 1)
    if current_generation not in (2, 3):
        raise RuntimeError(f"Expected Free generation 2 or an idempotent Gen3 rebuild, got {current_generation}")

    tiers, tier_of = gp.load_answer_tiers()
    metadata = gp.load_answer_metadata()
    fun_of = {w: int(m.get("fun", 3)) for w, m in metadata.items()}
    pools = gp.build_answer_pools(tiers, metadata)
    freq = gp.load_frequency_words()
    all_answers = [w for tier in ("A", "B", "C", "D") for w in tiers[tier]]
    dictionary = [w for w, _ in freq if w not in gp.FUNCTION_WORDS]
    dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + all_answers + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))

    legacy = {d: list((data.get("legacyFree") or {}).get(d, [])) for d in DIFFICULTIES}
    if current_generation < 3:
        for difficulty in DIFFICULTIES:
            for index, puzzle in enumerate(data.get("free", {}).get(difficulty, []), start=1):
                archived = json.loads(json.dumps(puzzle))
                meta = archived.setdefault("meta", {})
                meta.setdefault("level", index)
                meta.setdefault("contentGeneration", current_generation)
                meta.setdefault("generationKey", f"free-gen{current_generation}")
                meta["legacy"] = True
                legacy[difficulty].append(archived)

    used_signatures = set()
    for bank in legacy.values():
        for p in bank:
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for key in ("daily", "rescue"):
        for p in data.get(key, []):
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for p in (data.get("previousDaily") or {}).get("puzzles", []):
        used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))
    for bank in data.get("legacyDaily", []):
        for p in bank.get("puzzles", []):
            used_signatures.add((p["rows"], p["cols"], tuple(p["letters"])))

    rng = random.Random(SEED)
    free = {d: [] for d in DIFFICULTIES}
    recent = {d: [] for d in DIFFICULTIES}
    broad_rejects = Counter()
    signature_rejects = Counter()
    started = time.time()

    for difficulty in DIFFICULTIES:
        for level in range(1, TARGET_LEVELS + 1):
            avoid = set().union(*recent[difficulty]) if recent[difficulty] else set()
            vocab_key = gp.free_vocab_key(difficulty, level)
            variant = gp.progression_variant_index(difficulty, level)
            accepted = None
            for retry in range(1, MAX_RETRIES + 1):
                seed = rng.randrange(1, 2**31 - 1)
                puzzle = gp.create_puzzle(
                    difficulty, seed, pools[vocab_key], dictionary,
                    f"{PREFIX[difficulty]}-{level:03d}",
                    variant_index=variant, tier_of=tier_of, vocab_key=vocab_key,
                    fun_of=fun_of, avoid_words=avoid,
                )
                sig = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
                if sig in used_signatures:
                    signature_rejects[difficulty] += 1
                    continue
                unique, candidates, nodes = broad_unique(gp, puzzle, dictionary)
                if not unique:
                    broad_rejects[difficulty] += 1
                    continue
                puzzle.setdefault("meta", {}).update({
                    "level": level,
                    "contentGeneration": 3,
                    "generationKey": "free-gen3",
                    "lexiconVersion": 2,
                    "progressionPhase": variant + 1 if variant is not None else 1,
                    "wideVerifiedUnique": True,
                    "wideUniquenessDictionarySize": WIDE_DICTIONARY_SIZE,
                    "wideCandidateCount": candidates,
                    "wideSolverNodes": nodes,
                    "gen3SeedRetry": retry,
                })
                accepted = puzzle
                used_signatures.add(sig)
                break
            if accepted is None:
                raise RuntimeError(f"Could not generate {difficulty} level {level} after {MAX_RETRIES} retries")
            free[difficulty].append(accepted)
            recent[difficulty].append({a["word"].lower() for a in accepted["answers"]})
            recent[difficulty] = recent[difficulty][-24:]
            if level % 25 == 0:
                print(f"Gen3 {difficulty}: {level}/{TARGET_LEVELS}", flush=True)

    payload = json.loads(json.dumps(data))
    payload.update({
        "version": 10,
        "generatedAt": "2026-08-17",
        "free": free,
        "legacyFree": legacy,
        "freeGeneration": 3,
        "freeLevelsPerDifficulty": TARGET_LEVELS,
        "lexiconVersion": 2,
        "vocabularyVersion": 2,
        "vocabularyTierCounts": {tier: len(tiers[tier]) for tier in ("A", "B", "C", "D")},
        "freeMigration": {
            "strategy": "stable-level-slots",
            "xpPolicy": "once-per-difficulty-level-slot",
            "activeGeneration": 3,
            "playerFacingGenerationLabels": False,
            "inProgressLegacyFinishAllowed": True,
        },
        "freeProgression": {
            "version": 3,
            "mediumPhases": [50, 100, 150, 200],
            "hardPhases": [50, 100, 150, 200],
            "playerFacingModel": "difficulty-plus-level-only",
        },
    })
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    DATA.write_text(encoded, encoding="utf-8")
    PUBLIC.write_text(encoded, encoding="utf-8")
    print(json.dumps({
        "freeGeneration": 3,
        "counts": {d: len(free[d]) for d in DIFFICULTIES},
        "broadRejects": dict(broad_rejects),
        "signatureRejects": dict(signature_rejects),
        "seconds": round(time.time() - started, 1),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
''', encoding="utf-8")


def patch_rolling_generator() -> None:
    p = ROOT / "tools" / "generate_rolling_content.py"
    text = p.read_text(encoding="utf-8")
    text = text.replace('ID_PREFIX = {"easy": "g2-e", "medium": "g2-m", "hard": "g2-h", "hardcore": "g2-x"}', 'ID_PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}')
    text = text.replace('if int(data.get("version") or 0) != 9 or int(public.get("version") or 0) != 9:\n        raise RuntimeError("Rolling content expects unchanged base puzzle DB v9")', 'if int(data.get("version") or 0) != 10 or int(public.get("version") or 0) != 10:\n        raise RuntimeError("Rolling content expects Gen3 base puzzle DB v10")')
    text = text.replace('if int(data.get("freeGeneration") or 0) != 2:\n        raise RuntimeError("Rolling content expects Free generation 2")', 'if int(data.get("freeGeneration") or 0) != 3:\n        raise RuntimeError("Rolling content expects Free generation 3")')
    text = text.replace('dictionary = dictionary[:WIDE_DICTIONARY_SIZE] + [w for w in all_answers if w not in dictionary[:WIDE_DICTIONARY_SIZE]]', 'dictionary = list(dict.fromkeys(dictionary[:WIDE_DICTIONARY_SIZE] + all_answers + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))')
    text = text.replace('            vocab_key = "hardcore_conservative" if difficulty == "hardcore" else difficulty', '            vocab_key = gp.free_vocab_key(difficulty, level)')
    text = text.replace('                    variant_index=level - 1 if difficulty == "hard" else None,', '                    variant_index=gp.progression_variant_index(difficulty, level),')
    text = text.replace('                    "contentGeneration": 2,\n                    "generationKey": "free-gen2",', '                    "contentGeneration": 3,\n                    "generationKey": "free-gen3",\n                    "progressionPhase": (gp.progression_variant_index(difficulty, level) or 0) + 1,')
    text = text.replace('        "basePuzzleVersion": 9,', '        "basePuzzleVersion": 10,')
    text = text.replace('        "generatedAtVersion": "3.30.0",', '        "generatedAtVersion": "3.31.6",')
    p.write_text(text, encoding="utf-8")


def patch_app() -> None:
    p = ROOT / "public" / "app.js"
    replace_one(p, "const APP_VERSION='3.31.5';", "const APP_VERSION='3.31.6';")
    replace_one(p, "  medium:{label:'Střední',icon:'/difficulty/medium.svg',desc:'7×8 · větší plocha a víc možných cest.',xp:25},", "  medium:{label:'Střední',icon:'/difficulty/medium.svg',desc:'Postupně větší plocha · od přehledných cest k prvním zákrutám.',xp:25},")
    replace_one(
        p,
        "function localFreeSlotState(diff){\n const actual=new Set(),legacy=new Set(),rows=Object.values(getState().completed||{});\n const maxLevel=sortedFreeBank(diff).length;for(const r of rows){if(r?.mode!=='free'||r.difficulty!==diff)continue;const info=(Number(r.level)&&Number(r.contentGeneration))?{level:Number(r.level),generation:Number(r.contentGeneration)}:freePuzzleSlot(r.puzzleId,diff);if(!info||info.level<1||info.level>maxLevel)continue;(info.generation>=2?actual:legacy).add(info.level)}\n const effective=new Set([...legacy,...actual]),transferred=new Set([...legacy].filter(level=>!actual.has(level)));\n return {actual,legacy,effective,transferred};\n}",
        "function localFreeSlotState(diff){\n const actual=new Set(),prior=new Set(),rows=Object.values(getState().completed||{}),activeGeneration=Number(puzzleDB?.freeGeneration)||1;\n const maxLevel=sortedFreeBank(diff).length;for(const r of rows){if(r?.mode!=='free'||r.difficulty!==diff)continue;const resolved=freePuzzleSlot(r.puzzleId,diff),info=(Number(r.level)&&Number(r.contentGeneration))?{level:Number(r.level),generation:Number(r.contentGeneration),legacy:resolved?.legacy===true}:resolved;if(!info||info.level<1||info.level>maxLevel)continue;(info.generation===activeGeneration&&!info.legacy?actual:prior).add(info.level)}\n const effective=new Set([...prior,...actual]),transferred=new Set([...prior].filter(level=>!actual.has(level)));\n return {actual,legacy:prior,prior,effective,transferred};\n}",
    )
    replace_one(
        p,
        "function resumableFreePuzzle(diff,list){const s=getState(),rows=Object.values(s.inProgress||{}).filter(r=>r?.mode==='free'&&r.difficulty===diff&&!s.completed?.[`free:${r.puzzleId}`]).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));return rows.length?list.find(p=>p.id===rows[0].puzzleId)||null:null}",
        "function resumableFreePuzzle(diff,list){const s=getState(),rows=Object.values(s.inProgress||{}).filter(r=>r?.mode==='free'&&r.difficulty===diff&&!s.completed?.[`free:${r.puzzleId}`]).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));if(!rows.length)return null;return list.find(p=>p.id===rows[0].puzzleId)||freePuzzleSlot(rows[0].puzzleId,diff)?.puzzle||null}",
    )
    replace_one(
        p,
        " root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),nextLevel=Number((q.resume||q.nextUnsolved)?.meta?.level)||null,status=q.resume?`Pokračovat${nextLevel?` · úroveň ${nextLevel}`:''}`:q.done===q.total&&q.total?'Hotovo · hrát znovu':`${q.transferred?`Převedeno ${q.transferred} · `:''}další ${nextLevel||1}`;return `<button class=\"quick-game\"",
        " root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),nextLevel=Number((q.resume||q.nextUnsolved)?.meta?.level)||null,status=q.resume?`Pokračovat${nextLevel?` · úroveň ${nextLevel}`:''}`:q.done===q.total&&q.total?'Hotovo · hrát znovu':`Další · úroveň ${nextLevel||1}`;return `<button class=\"quick-game\"",
    )
    replace_one(
        p,
        "function renderNewContentBanner(){\n const root=$('#newContentBanner');if(!root)return;const batch=latestContentBatch();\n if(!batch||!latestContentIsFresh()){root.classList.add('hidden');root.innerHTML='';return}\n const all=latestContentPuzzles(),unplayed=latestContentUnplayed(),extra=DIFF[batch.extraDifficulty]?.label||'',done=!unplayed.length;\n root.classList.remove('hidden');\n root.innerHTML=`<div class=\"new-content-main\"><span class=\"new-content-spark\">✨</span><div><span class=\"eyebrow\">NOVÁ TÝDENNÍ VÁRKA</span><h2>${done?'Nové Proplety máš hotové':'5 nových Propletů'}</h2><p>${done?'Paráda. Další várka dorazí zase v pondělí.':`Jedna úroveň od každé obtížnosti${extra?` · ${extra} je tentokrát dvakrát`:''}.`}</p></div></div><div class=\"new-content-actions\"><button id=\"playNewContentBtn\" class=\"primary-btn\" ${all.length?'':'disabled'}>${done?'Zahrát znovu':'Hrát nové →'}</button><button id=\"contentDropNotifyBtn\" class=\"text-btn\">🔔 Upozornit na další</button></div>`;\n $('#playNewContentBtn').onclick=startLatestContent;$('#contentDropNotifyBtn').onclick=enableContentPushFromDrop;\n updatePushUI().catch(()=>{});\n}",
        "function renderNewContentBanner(){const root=$('#newContentBanner');if(!root)return;root.classList.add('hidden');root.innerHTML=''}",
    )
    # Free cards: no migration terminology and no batch badge competing with the level sequence.
    text = p.read_text(encoding="utf-8")
    text = text.replace("(done===total?`${done}/${total} HOTOVO`:transferred?`${transferred} PŘEVEDENO · DALŠÍ ${nextLevel||1}`:`ÚROVEŇ ${nextLevel||1} Z ${total}`)", "(done===total?`${done}/${total} HOTOVO`:`ÚROVEŇ ${nextLevel||1} Z ${total}`)")
    text = text.replace("${newContentCount(key)?`<span class=\"fresh-level-badge\">${newContentCount(key)} NOVÉ</span>`:\"\"}", "")
    text = text.replace("${done?` · ${actual} hraných${transferred?` + ${transferred} převedených`:''}`:''}", "${done?` · ${done} splněných`:''}")
    p.write_text(text, encoding="utf-8")

    # Played-levels normal UI: preserve slots but never expose content-generation concepts.
    old = "async function openPlayedLevels(diff){\n const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').textContent=`${d.label} · tvoje úrovně`;$('#playedLevelsMeta').textContent='Načítám odehrané a převedené úrovně…';$('#playedLevelsList').innerHTML='';modal.classList.remove('hidden');const p=getProfile();let levels=[],legacyLevels=[],summary=null;"
    new = "async function openPlayedLevels(diff){\n const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').textContent=`${d.label} · tvoje úrovně`;$('#playedLevelsMeta').textContent='Načítám tvůj postup…';$('#playedLevelsList').innerHTML='';modal.classList.remove('hidden');const p=getProfile();let levels=[],legacyLevels=[],summary=null;"
    replace_one(p, old, new)
    text = p.read_text(encoding="utf-8")
    text = text.replace("const actual=summary?.actual??levels.filter(r=>!r.transferred).length,transferred=summary?.transferred??levels.filter(r=>r.transferred).length,total=summary?.total??sortedFreeBank(diff).length;$('#playedLevelsMeta').textContent=levels.length?`${actual} odehraných${transferred?` · ${transferred} převedených`:''} · postup ${levels.length}/${total}`:'Zatím tu nic není. Nejdřív něco propleť.';", "const actual=summary?.actual??levels.filter(r=>!r.transferred).length,transferred=summary?.transferred??levels.filter(r=>r.transferred).length,total=summary?.total??sortedFreeBank(diff).length;$('#playedLevelsMeta').textContent=levels.length?`Postup ${levels.length}/${total}`:'Zatím tu nic není. Nejdřív něco propleť.';")
    start = text.index(" const currentHtml=levels.length?levels.map(r=>")
    end_marker = " $('#playedLevelsList').innerHTML=currentHtml+archiveHtml;"
    end = text.index(end_marker, start) + len(end_marker)
    replacement = " const currentHtml=levels.length?levels.map(r=>`<button class=\"played-level-row ${r.transferred?'transferred':''}\" data-level-puzzle=\"${esc(r.puzzleId)}\" data-level-diff=\"${diff}\"><span class=\"level-index\">${r.level}.</span><span class=\"level-history-main\">${r.transferred?`<strong>Úroveň ${r.level} · Splněno</strong><small>Postup je započítaný. Tuhle desku si můžeš kdykoli zahrát bez dalších XP.</small>`:`<strong>${fmtTime(r.elapsedMs)}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}${r.attempts>1?` · hráno ${r.attempts}×`:''}</small>`}</span><span class=\"played-arrow\">›</span></button>`).join(''):'<div class=\"empty-history\">Tady zatím fouká vítr. 🌬️</div>';$('#playedLevelsList').innerHTML=currentHtml;"
    text = text[:start] + replacement + text[end:]
    # Level detail neutral copy.
    text = text.replace("transferred?'<strong>✓ Převedeno</strong><span>Tuhle úroveň už máš splněnou z dřívější verze.</span><small>Novou desku hrát nemusíš. Pokud ji zkusíš, získáš čas a místo v aktuálním pořadí, ale ne další XP.</small>'", "transferred?'<strong>✓ Splněno</strong><span>Tuhle úroveň už máš započítanou.</span><small>Pokud chceš, můžeš si ji zahrát znovu a získat čas do pořadí. Další XP už se nepřidají.</small>'")
    text = text.replace("$('#levelDetailReplayBtn').textContent=transferred?'Zahrát novou desku · bez XP'", "$('#levelDetailReplayBtn').textContent=transferred?'Zahrát znovu · bez XP'")
    p.write_text(text, encoding="utf-8")


def patch_server() -> None:
    p = ROOT / "server.py"
    replace_one(p, 'APP_VERSION = "3.31.5"', 'APP_VERSION = "3.31.6"')
    replace_one(p, '"generation": int(meta.get("contentGeneration") or 2),\n                    "legacy": False, "rolling": True,', '"generation": int(meta.get("contentGeneration") or data.get("freeGeneration") or 1),\n                    "legacy": False, "rolling": True,')
    old = '''def free_slot_summary(rows: list[dict]) -> dict[str, dict[str, int]]:
    difficulties = ("easy", "medium", "hard", "hardcore")
    puzzle_data = load_puzzles(); reserve = load_rolling_content()
    maximum_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) + len(reserve.get("puzzles", {}).get(key, [])) for key in difficulties}
    legacy_slots = {key: set() for key in difficulties}
    gen2_slots = {key: set() for key in difficulties}
    for row in rows:
        if row.get("mode") != "free" or row.get("difficulty") not in legacy_slots:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), str(row.get("difficulty") or ""))
        if not info or not 1 <= int(info["level"]) <= maximum_levels.get(info["difficulty"], 0):
            continue
        target = gen2_slots if int(info["generation"]) >= 2 else legacy_slots
        target[info["difficulty"]].add(int(info["level"]))
    return {
        "effective": {key: len(legacy_slots[key] | gen2_slots[key]) for key in difficulties},
        "transferred": {key: len(legacy_slots[key] - gen2_slots[key]) for key in difficulties},
        "gen2": {key: len(gen2_slots[key]) for key in difficulties},
    }
'''
    new = '''def free_slot_summary(rows: list[dict]) -> dict[str, dict[str, int]]:
    """Summarise stable difficulty+level slots without exposing content generations to players."""
    difficulties = ("easy", "medium", "hard", "hardcore")
    puzzle_data = load_puzzles(); reserve = load_rolling_content()
    active_generation = int(puzzle_data.get("freeGeneration") or 1)
    maximum_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) + len(reserve.get("puzzles", {}).get(key, [])) for key in difficulties}
    prior_slots = {key: set() for key in difficulties}
    current_slots = {key: set() for key in difficulties}
    for row in rows:
        if row.get("mode") != "free" or row.get("difficulty") not in prior_slots:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), str(row.get("difficulty") or ""))
        if not info or not 1 <= int(info["level"]) <= maximum_levels.get(info["difficulty"], 0):
            continue
        is_current = int(info["generation"]) == active_generation and info.get("legacy") is not True
        target = current_slots if is_current else prior_slots
        target[info["difficulty"]].add(int(info["level"]))
    effective = {key: len(prior_slots[key] | current_slots[key]) for key in difficulties}
    transferred = {key: len(prior_slots[key] - current_slots[key]) for key in difficulties}
    current = {key: len(current_slots[key]) for key in difficulties}
    return {"effective": effective, "transferred": transferred, "current": current, "gen2": current}
'''
    replace_one(p, old, new)
    replace_one(p, '"freePlayedGen2": free_slots["gen2"],', '"freePlayedCurrent": free_slots["current"],\n        # Compatibility alias for cached pre-Gen3 clients; semantics are now active-generation plays.\n        "freePlayedGen2": free_slots["current"],')

    old_played = '''    legacy_slots: set[int] = set()
    legacy_history: list[dict] = []
    gen2_result_by_puzzle: dict[str, dict] = {}
    for row in results:
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if not info:
            continue
        if int(info["generation"]) >= 2:
            gen2_result_by_puzzle[str(row.get("puzzle_id"))] = row
        else:
            legacy_slots.add(int(info["level"]))
            legacy_history.append({
                "puzzleId": row.get("puzzle_id"), "level": int(info["level"]),
                "contentGeneration": int(info["generation"]),
                "elapsedMs": int(row.get("best_elapsed_ms") or 1000),
                "moves": int(row.get("best_moves") or 1),
                "hintsUsed": int(row.get("hints_used") or 0),
                "wrongAttempts": int(row.get("wrong_attempts") or 0),
                "cleanSolve": row.get("clean_solve") is True,
                "completedAt": row.get("completed_at"),
            })
'''
    new_played = '''    active_generation = int(data.get("freeGeneration") or 1)
    prior_slots: set[int] = set()
    prior_history: list[dict] = []
    current_result_by_puzzle: dict[str, dict] = {}
    for row in results:
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if not info:
            continue
        if int(info["generation"]) == active_generation and info.get("legacy") is not True:
            current_result_by_puzzle[str(row.get("puzzle_id"))] = row
        else:
            prior_slots.add(int(info["level"]))
            prior_history.append({
                "puzzleId": row.get("puzzle_id"), "level": int(info["level"]),
                "contentGeneration": int(info["generation"]),
                "elapsedMs": int(row.get("best_elapsed_ms") or 1000),
                "moves": int(row.get("best_moves") or 1),
                "hintsUsed": int(row.get("hints_used") or 0),
                "wrongAttempts": int(row.get("wrong_attempts") or 0),
                "cleanSolve": row.get("clean_solve") is True,
                "completedAt": row.get("completed_at"),
            })
'''
    replace_one(p, old_played, new_played)
    text = p.read_text(encoding="utf-8")
    text = text.replace('result_row = gen2_result_by_puzzle.get(p["id"])', 'result_row = current_result_by_puzzle.get(p["id"])')
    text = text.replace('elif level in legacy_slots:', 'elif level in prior_slots:')
    text = text.replace('legacy_history.sort(key=lambda row: (row["level"], str(row.get("completedAt") or ""), str(row.get("puzzleId") or "")))\n    return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}', 'prior_history.sort(key=lambda row: (row["level"], str(row.get("completedAt") or ""), str(row.get("puzzleId") or "")))\n    return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": prior_history}')
    # Add neutral health marker while retaining old compatibility field.
    text = text.replace('"freeGeneration2Migration": free_generation2_migration, "starterMigration"', '"freeGeneration2Migration": free_generation2_migration, "freeProgressionMigration": free_generation2_migration, "stableFreeLevelSlots": True, "starterMigration"')
    text = text.replace('"freeGeneration2Migration": False, "starterMigration"', '"freeGeneration2Migration": False, "freeProgressionMigration": False, "stableFreeLevelSlots": True, "starterMigration"')
    p.write_text(text, encoding="utf-8")


def patch_sw() -> None:
    p = ROOT / "public" / "sw.js"
    text = p.read_text(encoding="utf-8")
    if "3.31.5" not in text:
        raise RuntimeError("Expected 3.31.5 service-worker cache marker")
    p.write_text(text.replace("3.31.5", "3.31.6"), encoding="utf-8")


def write_audit() -> None:
    p = ROOT / "tools" / "audit_free_generation3.py"
    p.write_text(r'''#!/usr/bin/env python3
"""Independent release audit for Free Generation 3 and its progression ladder."""
from __future__ import annotations

from collections import Counter
import importlib.util
import json
import math
from pathlib import Path
import statistics
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "puzzles.json"
PUBLIC = ROOT / "public" / "puzzles.json"
ROLLING = ROOT / "data" / "rolling_content_v1.json"
LEXICON = ROOT / "data" / "lexicon_v2.json"
WORDS = ROOT / "data" / "words.txt"
GEN = ROOT / "tools" / "generate_puzzles.py"
REPORT_JSON = ROOT / "FREE_GENERATION3_AUDIT.json"
REPORT_MD = ROOT / "FREE_GENERATION3_AUDIT_CZ.md"
DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
PREFIX = {"easy": "g3-e", "medium": "g3-m", "hard": "g3-h", "hardcore": "g3-x"}
ALLOWED = {"easy": set("A"), "medium": set("AB"), "hard": set("BC"), "hardcore": set("CD")}
REJECTED = {"nocebo", "trebuchet", "sofismus", "černodíra", "perigeum", "aerogel"}


def load_generator():
    spec = importlib.util.spec_from_file_location("audit_gp", GEN)
    mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)
    return mod


def mean(values):
    return round(statistics.mean(values), 3) if values else None


def band_row(puzzles):
    turns = [a.get("turns", 0) for p in puzzles for a in p.get("answers", [])]
    scores = [int((p.get("meta") or {}).get("difficultyScore") or 0) for p in puzzles]
    cells = [len(p.get("mask") or []) for p in puzzles]
    words = [len(p.get("answers") or []) for p in puzzles]
    tiers = Counter()
    for p in puzzles:
        tiers.update((p.get("meta") or {}).get("vocabTiers") or {})
    total_tiers = sum(tiers.values()) or 1
    return {
        "levels": len(puzzles), "meanCells": mean(cells), "meanWords": mean(words),
        "meanDifficultyScore": mean(scores), "medianDifficultyScore": statistics.median(scores) if scores else None,
        "meanTurnsPerWord": mean(turns), "zeroTurnShare": round(sum(t == 0 for t in turns) / len(turns), 3) if turns else None,
        "lowTurnShare": round(sum(t <= 1 for t in turns) / len(turns), 3) if turns else None,
        "tierShares": {k: round(v / total_tiers, 3) for k, v in sorted(tiers.items())},
    }


def main():
    gp = load_generator()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    rolling = json.loads(ROLLING.read_text(encoding="utf-8"))
    lex = json.loads(LEXICON.read_text(encoding="utf-8"))
    meta = {e["word"]: e for e in lex["entries"]}
    dictionary = WORDS.read_text(encoding="utf-8").splitlines()
    assert data == public
    assert int(data.get("version") or 0) == 10
    assert int(data.get("freeGeneration") or 0) == 3
    assert data.get("freeMigration", {}).get("strategy") == "stable-level-slots"
    assert data.get("freeMigration", {}).get("playerFacingGenerationLabels") is False
    assert not (REJECTED & set(meta))
    assert int(rolling.get("basePuzzleVersion") or 0) == 10
    assert rolling.get("generatedAtVersion") == "3.31.6"

    active_ids = set(); signatures = set(); solved = 0; answer_positions = {}
    summaries = {}
    for diff in DIFFICULTIES:
        bank = data["free"][diff]
        assert len(bank) == 200
        positions = {}
        for level, puzzle in enumerate(bank, start=1):
            assert puzzle["id"] == f"{PREFIX[diff]}-{level:03d}"
            assert puzzle["id"] not in active_ids; active_ids.add(puzzle["id"])
            pm = puzzle["meta"]
            assert int(pm.get("level")) == level and int(pm.get("contentGeneration")) == 3
            assert pm.get("generationKey") == "free-gen3"
            sig = (puzzle["rows"], puzzle["cols"], tuple(puzzle["letters"]))
            assert sig not in signatures; signatures.add(sig)
            targets = [a["word"].lower() for a in puzzle["answers"]]
            assert not (REJECTED & set(targets))
            assert len(targets) == len(set(targets))
            assert sum(map(len, targets)) == len(puzzle["mask"])
            for word in targets:
                assert word in meta and meta[word]["tier"] in ALLOWED[diff]
                if word in positions:
                    assert level - positions[word] >= 25, (diff, word, positions[word], level)
                positions[word] = level
            solver_dictionary = list(dict.fromkeys(dictionary[:12000] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
            solutions, candidates, nodes = gp.solve_count(
                [x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"],
                puzzle["lengths"], solver_dictionary, limit=2,
            )
            assert solutions == 1, (puzzle["id"], solutions, candidates, nodes)
            solved += 1
            if solved % 100 == 0:
                print(f"Broad exact-cover recheck {solved}/800", flush=True)
        answer_positions[diff] = positions
        summaries[diff] = {
            "1-50": band_row(bank[:50]), "51-100": band_row(bank[50:100]),
            "101-150": band_row(bank[100:150]), "151-200": band_row(bank[150:200]),
        }

    legacy_ids = {p["id"] for bank in (data.get("legacyFree") or {}).values() for p in bank}
    assert not active_ids & legacy_ids

    # Rolling reserve must continue Gen3 numbering and the 24-level anti-repeat window.
    rolling_checked = 0
    for diff in DIFFICULTIES:
        expected = 201
        recent_positions = dict(answer_positions[diff])
        for puzzle in rolling.get("puzzles", {}).get(diff, []):
            level = int((puzzle.get("meta") or {}).get("level") or 0)
            assert level == expected, (diff, expected, level)
            assert puzzle["id"] == f"{PREFIX[diff]}-{level:03d}"
            assert int(puzzle["meta"].get("contentGeneration")) == 3
            targets = [a["word"].lower() for a in puzzle["answers"]]
            assert not (REJECTED & set(targets))
            for word in targets:
                if word in recent_positions:
                    assert level - recent_positions[word] >= 25, (diff, word, recent_positions[word], level)
                recent_positions[word] = level
            solver_dictionary = list(dict.fromkeys(dictionary[:12000] + targets + sorted(gp.EDITORIAL_VALIDATOR_WORDS)))
            solutions, _, _ = gp.solve_count([x.lower() for x in puzzle["letters"]], puzzle["rows"], puzzle["cols"], puzzle["mask"], puzzle["lengths"], solver_dictionary, limit=2)
            assert solutions == 1, puzzle["id"]
            expected += 1; rolling_checked += 1

    m = summaries["medium"]; h = summaries["hard"]
    # Ladder guardrails: Medium grows in search area and later path complexity; Hard starts near late Medium.
    assert m["51-100"]["meanCells"] > m["1-50"]["meanCells"]
    assert m["151-200"]["meanTurnsPerWord"] > m["1-50"]["meanTurnsPerWord"]
    assert h["1-50"]["meanTurnsPerWord"] >= m["151-200"]["meanTurnsPerWord"]
    assert h["1-50"]["meanCells"] <= m["151-200"]["meanCells"] + 8
    report = {
        "status": "PASS", "freeGeneration": 3, "broadExactCoverRechecked": solved,
        "rollingRechecked": rolling_checked, "rejectedTargetWordsAbsent": sorted(REJECTED),
        "bands": summaries,
        "bridge": {"lateMedium": m["151-200"], "earlyHard": h["1-50"]},
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    labels = {"easy":"Snadná","medium":"Střední","hard":"Těžká","hardcore":"Mozkožrout"}
    lines = ["# Proplet Free Generation 3 — progression audit", "", "**Výsledek: PASS**", "", f"- {solved}/800 aktivních Free desek ověřeno širokým exact-cover solverem.", f"- {rolling_checked} budoucích rolling desek ověřeno včetně anti-repeat přes hranici levelu 200.", "- Hráčský model je pouze obtížnost + číslo úrovně; generace jsou interní implementační detail.", "- Reportovaná nevhodná cílová slova byla odstraněna z target lexikonu.", "", "| Obtížnost | Pásmo | políčka | slova | score | zatáčky/slovo | ≤1 zatáčka |", "|---|---|---:|---:|---:|---:|---:|"]
    for diff in DIFFICULTIES:
        for band, row in summaries[diff].items():
            lines.append(f"| {labels[diff]} | {band} | {row['meanCells']:.1f} | {row['meanWords']:.1f} | {row['meanDifficultyScore']:.1f} | {row['meanTurnsPerWord']:.2f} | {row['lowTurnShare']*100:.0f} % |")
    lines += ["", "## Most Střední → Těžká", "", f"Pozdní Střední: {m['151-200']['meanCells']:.1f} políčka, {m['151-200']['meanTurnsPerWord']:.2f} zatáčky/slovo.", f"První Těžká: {h['1-50']['meanCells']:.1f} políčka, {h['1-50']['meanTurnsPerWord']:.2f} zatáčky/slovo."]
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report["bridge"], ensure_ascii=False, indent=2))
    print("PASS: Free Generation 3 progression audit")


if __name__ == "__main__":
    main()
''', encoding="utf-8")


def main() -> None:
    patch_lexicon_builder()
    patch_canonical_lexicon()
    patch_generator()
    write_gen3_generator()
    patch_rolling_generator()
    patch_app()
    patch_server()
    patch_sw()
    write_audit()
    print("Applied v3.31.6 Gen3 progression source patch")


if __name__ == "__main__":
    main()
