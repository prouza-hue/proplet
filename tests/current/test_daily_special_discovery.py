"""Extra discoveries use the real immutable bank and the same atomic word ledger."""
from datetime import datetime
import os
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ.update(
    VERCEL_ENV="preview", VERCEL_GIT_COMMIT_REF="work/daily-specials-integrated-20261012",
    SUPABASE_URL="https://eanzztstmwlamwfdskbf.supabase.co",
    PROPLET_DAILY_SPECIALS_ENABLED="true", PROPLET_DATED_DAILY_ENABLED="true",
    PROPLET_ATOMIC_RESULT_V1_ENABLED="true", PROPLET_DAILY_SPECIALS_PREVIEW_DATE="2026-10-21",
)
import server
from word_recognition_v3330 import WordDiscoveryClaim, install_word_recognition, _discovery_reward_key

TZ = ZoneInfo("Europe/Prague")
rows, calls = [], []


def auth(token):
    if token != "Bearer synthetic":
        raise HTTPException(401, "synthetic auth required")
    return {"id": "synthetic"}


def rpc(name, params):
    assert name == "proplet_claim_word_discovery"
    key = _discovery_reward_key(params["p_puzzle_id"], params["p_word"])
    assert not any(row["reward_key"] == key for row in rows)
    calls.append(params)
    rows.append({"reward_key": key, "points": 1, "granted_at": datetime.now(TZ).isoformat()})
    return [{"newly_granted": True, "awarded_points": 1, "reward_key": key, "reason": "granted"}]


app = FastAPI()
install_word_recognition(
    app, auth_player=auth, db_select=lambda *_args, **_kw: rows, db_rpc=rpc, tz=TZ,
    puzzle_exists=server.puzzle_exists, resolved_puzzle=server.resolved_puzzle,
    daily_special_discovery_identity=server.daily_special_discovery_identity,
)
client = TestClient(app)
headers = {"Authorization": "Bearer synthetic"}
payload = {
    "puzzle_id": "g6-ds-hardcore-w02", "mode": "daily_special", "difficulty": "hardcore",
    "daily_date": "2026-10-21", "challenge_key": "daily-special:2026-10-21:hardcore",
    "word": "LEDNA", "path": [77, 76, 66, 67, 57],
}
assert client.post("/api/word-discovery/claim", json=payload).status_code == 401
for changed in (
    {"path": [77, 76, 66, 67, 56]}, {"path": [77] * 5},
    {"challenge_key": "daily-special-practice:2026-10-21:hardcore:g6-ds-hardcore-w02"},
    {"challenge_key": "daily:2026-10-21"}, {"challenge_key": None},
    {"daily_date": "2026-10-14"}, {"daily_date": None},
    {"difficulty": "mozkomor"}, {"puzzle_id": "g6-ds-hardcore-w03"},
):
    response = client.post("/api/word-discovery/claim", headers=headers, json={**payload, **changed})
    assert response.status_code == 400, (changed, response.text)
assert not calls

response = client.post("/api/word-discovery/claim", headers=headers, json=payload)
assert response.status_code == 200, response.text
assert response.json()["newlyGranted"] is True and response.json()["awardedPoints"] == 1
repeat = client.post("/api/word-discovery/claim", headers=headers, json={**payload, "word": "ledna"})
assert repeat.json()["newlyGranted"] is False and repeat.json()["awardedPoints"] == 0
assert repeat.json()["limitReason"] == "duplicate" and len(calls) == 1

# Bonus claims have the same release-day boundary as the official special. A valid
# historical board cannot bypass practice's no-XP contract by forging its old key.
os.environ["PROPLET_DAILY_SPECIALS_PREVIEW_DATE"] = "2026-10-22"
assert client.post("/api/word-discovery/claim", headers=headers, json=payload).status_code == 400
assert len(calls) == 1
for day, difficulty in (("2026-10-21", "hardcore"), ("2026-10-23", "mozkomor"), ("2026-10-25", "mozkokalypsa")):
    os.environ["PROPLET_DAILY_SPECIALS_PREVIEW_DATE"] = day
    candidate = WordDiscoveryClaim(**{**payload, "daily_date": day, "difficulty": difficulty,
                                     "puzzle_id": f"g6-ds-{difficulty}-w02",
                                     "challenge_key": f"daily-special:{day}:{difficulty}"})
    assert server.daily_special_discovery_identity(candidate).difficulty == difficulty

# A partial dependency upgrade must fail closed instead of rewarding arbitrary IDs.
missing = FastAPI()
install_word_recognition(missing, auth_player=auth, db_select=lambda *_a, **_kw: [], db_rpc=rpc,
                         puzzle_exists=lambda *_a: True, resolved_puzzle=lambda *_a: {})
assert TestClient(missing).post("/api/word-discovery/claim", headers=headers, json=payload).status_code == 503
print("PASS Extra LEDNA proof + all difficulties; auth, binding, archive, trace, atomic dedup and fail-closed assembly")
