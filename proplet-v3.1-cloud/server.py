from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
PUZZLES_PATH = ROOT / "data" / "puzzles.json"
TZ = ZoneInfo("Europe/Prague")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

BADGES = [
    {"days": 1, "icon": "🥉", "name": "První zářez"},
    {"days": 3, "icon": "❤️", "name": "Srdcař"},
    {"days": 5, "icon": "⭐", "name": "Pětka"},
    {"days": 7, "icon": "🔥", "name": "Týden v plamenech"},
    {"days": 10, "icon": "🏆", "name": "Desítka"},
    {"days": 14, "icon": "⚡", "name": "Blesk"},
    {"days": 21, "icon": "🦉", "name": "Mistr slov"},
    {"days": 30, "icon": "👑", "name": "Koruna"},
    {"days": 50, "icon": "💎", "name": "Diamant"},
    {"days": 100, "icon": "🚀", "name": "Legenda"},
]

POINTS = {"daily": 100, "easy": 10, "medium": 20, "hard": 35, "hardcore": 60}

app = FastAPI(title="Proplet API", version="3.5-cloud")
logger = logging.getLogger("proplet")


@app.exception_handler(Exception)
async def unexpected_error_handler(request, exc: Exception):
    # V osobním projektu je užitečnější bezpečný diagnostický detail než anonymní 500.
    # Případné tajné hodnoty před odesláním do browseru odstraníme.
    logger.exception("Unhandled Proplet error on %s", getattr(request, "url", "unknown"))
    detail = f"{type(exc).__name__}: {str(exc)}"
    if SUPABASE_SECRET_KEY:
        detail = detail.replace(SUPABASE_SECRET_KEY, "[secret]")
    if SUPABASE_URL:
        detail = detail.replace(SUPABASE_URL, "[supabase]")
    return JSONResponse(status_code=500, content={"detail": f"Interní chyba serveru: {detail[:220]}"})


class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    family_code: str = Field(min_length=2, max_length=24)
    # Optional keeps a rolling deployment compatible with an older cached PWA.
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class PlayerLogin(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    family_code: str = Field(min_length=2, max_length=24)
    password: str = Field(min_length=8, max_length=128)


class PasswordSet(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class ResultCreate(BaseModel):
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    elapsed_ms: int = Field(ge=1000, le=86_400_000)
    moves: int = Field(ge=1, le=10000)
    daily_date: Optional[str] = None
    hints_used: int = Field(default=0, ge=0, le=99)
    wrong_attempts: int = Field(default=0, ge=0, le=999)
    max_hint_level: int = Field(default=0, ge=0, le=3)
    attempt_id: Optional[str] = Field(default=None, min_length=8, max_length=80)
    # Conservative default keeps older cached clients from being falsely marked as Clean.
    clean_solve: bool = False


class AttemptStart(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str


class FeedbackCreate(BaseModel):
    puzzle_id: str
    challenge_key: str
    kind: str
    rating: Optional[int] = Field(default=None, ge=-1, le=1)
    word: Optional[str] = Field(default=None, max_length=80)
    note: Optional[str] = Field(default=None, max_length=300)


class RescueFinish(BaseModel):
    puzzle_id: str
    completed: bool
    elapsed_ms: int = Field(ge=0, le=120_000)


def supabase_ready() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SECRET_KEY)


def db_request(method: str, table: str, *, params=None, body=None, prefer=None):
    if not supabase_ready():
        raise HTTPException(503, "Supabase ještě není připojený")
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    try:
        with httpx.Client(timeout=12.0) as client:
            r = client.request(method, url, params=params, json=body, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Databáze je momentálně nedostupná") from exc
    if r.status_code >= 400:
        detail = "Chyba databáze"
        try:
            payload = r.json()
            detail = payload.get("message") or payload.get("hint") or detail
        except Exception:
            pass
        if r.status_code == 409:
            raise HTTPException(409, detail)
        raise HTTPException(503 if r.status_code >= 500 else 400, detail)
    if not r.content:
        return []
    return r.json()


def db_select(table: str, **filters):
    params = {"select": "*"}
    for key, value in filters.items():
        if value is not None:
            params[key] = f"eq.{value}"
    return db_request("GET", table, params=params)


def db_insert(table: str, row: dict):
    rows = db_request("POST", table, body=row, prefer="return=representation")
    return rows[0] if rows else row


def db_update(table: str, filters: dict, values: dict):
    params = {key: f"eq.{value}" for key, value in filters.items()}
    return db_request("PATCH", table, params=params, body=values, prefer="return=representation")


def norm_family(code: str) -> str:
    code = "".join(ch for ch in code.upper().strip() if ch.isalnum() or ch in "-_ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ")
    return code[:24]


SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 5
SCRYPT_MAXMEM = 32 * 1024 * 1024


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
        maxmem=SCRYPT_MAXMEM, dklen=32,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: Optional[str]) -> bool:
    if not encoded:
        return False
    try:
        scheme, n, r, p_cost, salt_hex, digest_hex = encoded.split("$", 5)
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
            n=int(n), r=int(r), p=int(p_cost), maxmem=SCRYPT_MAXMEM, dklen=len(bytes.fromhex(digest_hex)),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def new_session(player_id: str) -> str:
    token = secrets.token_urlsafe(32)
    db_insert("player_sessions", {
        "id": str(uuid.uuid4()),
        "player_id": player_id,
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "created_at": datetime.now(TZ).isoformat(),
    })
    return token


def auth_player(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Chybí přihlášení hráče")
    token = authorization[7:].strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Legacy/main-device token stays valid forever, so the v3.3 migration does not log anyone out.
    rows = db_select("players", token_hash=token_hash)
    if rows:
        return rows[0]

    # Additional devices get independent session tokens.
    try:
        sessions = db_select("player_sessions", token_hash=token_hash)
    except HTTPException:
        sessions = []
    if sessions:
        players = db_select("players", id=sessions[0]["player_id"])
        if players:
            return players[0]
    raise HTTPException(401, "Neplatné přihlášení hráče")


def current_prague_date() -> date:
    return datetime.now(TZ).date()


def streaks(dates: list[str]) -> tuple[int, int]:
    vals = sorted({date.fromisoformat(str(d)) for d in dates if d}, reverse=True)
    if not vals:
        return 0, 0
    s = set(vals)
    today = current_prague_date()
    anchor = today if today in s else (today - timedelta(days=1) if today - timedelta(days=1) in s else None)
    current = 0
    if anchor:
        d = anchor
        while d in s:
            current += 1
            d -= timedelta(days=1)
    longest = 0
    for d in vals:
        n = 0
        x = d
        while x in s:
            n += 1
            x -= timedelta(days=1)
        longest = max(longest, n)
    return current, longest


def streak_ending_on(date_strings: list[str] | set[str], anchor: date) -> int:
    vals = set(str(x)[:10] for x in date_strings if x)
    n = 0
    d = anchor
    while d.isoformat() in vals:
        n += 1
        d -= timedelta(days=1)
    return n


def rescue_rows(player_id: str) -> list[dict]:
    return db_select("streak_rescues", player_id=player_id)


def player_stats(player_id: str) -> dict:
    """Statistiky včetně ochráněných streak dnů a clean solve metrik."""
    rows = db_select("results", player_id=player_id)
    daily_dates: list[str] = []
    free = {k: 0 for k in ("easy", "medium", "hard", "hardcore")}
    daily_times: list[int] = []
    total_points = 0
    clean_solves = 0
    clean_daily = 0

    for r in rows:
        mode = r.get("mode")
        difficulty = r.get("difficulty")
        total_points += int(r.get("points") or 0)
        is_clean = r.get("clean_solve") is True
        if is_clean:
            clean_solves += 1

        if mode == "daily" and r.get("daily_date"):
            raw_date = str(r.get("daily_date"))[:10]
            try:
                date.fromisoformat(raw_date)
                daily_dates.append(raw_date)
                if is_clean:
                    clean_daily += 1
            except ValueError:
                logger.warning("Ignoring malformed daily_date for result %s: %r", r.get("id"), r.get("daily_date"))
            try:
                daily_times.append(int(r.get("best_elapsed_ms")))
            except (TypeError, ValueError):
                logger.warning("Ignoring malformed elapsed time for result %s", r.get("id"))

        if mode == "free" and difficulty in free:
            free[difficulty] += 1

    rescued_dates: list[str] = []
    try:
        for rr in rescue_rows(player_id):
            if rr.get("status") == "passed" and rr.get("missed_date"):
                raw = str(rr.get("missed_date"))[:10]
                try:
                    date.fromisoformat(raw)
                    rescued_dates.append(raw)
                except ValueError:
                    pass
    except HTTPException:
        # During a rolling deploy before the v3.4 migration, normal gameplay remains readable.
        rescued_dates = []

    effective_dates = list(set(daily_dates) | set(rescued_dates))
    current, longest = streaks(effective_dates)
    earned = [b for b in BADGES if longest >= b["days"]]
    next_badge = next((b for b in BADGES if current < b["days"]), None)
    return {
        "points": total_points,
        "totalCompleted": len(rows),
        "dailyCompleted": len(set(daily_dates)),
        "freeCompleted": free,
        "currentStreak": current,
        "longestStreak": longest,
        "bestDailyMs": min(daily_times) if daily_times else None,
        "cleanSolves": clean_solves,
        "cleanDaily": clean_daily,
        "rescuedDays": len(set(rescued_dates)),
        "earnedBadges": earned,
        "nextBadge": next_badge,
    }


def rescue_status_for(player_id: str) -> dict:
    today = current_prague_date()
    missed = today - timedelta(days=1)
    before = missed - timedelta(days=1)
    rows = db_select("results", player_id=player_id)
    daily_dates = {str(r.get("daily_date"))[:10] for r in rows if r.get("mode") == "daily" and r.get("daily_date")}
    rescues = rescue_rows(player_id)
    passed = {str(r.get("missed_date"))[:10] for r in rescues if r.get("status") == "passed" and r.get("missed_date")}
    effective = daily_dates | passed
    target = missed.isoformat()
    existing = next((r for r in rescues if str(r.get("missed_date"))[:10] == target), None)
    prior_streak = streak_ending_on(effective, before)

    if existing:
        status = existing.get("status")
        if status == "started":
            try:
                started = datetime.fromisoformat(str(existing.get("started_at")).replace("Z", "+00:00"))
                now = datetime.now(TZ)
                if started.tzinfo is None:
                    started = started.replace(tzinfo=TZ)
                elapsed = (now - started.astimezone(TZ)).total_seconds()
                if elapsed > 35:
                    db_update("streak_rescues", {"id": existing["id"]}, {
                        "status": "failed", "completed_at": now.isoformat(),
                        "elapsed_ms": int(max(0, elapsed * 1000)),
                    })
                    status = "failed"
                else:
                    return {
                        "eligible": True, "state": "started", "missedDate": target,
                        "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
                        "timeLimitMs": 30000, "secondsRemaining": max(0, round(30 - elapsed, 1)),
                    }
            except Exception:
                status = "failed"
        return {
            "eligible": False, "state": status or "failed", "missedDate": target,
            "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
        }

    eligible = target not in effective and before.isoformat() in effective and prior_streak > 0
    return {
        "eligible": eligible, "state": "available" if eligible else "none",
        "missedDate": target if eligible else None, "priorStreak": prior_streak if eligible else 0,
    }

def load_puzzles() -> dict:
    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))


def expected_daily_puzzle_id(daily_date: str) -> str:
    data = load_puzzles()
    try:
        d = date.fromisoformat(daily_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    base = date(2026, 1, 1)
    idx = (d - base).days % len(data["daily"])
    return data["daily"][idx]["id"]


def puzzle_exists(puzzle_id: str, mode: str, difficulty: str) -> bool:
    data = load_puzzles()
    if mode == "daily":
        return any(p["id"] == puzzle_id and p["difficulty"] == difficulty for p in data["daily"])
    if any(p["id"] == puzzle_id for p in data["free"].get(difficulty, [])):
        return True
    # Keep queued results from older Hard banks syncable after the v3.3 puzzle upgrade.
    return any(p["id"] == puzzle_id for p in data.get("legacyFree", {}).get(difficulty, []))


@app.get("/")
def home():
    return RedirectResponse(url="/index.html", status_code=307)


@app.get("/api/health")
def health():
    puzzle_file = PUZZLES_PATH.exists()
    base = {
        "date": current_prague_date().isoformat(),
        "puzzleFile": puzzle_file,
        "puzzleSource": "data/puzzles.json",
    }
    if not puzzle_file:
        return {**base, "ok": False, "database": False, "message": "Serverová databáze úloh není součástí deploymentu"}
    if not supabase_ready():
        return {**base, "ok": False, "database": False, "message": "Chybí SUPABASE_URL nebo SUPABASE_SECRET_KEY"}
    try:
        db_request("GET", "players", params={"select": "id", "limit": "1"})
        account_migration = True
        try:
            db_request("GET", "player_sessions", params={"select": "id", "limit": "1"})
        except HTTPException:
            account_migration = False
        features_migration = True
        try:
            db_request("GET", "results", params={"select": "id,hints_used,clean_solve", "limit": "1"})
            db_request("GET", "streak_rescues", params={"select": "id", "limit": "1"})
        except HTTPException:
            features_migration = False
        quality_migration = True
        try:
            db_request("GET", "results", params={"select": "id,wrong_attempts,max_hint_level", "limit": "1"})
            db_request("GET", "puzzle_attempts", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id", "limit": "1"})
        except HTTPException:
            quality_migration = False
        return {**base, "ok": True, "database": True, "accountMigration": account_migration, "featuresMigration": features_migration, "qualityMigration": quality_migration}
    except HTTPException as exc:
        return {**base, "ok": False, "database": False, "accountMigration": False, "featuresMigration": False, "qualityMigration": False, "message": exc.detail}


@app.get("/api/config")
def config():
    p = load_puzzles()
    return {
        "badges": BADGES,
        "points": POINTS,
        "dictionarySize": p["dictionarySize"],
        "dailyRotationSize": p["dailyRotationSize"],
        "rescueBankSize": len(p.get("rescue", [])),
    }


@app.post("/api/player")
def create_player(payload: PlayerCreate):
    name = " ".join(payload.name.strip().split())
    family = norm_family(payload.family_code)
    if not name or len(family) < 2:
        raise HTTPException(400, "Vyplň jméno a rodinný kód")

    family_players = db_select("players", family_code=family)
    if any(p["name"].casefold() == name.casefold() for p in family_players):
        raise HTTPException(409, "V této rodině už hráč s tímto jménem existuje")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    player_id = str(uuid.uuid4())
    now = datetime.now(TZ).isoformat()
    row = {
        "id": player_id,
        "name": name,
        "family_code": family,
        "token_hash": token_hash,
        "created_at": now,
    }
    if payload.password:
        row["password_hash"] = hash_password(payload.password)

    try:
        db_insert("players", row)
    except HTTPException as exc:
        if exc.status_code == 409:
            raise HTTPException(409, "V této rodině už hráč s tímto jménem existuje")
        raise

    stats = player_stats(player_id)
    return {
        "id": player_id, "name": name, "familyCode": family, "token": token,
        "hasPassword": bool(payload.password), "stats": stats,
    }


@app.post("/api/login")
def login(payload: PlayerLogin):
    family = norm_family(payload.family_code)
    name = " ".join(payload.name.strip().split())
    family_players = db_select("players", family_code=family)
    player = next((p for p in family_players if p["name"].casefold() == name.casefold()), None)
    if not player:
        raise HTTPException(401, "Jméno, rodinný kód nebo heslo nesedí")
    if not player.get("password_hash"):
        raise HTTPException(409, "Tento hráč ještě nemá heslo. Nastav ho na zařízení, kde už je přihlášený.")
    if not verify_password(payload.password, player.get("password_hash")):
        raise HTTPException(401, "Jméno, rodinný kód nebo heslo nesedí")

    token = new_session(player["id"])
    return {
        "id": player["id"], "name": player["name"], "familyCode": player["family_code"],
        "token": token, "hasPassword": True, "stats": player_stats(player["id"]),
    }


@app.post("/api/password")
def set_password(payload: PasswordSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    db_update("players", {"id": player["id"]}, {"password_hash": hash_password(payload.password)})
    return {"ok": True, "hasPassword": True}


@app.get("/api/me")
def me(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    stats = player_stats(player["id"])
    return {
        "id": player["id"], "name": player["name"], "familyCode": player["family_code"],
        "hasPassword": bool(player.get("password_hash")), "stats": stats,
    }


@app.get("/api/progress")
def progress(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    rows = db_select("results", player_id=player["id"])
    return {
        "completed": [
            {
                "puzzleId": r.get("puzzle_id"),
                "challengeKey": r.get("challenge_key"),
                "mode": r.get("mode"),
                "difficulty": r.get("difficulty"),
                "dailyDate": str(r.get("daily_date"))[:10] if r.get("daily_date") else None,
                "elapsedMs": int(r.get("best_elapsed_ms") or 1000),
                "moves": int(r.get("best_moves") or 1),
                "points": int(r.get("points") or 0),
                "hintsUsed": int(r.get("hints_used") or 0),
                "wrongAttempts": int(r.get("wrong_attempts") or 0),
                "maxHintLevel": int(r.get("max_hint_level") or 0),
                "cleanSolve": r.get("clean_solve") is True,
                "completedAt": r.get("completed_at"),
            }
            for r in rows
        ]
    }


def merged_hint_count(old_value, new_value: int) -> int:
    try:
        old = int(old_value) if old_value is not None else int(new_value)
    except (TypeError, ValueError):
        old = int(new_value)
    return min(old, int(new_value))


@app.post("/api/attempt/start")
def attempt_start(payload: AttemptStart, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    if payload.mode not in ("daily", "free") or payload.difficulty not in POINTS:
        raise HTTPException(400, "Neplatný pokus")
    if not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
        raise HTTPException(400, "Neznámá úloha")
    if payload.mode == "free" and payload.challenge_key != f"free:{payload.puzzle_id}":
        raise HTTPException(400, "Neplatný klíč pokusu")
    if payload.mode == "daily":
        if not payload.challenge_key.startswith("daily:"):
            raise HTTPException(400, "Neplatný Daily klíč pokusu")
        daily_date = payload.challenge_key[6:]
        try:
            date.fromisoformat(daily_date)
        except ValueError:
            raise HTTPException(400, "Neplatné datum Daily pokusu")
        if payload.puzzle_id != expected_daily_puzzle_id(daily_date):
            raise HTTPException(400, "Tato úloha nepatří k Daily datu")
    existing = db_select("puzzle_attempts", id=payload.attempt_id, player_id=player["id"])
    if existing:
        return {"ok": True, "attemptId": payload.attempt_id}
    db_insert("puzzle_attempts", {
        "id": payload.attempt_id, "player_id": player["id"], "puzzle_id": payload.puzzle_id,
        "challenge_key": payload.challenge_key, "mode": payload.mode, "difficulty": payload.difficulty,
        "started_at": datetime.now(TZ).isoformat(), "app_version": "3.5.2",
    })
    return {"ok": True, "attemptId": payload.attempt_id}


@app.post("/api/feedback")
def puzzle_feedback(payload: FeedbackCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    if payload.kind not in ("difficulty", "word"):
        raise HTTPException(400, "Neplatný typ zpětné vazby")
    data = load_puzzles()
    known = any(payload.puzzle_id == p["id"] for bank in data.get("free", {}).values() for p in bank) or any(payload.puzzle_id == p["id"] for p in data.get("daily", []))
    if not known:
        raise HTTPException(400, "Neznámá úloha")
    existing = db_select("puzzle_feedback", player_id=player["id"], puzzle_id=payload.puzzle_id, kind=payload.kind)
    row = {"rating": payload.rating, "word": payload.word, "note": payload.note, "created_at": datetime.now(TZ).isoformat()}
    if existing:
        db_update("puzzle_feedback", {"id": existing[0]["id"]}, row)
    else:
        db_insert("puzzle_feedback", {"id": str(uuid.uuid4()), "player_id": player["id"], "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key, "kind": payload.kind, **row})
    return {"ok": True}


def _median(vals: list[int]) -> Optional[int]:
    if not vals:
        return None
    vals = sorted(vals)
    n = len(vals)
    return vals[n // 2] if n % 2 else round((vals[n // 2 - 1] + vals[n // 2]) / 2)


@app.get("/api/quality-report")
def quality_report(authorization: Optional[str] = Header(default=None)):
    # Aggregate-only telemetry for calibrating puzzle difficulty. No player names are returned.
    auth_player(authorization)
    attempts = db_select("puzzle_attempts")
    feedback = db_select("puzzle_feedback", kind="difficulty")
    fb: dict[str, list[int]] = {}
    for f in feedback:
        if f.get("rating") is not None:
            fb.setdefault(f["puzzle_id"], []).append(int(f["rating"]))
    groups: dict[str, list[dict]] = {}
    for a in attempts:
        groups.setdefault(a["puzzle_id"], []).append(a)
    pdata = load_puzzles()
    puzzle_index = {}
    for p in pdata.get("daily", []):
        puzzle_index[p["id"]] = p
    for bank in pdata.get("free", {}).values():
        for p in bank:
            puzzle_index[p["id"]] = p
    rows = []
    for puzzle_id, vals in groups.items():
        completed = [x for x in vals if x.get("completed_at")]
        times = [int(x["elapsed_ms"]) for x in completed if x.get("elapsed_ms") is not None]
        wrong = [int(x.get("wrong_attempts") or 0) for x in completed]
        hints = [int(x.get("hints_used") or 0) for x in completed]
        clean = [1 if x.get("clean_solve") is True else 0 for x in completed]
        ratings = fb.get(puzzle_id, [])
        puzzle = puzzle_index.get(puzzle_id, {})
        meta = puzzle.get("meta") or {}
        rows.append({
            "puzzleId": puzzle_id, "difficulty": vals[0].get("difficulty"), "starts": len(vals), "completions": len(completed),
            "completionRate": round(len(completed) / len(vals), 3) if vals else 0, "medianMs": _median(times),
            "avgWrong": round(sum(wrong) / len(wrong), 2) if wrong else None, "avgHints": round(sum(hints) / len(hints), 2) if hints else None,
            "cleanRate": round(sum(clean) / len(clean), 3) if clean else None,
            "difficultyRating": round(sum(ratings) / len(ratings), 2) if ratings else None, "ratings": len(ratings),
            "generatedScore": meta.get("difficultyScore"), "cells": meta.get("cells"),
            "words": len(puzzle.get("answers") or []), "sample": "early" if len(vals) < 5 else "usable",
        })
    rows.sort(key=lambda r: (r["difficulty"] or "", -(r["medianMs"] or 0)))
    return {"attempts": len(attempts), "puzzlesMeasured": len(rows), "rows": rows}


@app.post("/api/result")
def result(payload: ResultCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    effective_clean = bool(payload.clean_solve and payload.hints_used == 0)
    if payload.mode not in ("daily", "free"):
        raise HTTPException(400, "Neplatný režim")
    if payload.difficulty not in ("easy", "medium", "hard", "hardcore"):
        raise HTTPException(400, "Neplatná obtížnost")
    if not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
        raise HTTPException(400, "Neznámá úloha")

    if payload.mode == "daily":
        if not payload.daily_date:
            raise HTTPException(400, "Daily výsledek musí mít datum")
        try:
            date.fromisoformat(payload.daily_date)
        except ValueError:
            raise HTTPException(400, "Neplatné datum")
        if payload.challenge_key != f"daily:{payload.daily_date}":
            raise HTTPException(400, "Neplatný daily klíč")
        if payload.puzzle_id != expected_daily_puzzle_id(payload.daily_date):
            raise HTTPException(400, "Tato úloha nepatří k uvedenému dni")
        points = POINTS["daily"]
    else:
        if payload.challenge_key != f"free:{payload.puzzle_id}":
            raise HTTPException(400, "Neplatný klíč volné úlohy")
        points = POINTS[payload.difficulty]

    existing = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)
    if existing:
        old = existing[0]
        # Daily Challenge je jednorázová: první dokončený výsledek je finální.
        # U volných úloh lze opakováním zlepšit osobní rekord.
        if payload.mode == "free":
            db_update("results", {"id": old["id"]}, {
                "best_elapsed_ms": min(int(old.get("best_elapsed_ms") or payload.elapsed_ms), payload.elapsed_ms),
                "best_moves": min(int(old.get("best_moves") or payload.moves), payload.moves),
                "hints_used": merged_hint_count(old.get("hints_used"), payload.hints_used),
                "wrong_attempts": min(int(old.get("wrong_attempts") or payload.wrong_attempts), payload.wrong_attempts),
                "max_hint_level": min(int(old.get("max_hint_level") or payload.max_hint_level), payload.max_hint_level),
                "clean_solve": bool(old.get("clean_solve") is True or effective_clean),
            })
        first = False
    else:
        try:
            db_insert("results", {
                "id": str(uuid.uuid4()),
                "player_id": player["id"],
                "puzzle_id": payload.puzzle_id,
                "challenge_key": payload.challenge_key,
                "mode": payload.mode,
                "difficulty": payload.difficulty,
                "daily_date": payload.daily_date,
                "best_elapsed_ms": payload.elapsed_ms,
                "best_moves": payload.moves,
                "points": points,
                "hints_used": payload.hints_used,
                "wrong_attempts": payload.wrong_attempts,
                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
                "completed_at": datetime.now(TZ).isoformat(),
            })
            first = True
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            # Dvojité odeslání ze dvou oken: zachovej idempotenci.
            old = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)[0]
            if payload.mode == "free":
                db_update("results", {"id": old["id"]}, {
                    "best_elapsed_ms": min(int(old.get("best_elapsed_ms") or payload.elapsed_ms), payload.elapsed_ms),
                    "best_moves": min(int(old.get("best_moves") or payload.moves), payload.moves),
                    "hints_used": merged_hint_count(old.get("hints_used"), payload.hints_used),
                    "wrong_attempts": min(int(old.get("wrong_attempts") or payload.wrong_attempts), payload.wrong_attempts),
                    "max_hint_level": min(int(old.get("max_hint_level") or payload.max_hint_level), payload.max_hint_level),
                    "clean_solve": bool(old.get("clean_solve") is True or effective_clean),
                })
            first = False

    if payload.attempt_id:
        try:
            attempts = db_select("puzzle_attempts", id=payload.attempt_id, player_id=player["id"])
            telemetry_values = {
                "completed_at": datetime.now(TZ).isoformat(),
                "elapsed_ms": payload.elapsed_ms,
                "moves": payload.moves,
                "wrong_attempts": payload.wrong_attempts,
                "hints_used": payload.hints_used,
                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
            }
            if attempts:
                db_update("puzzle_attempts", {"id": payload.attempt_id}, telemetry_values)
            else:
                # Offline start mohl minout server. Při synchronizaci výsledku vytvoř dokončený
                # pokus dodatečně, aby telemetry nepodhodnocovala completion rate.
                db_insert("puzzle_attempts", {
                    "id": payload.attempt_id, "player_id": player["id"], "puzzle_id": payload.puzzle_id,
                    "challenge_key": payload.challenge_key, "mode": payload.mode, "difficulty": payload.difficulty,
                    "started_at": datetime.now(TZ).isoformat(), "app_version": "3.5-offline", **telemetry_values,
                })
        except HTTPException:
            logger.warning("Could not finalize telemetry attempt %s", payload.attempt_id)

    # Zápis výsledku je primární operace. Selhání dopočtu statistik nesmí
    # způsobit 500 po již úspěšném uložení a nechat telefon ve falešné frontě.
    try:
        stats = player_stats(player["id"])
        stats_warning = None
    except Exception as exc:
        logger.exception("Result saved, but stats refresh failed for player %s", player.get("id"))
        stats = None
        stats_warning = f"{type(exc).__name__}: {str(exc)[:160]}"

    return {
        "ok": True,
        "firstCompletion": first,
        "stats": stats,
        "statsWarning": stats_warning,
    }


@app.get("/api/result-status")
def result_status(
    challenge_key: str = Query(min_length=3, max_length=80),
    authorization: Optional[str] = Header(default=None),
):
    """Lehký diagnostický endpoint pro ověření, zda je konkrétní výsledek v cloudu."""
    player = auth_player(authorization)
    rows = db_select("results", player_id=player["id"], challenge_key=challenge_key)
    if not rows:
        return {"synced": False, "challengeKey": challenge_key}
    r = rows[0]
    return {
        "synced": True,
        "challengeKey": challenge_key,
        "elapsedMs": r["best_elapsed_ms"],
        "moves": r["best_moves"],
        "completedAt": r["completed_at"],
    }


@app.get("/api/rescue-status")
def rescue_status(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    return rescue_status_for(player["id"])


@app.post("/api/rescue/start")
def rescue_start(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    status = rescue_status_for(player["id"])
    if status.get("state") == "started":
        return status
    if not status.get("eligible") or status.get("state") != "available":
        raise HTTPException(409, "Záchrana streaku teď není dostupná")
    bank = load_puzzles().get("rescue", [])
    if not bank:
        raise HTTPException(503, "Rescue úlohy nejsou na serveru")
    missed = status["missedDate"]
    digest = hashlib.sha256(f"{player['id']}:{missed}".encode()).digest()
    puzzle = bank[int.from_bytes(digest[:4], "big") % len(bank)]
    now = datetime.now(TZ)
    db_insert("streak_rescues", {
        "id": str(uuid.uuid4()), "player_id": player["id"], "missed_date": missed,
        "puzzle_id": puzzle["id"], "status": "started", "started_at": now.isoformat(),
    })
    return {
        "eligible": True, "state": "started", "missedDate": missed,
        "priorStreak": status.get("priorStreak", 0), "puzzleId": puzzle["id"],
        "timeLimitMs": 30000, "secondsRemaining": 30,
    }


@app.post("/api/rescue/finish")
def rescue_finish(payload: RescueFinish, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    rows = db_select("streak_rescues", player_id=player["id"], puzzle_id=payload.puzzle_id)
    if not rows:
        raise HTTPException(404, "Záchranný pokus nebyl nalezen")
    row = sorted(rows, key=lambda r: str(r.get("started_at") or ""), reverse=True)[0]
    if row.get("status") != "started":
        return {"ok": row.get("status") == "passed", "state": row.get("status"), "stats": player_stats(player["id"])}
    started = datetime.fromisoformat(str(row.get("started_at")).replace("Z", "+00:00"))
    if started.tzinfo is None:
        started = started.replace(tzinfo=TZ)
    server_elapsed_ms = int(max(0, (datetime.now(TZ) - started.astimezone(TZ)).total_seconds() * 1000))
    passed = bool(payload.completed and payload.elapsed_ms <= 30000 and server_elapsed_ms <= 35000)
    final_elapsed = max(payload.elapsed_ms, min(server_elapsed_ms, 120000))
    db_update("streak_rescues", {"id": row["id"]}, {
        "status": "passed" if passed else "failed",
        "completed_at": datetime.now(TZ).isoformat(),
        "elapsed_ms": final_elapsed,
    })
    return {"ok": passed, "state": "passed" if passed else "failed", "stats": player_stats(player["id"])}


@app.get("/api/leaderboard")
def leaderboard(
    family_code: str = Query(min_length=2, max_length=24),
    daily_date: Optional[str] = Query(default=None),
):
    family = norm_family(family_code)
    daily_date = daily_date or current_prague_date().isoformat()
    players = db_select("players", family_code=family)

    overall = []
    for p in players:
        stats = player_stats(p["id"])
        overall.append({"id": p["id"], "name": p["name"], **stats})
    overall.sort(key=lambda x: (-x["points"], -x["currentStreak"], x["name"].casefold()))
    for i, item in enumerate(overall, 1):
        item["rank"] = i

    player_map = {p["id"]: p for p in players}
    today = current_prague_date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    weekly = []
    all_results = db_select("results")
    family_results = [r for r in all_results if r.get("player_id") in player_map]
    for p in players:
        rows = []
        for r in family_results:
            if r.get("player_id") != p["id"]:
                continue
            try:
                done = datetime.fromisoformat(str(r.get("completed_at")).replace("Z", "+00:00")).astimezone(TZ).date()
            except Exception:
                continue
            if week_start <= done < week_end:
                rows.append(r)
        weekly.append({
            "id": p["id"], "name": p["name"], "points": sum(int(r.get("points") or 0) for r in rows),
            "completed": len(rows), "daily": sum(1 for r in rows if r.get("mode") == "daily"),
            "clean": sum(1 for r in rows if r.get("clean_solve") is True),
        })
    weekly.sort(key=lambda x: (-x["points"], -x["daily"], -x["clean"], x["name"].casefold()))
    for i, item in enumerate(weekly, 1):
        item["rank"] = i

    daily_rows = db_select("results", mode="daily", daily_date=daily_date)
    daily_rows = [r for r in daily_rows if r["player_id"] in player_map]
    daily_rows.sort(key=lambda r: (
        0 if r.get("clean_solve") is True else 1,
        int(r.get("hints_used") or 0),
        r["best_elapsed_ms"], r["best_moves"], player_map[r["player_id"]]["name"].casefold(),
    ))
    daily = [
        {
            "rank": i,
            "id": r["player_id"],
            "name": player_map[r["player_id"]]["name"],
            "elapsedMs": r["best_elapsed_ms"],
            "moves": r["best_moves"],
            "hintsUsed": int(r.get("hints_used") or 0),
            "cleanSolve": r.get("clean_solve") is True,
        }
        for i, r in enumerate(daily_rows, 1)
    ]
    return {"familyCode": family, "date": daily_date, "weekStart": week_start.isoformat(), "overall": overall, "weekly": weekly, "daily": daily}


# Lokální spuštění přes uvicorn: Vercel obslouží public/ sám z CDN.
if not os.environ.get("VERCEL"):
    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="local-static")
