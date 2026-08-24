#!/usr/bin/env python3
"""Static regression checks for the v4.01.9 rankings latency hotfix."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
server = (ROOT / "server.py").read_text(encoding="utf-8")
app = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
vercel = (ROOT / "vercel.json").read_text(encoding="utf-8")

assert '"regions": ["arn1"]' in vercel
assert "DB_HTTP_CLIENT = httpx.Client(" in server
assert "DB_HTTP_CLIENT.request(" in server and "DB_HTTP_CLIENT.post(" in server
assert '_ranking_context(\n        include_results=False,\n        include_rescues=False,' in server
assert 'db_select_all("puzzle_runs", mode="daily", puzzle_id=primary_puzzle_id)' in server
assert "memberships_by_player" in server
assert "Promise.allSettled([" in app
assert "XP pořadí se teď nepodařilo načíst." in app
assert "Dnešní pořadí se teď nepodařilo načíst." in app
assert "rankingLatencyV4019:true" in runtime

print("Proplet v4.01.9 rankings latency hotfix contract: OK")
