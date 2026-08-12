from __future__ import annotations

import hashlib
import math
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
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from pywebpush import webpush, WebPushException
except Exception:  # Push remains optional until dependencies/env are configured.
    webpush = None
    WebPushException = Exception

ROOT = Path(__file__).resolve().parent
PUZZLES_PATH = ROOT / "data" / "puzzles.json"
TZ = ZoneInfo("Europe/Prague")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "https://proplet-nine.vercel.app").strip()
CRON_SECRET = os.environ.get("CRON_SECRET", "").strip()

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

app = FastAPI(title="Proplet API", version="3.14-cloud")
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
    if VAPID_PRIVATE_KEY:
        detail = detail.replace(VAPID_PRIVATE_KEY, "[vapid-secret]")
    if CRON_SECRET:
        detail = detail.replace(CRON_SECRET, "[cron-secret]")
    return JSONResponse(status_code=500, content={"detail": f"Interní chyba serveru: {detail[:220]}"})


class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    family_code: str = Field(min_length=2, max_length=24)
    # Optional keeps a rolling deployment compatible with an older cached PWA.
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    league_pin: Optional[str] = Field(default=None, max_length=32)
    create_league: bool = False
    league_name: Optional[str] = Field(default=None, max_length=40)


class PlayerLogin(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    family_code: str = Field(min_length=2, max_length=24)
    password: str = Field(min_length=8, max_length=128)


class PasswordSet(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AvatarSet(BaseModel):
    avatar: str = Field(min_length=1, max_length=16)


class SupportModeSet(BaseModel):
    support_mode: str


class HelperEventCreate(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    event_type: str
    support_mode: str = Field(default="none", max_length=32)
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    idle_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    total_words: int = Field(default=0, ge=0, le=99)


class HintEventCreate(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    hint_level: int = Field(ge=1, le=3)
    source: str = Field(default="manual", max_length=24)
    support_mode: str = Field(default="none", max_length=32)
    complimentary: bool = False
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    total_words: int = Field(default=0, ge=0, le=99)


class TeamPinSet(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


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
    # Client timestamp lets delayed/offline sync preserve the actual first completion.
    completed_at: Optional[str] = Field(default=None, max_length=40)


class AttemptStart(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str


class AttemptCheckpoint(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    event_type: str
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)


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


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)
    p256dh: str = Field(min_length=20, max_length=512)
    auth: str = Field(min_length=8, max_length=256)
    user_agent: Optional[str] = Field(default=None, max_length=300)


class PushUnsubscribe(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048)


class FamilyLeagueSettings(BaseModel):
    enabled: bool
    public_name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    league_pin: Optional[str] = Field(default=None, max_length=32)  # backward compatibility with v3.8.1 clients


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


def db_delete(table: str, **filters):
    params = {key: f"eq.{value}" for key, value in filters.items() if value is not None}
    return db_request("DELETE", table, params=params, prefer="return=representation")


def norm_family(code: str) -> str:
    code = "".join(ch for ch in code.upper().strip() if ch.isalnum() or ch in "-_ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ")
    return code[:24]


def league_name_for(code: str) -> str:
    try:
        rows = db_select("leagues", code=norm_family(code))
        return rows[0].get("name") or norm_family(code) if rows else norm_family(code)
    except HTTPException:
        return norm_family(code)

def push_ready() -> bool:
    return bool(webpush and VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


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
    pdata = load_puzzles() if puzzle_file else {}
    base = {
        "date": current_prague_date().isoformat(),
        "puzzleFile": puzzle_file,
        "puzzleSource": "data/puzzles.json",
        "version": "3.14.0",
        "vocabularyVersion": pdata.get("vocabularyVersion"),
        "vocabularyTierCounts": pdata.get("vocabularyTierCounts"),
        "tieredDailyFrom": pdata.get("tieredDailyFrom"),
        "freeTieredFromVersion": pdata.get("freeTieredFromVersion"),
        "freeFreezeCutoffs": pdata.get("freeFreezeCutoffs"),
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
        profiles_migration = True
        try:
            db_request("GET", "players", params={"select": "id,avatar", "limit": "1"})
        except HTTPException:
            profiles_migration = False
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
        playtest_migration = True
        try:
            db_request("GET", "leagues", params={"select": "code,name", "limit": "1"})
            db_request("GET", "puzzle_runs", params={"select": "id", "limit": "1"})
            db_request("GET", "push_subscriptions", params={"select": "id", "limit": "1"})
        except HTTPException:
            playtest_migration = False
        global_league_migration = True
        try:
            db_request("GET", "leagues", params={"select": "code,public_opt_in,public_name,public_enabled_at", "limit": "1"})
        except HTTPException:
            global_league_migration = False
        analytics_v2_migration = True
        try:
            db_request("GET", "players", params={"select": "id,support_mode", "limit": "1"})
            db_request("GET", "helper_events", params={"select": "id", "limit": "1"})
            db_request("GET", "hint_events", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_attempts", params={"select": "id,first_correct_ms,first_hint_ms,reset_count,resume_count,last_found_words,last_activity_at", "limit": "1"})
            db_request("GET", "quality_snapshots", params={"select": "id,week_start", "limit": "1"})
        except HTTPException:
            analytics_v2_migration = False
        return {**base, "ok": True, "database": True, "accountMigration": account_migration, "featuresMigration": features_migration, "qualityMigration": quality_migration, "playtestMigration": playtest_migration, "globalLeagueMigration": global_league_migration, "profilesMigration": profiles_migration, "analyticsV2Migration": analytics_v2_migration, "helperSystem": analytics_v2_migration, "pushConfigured": push_ready(), "cronConfigured": bool(CRON_SECRET)}
    except HTTPException as exc:
        return {**base, "ok": False, "database": False, "accountMigration": False, "featuresMigration": False, "qualityMigration": False, "playtestMigration": False, "globalLeagueMigration": False, "profilesMigration": False, "analyticsV2Migration": False, "pushConfigured": push_ready(), "message": exc.detail}


@app.get("/api/config")
def config():
    p = load_puzzles()
    return {
        "badges": BADGES,
        "points": POINTS,
        "dictionarySize": p["dictionarySize"],
        "dailyRotationSize": p["dailyRotationSize"],
        "rescueBankSize": len(p.get("rescue", [])),
        "pushAvailable": push_ready(),
        "version": "3.14.0",
    }


@app.get("/api/teams")
@app.get("/api/leagues")
def list_leagues():
    """Public team discovery: names/codes only, never team PIN hashes."""
    try:
        rows = db_select("leagues")
    except HTTPException:
        rows = []
    try:
        players = db_select("players")
    except HTTPException:
        players = []
    counts: dict[str, int] = {}
    for p in players:
        code = norm_family(str(p.get("family_code") or ""))
        counts[code] = counts.get(code, 0) + 1
    out = [{"code": r.get("code"), "name": r.get("name") or r.get("code"), "members": counts.get(r.get("code"), 0), "protected": bool(r.get("pin_hash"))} for r in rows]
    out.sort(key=lambda x: str(x["name"]).casefold())
    return {"leagues": out}


@app.post("/api/player")
def create_player(payload: PlayerCreate):
    name = " ".join(payload.name.strip().split())
    family = norm_family(payload.family_code)
    if not name or len(family) < 2:
        raise HTTPException(400, "Vyplň jméno a tým")

    league_rows = db_select("leagues", code=family)
    if payload.create_league:
        display_name = " ".join((payload.league_name or payload.family_code).strip().split())[:40]
        if league_rows:
            raise HTTPException(409, "Tým s tímto názvem už existuje. Přidej se k němu místo zakládání nového.")
        if not payload.league_pin or len(payload.league_pin.strip()) < 4:
            raise HTTPException(400, "Nový tým potřebuje PIN alespoň 4 znaky")
        db_insert("leagues", {"code": family, "name": display_name or family, "pin_hash": hash_password(payload.league_pin.strip()), "created_at": datetime.now(TZ).isoformat()})
        league_rows = db_select("leagues", code=family)
    elif not league_rows:
        # Backward compatibility for a cached pre-team client. New v3.9 clients always create teams explicitly.
        db_insert("leagues", {"code": family, "name": family, "created_at": datetime.now(TZ).isoformat()})
        league_rows = db_select("leagues", code=family)
    else:
        # PIN is the shared invitation secret for adding a NEW player to an existing team.
        if not league_rows[0].get("pin_hash"):
            raise HTTPException(409, "Tento tým ještě nemá nastavený vstupní PIN. Některý přihlášený člen ho může nastavit v profilu.")
        if not payload.league_pin or not verify_password(payload.league_pin.strip(), league_rows[0].get("pin_hash")):
            raise HTTPException(401, "PIN týmu nesedí")

    family_players = db_select("players", family_code=family)
    if any(p["name"].casefold() == name.casefold() for p in family_players):
        raise HTTPException(409, "V tomto týmu už hráč s tímto jménem existuje")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    player_id = str(uuid.uuid4())
    now = datetime.now(TZ).isoformat()
    row = {
        "id": player_id,
        "name": name,
        "family_code": family,
        "avatar": "🙂",
        "support_mode": "none",
        "token_hash": token_hash,
        "created_at": now,
    }
    if payload.password:
        row["password_hash"] = hash_password(payload.password)

    try:
        db_insert("players", row)
    except HTTPException as exc:
        if exc.status_code == 409:
            raise HTTPException(409, "V tomto týmu už hráč s tímto jménem existuje")
        raise

    stats = player_stats(player_id)
    return {
        "id": player_id, "name": name, "familyCode": family, "leagueName": league_name_for(family), "token": token,
        "hasPassword": bool(payload.password), "avatar": row.get("avatar") or "🙂", "supportMode": row.get("support_mode") or "none", "stats": stats,
    }


@app.post("/api/login")
def login(payload: PlayerLogin):
    family = norm_family(payload.family_code)
    name = " ".join(payload.name.strip().split())
    family_players = db_select("players", family_code=family)
    player = next((p for p in family_players if p["name"].casefold() == name.casefold()), None)
    if not player:
        raise HTTPException(401, "Tým, jméno nebo heslo nesedí")
    if not player.get("password_hash"):
        raise HTTPException(409, "Tento hráč ještě nemá heslo. Nastav ho na zařízení, kde už je přihlášený.")
    if not verify_password(payload.password, player.get("password_hash")):
        raise HTTPException(401, "Tým, jméno nebo heslo nesedí")

    token = new_session(player["id"])
    return {
        "id": player["id"], "name": player["name"], "familyCode": player["family_code"], "leagueName": league_name_for(player["family_code"]),
        "token": token, "hasPassword": True, "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": player_stats(player["id"]),
    }


@app.post("/api/password")
def set_password(payload: PasswordSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    db_update("players", {"id": player["id"]}, {"password_hash": hash_password(payload.password)})
    return {"ok": True, "hasPassword": True}


@app.post("/api/avatar")
def set_avatar(payload: AvatarSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    avatar = payload.avatar.strip()[:16]
    if not avatar:
        raise HTTPException(400, "Vyber avatar")
    db_update("players", {"id": player["id"]}, {"avatar": avatar})
    return {"ok": True, "avatar": avatar}


@app.post("/api/support-mode")
def set_support_mode(payload: SupportModeSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    allowed = {"none", "beginner", "younger", "older"}
    mode = (payload.support_mode or "none").strip().lower()
    if mode not in allowed:
        raise HTTPException(400, "Neplatná úroveň podpory")
    db_update("players", {"id": player["id"]}, {"support_mode": mode})
    return {"ok": True, "supportMode": mode}


def _telemetry_attempt(player_id: str, attempt_id: str, puzzle_id: str, challenge_key: str) -> Optional[dict]:
    rows = db_select("puzzle_attempts", id=attempt_id, player_id=player_id)
    if not rows:
        return None
    row = rows[0]
    # Telemetry must describe the real authenticated attempt, not arbitrary client metadata.
    if row.get("puzzle_id") != puzzle_id or row.get("challenge_key") != challenge_key:
        raise HTTPException(400, "Telemetry neodpovídá pokusu")
    return row


@app.post("/api/helper-event")
def helper_event(payload: HelperEventCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    allowed_events = {"offered", "accepted", "dismissed"}
    if payload.event_type not in allowed_events:
        raise HTTPException(400, "Neplatný helper event")
    if not _telemetry_attempt(player["id"], payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    support_mode = player.get("support_mode") or "none"
    db_insert("helper_events", {
        "id": str(uuid.uuid4()),
        "player_id": player["id"],
        "attempt_id": payload.attempt_id,
        "puzzle_id": payload.puzzle_id,
        "challenge_key": payload.challenge_key,
        "event_type": payload.event_type,
        "support_mode": support_mode,
        "elapsed_ms": payload.elapsed_ms,
        "idle_ms": payload.idle_ms,
        "found_words": payload.found_words,
        "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/hint-event")
def hint_event(payload: HintEventCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    if payload.source not in {"manual", "helper"}:
        raise HTTPException(400, "Neplatný zdroj nápovědy")
    if not _telemetry_attempt(player["id"], payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    support_mode = player.get("support_mode") or "none"
    # Complimentary is intentionally derived server-side. It has no gameplay effect in v3.14,
    # but future hint economy must not trust a client-declared free-credit flag.
    previous_hints = db_select("hint_events", attempt_id=payload.attempt_id, player_id=player["id"])
    sibling_attempts = db_select("puzzle_attempts", player_id=player["id"], challenge_key=payload.challenge_key)
    first_attempt_id = None
    if sibling_attempts:
        first_attempt_id = min(
            sibling_attempts,
            key=lambda a: (str(a.get("started_at") or ""), str(a.get("id") or "")),
        ).get("id")
    complimentary = (
        payload.hint_level == 1
        and support_mode in {"beginner", "younger"}
        and payload.attempt_id == first_attempt_id
        and not previous_hints
    )
    db_insert("hint_events", {
        "id": str(uuid.uuid4()),
        "player_id": player["id"],
        "attempt_id": payload.attempt_id,
        "puzzle_id": payload.puzzle_id,
        "challenge_key": payload.challenge_key,
        "hint_level": payload.hint_level,
        "source": payload.source,
        "support_mode": support_mode,
        "complimentary": complimentary,
        "elapsed_ms": payload.elapsed_ms,
        "found_words": payload.found_words,
        "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/team-pin")
def set_team_pin(payload: TeamPinSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    team = norm_family(str(player.get("family_code") or ""))
    rows = db_select("leagues", code=team)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    db_update("leagues", {"code": team}, {"pin_hash": hash_password(payload.pin.strip())})
    return {"ok": True, "hasPin": True}


@app.post("/api/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return {"ok": True}
    token = authorization.split(" ", 1)[1].strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    sessions = db_select("player_sessions", token_hash=token_hash)
    if sessions:
        db_delete("player_sessions", id=sessions[0]["id"])
        return {"ok": True}
    # The original device token lives on players. Rotate it so this particular token stops working;
    # independent sessions on other devices remain valid.
    players = db_select("players", token_hash=token_hash)
    if players:
        db_update("players", {"id": players[0]["id"]}, {"token_hash": hashlib.sha256(secrets.token_urlsafe(32).encode()).hexdigest()})
    return {"ok": True}


@app.get("/api/me")
def me(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    stats = player_stats(player["id"])
    return {
        "id": player["id"], "name": player["name"], "familyCode": player["family_code"], "leagueName": league_name_for(player["family_code"]),
        "hasPassword": bool(player.get("password_hash")), "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": stats,
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
        "started_at": datetime.now(TZ).isoformat(), "app_version": "3.14",
    })
    return {"ok": True, "attemptId": payload.attempt_id}


@app.post("/api/attempt/checkpoint")
def attempt_checkpoint(payload: AttemptCheckpoint, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    allowed = {"correct", "hint", "reset", "resume", "leave"}
    if payload.event_type not in allowed:
        raise HTTPException(400, "Neplatný checkpoint")
    rows = db_select("puzzle_attempts", id=payload.attempt_id, player_id=player["id"])
    if not rows:
        return {"ok": True, "ignored": True}
    row = rows[0]
    values = {
        "last_found_words": max(int(row.get("last_found_words") or 0), int(payload.found_words)),
        "last_activity_at": datetime.now(TZ).isoformat(),
    }
    if payload.event_type == "correct" and row.get("first_correct_ms") is None:
        values["first_correct_ms"] = int(payload.elapsed_ms)
    elif payload.event_type == "hint" and row.get("first_hint_ms") is None:
        values["first_hint_ms"] = int(payload.elapsed_ms)
    elif payload.event_type == "reset":
        values["reset_count"] = int(row.get("reset_count") or 0) + 1
    elif payload.event_type == "resume":
        values["resume_count"] = int(row.get("resume_count") or 0) + 1
    db_update("puzzle_attempts", {"id": payload.attempt_id}, values)
    return {"ok": True}


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


def build_quality_report():
    """Quality Analytics v2.

    Main calibration metrics use each player's FIRST started attempt on a puzzle.
    Replays remain available as secondary telemetry, but cannot make a puzzle look easier.
    """
    attempts = db_select("puzzle_attempts")
    feedback = db_select("puzzle_feedback", kind="difficulty")
    word_feedback = db_select("puzzle_feedback", kind="word")
    hint_events = db_select("hint_events")
    helper_events = db_select("helper_events")

    def ts(row):
        raw = row.get("started_at") or ""
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except Exception:
            return datetime.max.replace(tzinfo=TZ)

    first_by_player_puzzle: dict[tuple[str, str], dict] = {}
    for a in sorted(attempts, key=ts):
        key = (str(a.get("player_id")), str(a.get("puzzle_id")))
        first_by_player_puzzle.setdefault(key, a)

    first_attempts = list(first_by_player_puzzle.values())
    groups: dict[str, list[dict]] = {}
    for a in first_attempts:
        groups.setdefault(a["puzzle_id"], []).append(a)

    word_reports: dict[str, int] = {}
    for f in word_feedback:
        word_reports[f["puzzle_id"]] = word_reports.get(f["puzzle_id"], 0) + 1

    fb: dict[str, list[int]] = {}
    for f in feedback:
        if f.get("rating") is not None:
            fb.setdefault(f["puzzle_id"], []).append(int(f["rating"]))

    pdata = load_puzzles()
    puzzle_index = {}
    for p in pdata.get("daily", []):
        puzzle_index[p["id"]] = p
    for bank in pdata.get("free", {}).values():
        for p in bank:
            puzzle_index[p["id"]] = p

    # Retired IDs remain syncable for historical data, but must not calibrate the active bank.
    first_attempts = [a for a in first_attempts if a.get("puzzle_id") in puzzle_index]
    groups = {}
    for a in first_attempts:
        groups.setdefault(a["puzzle_id"], []).append(a)

    rows = []
    for puzzle_id, vals in groups.items():
        completed = [x for x in vals if x.get("completed_at")]
        times = [int(x["elapsed_ms"]) for x in completed if x.get("elapsed_ms") is not None]
        wrong = [int(x.get("wrong_attempts") or 0) for x in completed]
        hints = [int(x.get("hints_used") or 0) for x in completed]
        clean = [1 if x.get("clean_solve") is True else 0 for x in completed]
        first_correct = [int(x.get("first_correct_ms")) for x in vals if x.get("first_correct_ms") is not None]
        resets = [int(x.get("reset_count") or 0) for x in vals]
        resumes = [int(x.get("resume_count") or 0) for x in vals]
        ratings = fb.get(puzzle_id, [])
        puzzle = puzzle_index.get(puzzle_id, {})
        meta = puzzle.get("meta") or {}
        starts = len(vals)
        sample = "none" if starts < 5 else "early" if starts < 10 else "usable" if starts < 20 else "reliable" if starts < 50 else "strong"
        rows.append({
            "puzzleId": puzzle_id,
            "difficulty": vals[0].get("difficulty"),
            "starts": starts,
            "completions": len(completed),
            "completionRate": round(len(completed) / starts, 3) if starts else 0,
            "medianMs": _median(times),
            "avgWrong": round(sum(wrong) / len(wrong), 2) if wrong else None,
            "avgHints": round(sum(hints) / len(hints), 2) if hints else None,
            "cleanRate": round(sum(clean) / len(clean), 3) if clean else None,
            "medianFirstCorrectMs": _median(first_correct),
            "avgResets": round(sum(resets) / len(resets), 2) if resets else 0,
            "avgResumes": round(sum(resumes) / len(resumes), 2) if resumes else 0,
            "difficultyRating": round(sum(ratings) / len(ratings), 2) if ratings else None,
            "ratings": len(ratings),
            "wordReports": word_reports.get(puzzle_id, 0),
            "generatedScore": meta.get("difficultyScore"),
            "cells": meta.get("cells"),
            "words": len(puzzle.get("answers") or []),
            "sample": sample,
        })

    def med(values):
        xs = [float(v) for v in values if v is not None]
        if not xs:
            return None
        xs.sort()
        n = len(xs)
        return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

    def robust_z(value, values):
        if value is None:
            return 0.0
        xs = [float(v) for v in values if v is not None]
        if len(xs) < 5:
            return 0.0
        center = med(xs)
        deviations = [abs(x - center) for x in xs]
        mad = med(deviations) or 0.0
        if mad < 1e-9:
            mean = sum(xs) / len(xs)
            variance = sum((x - mean) ** 2 for x in xs) / max(1, len(xs) - 1)
            sd = variance ** 0.5
            return 0.0 if sd < 1e-9 else (float(value) - mean) / sd
        return 0.6745 * (float(value) - center) / mad

    by_diff: dict[str, list[dict]] = {}
    for r in rows:
        if r["starts"] >= 5:
            by_diff.setdefault(r["difficulty"], []).append(r)

    for diff, peers in by_diff.items():
        metrics = {
            "logTime": [math.log(max(1, r["medianMs"])) if r["medianMs"] else None for r in peers],
            "completion": [r["completionRate"] for r in peers],
            "hints": [r["avgHints"] for r in peers],
            "wrong": [r["avgWrong"] for r in peers],
            "clean": [r["cleanRate"] for r in peers],
            "rating": [r["difficultyRating"] for r in peers],
        }
        for r in peers:
            z_time = robust_z(math.log(max(1, r["medianMs"])) if r["medianMs"] else None, metrics["logTime"])
            z_completion = -robust_z(r["completionRate"], metrics["completion"])
            z_hints = robust_z(r["avgHints"], metrics["hints"])
            z_wrong = robust_z(r["avgWrong"], metrics["wrong"])
            z_clean = -robust_z(r["cleanRate"], metrics["clean"])
            z_rating = robust_z(r["difficultyRating"], metrics["rating"]) if r["ratings"] >= 3 else 0.0
            raw = (0.35*z_time + 0.20*z_completion + 0.15*z_hints + 0.10*z_wrong + 0.10*z_clean + 0.10*z_rating)
            # Do not overstate tiny samples. Reliability reaches 1.0 at 20 first attempts.
            confidence = min(1.0, r["starts"] / 20.0)
            rating_conf = min(1.0, r["ratings"] / 10.0)
            r["difficultyIndex"] = round(raw * (0.6 + 0.4 * confidence), 2)
            r["confidence"] = round(confidence, 2)
            r["ratingConfidence"] = round(rating_conf, 2)
            idx = r["difficultyIndex"]
            if r["starts"] >= 20 and idx >= 1.25:
                r["flag"] = "too_hard"
                r["recommendation"] = "Zkontrolovat geometrii, slovní mix a případnou potřebu přesunu výš."
            elif r["starts"] >= 20 and idx <= -1.25:
                r["flag"] = "too_easy"
                r["recommendation"] = "Kandidát na jednodušší kategorii nebo pozdější pořadí v bance."
            elif r["starts"] >= 10 and abs(idx) >= 1.60:
                r["flag"] = "watch"
                r["recommendation"] = "Sbírat další data; zatím neměnit automaticky."
            else:
                r["flag"] = "ok"
                r["recommendation"] = "Bez zásahu."

    for r in rows:
        r.setdefault("difficultyIndex", None)
        r.setdefault("confidence", min(1.0, r["starts"] / 20.0))
        r.setdefault("ratingConfidence", min(1.0, r["ratings"] / 10.0))
        r.setdefault("flag", "insufficient_data" if r["starts"] < 5 else "ok")
        r.setdefault("recommendation", "Čekat na větší vzorek." if r["starts"] < 5 else "Bez zásahu.")

    rows.sort(key=lambda r: (0 if r["flag"] in {"too_hard","too_easy","watch"} else 1, -(abs(r["difficultyIndex"] or 0)), -(r["starts"] or 0)))
    priorities = [r for r in rows if r["flag"] in {"too_hard", "too_easy", "watch"}]
    helper_summary = {}
    first_attempt_map = {str(a.get("id")): a for a in first_attempts}
    first_attempt_ids = set(first_attempt_map)
    helper_events_first = [e for e in helper_events if str(e.get("attempt_id")) in first_attempt_ids]
    helper_summary["rawEvents"] = len(helper_events)
    helper_summary["firstAttemptEvents"] = len(helper_events_first)
    helper_summary["offers"] = sum(1 for e in helper_events_first if e.get("event_type") == "offered")
    helper_summary["accepted"] = sum(1 for e in helper_events_first if e.get("event_type") == "accepted")
    helper_summary["dismissed"] = sum(1 for e in helper_events_first if e.get("event_type") == "dismissed")
    helper_summary["acceptRate"] = round(helper_summary["accepted"] / helper_summary["offers"], 3) if helper_summary["offers"] else None
    offer_idle = [int(e.get("idle_ms") or 0) for e in helper_events_first if e.get("event_type") == "offered"]
    helper_summary["medianOfferIdleMs"] = _median(offer_idle)
    accepted_ids = {str(e.get("attempt_id")) for e in helper_events_first if e.get("event_type") == "accepted"}
    dismissed_ids = {str(e.get("attempt_id")) for e in helper_events_first if e.get("event_type") == "dismissed"}
    accepted_attempts = [first_attempt_map[i] for i in accepted_ids if i in first_attempt_map]
    dismissed_attempts = [first_attempt_map[i] for i in dismissed_ids if i in first_attempt_map]
    helper_summary["acceptedCompletionRate"] = round(sum(1 for a in accepted_attempts if a.get("completed_at")) / len(accepted_attempts), 3) if accepted_attempts else None
    helper_summary["dismissedCompletionRate"] = round(sum(1 for a in dismissed_attempts if a.get("completed_at")) / len(dismissed_attempts), 3) if dismissed_attempts else None
    helper_summary["bySupportMode"] = {}
    for mode in ("beginner", "younger", "older", "none"):
        evs = [e for e in helper_events_first if (e.get("support_mode") or "none") == mode]
        offers = sum(1 for e in evs if e.get("event_type") == "offered")
        accepted = sum(1 for e in evs if e.get("event_type") == "accepted")
        helper_summary["bySupportMode"][mode] = {
            "offers": offers, "accepted": accepted,
            "dismissed": sum(1 for e in evs if e.get("event_type") == "dismissed"),
            "acceptRate": round(accepted / offers, 3) if offers else None,
        }

    completed_first = [a for a in first_attempts if a.get("completed_at")]
    hint_hist = {"0": 0, "1": 0, "2": 0, "3plus": 0}
    for a in completed_first:
        n = int(a.get("hints_used") or 0)
        hint_hist["0" if n == 0 else "1" if n == 1 else "2" if n == 2 else "3plus"] += 1
    first_hint_times = [int(a.get("first_hint_ms")) for a in first_attempts if a.get("first_hint_ms") is not None]
    hint_events_first = [e for e in hint_events if str(e.get("attempt_id")) in first_attempt_ids]
    hinted_first_ids = {str(e.get("attempt_id")) for e in hint_events_first}
    hint_summary = {
        "events": len(hint_events),
        "firstAttemptEvents": len(hint_events_first),
        "manual": sum(1 for e in hint_events_first if e.get("source") == "manual"),
        "helper": sum(1 for e in hint_events_first if e.get("source") == "helper"),
        "complimentary": sum(1 for e in hint_events_first if e.get("complimentary") is True),
        "byLevel": {str(level): sum(1 for e in hint_events_first if int(e.get("hint_level") or 0) == level) for level in (1,2,3)},
        "firstAttemptDistribution": hint_hist,
        "medianFirstHintMs": _median(first_hint_times),
        "firstAttemptHintRate": round(len(hinted_first_ids) / len(first_attempts), 3) if first_attempts else None,
    }
    return {
        "analyticsVersion": 2,
        "attemptsRaw": len(attempts),
        "firstAttempts": len(first_attempts),
        "puzzlesMeasured": len(rows),
        "summary": {
            "tooHard": sum(1 for r in rows if r["flag"] == "too_hard"),
            "tooEasy": sum(1 for r in rows if r["flag"] == "too_easy"),
            "watch": sum(1 for r in rows if r["flag"] == "watch"),
            "reliable": sum(1 for r in rows if r["starts"] >= 20),
        },
        "helper": helper_summary,
        "hints": hint_summary,
        "priorities": priorities[:30],
        "rows": rows,
    }


@app.get("/api/quality-report")
def quality_report(authorization: Optional[str] = Header(default=None)):
    auth_player(authorization)
    return build_quality_report()


@app.get("/api/quality-history")
def quality_history(authorization: Optional[str] = Header(default=None)):
    auth_player(authorization)
    rows = db_request("GET", "quality_snapshots", params={"select": "week_start,payload,created_at", "order": "week_start.desc", "limit": "12"})
    return {"snapshots": rows}


def save_quality_snapshot_if_monday() -> dict:
    today = current_prague_date()
    if today.weekday() != 0:
        return {"saved": False, "reason": "not_monday"}
    week_start = today.isoformat()
    if db_select("quality_snapshots", week_start=week_start):
        return {"saved": False, "reason": "exists"}
    report = build_quality_report()
    compact = {
        "analyticsVersion": report.get("analyticsVersion"),
        "firstAttempts": report.get("firstAttempts"),
        "puzzlesMeasured": report.get("puzzlesMeasured"),
        "summary": report.get("summary"),
        "helper": report.get("helper"),
        "hints": report.get("hints"),
        "priorities": report.get("priorities", [])[:30],
    }
    db_insert("quality_snapshots", {
        "id": str(uuid.uuid4()), "week_start": week_start, "analytics_version": 2,
        "payload": compact, "created_at": datetime.now(TZ).isoformat(),
    })
    return {"saved": True, "weekStart": week_start}


def payload_completed_at(value: Optional[str]) -> str:
    """Return a sane ISO timestamp from the client, falling back to server time."""
    if value:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=TZ)
            # Reject absurd timestamps; device clocks can occasionally be wrong.
            now = datetime.now(TZ)
            if datetime(2025, 1, 1, tzinfo=TZ) <= dt.astimezone(TZ) <= now + timedelta(days=1):
                return dt.astimezone(TZ).isoformat()
        except (TypeError, ValueError):
            pass
    return datetime.now(TZ).isoformat()

def completion_time(r: dict) -> datetime:
    raw = r.get("completed_at")
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    except (TypeError, ValueError):
        return datetime.max.replace(tzinfo=TZ)

def first_run_key(r: dict) -> tuple:
    return (completion_time(r), str(r.get("id") or r.get("attempt_id") or ""))

def run_rank_tuple(r: dict) -> tuple:
    return (
        0 if r.get("clean_solve") is True else 1,
        int(r.get("hints_used") or 0),
        int(r.get("elapsed_ms") or r.get("best_elapsed_ms") or 10**12),
        int(r.get("moves") or r.get("best_moves") or 10**9),
        int(r.get("wrong_attempts") or 0),
    )

def puzzle_info(puzzle_id: str) -> Optional[dict]:
    data = load_puzzles()
    for diff, bank in data.get("free", {}).items():
        for p in bank:
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": diff, "mode": "free", "level": int((p.get("meta") or {}).get("level") or 0)}
    for p in data.get("daily", []):
        if p.get("id") == puzzle_id:
            return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None}
    return None

def record_puzzle_run(player_id: str, payload: ResultCreate, effective_clean: bool):
    attempt_id = payload.attempt_id or f"run:{player_id}:{payload.challenge_key}:{uuid.uuid4()}"
    if db_select("puzzle_runs", attempt_id=attempt_id):
        return
    completed_at = payload_completed_at(payload.completed_at)
    db_insert("puzzle_runs", {
        "id": str(uuid.uuid4()), "attempt_id": attempt_id, "player_id": player_id,
        "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "mode": payload.mode, "difficulty": payload.difficulty, "elapsed_ms": payload.elapsed_ms,
        "moves": payload.moves, "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
        "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
        "completed_at": completed_at,
    })


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

    # Each actual completion is stored as one coherent run. Leaderboards never mix a fast hinted
    # attempt with a slower clean attempt into an impossible synthetic record.
    try:
        record_puzzle_run(player["id"], payload, effective_clean)
    except HTTPException:
        logger.warning("Could not store puzzle run for %s", payload.attempt_id)

    official_completed_at = payload_completed_at(payload.completed_at)
    existing = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)
    if existing:
        old = existing[0]
        # Daily i volná úloha mají stejnou soutěžní zásadu: oficiální je PRVNÍ dokončení.
        # Replay se ukládá do puzzle_runs pro telemetry, ale nesmí zlepšit čas/Clean/hinty.
        # Jediná výjimka je opožděná offline synchronizace skutečně staršího dokončení.
        try:
            incoming_is_earlier = completion_time({"completed_at": official_completed_at}) < completion_time(old)
        except Exception:
            incoming_is_earlier = False
        if incoming_is_earlier:
            db_update("results", {"id": old["id"]}, {
                "best_elapsed_ms": payload.elapsed_ms, "best_moves": payload.moves,
                "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
                "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
                "completed_at": official_completed_at,
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
                "completed_at": official_completed_at,
            })
            first = True
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            # Současné odeslání ze dvou zařízení: zachovej chronologicky první dokončení.
            old = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)[0]
            if completion_time({"completed_at": official_completed_at}) < completion_time(old):
                db_update("results", {"id": old["id"]}, {
                    "best_elapsed_ms": payload.elapsed_ms, "best_moves": payload.moves,
                    "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
                    "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
                    "completed_at": official_completed_at,
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
                    "started_at": datetime.now(TZ).isoformat(), "app_version": "3.7-offline", **telemetry_values,
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



def _daily_individual_score(row: dict, day_rows: list[dict]) -> float:
    """0–100. Completion 55, clean 15, hints up to 10, relative speed up to 20."""
    elapsed = int(row.get("best_elapsed_ms") or 86_400_000)
    hints = int(row.get("hints_used") or 0)
    clean = row.get("clean_solve") is True
    completion = 55.0
    clean_bonus = 15.0 if clean else 0.0
    hint_bonus = max(0.0, 10.0 - 3.0 * hints)
    times = sorted(int(r.get("best_elapsed_ms") or 86_400_000) for r in day_rows)
    if len(times) <= 1:
        speed_bonus = 10.0
    else:
        # Equal times receive the same best-position percentile.
        rank0 = next((i for i, value in enumerate(times) if value >= elapsed), len(times) - 1)
        percentile = 1.0 - (rank0 / (len(times) - 1))
        speed_bonus = max(0.0, min(20.0, percentile * 20.0))
    return round(min(100.0, completion + clean_bonus + hint_bonus + speed_bonus), 1)


def _family_league_week(week_offset: int = 0) -> dict:
    today = current_prague_date()
    current_week = today - timedelta(days=today.weekday())
    week_start = current_week + timedelta(days=7 * week_offset)
    week_end = week_start + timedelta(days=7)
    dates = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]

    leagues = [r for r in db_select("leagues") if r.get("public_opt_in") is True]
    players = db_select("players")
    player_by_id = {p["id"]: p for p in players}
    members_by_family: dict[str, list[dict]] = {}
    for p in players:
        members_by_family.setdefault(norm_family(str(p.get("family_code") or "")), []).append(p)

    daily_results = db_select("results", mode="daily")
    daily_results = [r for r in daily_results if str(r.get("daily_date") or "")[:10] in dates]
    rows_by_day: dict[str, list[dict]] = {d: [] for d in dates}
    for r in daily_results:
        d = str(r.get("daily_date") or "")[:10]
        if d in rows_by_day:
            rows_by_day[d].append(r)

    standings = []
    for league in leagues:
        family = norm_family(str(league.get("code") or ""))
        members = members_by_family.get(family, [])
        member_ids = {p["id"] for p in members}
        member_count = len(members)
        eligible = member_count >= 2
        try:
            enabled_date = datetime.fromisoformat(str(league.get("public_enabled_at") or "").replace("Z", "+00:00")).astimezone(TZ).date()
        except Exception:
            enabled_date = week_start
        # A team that joined later must not appear retroactively in older weeks.
        if enabled_date >= week_end:
            continue
        daily_scores = []
        participation_days = 0
        total_completions = 0
        for d in dates:
            world_rows = rows_by_day[d]
            day_date = date.fromisoformat(d)
            day_members = []
            for member in members:
                try:
                    created = datetime.fromisoformat(str(member.get("created_at") or "").replace("Z", "+00:00")).astimezone(TZ).date()
                except Exception:
                    created = date.min
                if created <= day_date:
                    day_members.append(member)
            day_ids = {m["id"] for m in day_members}
            denominator = min(3, len(day_members)) if day_members else 1
            day_eligible = len(day_members) >= 2 and day_date >= enabled_date
            own_rows = [r for r in world_rows if r.get("player_id") in day_ids and day_date >= enabled_date]
            scored = sorted((_daily_individual_score(r, world_rows) for r in own_rows), reverse=True)
            top = scored[:3]
            score = round(sum(top) / denominator, 1) if day_eligible else 0.0
            if own_rows:
                participation_days += 1
                total_completions += len(own_rows)
            daily_scores.append({"date": d, "score": score, "players": min(len(own_rows), 3)})
        weekly_score = round(sum(x["score"] for x in daily_scores), 1)
        if eligible:
            standings.append({
                "familyCode": family,
                "name": league.get("public_name") or league.get("name") or family,
                "score": weekly_score,
                "memberCount": member_count,
                "daysPlayed": participation_days,
                "daily": daily_scores,
                "completions": total_completions,
            })
    standings.sort(key=lambda x: (-x["score"], -x["daysPlayed"], -x["completions"], str(x["name"]).casefold()))
    for i, item in enumerate(standings, 1):
        item["rank"] = i
    return {
        "weekStart": week_start.isoformat(), "weekEnd": (week_end - timedelta(days=1)).isoformat(),
        "weekOffset": week_offset, "maxScore": 700, "standings": standings,
        "scoring": {"completion": 55, "clean": 15, "hints": 10, "speed": 20, "teamSlots": 3},
    }


@app.get("/api/family-league")
def family_league(
    week_offset: int = Query(default=0, ge=-12, le=0),
    authorization: Optional[str] = Header(default=None),
):
    data = _family_league_week(week_offset)
    my_family = None
    if authorization:
        try:
            player = auth_player(authorization)
            family = norm_family(str(player.get("family_code") or ""))
            league_rows = db_select("leagues", code=family)
            members = db_select("players", family_code=family)
            league = league_rows[0] if league_rows else {}
            mine = next((r for r in data["standings"] if r["familyCode"] == family), None)
            my_family = {
                "familyCode": family,
                "leagueName": league.get("name") or family,
                "publicName": league.get("public_name") or league.get("name") or family,
                "enabled": league.get("public_opt_in") is True,
                "hasPin": bool(league.get("pin_hash")),
                "memberCount": len(members),
                "eligible": len(members) >= 2,
                "rank": mine.get("rank") if mine else None,
                "score": mine.get("score") if mine else 0,
            }
        except HTTPException:
            pass
    public_rows = []
    my_code = my_family.get("familyCode") if my_family else None
    for row in data["standings"]:
        clean = {k: v for k, v in row.items() if k != "familyCode"}
        clean["isMine"] = bool(my_code and row.get("familyCode") == my_code)
        public_rows.append(clean)
    if my_family:
        my_family = {k: v for k, v in my_family.items() if k != "familyCode"}
    return {**data, "standings": public_rows, "myFamily": my_family}


@app.post("/api/family-league/settings")
def family_league_settings(payload: FamilyLeagueSettings, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    family = norm_family(str(player.get("family_code") or ""))
    rows = db_select("leagues", code=family)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    league = rows[0]
    # Každý přihlášený člen rodiny má stejná práva k veřejnému nastavení týmu.
    # PIN zůstává pouze jako sdílené pozvání při vytváření NOVÉHO hráče v existující lize.
    values = {"public_opt_in": bool(payload.enabled)}
    if payload.enabled:
        public_name = " ".join((payload.public_name or league.get("name") or family).strip().split())[:40]
        if len(public_name) < 2:
            raise HTTPException(400, "Zadej veřejný název týmu")
        values["public_name"] = public_name
        if league.get("public_opt_in") is not True:
            values["public_enabled_at"] = datetime.now(TZ).isoformat()
    db_update("leagues", {"code": family}, values)
    return {"ok": True, "enabled": bool(payload.enabled), "publicName": values.get("public_name") or league.get("public_name") or league.get("name") or family}


@app.get("/api/puzzle-leaderboard")
def puzzle_leaderboard(
    puzzle_id: str = Query(min_length=2, max_length=80),
    family_code: str = Query(min_length=2, max_length=24),
):
    family = norm_family(family_code)
    players = db_select("players", family_code=family)
    pmap = {p["id"]: p for p in players}
    rows = [r for r in db_select("puzzle_runs", puzzle_id=puzzle_id) if r.get("player_id") in pmap]
    first: dict[str, dict] = {}
    for r in rows:
        pid = r["player_id"]
        if pid not in first or first_run_key(r) < first_run_key(first[pid]):
            first[pid] = r
    # Pořadí srovnává první dokončení každého hráče; replay už výsledek nikdy nezlepší.
    ranked = sorted(first.values(), key=lambda r: (*run_rank_tuple(r), pmap[r["player_id"]]["name"].casefold()))
    board = []
    for i, r in enumerate(ranked, 1):
        board.append({
            "rank": i, "id": r["player_id"], "name": pmap[r["player_id"]]["name"], "avatar": pmap[r["player_id"]].get("avatar") or "🙂",
            "elapsedMs": int(r["elapsed_ms"]), "moves": int(r["moves"]),
            "hintsUsed": int(r.get("hints_used") or 0), "wrongAttempts": int(r.get("wrong_attempts") or 0),
            "cleanSolve": r.get("clean_solve") is True, "completedAt": r.get("completed_at"),
        })
    info = puzzle_info(puzzle_id)
    return {"familyCode": family, "puzzleId": puzzle_id, "difficulty": info.get("difficulty") if info else None, "level": info.get("level") if info else None, "rows": board}


@app.get("/api/played-levels")
def played_levels(
    difficulty: str = Query(min_length=3, max_length=20),
    authorization: Optional[str] = Header(default=None),
):
    player = auth_player(authorization)
    data = load_puzzles()
    bank = sorted(data.get("free", {}).get(difficulty, []), key=lambda p: int((p.get("meta") or {}).get("level") or 9999))
    active = {p["id"]: p for p in bank}
    runs = [r for r in db_select("puzzle_runs", player_id=player["id"]) if r.get("mode") == "free" and r.get("difficulty") == difficulty and r.get("puzzle_id") in active]
    grouped: dict[str, list[dict]] = {}
    for r in runs:
        grouped.setdefault(r["puzzle_id"], []).append(r)
    items = []
    for p in bank:
        vals = grouped.get(p["id"], [])
        if not vals:
            continue
        first = min(vals, key=first_run_key)
        items.append({
            "puzzleId": p["id"], "level": int((p.get("meta") or {}).get("level") or 0),
            "elapsedMs": int(first["elapsed_ms"]), "moves": int(first["moves"]),
            "hintsUsed": int(first.get("hints_used") or 0), "wrongAttempts": int(first.get("wrong_attempts") or 0),
            "cleanSolve": first.get("clean_solve") is True, "attempts": len(vals), "completedAt": first.get("completed_at"),
        })
    return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "levels": items}


@app.get("/api/push/config")
def push_config():
    return {"available": push_ready(), "publicKey": VAPID_PUBLIC_KEY if push_ready() else None}


@app.post("/api/push/subscribe")
def push_subscribe(payload: PushSubscriptionCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    if not push_ready():
        raise HTTPException(503, "Push notifikace ještě nejsou na serveru nakonfigurované")
    existing = db_select("push_subscriptions", endpoint=payload.endpoint)
    row = {"player_id": player["id"], "p256dh": payload.p256dh, "auth": payload.auth, "user_agent": payload.user_agent, "updated_at": datetime.now(TZ).isoformat()}
    if existing:
        db_update("push_subscriptions", {"id": existing[0]["id"]}, row)
    else:
        db_insert("push_subscriptions", {"id": str(uuid.uuid4()), "endpoint": payload.endpoint, "created_at": datetime.now(TZ).isoformat(), **row})
    return {"ok": True}


@app.post("/api/push/unsubscribe")
def push_unsubscribe(payload: PushUnsubscribe, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    rows = db_select("push_subscriptions", endpoint=payload.endpoint)
    for row in rows:
        if row.get("player_id") == player["id"]:
            db_delete("push_subscriptions", id=row["id"])
    return {"ok": True}


@app.get("/api/cron/daily-push")
def cron_daily_push(request: Request, authorization: Optional[str] = Header(default=None)):
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(401, "Neplatné cron oprávnění")
    today = current_prague_date().isoformat()
    snapshot = save_quality_snapshot_if_monday()
    if not push_ready():
        return {"ok": False, "sent": 0, "message": "VAPID není nakonfigurovaný", "qualitySnapshot": snapshot}
    completed = {r.get("player_id") for r in db_select("results", mode="daily", daily_date=today)}
    subscriptions = db_select("push_subscriptions")
    sent = failed = removed = 0
    payload = json.dumps({
        "title": "☀️ Nový Proplet je tady",
        "body": "Dnešní výzva čeká. Propleteš ji čistě?",
        "url": "/?open=daily", "tag": f"proplet-daily-{today}"
    }, ensure_ascii=False)
    for sub in subscriptions:
        if sub.get("player_id") in completed:
            continue
        info = {"endpoint": sub.get("endpoint"), "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")}}
        try:
            webpush(subscription_info=info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=43200)
            sent += 1
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Push failed for subscription %s: %s", sub.get("id"), exc)
    return {"ok": True, "date": today, "sent": sent, "failed": failed, "removed": removed, "qualitySnapshot": snapshot}


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
        overall.append({"id": p["id"], "name": p["name"], "avatar": p.get("avatar") or "🙂", **stats})
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
            "id": p["id"], "name": p["name"], "avatar": p.get("avatar") or "🙂", "points": sum(int(r.get("points") or 0) for r in rows),
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
            "avatar": player_map[r["player_id"]].get("avatar") or "🙂",
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
