"""Loopback-only browser acceptance fixture; never reads production credentials.

The real FastAPI public content routes and real public/ app + service worker run
unchanged. Middleware supplies only isolated session / personal API boundaries.
The in-memory receipt ledger is a transport fixture, not a PostgreSQL test.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
for key in list(os.environ):
    if key.lower().endswith("_proxy") or key.startswith(("SUPABASE_", "VERCEL_", "PROPLET_DAILY_SPECIALS_PREVIEW")):
        os.environ.pop(key, None)
os.environ.pop("VERCEL", None)
os.environ["PROPLET_ARCHIVE_ENABLED"] = "true"
os.environ["PROPLET_HISTORICAL_FREE_REWARDS_ENABLED"] = "true"
os.environ["PROPLET_ATOMIC_RESULT_V1_ENABLED"] = "true"

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
import server as native

native.PUZZLES_PATH = ROOT / "public/puzzles.json"
native.load_puzzles.cache_clear()


def forbidden_database(*_args, **_kwargs):
    raise RuntimeError("Offline acceptance fixture forbids external database access")


for key in ("db_request", "db_select", "db_select_bounded", "db_rpc", "db_atomic_result_rpc", "db_insert", "db_update", "db_delete"):
    setattr(native, key, forbidden_database)
native.enforce_rate_limit = lambda *_args, **_kwargs: None  # Isolated API guard boundary; no shared rate-limit RPC.

app = native.app
LEDGERS: dict[str, dict] = {}
REQUESTS: list[dict] = []
EXPIRED: set[str] = set()
EXTRA_ENABLED = False
REJECT_EXTRA_FINISH = False
PLAY_SESSIONS: dict[str, dict] = {}
FREE = native.load_puzzles()["free"]
EDITION = native.archive_domain.load_edition(str(ROOT))
ARCHIVE = EDITION["byId"]


def owner(request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    if token not in {"fixture-token-a", "fixture-token-b"} or token in EXPIRED:
        return None
    return "fixture-" + token[-1]


def ledger(who):
    return LEDGERS.setdefault(who, {"results": {}, "receipts": {}, "claims": {}, "points": 0, "posts": []})


def stats(who):
    value = ledger(who)
    counts = {difficulty: 0 for difficulty in FREE}
    for row in value["results"].values():
        if row["mode"] == "free":
            counts[row["difficulty"]] += 1
    return {"points": value["points"], "totalCompleted": len(value["results"]),
            "dailyCompleted": 0, "currentStreak": 0, "longestStreak": 0,
            "freeCompleted": counts, "earnedBadges": [], "nextBadge": None,
            "cleanSolves": len(value["results"]), "mozkomorUnlocked": True}


def profile(who):
    return {"id": who, "name": "Offline tester " + who[-1].upper(), "avatar": "🦊",
            "familyCode": None, "leagueName": None, "hasPassword": True,
            "supportMode": "none", "publicRankings": True, "googleLinked": False,
            "stats": stats(who), "completed": list(ledger(who)["results"].values()),
            "cursor": datetime.now(native.TZ).isoformat()}


def response(value, status=200):
    return JSONResponse(value, status_code=status, headers={"Cache-Control": "no-store"})


def daily():
    today = native.current_prague_date().isoformat()
    puzzle = deepcopy(next(p for p in native.load_puzzles()["daily"] if p.get("answers")))
    # No unpublished calendar content or production player is needed to boot.
    return {"schemaVersion": 1, "dailyDate": today, "serverToday": today,
            "validUntil": (datetime.now(native.TZ) + timedelta(hours=12)).isoformat(),
            "puzzleId": puzzle["id"], "puzzle": puzzle, "challengeKey": "daily:" + today,
            "bankVersion": "loopback-acceptance-v1", "official": True,
            "rewardEligible": True, "contentHash": hashlib.sha256(json.dumps(puzzle).encode()).hexdigest()}


@app.middleware("http")
async def isolated_personal_boundary(request: Request, call_next):
    global EXTRA_ENABLED, REJECT_EXTRA_FINISH
    path = request.url.path
    if path == "/":
        # Vercel serves the actual public index at /. Native local FastAPI's
        # redirect to /index.html would cache a redirected navigation response
        # and introduce a localhost-only cold-start failure absent on the CDN.
        return FileResponse(ROOT / "public/index.html")
    if path.startswith("/__fixture/"):
        if path == "/__fixture/state":
            return response({"ledgers": LEDGERS, "requests": REQUESTS})
        if path == "/__fixture/archive-alternative":
            entry = next(e for e in EDITION["boards"] if e["difficulty"] == "medium" and len(e["solutions"]["solutionSets"]) > 1)
            return response({"puzzleId": entry["puzzle"]["id"], "cover": entry["solutions"]["solutionSets"][1]})
        if path == "/__fixture/expire":
            data = await request.json()
            if data.get("expired", True):
                EXPIRED.add(data.get("token", "fixture-token-a"))
            else:
                EXPIRED.discard(data.get("token", "fixture-token-a"))
            return response({"ok": True})
        if path == "/__fixture/extra":
            settings = await request.json()
            EXTRA_ENABLED = bool(settings.get("enabled"))
            REJECT_EXTRA_FINISH = bool(settings.get("rejectFinish", False))
            return response({"ok": True})
        return response({"detail": "Unknown fixture route"}, 404)
    if not path.startswith("/api/"):
        return await call_next(request)
    # Public offline routes execute their real implementation, including hash,
    # publication gate and finite Archive download validation.
    if path in {"/api/config", "/api/offline-manifest", "/api/archive", "/api/archive/offline", "/api/archive/puzzle", "/api/rolling-content", "/api/puzzle-database"}:
        return await call_next(request)
    who = owner(request)
    REQUESTS.append({"path": path, "method": request.method, "owner": who})
    if path == "/api/daily":
        return response(daily())
    if path == "/api/daily-special":
        row = daily()
        special = None
        if EXTRA_ENABLED:
            puzzle = deepcopy(FREE["hardcore"][0])
            puzzle["id"] = "fixture-published-extra-" + row["serverToday"]
            special = {**row, "puzzleId": puzzle["id"], "puzzle": puzzle,
                       "difficulty": "hardcore", "mode": "daily_special", "challengeKind": "special",
                       "challengeKey": "daily-special:" + row["serverToday"] + ":hardcore"}
        return response({"schemaVersion": 1, "serverToday": row["serverToday"], "validUntil": row["validUntil"], "special": special, "schedule": []})
    if path == "/api/tajenka":
        return response({"detail": "No fixture Tajenka"}, 404)
    if path in {"/api/account/snapshot", "/api/me", "/api/archive/claims", "/api/result"} and not who:
        return response({"detail": "Fixture session expired"}, 401)
    if path in {"/api/account/snapshot", "/api/me"}:
        return response(profile(who))
    if path == "/api/archive/claims":
        value = ledger(who)
        return response({"editionId": EDITION["editionId"], "claims": value["claims"], "completedPuzzleIds": [p for p in value["results"] if p in ARCHIVE]})
    if path == "/api/result":
        body = await request.json()
        value = ledger(who)
        value["posts"].append(body)
        puzzle_id = body.get("puzzle_id")
        puzzle = next((p for p in FREE.get(body.get("difficulty"), []) if p["id"] == puzzle_id), None)
        is_special = body.get("mode") == "daily_special" and EXTRA_ENABLED and puzzle_id == "fixture-published-extra-" + native.current_prague_date().isoformat()
        if is_special:
            puzzle = deepcopy(FREE["hardcore"][0])
            puzzle["id"] = puzzle_id
        entry = ARCHIVE.get(puzzle_id)
        if entry:
            try:
                native.archive_domain.validate_completion(entry, body.get("archive_solution") or {})
            except (ValueError, KeyError, TypeError):
                return response({"detail": "Invalid finite approved cover"}, 400)
            puzzle = entry["puzzle"]
        if not puzzle:
            return response({"detail": "Neznámá úloha"}, 400)
        receipt_id = body.get("attempt_id") or body["challenge_key"] + body.get("completed_at", "")
        if receipt_id in value["receipts"]:
            return response(value["receipts"][receipt_id])
        first = puzzle_id not in value["results"]
        slot = body["challenge_key"] if is_special else entry["rewardSlotKey"] if entry else "active:" + body["difficulty"] + ":" + str(puzzle["meta"]["level"])
        xp = 100 if is_special else entry["rewardXp"] if entry else native.POINTS[body["difficulty"]]
        awarded = xp if slot not in value["claims"] else 0
        value["claims"].setdefault(slot, {"sourcePuzzleId": puzzle_id, "points": awarded})
        value["points"] += awarded
        row = {"puzzleId": puzzle_id, "challengeKey": body["challenge_key"], "mode": body["mode"], "difficulty": body["difficulty"],
               "elapsedMs": body["elapsed_ms"], "moves": body["moves"], "points": awarded, "level": puzzle["meta"]["level"],
               "contentGeneration": puzzle["meta"].get("contentGeneration", 4), "completedAt": body.get("completed_at"),
               "timingUnverified": body.get("timing_unverified") is True, "timingStatus": "unverified", "cleanSolve": body.get("clean_solve", False)}
        value["results"].setdefault(puzzle_id, row)
        receipt = {"ok": True, "firstCompletion": first, "awardedPoints": awarded,
                   "dailyGenerationUpgrade": False, "transferredSlot": not first, "stats": stats(who), "statsWarning": None}
        value["receipts"][receipt_id] = receipt
        return response(receipt)
    if path == "/api/play-session/config":
        return response({"enabled": EXTRA_ENABLED, "heartbeatMs": 25000})
    if path == "/api/play-session":
        if not who:
            return response({"detail": "Fixture session expired"}, 401)
        body = await request.json()
        if body.get("action") == "finish" and REJECT_EXTRA_FINISH:
            return response({"detail": "Fixture temporarily refuses finish"}, 503)
        key = who + ":" + body["attempt_id"]
        row = PLAY_SESSIONS.setdefault(key, {"verified": True, "finished": False, "attempt_id": body["attempt_id"], "progress": {}, "elapsed_ms": 0})
        row["progress"] = body.get("progress") or row["progress"]
        row["elapsed_ms"] = max(row["elapsed_ms"], int(row["progress"].get("elapsedMs") or 0))
        row["verified"] = row["progress"].get("unverified") is not True
        if body.get("action") == "finish":
            row["finished"] = True
        return response(row)
    if path == "/api/free-order/config":
        return response({"enabled": False})
    if path == "/api/free-order":
        return response({"enabled": False, "records": {}, "resumeIds": {}})
    if path == "/api/mozkokalypsa/status":
        return response({"eligible": False, "active": False, "order": []})
    if path in {"/api/rescue-status", "/api/rescue/status"}:
        return response({"state": "unavailable"})
    if path.startswith("/api/referral"):
        return response({"enabled": False, "referrals": []})
    if path == "/api/admin/me":
        return response({"detail": "Fixture is not admin"}, 403)
    # Analytics / ranks / push availability are isolated inert fixture responses.
    return response({"ok": True, "enabled": False, "available": False, "rows": [], "players": [], "teams": [], "members": [], "leagues": [], "accepted": [], "wordDiscoveryXp": 0})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("OFFLINE_FIXTURE_PORT", "8765")), access_log=False)
