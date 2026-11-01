"""Reward reads stay bounded without stale post-write XP or duplicate awards."""
from copy import deepcopy
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from account_bonus_v3331 import install_account_bonus, ACCOUNT_CREATION_BONUS_KEY
from word_recognition_v3330 import install_word_recognition

TZ = ZoneInfo("Europe/Prague")
stamp = datetime.now(TZ).isoformat()
rows = [{"id": str(i), "player_id": "fixture", "reward_key": f"word_discovery_v1:old:w{i}",
         "points": 1, "granted_at": stamp} for i in range(1500)]
rows.append({"id": "creation", "player_id": "fixture", "reward_key": ACCOUNT_CREATION_BONUS_KEY,
             "points": 500, "granted_at": stamp})
reads, writes = [], []


def select(table, *, columns="*", **filters):
    assert table == "account_rewards"
    selected = [row for row in rows if all(row.get(k) == v for k, v in filters.items())]
    # Model a detached DB response: stale pre-write snapshots must not update
    # by reference when the atomic RPC exchanges recovery XP for a word key.
    projected = [{k: v for k, v in row.items() if columns == "*" or k in columns.split(",")}
                 for row in selected]
    reads.append((columns, filters, len(projected)))
    return deepcopy(projected)


def auth(token):
    if token != "Bearer fixture":
        raise HTTPException(401, "synthetic auth required")
    return {"id": "fixture"}


def insert(table, row):
    writes.append(row)
    rows.append(row)
    return row


app = FastAPI()
install_account_bonus(app, db_select=select, db_insert=insert, auth_player=auth,
                      enforce_rate_limit=lambda *_a, **_k: None, tz=TZ)
client = TestClient(app)
headers = {"Authorization": "Bearer fixture"}
assert client.get("/api/account-bonus/status").status_code == 401
for route in ("status", "claim"):
    reads.clear()
    response = (client.get if route == "status" else client.post)(
        f"/api/account-bonus/{route}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["bonusXp"] == 500
    assert reads == [("reward_key,points", {"player_id": "fixture", "reward_key": ACCOUNT_CREATION_BONUS_KEY}, 1)]
assert not writes
# Missing bonus is inserted once, then canonically reread; conflict handling
# uses the same filtered lookup rather than a truncated word-history page.
rows[:] = [r for r in rows if r["reward_key"] != ACCOUNT_CREATION_BONUS_KEY]
assert client.post("/api/account-bonus/claim", headers=headers).json()["newlyGranted"] is True
assert len(writes) == 1

puzzle = {"rows": 1, "cols": 4, "mask": [0, 1, 2, 3], "letters": list("STÁJ"), "answers": []}
key = "word_discovery_v1:board:stáj"
reserve_key = "word_discovery_recovery_v1:board"
rows.append({"id": "reserve", "player_id": "fixture", "reward_key": reserve_key,
             "points": 2, "granted_at": stamp, "puzzle_id": "board"})
rpc_calls = []


def rpc(name, params):
    rpc_calls.append((name, params))
    reserve = next(r for r in rows if r["reward_key"] == reserve_key)
    reserve["points"] -= 1
    rows.append({"id": "new", "player_id": "fixture", "reward_key": key, "points": 1,
                 "granted_at": stamp, "puzzle_id": "board", "reward_word": "stáj"})
    return [{"newly_granted": False, "awarded_points": 0, "reason": "recovered", "reward_key": key}]


def discovery_client(preview=False):
    app = FastAPI()
    install_word_recognition(app, db_select=select, auth_player=auth, db_rpc=rpc, tz=TZ,
                             puzzle_exists=lambda *_a: True, resolved_puzzle=lambda *_a: puzzle,
                             vercel_env="preview" if preview else "production")
    return TestClient(app)


payload = {"puzzle_id": "board", "mode": "free", "difficulty": "easy", "word": "STÁJ", "path": [0, 1, 2, 3]}
client = discovery_client()
with patch("word_recognition_v3330._recognize_source", return_value="fixture"):
    reads.clear()
    reply = client.post("/api/word-discovery/claim", headers=headers, json=payload)
    assert reply.status_code == 200, reply.text
    value = reply.json()
    assert value["totalDiscoveryXp"] == 1502 and value["boardDiscoveryXp"] == 2
    assert key in value["rewardKeys"] and value["awardedPoints"] == 0
    assert len(reads) == 2  # A real write MUST reread the changed recovery balance.
    assert all(read[0] == "id,reward_key,points,granted_at,puzzle_id,reward_word" for read in reads)
    reads.clear()
    repeat = client.post("/api/word-discovery/claim", headers=headers, json=payload).json()
    assert repeat["limitReason"] == "duplicate" and repeat["totalDiscoveryXp"] == 1502
    assert len(reads) == 1 and len(rpc_calls) == 1
    # No cross-request memoization: an external update appears on the next status.
    rows[-1]["points"] = 4
    assert client.get("/api/word-discovery/status", headers=headers).json()["totalDiscoveryXp"] == 1505
    rows.pop()
    reads.clear()
    preview = discovery_client(preview=True).post("/api/word-discovery/claim", headers=headers, json=payload).json()
    assert preview["simulated"] is True and key in preview["rewardKeys"]
    assert len(reads) == 1 and len(rpc_calls) == 1
print("PASS unique bonus lookup across 1500+ rewards; complete discovery keys; fresh recovery balance; duplicate/preview single read")
