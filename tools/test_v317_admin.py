#!/usr/bin/env python3
"""Regression checks for Proplet v3.17 admin authorization and feedback queue."""

from __future__ import annotations

import copy
import hashlib
import sys
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


ADMIN_TOKEN = "admin-token"
PLAYER_TOKEN = "player-token"
ADMIN_ID = "00000000-0000-0000-0000-000000000001"
PLAYER_ID = "00000000-0000-0000-0000-000000000002"
NOW = "2026-08-13T12:00:00+02:00"

puzzles = server.load_puzzles()
test_puzzle = next(p for p in puzzles["free"]["medium"] if len(p.get("answers", [])) >= 2)
word_one, word_two = [answer["word"] for answer in test_puzzle["answers"][:2]]

tables = {
    "players": [
        {"id": ADMIN_ID, "name": "Pavel", "family_code": "PROUZA", "avatar": "😎", "support_mode": "older", "password_hash": "secret", "token_hash": hashlib.sha256(ADMIN_TOKEN.encode()).hexdigest(), "created_at": NOW},
        {"id": PLAYER_ID, "name": "Peter", "family_code": "PROUZA", "avatar": "🙂", "support_mode": "none", "password_hash": "secret", "token_hash": hashlib.sha256(PLAYER_TOKEN.encode()).hexdigest(), "created_at": NOW},
    ],
    "admin_accounts": [{"player_id": ADMIN_ID, "role": "owner", "active": True, "created_at": NOW}],
    "admin_audit_log": [],
    "player_sessions": [],
    "results": [],
    "puzzle_runs": [],
    "puzzle_attempts": [],
    "puzzle_feedback": [],
    "leagues": [{"code": "PROUZA", "name": "Prouza"}],
    "streak_rescues": [],
    "push_subscriptions": [],
    "hint_events": [],
    "helper_events": [],
    "product_events": [],
    "quality_snapshots": [],
}


def fake_select(table: str, **filters):
    rows = tables.get(table, [])
    return [copy.deepcopy(row) for row in rows if all(row.get(key) == value for key, value in filters.items() if value is not None)]


def fake_insert(table: str, row: dict):
    tables.setdefault(table, []).append(copy.deepcopy(row))
    return copy.deepcopy(row)


def fake_update(table: str, filters: dict, values: dict):
    changed = []
    for row in tables.get(table, []):
        if all(row.get(key) == value for key, value in filters.items()):
            row.update(copy.deepcopy(values))
            changed.append(copy.deepcopy(row))
    return changed


def fake_delete(table: str, **filters):
    removed = [row for row in tables.get(table, []) if all(row.get(key) == value for key, value in filters.items())]
    tables[table] = [row for row in tables.get(table, []) if row not in removed]
    return copy.deepcopy(removed)


def fake_request(method: str, table: str, *, params=None, body=None, prefer=None):
    if method == "GET":
        return fake_select(table)
    raise AssertionError((method, table, params, body, prefer))


server.db_select = fake_select
server.db_insert = fake_insert
server.db_update = fake_update
server.db_delete = fake_delete
server.db_request = fake_request

admin_auth = f"Bearer {ADMIN_TOKEN}"
player_auth = f"Bearer {PLAYER_TOKEN}"

# Separate role: the linked owner passes; an ordinary player in the same team does not.
admin = server.admin_me(admin_auth)
assert admin["name"] == "Pavel" and admin["role"] == "owner"
try:
    server.admin_me(player_auth)
    raise AssertionError("ordinary player entered admin")
except HTTPException as exc:
    assert exc.status_code == 403

# The old hidden Quality endpoint is protected by the same admin grant.
try:
    server.quality_report(player_auth)
    raise AssertionError("ordinary player opened quality report")
except HTTPException as exc:
    assert exc.status_code == 403

# Two different words from one board are two reports; submitting the same word updates it.
base = {"puzzle_id": test_puzzle["id"], "challenge_key": f"free:{test_puzzle['id']}", "kind": "word"}
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_one, note="První"), admin_auth, None)
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_two, note="Druhé"), admin_auth, None)
assert len(tables["puzzle_feedback"]) == 2
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_one, note="Aktualizace"), admin_auth, None)
assert len(tables["puzzle_feedback"]) == 2
assert next(row for row in tables["puzzle_feedback"] if row["word"] == word_one)["note"] == "Aktualizace"

# The queue exposes no password/token fields and changing status creates an audit entry.
queue = server.admin_reports("open", "", 100, admin_auth)
assert queue["total"] == 2
assert "token_hash" not in repr(queue) and "password_hash" not in repr(queue)
report_id = queue["reports"][0]["id"]
result = server.admin_report_update(report_id, server.AdminReportUpdate(status="resolved", resolution_note="Slovo je v pořádku."), admin_auth)
assert result["ok"] is True
assert next(row for row in tables["puzzle_feedback"] if row["id"] == report_id)["status"] == "resolved"
assert len(tables["admin_audit_log"]) == 1

# User list/detail contains useful operational data, never secrets.
users = server.admin_users("", 60, admin_auth)
detail = server.admin_user_detail(ADMIN_ID, admin_auth)
assert users["total"] == 2 and detail["user"]["name"] == "Pavel"
assert "token_hash" not in repr(users) + repr(detail)
assert "password_hash" not in repr(users) + repr(detail)

# Admin static route exists and the overview can be built over an empty playtest.
assert str(server.admin_home().path).endswith("public/admin.html")
overview = server.admin_overview(admin_auth)
assert overview["players"]["total"] == 2
assert overview["feedback"]["wordReportsTotal"] == 2

# Real routing preserves bearer authorization and serves /admin before the static mount.
client = TestClient(server.app)
assert client.get("/admin").status_code == 200
assert client.get("/api/admin/me", headers={"Authorization": admin_auth}).status_code == 200
assert client.get("/api/admin/me", headers={"Authorization": player_auth}).status_code == 403

print("v3.17 admin authorization, reports, audit and privacy: OK")
