"""The new content extends finite play without changing prior rewards or slots."""
import hashlib
import json
from pathlib import Path

from backend.content import free_puzzle_info
from tools.free_expansion.integrate import BATCH, DIFFICULTIES, digest
from tools.free_expansion.catalog import difficulty_prefixes, LEXICON_PATH, norm
from tools.measure_gen4_ambiguity import board_metrics

ROOT = Path(__file__).resolve().parents[2]
read = lambda name: json.loads((ROOT / name).read_bytes())
pack = Path("content/gen6") / BATCH
source, public = read("data/puzzles.json"), read("public/puzzles.json")
frozen, boundary = read(pack / "bank.json"), read(pack / "production-boundaries.json")
routes = read("public/content/free-order/shared-pestre-v3.json")
assert digest(frozen["boards"]) == frozen["contentHash"] == boundary["manufacturedContentHash"]
assert source["freeGeneration"] == source["contentGeneration"] == 4
assert source["free"] == public["free"]
assert source["freeExpansionRelease"]["totalNewLevels"] == 600
assert source["freeLevelCounts"] == dict(zip(DIFFICULTIES, (500, 500, 500, 400, 250, 200)))
assert set(source) == set(boundary["preserved"]) | {"free", "freeLevelCounts", "mozkomorUnlock", "freeExpansionRelease"}
for field, expected in boundary["preserved"].items():
    assert digest(source[field]) == expected, field
for field, expected in boundary["publicPreserved"].items():
    assert digest(public[field]) == expected, field
assert {k: v for k, v in source["mozkomorUnlock"].items() if k != "levels"} == {
    k: v for k, v in boundary["mozkomorUnlock"].items() if k != "levels"}
assert source["mozkomorUnlock"]["levels"] == 250
assert hashlib.sha256((ROOT / "data/rolling_content_v1.json").read_bytes().replace(b"\r\n", b"\n")).hexdigest() == boundary["rollingSha256"]
by_id = {p["id"]: p for p in frozen["boards"]}
all_ids = set()
for d in DIFFICULTIES:
    old_count = boundary["counts"][d]
    old, added = source["free"][d][:old_count], source["free"][d][old_count:]
    assert digest(old) == boundary["free"][d], d
    assert len(added) == 100
    assert len({p["meta"]["level"] for p in source["free"][d]}) == len(source["free"][d])
    route_prefix = boundary["routePrefixes"][d]
    assert digest(routes["routes"][d][:route_prefix["count"]]) == route_prefix["hash"]
    assert routes["routes"][d][route_prefix["count"]:] == [p["id"] for p in added]
    assert set(routes["routes"][d]) == {p["id"] for p in source["free"][d]}
    for index, p in enumerate(added, 1):
        assert p["id"] not in all_ids
        all_ids.add(p["id"])
        for key in ("id", "difficulty", "rows", "cols", "mask", "letters", "answers"):
            assert p[key] == by_id[p["id"]][key], (p["id"], key)
        meta = p["meta"]
        assert "manufacture" not in meta and "manufacture" in by_id[p["id"]]["meta"]
        assert meta["level"] == boundary["maxLevels"][d] + index
        assert meta["contentGeneration"] == 4 and meta["generatorGeneration"] == 6
        assert meta["releaseBatch"] == BATCH and not meta["candidateOnly"] and not meta["playtestOnly"]
        info = free_puzzle_info(source, {}, p["id"], DIFFICULTIES, d)
        assert info["generation"] == 4 and info["level"] == meta["level"] and not info["legacy"]
        cells = []
        for answer in p["answers"]:
            path = answer["path"]
            assert "".join(p["letters"][i] for i in path) == answer["word"]
            for a, b in zip(path, path[1:]):
                assert abs(a // p["cols"] - b // p["cols"]) + abs(a % p["cols"] - b % p["cols"]) == 1
            cells.extend(path)
        assert sorted(cells) == sorted(p["mask"]) and len(cells) == len(set(cells))
assert len(all_ids) == 600
# Correctness recognition grew after calibration. Reproduce an actually
# released anchor so a larger recognizer cannot silently shift difficulty.
class CalibrationVocabulary:
    entries = {norm(e["word"]): e for e in json.loads(LEXICON_PATH.read_bytes())["entries"]}

anchor = next(p for p in read("content/gen6/free-refresh-300/bank.json")["boards"] if p["id"] == "g6-refresh-hard-100")
assert board_metrics(anchor, difficulty_prefixes(CalibrationVocabulary()), 4)["localAmbiguityScore"] == 15.972
assert anchor["meta"]["manufacture"]["ambiguity"]["localAmbiguityScore"] == 15.972
print("PASS 600 appended boards; all prior content, slots, route prefixes, runtime identities and reward eligibility retained")
