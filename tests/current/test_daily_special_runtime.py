"""Real ASGI special contracts with synthetic transport; SQL is tested separately."""
import os
import sys
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
os.environ.update(VERCEL_ENV="preview", VERCEL_GIT_COMMIT_REF="work/daily-specials-integrated-20261012",
                  SUPABASE_URL="https://eanzztstmwlamwfdskbf.supabase.co", PROPLET_DAILY_SPECIALS_ENABLED="true",
                  PROPLET_DATED_DAILY_ENABLED="true", PROPLET_ATOMIC_RESULT_V1_ENABLED="true",
                  PROPLET_DAILY_SPECIALS_PREVIEW_DATE="2026-10-21")
import server
from fastapi.testclient import TestClient

player={"id":"00000000-0000-4000-8000-000000000321","family_code":"SOLO_QA"}
session={"attempt_id":"special-asgi-001","finished":True,"verified":True}
commands=[]
def select(table,**filters):
    if table=="play_sessions":return [session]
    if table in ("result_commands","puzzle_attempts"):return []
    raise AssertionError((table,filters))

def rpc(name,body):
    commands.append((name,body))
    assert name=="proplet_submit_daily_special_v1"
    command=body["p_command"]
    return {"firstCompletion":not command["specialPractice"],"awardedPoints":command["points"],
            "dailyGenerationUpgrade":False,"transferredSlot":False,"practice":command["specialPractice"]}

with patch.object(server,"enforce_rate_limit",lambda *a,**k:None),patch.object(server,"auth_player",lambda authorization:player),\
     patch.object(server,"db_select",select),patch.object(server,"db_atomic_result_rpc",rpc),\
     patch.object(server,"rankings_v2_schema_ready",lambda:False),patch.object(server,"player_stats",lambda player:{"currentStreak":0}):
    client=TestClient(server.app)
    base=client.get("/api/daily").json()
    envelope=client.get("/api/daily-special").json()
    special=envelope["special"]
    assert base["serverToday"]==envelope["serverToday"]=="2026-10-21"
    assert base["challengeKey"]=="daily:2026-10-21" and special["challengeKey"]=="daily-special:2026-10-21:hardcore"
    for url in ("/api/daily-special?daily_date=2026-10-23", "/api/daily-special?daily_date=2026-10-21&puzzle_id=g6-ds-mozkomor-w01",
                "/api/daily-special?as_of=2027-01-10", "/api/shared-puzzle?kind=daily_special&daily_date=2026-10-23&puzzle_id=g6-ds-mozkomor-w01",
                "/data/daily_specials_private.json", "/content/gen6/daily-specials-36/bank.json"):
        assert client.get(url).status_code==404,url
    assert client.get("/api/shared-puzzle?kind=daily_special&daily_date=2026-10-21&puzzle_id="+special["puzzleId"]).status_code==200
    assert 'no-store' in client.get("/api/daily-special").headers['cache-control']
    payload={"puzzle_id":special["puzzleId"],"challenge_key":special["challengeKey"],"mode":"daily_special",
             "difficulty":"hardcore","daily_date":"2026-10-21","elapsed_ms":60_000,"moves":30,
             "attempt_id":"special-asgi-001","clean_solve":True}
    response=client.post("/api/result",json=payload,headers={"X-Proplet-Result-Receipt":"1"})
    assert response.status_code==200,response.text
    assert response.json()["awardedPoints"]==100
    assert commands[-1][1]["p_command"]["contentHash"]==special["contentHash"]
    assert commands[-1][1]["p_command"]["freeLevel"] is None and commands[-1][1]["p_command"]["legacyRewardSlot"] is None
    for modified in ({**payload,"challenge_key":base["challengeKey"]},{**payload,"daily_date":"2026-10-20"},
                     {**payload,"attempt_id":"other-asgi-attempt"},{**payload,"puzzle_id":"g6-ds-mozkomor-w01"}):
        assert client.post("/api/result",json=modified).status_code in(400,409)
    practice=client.post("/api/result",json={**payload,"challenge_key":special["practiceChallengeKey"],"attempt_id":"practice-asgi-001"})
    assert practice.status_code==200,practice.text
    assert practice.json()["practice"] is True and practice.json()["awardedPoints"]==0
    os.environ["PROPLET_DAILY_SPECIALS_PREVIEW_DATE"]="2026-10-22"
    archive=client.get("/api/daily-special?daily_date=2026-10-21").json()["special"]
    assert archive["official"] is False and archive["rewardEligible"] is False
    assert client.get("/api/daily-special").json()["special"] is None
    assert client.post("/api/result",json=payload).status_code==409

print("PASS: real ASGI base+special identity, date parity, future/hash/date tampering, isolated practice receipt0XP")
