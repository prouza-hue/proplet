#!/usr/bin/env python3
"""Joint v4.01.32 XP economy + Mozkomor + release CTA contract."""
from __future__ import annotations

import json
from pathlib import Path
import sys

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

# The released bank and its historical metadata remain unchanged. Availability
# policy now belongs to the current runtime, not the frozen release artifact.
for payload in (puzzles, public_puzzles):
    assert len(payload["free"]["mozkomor"]) == 150
    bank = payload["free"]["mozkomor"][:100]
    assert [p["id"] for p in bank] == [f"g4-z-{i:03d}" for i in range(1, 101)]
    assert [int(p["meta"]["level"]) for p in bank] == list(range(1, 101))
    assert all(p["difficulty"] == "mozkomor" for p in bank)
    assert all(int(p["meta"]["targetCooldown"]) == 8 for p in bank)
    assert payload["mozkomorUnlock"] == {
        "requiresDifficulty": "hardcore",
        "requiresCurrentBaseLevels": 200,
        "persistentOnceEarned": True,
        "levels": 150,
        "xpPerFirstCompletion": 150,
    }

# Every Hrát card offers play immediately and retains completion history.
assert "mozkomor:{label:'Mozkomor'" in app
assert "xp:150" in app
assert "MOZKOMOR_UNLOCK_BASE" not in app
assert "a vypusť Mozkomora" not in app
assert "${unlock.done} / ${unlock.required} dokončeno" not in app
assert 'class="cp-lock-message"' not in app
assert 'data-play-free="${key}"' in app
assert "ÚROVEŇ ${nextLevel||1} Z ${total}" not in app

# Dnes exposes every registered difficulty, including resume and history.
assert "mozkomorUnlockState" not in app
assert "Object.keys(DIFF).filter(todayDifficultyVisible)" in home
assert "return !!DIFF[key]" in home
assert "r?.mode==='free'&&todayDifficultyVisible(r.difficulty)" in home

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

# Server has no completion prerequisites; old projection fields stay compatible.
assert server.FREE_DIFFICULTIES == ("easy", "medium", "hard", "hardcore", "mozkomor")
assert server.POINTS["mozkomor"] == 150
assert server.MOZKOMOR_UNLOCK_BASE_LEVELS == 0
empty = {key: 0 for key in server.FREE_DIFFICULTIES}
summary = {"current": {**empty, "hardcore": 199}}
assert server.mozkomor_unlocked_from_rows([], summary) is True
summary["current"]["hardcore"] = 200
assert server.mozkomor_unlocked_from_rows([], summary) is True
assert server.mozkomor_unlocked_from_rows([{"mode": "free", "difficulty": "mozkomor"}], {"baseCurrent": empty}) is True
assert '"freeBasePlayedCurrent": free_slots["baseCurrent"]' in server_source
assert "enforce_mozkomor_unlock" not in server_source
assert "Mozkomora nejprve odemkni" not in server_source

# Migration is prepared for release but this test does not execute it.
for table in ("results", "puzzle_attempts", "free_slot_rewards"):
    assert f"alter table public.{table}" in migration
assert migration.count("'mozkomor'::text") == 3

print("v4.01.32 joint preview contract: OK")
