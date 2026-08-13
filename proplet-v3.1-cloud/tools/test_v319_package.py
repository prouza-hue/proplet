#!/usr/bin/env python3
"""Release-completeness checks for a source tree or extracted v3.19 package."""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
REQUIRED = (
    "server.py", "requirements.txt", "vercel.json", "SUPABASE_MIGRATION_V3_19.sql",
    "data/puzzles.json", "data/words.txt", "data/lexicon_v2.json", "data/answer_tiers.json",
    "public/index.html", "public/app.js", "public/styles.css", "public/sw.js", "public/puzzles.json",
    "public/admin.html", "public/admin.css", "public/admin.js",
)
for relative in REQUIRED:
    assert (ROOT / relative).is_file(), f"missing release file: {relative}"

server = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public/app.js").read_text(encoding="utf-8")
index = (ROOT / "public/index.html").read_text(encoding="utf-8")
service_worker = (ROOT / "public/sw.js").read_text(encoding="utf-8")
migration = (ROOT / "SUPABASE_MIGRATION_V3_19.sql").read_text(encoding="utf-8")
puzzles_raw = (ROOT / "data/puzzles.json").read_bytes()
puzzles = json.loads(puzzles_raw)

assert 'version="3.19.1-cloud"' in server
assert '"version": "3.19.1"' in server
assert "const APP_VERSION='3.19.1'" in app
assert "Proplet v3.19.1" in index
assert "proplet-v3.19.1-recovery-complete-shell" in service_worker
assert 'return RedirectResponse(url="/admin.html", status_code=307)' in server

# A file can exist and still be unusable: v3.19.0 accidentally shipped an
# index truncated before app.js. Check the complete boot shell, not only names.
assert len(index.encode("utf-8")) > 25_000
assert index.rstrip().endswith("</html>")
assert '<script src="/app.js"></script>' in index
html_ids = set(re.findall(r'id=["\']([^"\']+)', index))
bind_match = re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot", app, re.S)
assert bind_match, "could not locate bind() for HTML contract check"
bound_ids = set(re.findall(r"\$\('#([^']+)'\)", bind_match.group(1)))
missing_bound_ids = sorted(bound_ids - html_ids)
assert not missing_bound_ids, f"index is missing controls required by bind(): {missing_bound_ids}"
assert "level between 1 and 200" in migration
assert puzzles.get("freeLevelsPerDifficulty") == 200
assert puzzles.get("freeExtendedFromVersion") == "3.19"
assert {key: len(bank) for key, bank in puzzles["free"].items()} == {
    "easy": 200, "medium": 200, "hard": 200, "hardcore": 200,
}
assert (ROOT / "public/puzzles.json").read_bytes() == puzzles_raw
assert all(puzzle["meta"]["vocabPolicy"] == "hardcore_conservative" for puzzle in puzzles["free"]["hardcore"][100:])
new_hardcore_words = {
    answer["word"].casefold() for puzzle in puzzles["free"]["hardcore"][100:] for answer in puzzle["answers"]
}
assert not new_hardcore_words & {"nocebo", "mastaba"}
assert "function pauseGameClock(" in app and "function resumeGameClock(" in app
assert "window.addEventListener('blur',()=>pauseGameClock('blur'))" in app
assert "window.addEventListener('focus',resumeGameClock)" in app

print(f"v3.19.1 release completeness and boot shell: OK ({ROOT})")
