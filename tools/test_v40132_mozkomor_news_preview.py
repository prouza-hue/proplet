#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
app=(root/"public/app.js").read_text(encoding="utf-8")
home=(root/"public/home-layout.js").read_text(encoding="utf-8")
theme=(root/"public/theme-init.js").read_text(encoding="utf-8")
quality=(root/"public/quality-v334-core-v40114.js").read_text(encoding="utf-8")
notes=(root/"public/release-notes-v3331.js").read_text(encoding="utf-8")
css=(root/"public/release-notes-v3331.css").read_text(encoding="utf-8")
server=(root/"server.py").read_text(encoding="utf-8")

# Exactly one active release CTA: the v4.01.32 card suppresses both legacy Gen4/XP modals.
assert "window.PROPLET_SINGLE_RELEASE_CTA_V40132=true" in theme
assert "PROPLET_SINGLE_RELEASE_CTA_V40132===true" in quality
assert "qualityReleaseModal" in quality
assert "Novinky v Propletu" in notes
for phrase in (
    "Tajenka",
    "nová každou sobotu",
    "Mozkomor",
    "100 nových úrovní",
    "+1 XP",
    "za platná slova navíc",
    "Jdu hrát",
):
    assert phrase in notes, phrase
assert "eyebrow" not in notes
assert "release-notes-v3331-secondary" not in notes
assert notes.count("Jdu hrát")==1

# Product invariant: Mozkomor is a 100-board 150-XP endgame unlocked by 200/200 Mozkožrout.
assert "mozkomor:{label:'Mozkomor'" in app
assert "xp:150" in app
assert "const MOZKOMOR_UNLOCK_BASE=200" in app
assert "Odemkne se po dokončení všech 200 Mozkožroutů." in app
assert "<small>/200</small>" in app
assert "Endgame · 100 úrovní · +150 XP za novou úroveň" in app

# Dnes never exposes Mozkomor, including quick play and resume/history.
assert "Object.entries(DIFF).filter(([key])=>key!=='mozkomor')" in app
assert "Object.entries(DIFF).filter(([key])=>key!=='mozkomor')" in home
assert "r.difficulty!=='mozkomor'" in home

# QA bypass is preview-only and never syncs Mozkomor test results to production APIs.
assert "location.hostname.endsWith('.vercel.app')" in app
assert "MOZKOMOR_QA_PARAM==='final'||MOZKOMOR_QA_PARAM==='unlocked'" in app
assert "MOZKOMOR_QA_PREVIEW&&rec?.difficulty==='mozkomor'" in app
assert "MOZKOMOR_QA_PREVIEW&&g?.puzzle?.difficulty==='mozkomor'" in app

# Server-authoritative production gate.
assert 'FREE_DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor")' in server
assert '"mozkomor": 150' in server
assert "MOZKOMOR_UNLOCK_BASE_LEVELS = 200" in server
assert '"freeBasePlayedCurrent": free_slots["baseCurrent"]' in server
assert '"mozkomorUnlocked": mozkomor_unlocked_from_rows(rows)' in server
assert 'if payload.difficulty == "mozkomor":' in server
assert 'raise HTTPException(403, "Mozkomor se odemkne po dokončení všech 200 Mozkožroutů")' in server

# Compact visual release card contract.
assert ".release-notes-v3331-features" in css
assert ".release-notes-v3331-feature" in css
assert ".release-notes-v3331-account" in css
print("v4.01.32 Mozkomor/news preview contract: OK")
