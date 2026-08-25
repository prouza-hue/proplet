#!/usr/bin/env python3
"""Focused regression for the v4.01.16 Daily hero and team-score repair."""

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
server_source = (ROOT / "server.py").read_text(encoding="utf-8")
core = (ROOT / "public" / "quality-v334-core-v40114.js").read_text(encoding="utf-8")
challenge_css = (ROOT / "public" / "challenge-cta-v3333.css").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")

# Daily no longer spends hero space on a duplicate Calm-mode preference. The
# in-game action remains available and keeps its confirmation step.
assert "insertAdjacentHTML('beforebegin',html)" not in core
assert "q('#dailyCalmQuick')?.remove()" in core
assert "btn.id='calmRunBtn'" in core
assert "openCalmConfirmation('run')" in core

# The Daily challenge CTA uses the result-screen raspberry treatment but no
# shadow in normal, hover/focus or dark states.
daily_css = challenge_css.split(".daily-hero #shareDailyBtn.daily-challenge-cta{", 1)[1]
assert "linear-gradient(135deg,#a93262 0%,#c83f67 56%,#dc5b70 100%)" in daily_css
assert daily_css.count("box-shadow:none") >= 3

# Execute only the pure scoring helper. puzzle_runs has elapsed_ms (not
# best_elapsed_ms), so three distinct clean runs must receive distinct scores.
tree = ast.parse(server_source)
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "_daily_individual_score")
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), "server.py", "exec"), namespace)
score = namespace["_daily_individual_score"]
rows = [
    {"elapsed_ms": 60_000, "hints_used": 0, "clean_solve": True},
    {"elapsed_ms": 90_000, "hints_used": 0, "clean_solve": True},
    {"elapsed_ms": 120_000, "hints_used": 0, "clean_solve": True},
]
scores = [score(row, rows) for row in rows]
assert scores == [100.0, 90.0, 80.0], scores
assert sum(scores[:2]) / 2 > scores[2]

assert "dailyHeroTeamScoringV40116:true" in runtime
print("PASS: Daily hero is compact, CTA is raspberry/no-shadow and team scores use real elapsed_ms.")
