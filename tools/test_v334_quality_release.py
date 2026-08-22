#!/usr/bin/env python3
"""Cheap release contract for the v3.34 UX/archive/Calm Mode quality pass."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
server = (root / "server.py").read_text(encoding="utf-8")
client = (root / "public" / "quality-v334.js").read_text(encoding="utf-8")
css = (root / "public" / "quality-v334.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
migration = (root / "SUPABASE_MIGRATION_V3_34_GEN4_ARCHIVE.sql").read_text(encoding="utf-8")
verify = (root / "SUPABASE_VERIFY_V3_34_GEN4_ARCHIVE.sql").read_text(encoding="utf-8")

# API + telemetry contract.
for model in ("ResultCreate", "AttemptStart", "AttemptFinishTelemetry"):
    match = re.search(rf"class {model}\(BaseModel\):(.*?)(?=\n\nclass |\n\ndef )", server, re.S)
    assert match and "calm_mode" in match.group(1), f"{model} must carry calm_mode"
checkpoint = re.search(r"class AttemptCheckpoint\(BaseModel\):(.*?)(?=\n\nclass )", server, re.S)
assert checkpoint and "calm_mode: Optional[bool] = None" in checkpoint.group(1)
assert '"calm_mode": bool(payload.calm_mode)' in server
assert 'values["calm_mode"] = bool(row.get("calm_mode") is True or payload.calm_mode)' in server

# Calm Mode stays in personal data but is cut out of every competitive source.
assert "def competitive_row(row: dict) -> bool:" in server
assert 'runs = [row for row in db_select_all("puzzle_runs", puzzle_id=puzzle_id, mode="free") if competitive_row(row)]' in server
assert 'db_select_all("puzzle_runs", mode="daily")' in server
assert 'if competitive_row(row)' in server
assert 'row.get("calm_mode") is not True' in server
assert '"calmMode": calm_mode_summary' in server
assert 'first_attempts = [a for a in active_first_attempts if a.get("calm_mode") is not True]' in server

# Migration is additive and stores the cohort flag on all three gameplay tables.
for table in ("results", "puzzle_runs", "puzzle_attempts"):
    block = re.search(rf"alter table public\.{table}(.*?);", migration, re.S)
    assert block and "calm_mode boolean not null default false" in block.group(1), table
assert "results_competitive_rank_idx" in migration
assert "puzzle_runs_competitive_rank_idx" in migration
assert verify.count("calm_mode") >= 4

# Player-facing contract: exact approved copy + compact hierarchy + archive reassurance.
for phrase in (
    "Nové úrovně jsou tady",
    "Víc zábavy, menší frustrace!",
    "Vyladili jsme obtížnost a komplet předělali všechny úrovně.",
    "800 nových volných úrovní",
    "Vyladěná obtížnost napříč všemi režimy",
    "Tvé XP, postup, historie i odznaky zůstávají",
    "Jdu si zahrát!",
    "Jak se změnil archiv a postup",
    "Dosažená hodnost",
    "Propletené úspěchy",
    "Odznaky za věrnost",
    "Dříve odehrané",
):
    assert phrase in client, phrase
assert "Čisté řešení → méně nápověd → čas → tahy." in client
assert "#screen-free>.screen-title" in css and "#screen-leaderboard>.screen-title" in css

# Calm Mode UX/data: timer hidden, leaderboard hidden while calm, and mid-run switch is persisted.
for phrase in ("Klidný režim", "Hraj bez časomíry a pořadí. XP i postup zůstávají.", "calm_mode"):
    assert phrase in client, phrase
assert "body.calm-run-v334 #timer" in css
assert "body.calm-run-v334 #levelLeaderboardBox" in css
assert "/api/attempt/checkpoint" in client
assert "sendAttemptCheckpoint('resume')" in client
assert "calmModeLeaderboardExcluded:true" in runtime

print("v3.34 quality release contract: OK")
