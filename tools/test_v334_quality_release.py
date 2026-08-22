#!/usr/bin/env python3
"""Cheap release contract for the v3.34 UX/archive/Calm Mode quality pass."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
server = (root / "server.py").read_text(encoding="utf-8")
client = (root / "public" / "quality-v334.js").read_text(encoding="utf-8")
css = (root / "public" / "quality-v334.css").read_text(encoding="utf-8")
hotfix_css = (root / "public" / "quality-hotfix-v334.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")
index = (root / "public" / "index.html").read_text(encoding="utf-8")
app = (root / "public" / "app.js").read_text(encoding="utf-8")
sw = (root / "public" / "sw.js").read_text(encoding="utf-8")
preview_auth = (root / "preview_auth_v334.py").read_text(encoding="utf-8")
account_auth = (root / "account_auth.py").read_text(encoding="utf-8")
migration = (root / "SUPABASE_MIGRATION_V3_34_GEN4_ARCHIVE.sql").read_text(encoding="utf-8")
verify = (root / "SUPABASE_VERIFY_V3_34_GEN4_ARCHIVE.sql").read_text(encoding="utf-8")
production_puzzles = json.loads((root / "data" / "puzzles.json").read_text(encoding="utf-8"))
gen4_puzzles = json.loads((root / "data" / "puzzles_gen4_candidate_v334.json").read_text(encoding="utf-8"))

# The scripted onboarding puzzle is a UX asset, never generated content.
canonical_starter = production_puzzles["starter"]
assert gen4_puzzles["starter"] == canonical_starter
assert canonical_starter["id"] == "starter-v1"
assert (canonical_starter["rows"], canonical_starter["cols"]) == (5, 5)
assert [a["word"] for a in canonical_starter["answers"]] == ["MRAK", "JABLKO", "ČOKOLÁDA", "AUTOBUS"]
starter_cells = [i for answer in canonical_starter["answers"] for i in answer["path"]]
assert len(starter_cells) == 25 and len(set(starter_cells)) == 25

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
    "Nové úrovně jsou tady!",
    "Vyladěná obtížnost pro více zábavy",
    "800 nových volných úrovní",
    "Vyladěná obtížnost napříč všemi režimy",
    "Tvé XP, postup, historie i odznaky zůstávají",
    "Klidný režim, když si chceš oddechnout od žebříčku",
    "Jdu si zahrát!",
    "Jak se změnil archiv a postup",
    "Dosažená hodnost",
    "Propletené úspěchy",
    "Odznaky za věrnost",
    "Dříve odehrané",
):
    assert phrase in client, phrase
assert "Víc zábavy, menší frustrace!" not in client
assert "Vyladili jsme obtížnost a komplet předělali všechny úrovně." not in client
assert "Čisté řešení → méně nápověd → čas → tahy." in client
assert "#screen-free>.screen-title" in css and "#screen-leaderboard>.screen-title" in css
assert "appearance-card .section-head .eyebrow" in client

# Responsive modal and flash-free boot are explicit release contracts.
for token in ("clamp(30px,3.2vw,42px)", "@media (min-width:720px)", "grid-template-columns:1fr 1fr"):
    assert token in css, token
assert "gen4-preview-booting" in runtime and "gen4-preview-booting" in css
assert "revealApp" in client

# Calm Mode UX/data: timer hidden, leaderboard hidden while calm, mid-run switch persisted.
for phrase in ("Klidný režim", "bez časomíry a žebříčku", "calm_mode"):
    assert phrase in client, phrase
assert "body.calm-run-v334 #timer" in css
assert "body.calm-run-v334 #levelLeaderboardBox" in css
assert 'content:"🫧 Klidný režim"' in css
assert "!eligible||calm" in client
assert "/api/attempt/checkpoint" in client
assert "sendAttemptCheckpoint('resume')" in client
assert "calmModeLeaderboardExcluded:true" in runtime

# Final v4 interaction polish: no obsolete reset, calm-mode confirmation, stable privacy icon.
assert 'id="resetBtn"' not in index
assert "$('#resetBtn').onclick" not in app
assert "🫧 Klidný režim" in client and "Přepnout do klidného režimu" not in client
assert "Zapnout Klidný režim?" in client
assert "tento pokus se nebude počítat do žebříčku" in client
assert "ranking-privacy-mini-icon" in client and "ranking-privacy-mini-label" in client
assert "label:'Anonymní'" in client
assert "transform:none" in hotfix_css
assert "Hrát další úroveň" in app

# v4 is a forced service-worker handover before the Monday Daily cutover.
assert 'version:\'4.00.0\'' in runtime
assert "proplet-v4.00.0" in sw
assert "self.skipWaiting()" in sw
assert "client.navigate(client.url)" in sw
assert "forcedClientUpdateV400:true" in runtime

# Preview auth stays narrow, but uses ordinary browser POST. No PROPFIND/fetch monkeypatch.
assert "gen4PreviewAuthTesting:true" in runtime
assert "__PROPLET_PREVIEW_FETCH_GUARD__" not in runtime
assert 'methods=["PROPFIND"]' not in preview_auth
assert '@app.middleware("http")' in preview_auth
assert 'request.method == "POST"' in preview_auth
for path in (
    "/api/login",
    "/api/player",
    "/api/auth/google/complete",
    "/api/account/email/start",
    "/api/account-bonus/claim",
):
    assert path in preview_auth, path
assert "_install_preview_auth_v334(app)" in account_auth
assert "GEN4_CANDIDATE_PREVIEW and request.method" in server

print("Proplet v4.00.0 quality release contract: OK")
