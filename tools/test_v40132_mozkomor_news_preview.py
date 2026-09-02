#!/usr/bin/env python3
"""Joint v4.01.32 XP economy + Mozkomor + release CTA contract."""
from __future__ import annotations

import json
from pathlib import Path
import sys
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


app = read("public/app.js")
home = read("public/home-layout.js")
theme = read("public/theme-init.js")
quality = read("public/quality-v334-core-v40114.js")
notes = read("public/release-notes-v3331.js")
css = read("public/release-notes-v3331.css")
server_source = read("server.py")
migration = read("SUPABASE_MIGRATION_V4_01_32_MOZKOMOR.sql")
puzzles = json.loads(read("data/puzzles.json"))
public_puzzles = json.loads(read("public/puzzles.json"))

# The v4.01.32 release CTA is retired from runtime, while its historical asset
# remains in the repository. The suppression flag stays active so retiring the
# CTA cannot resurrect the older Gen4/XP release modal.
assert "window.PROPLET_SINGLE_RELEASE_CTA_V40132=true" in theme
assert "PROPLET_SINGLE_RELEASE_CTA_V40132===true" in quality
assert "release-notes-v3331.js" not in theme
assert "release-notes-v3331.css" not in theme
assert "Novinky v Propletu" in notes
assert notes.count("Jdu hrát") == 1
assert "release-notes-v3331-art" in notes
assert all(token in css for token in ("tile-p", "feature-tajenka", "feature-mozkomor", "feature-xp"))

# Final bank is bound unchanged and exposes the approved 200/200 unlock contract.
for payload in (puzzles, public_puzzles):
    bank = payload["free"]["mozkomor"]
    assert len(bank) == 100
    assert [p["id"] for p in bank] == [f"g4-z-{i:03d}" for i in range(1, 101)]
    assert [int(p["meta"]["level"]) for p in bank] == list(range(1, 101))
    assert all(p["difficulty"] == "mozkomor" for p in bank)
    assert all(int(p["meta"]["targetCooldown"]) == 8 for p in bank)
    assert payload["mozkomorUnlock"] == {
        "requiresDifficulty": "hardcore",
        "requiresCurrentBaseLevels": 200,
        "persistentOnceEarned": True,
        "levels": 100,
        "xpPerFirstCompletion": 150,
    }

# Hrát shows a gated fifth card, while the four existing cards never regain the old X z 200 eyebrow.
assert "mozkomor:{label:'Mozkomor'" in app
assert "xp:150" in app
assert "const MOZKOMOR_UNLOCK_BASE=200" in app
assert "Odemkne se po dokončení všech 200 Mozkožroutů" in app
assert "<small>/200</small>" in app
assert "+150 XP za novou úroveň" in app
assert "ÚROVEŇ ${nextLevel||1} Z ${total}" not in app

# Dnes never exposes Mozkomor, including quick play, resume, or local recent history.
assert "Object.entries(DIFF).filter(([key])=>key!=='mozkomor')" in app
assert "Object.entries(DIFF).filter(([key])=>key!=='mozkomor')" in home
assert "r.difficulty!=='mozkomor'" in home

# QA bypass is preview-only, excludes known production aliases, and never syncs test runs.
assert "location.hostname.endsWith('.vercel.app')" in app
assert "location.hostname.includes('-git-')" in app
for production_host in (
    "proplet-nine.vercel.app",
    "proplet-pavel-prouzas-projects.vercel.app",
    "proplet-git-main-pavel-prouzas-projects.vercel.app",
):
    assert production_host in app
assert "MOZKOMOR_QA_PARAM==='final'" in app
assert "MOZKOMOR_QA_PARAM==='unlocked'" not in app
assert app.count("isMozkomorQaDifficulty(") >= 5

# Server-authoritative gate and persistent unlock semantics.
assert server.FREE_DIFFICULTIES == ("easy", "medium", "hard", "hardcore", "mozkomor")
assert server.POINTS["mozkomor"] == 150
assert server.MOZKOMOR_UNLOCK_BASE_LEVELS == 200
empty = {key: 0 for key in server.FREE_DIFFICULTIES}
summary = {"baseCurrent": {**empty, "hardcore": 199}}
assert server.mozkomor_unlocked_from_rows([], summary) is False
try:
    server.enforce_mozkomor_unlock([], summary)
    raise AssertionError("locked Mozkomor must return HTTP 403")
except HTTPException as exc:
    assert exc.status_code == 403
summary["baseCurrent"]["hardcore"] = 200
assert server.mozkomor_unlocked_from_rows([], summary) is True
server.enforce_mozkomor_unlock([], summary)
assert server.mozkomor_unlocked_from_rows([{"mode": "free", "difficulty": "mozkomor"}], {"baseCurrent": empty}) is True
assert '"freeBasePlayedCurrent": free_slots["baseCurrent"]' in server_source
assert 'if payload.difficulty == "mozkomor":' in server_source
assert "enforce_mozkomor_unlock(unlock_rows)" in server_source

# Migration is prepared for release but this test does not execute it.
for table in ("results", "puzzle_attempts", "free_slot_rewards"):
    assert f"alter table public.{table}" in migration
assert migration.count("'mozkomor'::text") == 3

print("v4.01.32 joint preview contract: OK")
