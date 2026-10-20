"""A paid recovery becomes verified word keys without inflating cached profile XP."""
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import subprocess
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.progress import reward_stats_from_rows
from word_recognition_v3330 import _discovery_summary, install_word_recognition

TZ = ZoneInfo("Europe/Prague")
ROOT = Path(__file__).resolve().parents[2]
stamp = datetime.now(TZ).isoformat()
today = datetime.now(TZ).date().isoformat()
puzzle_id = "recovered-board"
actual_prefix = f"word_discovery_v1:{puzzle_id}:"
reserve_key = f"word_discovery_recovery_v1:{puzzle_id}"
rows = [
    {"reward_key": actual_prefix + "ledna", "points": 1, "granted_at": stamp,
     "puzzle_id": puzzle_id, "reward_word": "ledna"},
    {"reward_key": reserve_key, "points": 3, "granted_at": stamp, "puzzle_id": puzzle_id},
    {"reward_key": "account_creation_v1", "points": 500, "granted_at": stamp},
]
puzzle = {"rows": 5, "cols": 5, "mask": list(range(25)),
          "letters": list("LEDNASTROMAORTAOBRNASTÁJX"), "answers": []}


def auth(token):
    if token != "Bearer fixture":
        raise HTTPException(401, "synthetic auth required")
    return {"id": "fixture"}


def rpc(name, params):
    assert name == "proplet_claim_word_discovery"
    key = actual_prefix + params["p_word"]
    assert not any(row["reward_key"] == key for row in rows)
    reserve = next(row for row in rows if row["reward_key"] == reserve_key)
    exchange = reserve["points"] > 0
    rows.append({"reward_key": key, "points": 1, "granted_at": stamp,
                 "puzzle_id": puzzle_id, "reward_word": params["p_word"]})
    if exchange:
        reserve["points"] -= 1
    return [{"newly_granted": not exchange, "awarded_points": 0 if exchange else 1,
             "reason": "recovered" if exchange else "granted", "reward_key": key}]


app = FastAPI()
install_word_recognition(app, db_select=lambda *_a, **_kw: rows, auth_player=auth,
                         db_rpc=rpc, tz=TZ, puzzle_exists=lambda *_a: True,
                         resolved_puzzle=lambda *_a: puzzle)
client = TestClient(app)
headers = {"Authorization": "Bearer fixture"}
ui_fixture = []


def verify(expected_words, expected_xp=4):
    status = client.get("/api/word-discovery/status", headers=headers).json()
    summary = _discovery_summary(rows, puzzle_id=puzzle_id, today=today, tz=TZ)
    profile = reward_stats_from_rows(rows)
    assert profile["wordDiscoveryXp"] == status["totalDiscoveryXp"] == expected_xp
    assert summary["boardDiscoveryXp"] == summary["dailyDiscoveryXp"] == expected_xp
    assert profile["rewardXp"] == 500 + expected_xp and profile["otherRewardXp"] == 0
    assert profile["wordDiscoveryRewards"] == profile["discoveredWords"] == expected_words
    assert status["discoveredWords"] == len(status["rewardKeys"]) == expected_words
    assert all(key.startswith(actual_prefix) for key in status["rewardKeys"])
    ui_fixture.append({"totalDiscoveryXp": status["totalDiscoveryXp"],
                       "expectedPoints": 70333 + expected_xp - 4})


verify(1)
# Structured reserve rows and older key-only rows identify the same board.
key_only = deepcopy(rows)
key_only[1].pop("puzzle_id")
assert _discovery_summary(key_only, puzzle_id=puzzle_id)["boardDiscoveryXp"] == 4
assert _discovery_summary(rows, puzzle_id="another-board")["boardDiscoveryXp"] == 0
assert _discovery_summary(rows, today="2000-01-01", tz=TZ)["dailyDiscoveryXp"] == 0

for number, (word, path) in enumerate((("STROM", list(range(5, 10))),
                                      ("AORTA", list(range(10, 15))),
                                      ("OBRNA", list(range(15, 20)))), start=2):
    payload = {"puzzle_id": puzzle_id, "mode": "free", "difficulty": "easy", "word": word, "path": path}
    reply = client.post("/api/word-discovery/claim", headers=headers, json=payload)
    assert reply.status_code == 200, reply.text
    assert reply.json()["newlyGranted"] is False and reply.json()["awardedPoints"] == 0
    assert reply.json()["limitReason"] == "recovered"
    assert reply.json()["totalDiscoveryXp"] == reply.json()["boardDiscoveryXp"] == 4
    verify(number)
    duplicate = client.post("/api/word-discovery/claim", headers=headers, json=payload).json()
    assert duplicate["limitReason"] == "duplicate" and duplicate["awardedPoints"] == 0
    verify(number)

new_word = client.post("/api/word-discovery/claim", headers=headers, json={
    "puzzle_id": puzzle_id, "mode": "free", "difficulty": "easy", "word": "STÁJ", "path": [20, 21, 22, 23],
})
assert new_word.status_code == 200, new_word.text
assert new_word.json()["newlyGranted"] is True and new_word.json()["awardedPoints"] == 1
verify(5, 5)

# Execute the actual client wrapper against a cached 70,333-XP account. Exchanging
# reserve entries must display 70,333 throughout; a genuinely new word adds one.
node = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const cases=JSON.parse(fs.readFileSync(0,'utf8'));
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
const wrapper=source.slice(source.indexOf('  const patchEffectiveStats='),source.indexOf('  const ensureXpStyle='));
let balance=4;
const context={effectiveStatsPatched:false,rewardDisabled:()=>false,currentDiscoveryXp:()=>balance,
  effectiveStats:()=>({points:70333,wordDiscoveryXp:4})};
vm.createContext(context);vm.runInContext(wrapper+';patchEffectiveStats();',context);
for(const entry of cases){balance=entry.totalDiscoveryXp;assert.equal(context.effectiveStats().points,entry.expectedPoints)}
"""
subprocess.run(["node", "-e", node], input=json.dumps(ui_fixture), text=True, cwd=ROOT, check=True)
print("PASS reserve→word exchanges preserve API/profile/day/board XP and cached 70333; new word→70334; keys/counts stay genuine")
