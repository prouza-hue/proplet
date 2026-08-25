#!/usr/bin/env python3
"""The leaderboard must rank the same precision it shows to players."""

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
tree = ast.parse(source)
names = {"ranking_elapsed_ms", "displayed_elapsed_seconds", "run_rank_tuple", "competition_ranks"}
functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
assert {node.name for node in functions} == names
namespace = {}
exec(compile(ast.Module(body=functions, type_ignores=[]), "server.py", "exec"), namespace)
rank = namespace["run_rank_tuple"]
competition_ranks = namespace["competition_ranks"]

pavel = {"name": "Pavel", "clean_solve": True, "hints_used": 0, "elapsed_ms": 27_546, "moves": 8}
martina = {"name": "Martina", "clean_solve": True, "hints_used": 0, "elapsed_ms": 27_560, "moves": 7}
assert [row["name"] for row in sorted([pavel, martina], key=rank)] == ["Martina", "Pavel"]

# A genuinely faster displayed second still wins regardless of moves.
fast = {"clean_solve": True, "hints_used": 0, "elapsed_ms": 26_999, "moves": 99}
next_second = {"clean_solve": True, "hints_used": 0, "elapsed_ms": 27_000, "moves": 1}
assert sorted([next_second, fast], key=rank)[0] is fast

# Hidden milliseconds cannot decide at all when every displayed criterion is
# equal: both players share the same competition rank.
tie_a = {"clean_solve": True, "hints_used": 0, "elapsed_ms": 27_001, "moves": 7}
tie_b = {"clean_solve": True, "hints_used": 0, "elapsed_ms": 27_999, "moves": 7}
tie_rows = sorted([tie_b, tie_a], key=rank)
assert rank(tie_a) == rank(tie_b)
assert competition_ranks(tie_rows) == [1, 1]

assert source.count("displayed_elapsed_seconds(") >= 2
assert source.count("run_rank_tuple(") >= 6
assert "Math.floor(elapsed/1000),Number(r?.moves" in app
assert "visibleTimeRankingV40118:true" in runtime
print("PASS: visible whole seconds rank before moves; equal visible results share a rank.")
