#!/usr/bin/env python3
"""Regression checks for Proplet v3.17 admin authorization and feedback queue."""

from __future__ import annotations

import copy
import hashlib
import sys
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, Request
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


def fixture_users(body):
    needle = (body.get("p_query") or "").casefold()
    rows = [p for p in tables["players"] if not needle or p["id"] == needle or needle in p["name"].casefold()]
    output = [{"id": p["id"], "name": p["name"], "avatar": p["avatar"], "family_code": p["family_code"],
               "team": "Prouza", "has_password": bool(p.get("password_hash")), "points": 0, "created_at": NOW}
              for p in rows]
    return {"total": len(output), "users": output[body.get("p_offset", 0):body.get("p_offset", 0) + body.get("p_limit", 60)]}


def fake_rpc(name, body):
    if name in {"proplet_rate_limit", "proplet_request_guard_v1"}:
        return {"allowed": True}
    if name == "proplet_auth_player_v1":
        found = next((p for p in tables["players"] if p["token_hash"] == body["p_token_hash"]), None)
        return {"expired": False, "player": copy.deepcopy(found)}
    if name == "proplet_admin_cases_v1":
        assert body["p_kind"] in {"words", "support"}
        rows = fake_select("puzzle_feedback", kind="word") if body["p_kind"] == "words" else []
        if body.get("p_player"):
            rows = [r for r in rows if r.get("player_id") == body["p_player"]]
        if body["p_status"] == "open":
            rows = [r for r in rows if r.get("status", "new") in {"new", "reviewing"}]
        for row in rows:
            owner = fake_select("players", id=row.get("player_id"))[0]
            row["player"] = {"id": owner["id"], "name": owner["name"], "team": "Prouza"}
        return {"total": len(rows), "rows": rows[body["p_offset"]:body["p_offset"] + body["p_limit"]]}
    if name == "proplet_admin_case_update_v1":
        assert body["p_admin"] == ADMIN_ID and body["p_kind"] == "words"
        row = fake_select("puzzle_feedback", id=body["p_id"])[0]
        values = {"status": body["p_status"], "resolution_note": body["p_note"], "reviewed_at": NOW, "reviewed_by": ADMIN_ID}
        fake_update("puzzle_feedback", {"id": body["p_id"]}, values)
        fake_insert("admin_audit_log", {"action": "word_report_status", "target_id": body["p_id"], "from": row.get("status", "new")})
        return {"ok": True, "id": body["p_id"], **values}
    if name == "proplet_admin_users_page_v1":
        return fixture_users(body)
    if name == "proplet_admin_player_detail_v1":
        return {"user": fixture_users({"p_query": body["p_player"]})["users"][0], "stats": {"points": 0},
                "recentResults": [], "sessionCount": 0, "pushCount": 0}
    if name == "proplet_admin_overview_v1":
        return [{"payload": {"players": {"total": len(tables["players"])},
                              "feedback": {"wordReportsTotal": len(tables["puzzle_feedback"])}}}]
    raise AssertionError((name, body))


server.db_rpc = fake_rpc

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
feedback_request = Request({"type": "http", "method": "POST", "path": "/api/feedback", "headers": []})
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_one, note="První"), feedback_request, admin_auth, None)
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_two, note="Druhé"), feedback_request, admin_auth, None)
assert len(tables["puzzle_feedback"]) == 2
server.puzzle_feedback(server.FeedbackCreate(**base, word=word_one, note="Aktualizace"), feedback_request, admin_auth, None)
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
assert server.admin_home().headers["location"] == "/admin.html"
overview = server.admin_overview(admin_auth)
assert overview["players"]["total"] == 2
assert overview["feedback"]["wordReportsTotal"] == 2

# Real routing preserves bearer authorization and serves /admin before the static mount.
client = TestClient(server.app)
assert client.get("/admin").status_code == 200
assert client.get("/api/admin/me", headers={"Authorization": admin_auth}).status_code == 200
assert client.get("/api/admin/me", headers={"Authorization": player_auth}).status_code == 403

print("v3.17 admin authorization, reports, audit and privacy: OK")
