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
from functools import lru_cache
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

app = FastAPI(title="Proplet API", version="3.20.1-cloud")
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
    # v3.20: team is optional. Keeping these fields preserves older cached clients.
    family_code: Optional[str] = Field(default=None, max_length=24)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    league_pin: Optional[str] = Field(default=None, max_length=32)
    create_league: bool = False
    league_name: Optional[str] = Field(default=None, max_length=40)


class PlayerLogin(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    # New accounts log in with name + password. Team remains an optional
    # disambiguator for legacy duplicate names.
    family_code: Optional[str] = Field(default=None, max_length=24)
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


class ProductEventCreate(BaseModel):
    event_type: str = Field(min_length=2, max_length=40)


class TeamPinSet(BaseModel):
    pin: str = Field(min_length=4, max_length=32)


class TeamMembershipSet(BaseModel):
    mode: str = Field(pattern="^(join|new)$")
    family_code: Optional[str] = Field(default=None, max_length=24)
    league_pin: str = Field(min_length=4, max_length=32)
    league_name: Optional[str] = Field(default=None, max_length=40)


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


class AttemptFinishTelemetry(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    elapsed_ms: int = Field(ge=1000, le=86_400_000)
    moves: int = Field(ge=1, le=10000)
    hints_used: int = Field(default=0, ge=0, le=99)
    wrong_attempts: int = Field(default=0, ge=0, le=999)
    max_hint_level: int = Field(default=0, ge=0, le=3)
    clean_solve: bool = False
    completed_at: Optional[str] = Field(default=None, max_length=40)


class AnonymousClaim(BaseModel):
    anonymous_id: str = Field(min_length=16, max_length=100)


class FeedbackCreate(BaseModel):
    puzzle_id: str
    challenge_key: str
    kind: str
    rating: Optional[int] = Field(default=None, ge=-1, le=1)
    word: Optional[str] = Field(default=None, max_length=80)
    note: Optional[str] = Field(default=None, max_length=300)


class AdminReportUpdate(BaseModel):
    status: str = Field(min_length=3, max_length=20)
    resolution_note: Optional[str] = Field(default=None, max_length=500)


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


def db_select_all(table: str, **filters):
    """Read complete analytics/admin datasets past PostgREST's 1,000-row page."""
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        params = {"select": "*", "limit": str(page_size), "offset": str(offset)}
        for key, value in filters.items():
            if value is not None:
                params[key] = f"eq.{value}"
        page = db_request("GET", table, params=params)
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


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
    code = "".join(ch for ch in str(code or "").upper().strip() if ch.isalnum() or ch in "-_ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ")
    return code[:24]


SOLO_FAMILY_PREFIX = "SOLO_"


def is_solo_family(code: Optional[str], team_joined_at: Optional[str] = None) -> bool:
    # Prefix marks our internal compatibility namespace; team_joined_at protects
    # any pre-existing real team that could coincidentally have a similar code.
    return not team_joined_at and norm_family(str(code or "")).startswith(SOLO_FAMILY_PREFIX)


def is_solo_player(player: dict) -> bool:
    return is_solo_family(player.get("family_code"), player.get("team_joined_at"))


def public_family_code(code: Optional[str], team_joined_at: Optional[str] = None) -> Optional[str]:
    normalized = norm_family(str(code or ""))
    return None if not normalized or is_solo_family(normalized, team_joined_at) else normalized


def public_team_name(code: Optional[str], team_joined_at: Optional[str] = None) -> Optional[str]:
    family = public_family_code(code, team_joined_at)
    return league_name_for(family) if family else None


def league_name_for(code: str) -> str:
    normalized = norm_family(code)
    try:
        rows = db_select("leagues", code=normalized)
        return rows[0].get("name") or normalized if rows else normalized
    except HTTPException:
        return normalized

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


def require_admin(authorization: Optional[str], *, write: bool = False) -> dict:
    """Authenticate a player and then require an independent admin grant.

    Admin rights deliberately live outside the player row. Team membership, a
    guessed URL or an ordinary authenticated session can never grant access by
    itself. The first owner is created by the v3.17 migration.
    """
    player = auth_player(authorization)
    try:
        rows = db_select("admin_accounts", player_id=player["id"])
    except HTTPException as exc:
        raise HTTPException(403, "Administrace ještě není aktivovaná. Spusť migraci v3.17.") from exc
    rows = [row for row in rows if row.get("active") is True]
    if not rows:
        raise HTTPException(403, "Tento hráč nemá přístup do administrace")
    account = rows[0]
    role = str(account.get("role") or "viewer")
    if write and role not in ("owner", "editor"):
        raise HTTPException(403, "Toto administrátorské oprávnění je pouze pro čtení")
    return {"player": player, "account": account, "role": role}


def record_admin_audit(admin: dict, action: str, target_type: str, target_id: Optional[str], details: Optional[dict] = None) -> None:
    db_insert("admin_audit_log", {
        "id": str(uuid.uuid4()),
        "admin_player_id": admin["player"]["id"],
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "created_at": datetime.now(TZ).isoformat(),
    })


def anonymous_hash(raw: Optional[str]) -> Optional[str]:
    """Return a non-reversible installation identifier for anonymous telemetry.

    The browser keeps a random UUID; the database only sees this SHA-256 digest.
    It is not derived from IP, device model, user agent or any other fingerprint.
    """
    if not raw:
        return None
    value = raw.strip()
    if len(value) < 16 or len(value) > 100:
        raise HTTPException(400, "Neplatné anonymní ID")
    return hashlib.sha256(("proplet-anon-v1:" + value).encode("utf-8")).hexdigest()


def telemetry_actor(authorization: Optional[str], anonymous_id: Optional[str]) -> dict:
    if authorization and authorization.startswith("Bearer "):
        player = auth_player(authorization)
        return {"player": player, "player_id": player["id"], "anonymous_id": None, "actor_key": f"p:{player['id']}"}
    anon = anonymous_hash(anonymous_id)
    if anon:
        return {"player": None, "player_id": None, "anonymous_id": anon, "actor_key": f"a:{anon}"}
    raise HTTPException(401, "Chybí identita telemetry")


def actor_filters(actor: dict) -> dict:
    return {"player_id": actor["player_id"]} if actor.get("player_id") else {"anonymous_id": actor["anonymous_id"]}


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
    free_history = {k: 0 for k in ("easy", "medium", "hard", "hardcore")}
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

        if mode == "free" and difficulty in free_history:
            free_history[difficulty] += 1

    free_slots = free_slot_summary(rows)

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
        # Effective progress is a union of level slots across content generations.
        # A Gen1 level and its Gen2 replacement therefore count once, while every
        # actual historical result remains available in the history.
        "freeCompleted": free_slots["effective"],
        "freeTransferred": free_slots["transferred"],
        "freePlayedGen2": free_slots["gen2"],
        "freeHistoryCompleted": free_history,
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
            # Since v3.19 the rescue clock measures active play, not wall time.
            # Leaving the PWA therefore cannot silently consume the attempt.
            elapsed_ms = max(0, int(existing.get("elapsed_ms") or 0))
            return {
                "eligible": True, "state": "started", "missedDate": target,
                "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
                "timeLimitMs": 30000, "secondsRemaining": max(0, round((30000 - elapsed_ms) / 1000, 1)),
            }
        return {
            "eligible": False, "state": status or "failed", "missedDate": target,
            "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
        }

    eligible = target not in effective and before.isoformat() in effective and prior_streak > 0
    return {
        "eligible": eligible, "state": "available" if eligible else "none",
        "missedDate": target if eligible else None, "priorStreak": prior_streak if eligible else 0,
    }

@lru_cache(maxsize=1)
def load_puzzles() -> dict:
    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))


def free_puzzle_info(puzzle_id: str, difficulty: Optional[str] = None) -> Optional[dict]:
    """Resolve a Free puzzle to its generation and stable difficulty/level slot."""
    data = load_puzzles()
    difficulties = (difficulty,) if difficulty in ("easy", "medium", "hard", "hardcore") else ("easy", "medium", "hard", "hardcore")
    for diff in difficulties:
        for index, puzzle in enumerate(data.get("free", {}).get(diff, []), start=1):
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {
                    "puzzle": puzzle, "difficulty": diff, "mode": "free",
                    "level": int(meta.get("level") or index),
                    "generation": int(meta.get("contentGeneration") or data.get("freeGeneration") or 1),
                    "legacy": False,
                }
    # Newest archived bank is appended last. This is the best possible mapping for
    # a handful of IDs that had already been reused before Gen2 introduced unique IDs.
    for diff in difficulties:
        bank = data.get("legacyFree", {}).get(diff, [])
        for index in range(len(bank) - 1, -1, -1):
            puzzle = bank[index]
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {
                    "puzzle": puzzle, "difficulty": diff, "mode": "free",
                    "level": int(meta.get("level") or index + 1),
                    "generation": int(meta.get("contentGeneration") or 1),
                    "legacy": True,
                }
    return None


def free_slot_summary(rows: list[dict]) -> dict[str, dict[str, int]]:
    difficulties = ("easy", "medium", "hard", "hardcore")
    puzzle_data = load_puzzles()
    maximum_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) for key in difficulties}
    legacy_slots = {key: set() for key in difficulties}
    gen2_slots = {key: set() for key in difficulties}
    for row in rows:
        if row.get("mode") != "free" or row.get("difficulty") not in legacy_slots:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), str(row.get("difficulty") or ""))
        if not info or not 1 <= int(info["level"]) <= maximum_levels.get(info["difficulty"], 0):
            continue
        target = gen2_slots if int(info["generation"]) >= 2 else legacy_slots
        target[info["difficulty"]].add(int(info["level"]))
    return {
        "effective": {key: len(legacy_slots[key] | gen2_slots[key]) for key in difficulties},
        "transferred": {key: len(legacy_slots[key] - gen2_slots[key]) for key in difficulties},
        "gen2": {key: len(gen2_slots[key]) for key in difficulties},
    }


def free_slot_already_rewarded(player_id: str, difficulty: str, level: int) -> bool:
    for row in db_select("results", player_id=player_id):
        if row.get("mode") != "free" or row.get("difficulty") != difficulty or int(row.get("points") or 0) <= 0:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if info and int(info["level"]) == int(level):
            return True
    return False


def claim_free_slot_points(player_id: str, info: dict, points: int, puzzle_id: str) -> tuple[int, bool]:
    """Award XP once per difficulty/level slot, across all content generations.

    The v3.16 table supplies a concurrency-safe unique constraint. During a
    rolling deployment without that migration, result-history lookup remains a
    safe compatibility fallback (apart from a very narrow simultaneous race).
    """
    difficulty, level = info["difficulty"], int(info["level"])
    historical_reward = free_slot_already_rewarded(player_id, difficulty, level)
    try:
        claimed = db_select("free_slot_rewards", player_id=player_id, difficulty=difficulty, level=level)
        if claimed:
            return 0, True
        db_insert("free_slot_rewards", {
            "id": str(uuid.uuid4()), "player_id": player_id, "difficulty": difficulty,
            "level": level, "source_puzzle_id": puzzle_id,
            "content_generation": int(info.get("generation") or 1),
            "points": 0 if historical_reward else int(points),
            "earned_at": datetime.now(TZ).isoformat(),
        })
        return (0, True) if historical_reward else (int(points), False)
    except HTTPException as exc:
        if exc.status_code == 409:
            return 0, True
        logger.warning("free_slot_rewards unavailable; using result-history fallback: %s", exc.detail)
        return (0, True) if historical_reward else (int(points), False)


def daily_rotation_index(daily_date: str, bank_size: int) -> int:
    if bank_size <= 0:
        raise HTTPException(503, "Daily banka je prázdná")
    try:
        d = date.fromisoformat(daily_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    return (d - date(2026, 1, 1)).days % bank_size


def legacy_daily_banks(data: Optional[dict] = None) -> list[dict]:
    pdata = data or load_puzzles()
    return [bank for bank in pdata.get("legacyDaily", []) if bank.get("puzzles")]


def expected_daily_puzzle_id(daily_date: str) -> str:
    """Return the primary board for a date without rewriting historical Daily."""
    data = load_puzzles()
    try:
        d = date.fromisoformat(daily_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    switch_raw = data.get("dailyGeneration2From")
    try:
        switch = date.fromisoformat(str(switch_raw)) if switch_raw else date.min
    except ValueError:
        switch = date.min
    if d < switch:
        banks = legacy_daily_banks(data)
        if banks:
            bank = banks[-1]["puzzles"]
            return bank[daily_rotation_index(daily_date, len(bank))]["id"]
    bank = data.get("daily", [])
    return bank[daily_rotation_index(daily_date, len(bank))]["id"]


def valid_daily_puzzle_ids(daily_date: str) -> set[str]:
    """Accept the active board plus archived rotations for cached/offline clients."""
    data = load_puzzles()
    ids = {data["daily"][daily_rotation_index(daily_date, len(data.get("daily", [])))]["id"]}
    for legacy_bank in legacy_daily_banks(data):
        bank = legacy_bank["puzzles"]
        ids.add(bank[daily_rotation_index(daily_date, len(bank))]["id"])
    return ids


def daily_puzzle_matches_date(puzzle_id: str, daily_date: str) -> bool:
    return puzzle_id in valid_daily_puzzle_ids(daily_date)


def is_daily_generation_upgrade(old: dict, payload: ResultCreate) -> bool:
    """True only when an archived Daily result is replaced by that day's primary board."""
    return bool(
        payload.mode == "daily"
        and payload.daily_date
        and old.get("puzzle_id") != payload.puzzle_id
        and payload.puzzle_id == expected_daily_puzzle_id(payload.daily_date)
    )


def puzzle_exists(puzzle_id: str, mode: str, difficulty: str) -> bool:
    data = load_puzzles()
    if mode == "daily":
        active = any(p["id"] == puzzle_id and p["difficulty"] == difficulty for p in data.get("daily", []))
        archived = any(
            p.get("id") == puzzle_id and p.get("difficulty") == difficulty
            for bank in legacy_daily_banks(data) for p in bank["puzzles"]
        )
        return active or archived
    if any(p["id"] == puzzle_id for p in data["free"].get(difficulty, [])):
        return True
    # Keep queued results from older Hard banks syncable after the v3.3 puzzle upgrade.
    return any(p["id"] == puzzle_id for p in data.get("legacyFree", {}).get(difficulty, []))


@app.get("/")
def home():
    return RedirectResponse(url="/index.html", status_code=307)


@app.get("/admin")
@app.get("/admin/")
def admin_home():
    # Vercel serves files from public/ through its static CDN; they are not
    # necessarily present inside the isolated Python function at /var/task.
    # Redirecting keeps /admin convenient without coupling it to that runtime.
    return RedirectResponse(url="/admin.html", status_code=307)


@app.get("/api/health")
def health():
    puzzle_file = PUZZLES_PATH.exists()
    pdata = load_puzzles() if puzzle_file else {}
    base = {
        "date": current_prague_date().isoformat(),
        "puzzleFile": puzzle_file,
        "puzzleSource": "data/puzzles.json",
        "version": "3.20.1",
        "adminStatic": True,
        "adminEntry": "/admin.html",
        "adminDelivery": "vercel-public-static",
        "vocabularyVersion": pdata.get("lexiconVersion") or pdata.get("vocabularyVersion"),
        "vocabularyTierCounts": pdata.get("vocabularyTierCounts"),
        "freeGeneration": pdata.get("freeGeneration"),
        "freeLevelsPerDifficulty": pdata.get("freeLevelsPerDifficulty") or min((len(bank) for bank in pdata.get("free", {}).values()), default=0),
        "dailyGeneration": pdata.get("dailyGeneration"),
        "dailyGeneration2From": pdata.get("dailyGeneration2From"),
        "dailyMigration": pdata.get("dailyMigration"),
        "freeMigration": pdata.get("freeMigration"),
        "tieredDailyFrom": pdata.get("tieredDailyFrom"),
        "freeTieredFromVersion": pdata.get("freeTieredFromVersion"),
        "freeFreezeCutoffs": pdata.get("freeFreezeCutoffs"),
        "uxSprint": "3.20",
        "accountWithoutTeam": True,
        "accountNudgeCompletions": [1, 4, 10],
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
        ux_migration = True
        try:
            db_request("GET", "players", params={"select": "id,team_joined_at", "limit": "1"})
        except HTTPException:
            ux_migration = False
        analytics_v2_migration = True
        try:
            db_request("GET", "players", params={"select": "id,support_mode", "limit": "1"})
            db_request("GET", "helper_events", params={"select": "id", "limit": "1"})
            db_request("GET", "hint_events", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_attempts", params={"select": "id,first_correct_ms,first_hint_ms,reset_count,resume_count,last_found_words,last_activity_at", "limit": "1"})
            db_request("GET", "quality_snapshots", params={"select": "id,week_start", "limit": "1"})
        except HTTPException:
            analytics_v2_migration = False
        anonymous_analytics_migration = True
        try:
            db_request("GET", "puzzle_attempts", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "helper_events", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "hint_events", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "product_events", params={"select": "id,anonymous_id,event_type", "limit": "1"})
        except HTTPException:
            anonymous_analytics_migration = False
        free_generation2_migration = True
        try:
            db_request("GET", "free_slot_rewards", params={"select": "id,level,content_generation", "limit": "1"})
        except HTTPException:
            free_generation2_migration = False
        admin_migration = True
        try:
            db_request("GET", "admin_accounts", params={"select": "player_id,role,active", "limit": "1"})
            db_request("GET", "admin_audit_log", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id,status,resolution_note,reviewed_at,reviewed_by", "limit": "1"})
        except HTTPException:
            admin_migration = False
        return {**base, "ok": True, "database": True, "accountMigration": account_migration, "featuresMigration": features_migration, "qualityMigration": quality_migration, "playtestMigration": playtest_migration, "globalLeagueMigration": global_league_migration, "uxMigration": ux_migration, "profilesMigration": profiles_migration, "analyticsV2Migration": analytics_v2_migration, "anonymousAnalyticsMigration": anonymous_analytics_migration, "anonymousAnalytics": anonymous_analytics_migration, "freeGeneration2Migration": free_generation2_migration, "adminMigration": admin_migration, "helperSystem": analytics_v2_migration, "pushConfigured": push_ready(), "cronConfigured": bool(CRON_SECRET)}
    except HTTPException as exc:
        return {**base, "ok": False, "database": False, "accountMigration": False, "featuresMigration": False, "qualityMigration": False, "playtestMigration": False, "globalLeagueMigration": False, "uxMigration": False, "profilesMigration": False, "analyticsV2Migration": False, "anonymousAnalyticsMigration": False, "anonymousAnalytics": False, "freeGeneration2Migration": False, "adminMigration": False, "pushConfigured": push_ready(), "message": exc.detail}


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
        "version": "3.20.1",
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
    requested_family = norm_family(payload.family_code or "")
    solo = len(requested_family) < 2
    family = requested_family if not solo else f"{SOLO_FAMILY_PREFIX}{secrets.token_hex(6).upper()}"
    if not name:
        raise HTTPException(400, "Vyplň jméno")
    if solo and not payload.password:
        raise HTTPException(400, "Nový účet potřebuje heslo")

    if not solo:
        league_rows = db_select("leagues", code=family)
        if payload.create_league:
            display_name = " ".join((payload.league_name or payload.family_code or "").strip().split())[:40]
            if league_rows:
                raise HTTPException(409, "Tým s tímto názvem už existuje. Přidej se k němu místo zakládání nového.")
            if not payload.league_pin or len(payload.league_pin.strip()) < 4:
                raise HTTPException(400, "Nový tým potřebuje PIN alespoň 4 znaky")
            db_insert("leagues", {"code": family, "name": display_name or family, "pin_hash": hash_password(payload.league_pin.strip()), "created_at": datetime.now(TZ).isoformat()})
            league_rows = db_select("leagues", code=family)
        elif not league_rows:
            # Backward compatibility for cached pre-v3.20 clients.
            db_insert("leagues", {"code": family, "name": family, "created_at": datetime.now(TZ).isoformat()})
            league_rows = db_select("leagues", code=family)
        else:
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
    if not solo:
        row["team_joined_at"] = now
    if payload.password:
        row["password_hash"] = hash_password(payload.password)

    try:
        db_insert("players", row)
    except HTTPException as exc:
        if exc.status_code == 409:
            raise HTTPException(409, "Takový hráč už existuje")
        raise

    stats = player_stats(player_id)
    public_family = public_family_code(family, row.get("team_joined_at"))
    return {
        "id": player_id, "name": name, "familyCode": public_family,
        "leagueName": league_name_for(family) if public_family else None, "token": token,
        "hasPassword": bool(payload.password), "avatar": row.get("avatar") or "🙂", "supportMode": row.get("support_mode") or "none", "stats": stats,
    }


@app.post("/api/login")
def login(payload: PlayerLogin):
    family = norm_family(payload.family_code or "")
    name = " ".join(payload.name.strip().split())
    if family:
        candidates = [p for p in db_select("players", family_code=family) if p.get("name", "").casefold() == name.casefold()]
    else:
        # Teamless login is intentionally simple for the player. We only use
        # team when an old duplicate name needs disambiguation.
        candidates = [p for p in db_select("players") if p.get("name", "").casefold() == name.casefold()]

    if not candidates:
        raise HTTPException(401, "Jméno nebo heslo nesedí")
    password_matches = [p for p in candidates if p.get("password_hash") and verify_password(payload.password, p.get("password_hash"))]
    if not password_matches:
        if len(candidates) == 1 and not candidates[0].get("password_hash"):
            raise HTTPException(409, "Tento hráč ještě nemá heslo. Nastav ho na zařízení, kde už je přihlášený.")
        raise HTTPException(401, "Jméno nebo heslo nesedí")
    if len(password_matches) > 1 and not family:
        raise HTTPException(409, "Našli jsme více účtů se stejným jménem. Otevři volbu pro starší týmový účet a vyber svůj tým.")
    player = password_matches[0]

    token = new_session(player["id"])
    public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"], "name": player["name"], "familyCode": public_family,
        "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
        "token": token, "hasPassword": True, "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": player_stats(player["id"]),
    }


@app.post("/api/anonymous/claim")
def claim_anonymous(payload: AnonymousClaim, authorization: Optional[str] = Header(default=None)):
    """Attach anonymous telemetry from this installation to the newly authenticated player.

    This prevents one person from being counted twice after creating/logging into an account.
    Official results, XP and leaderboards are never created here; only QA telemetry is reassigned.
    """
    player = auth_player(authorization)
    anon = anonymous_hash(payload.anonymous_id)
    if not anon:
        raise HTTPException(400, "Chybí anonymní ID")
    claimed = {"attempts": 0, "helperEvents": 0, "hintEvents": 0, "productEvents": 0, "feedback": 0}
    for table, key in (("puzzle_attempts", "attempts"), ("helper_events", "helperEvents"), ("hint_events", "hintEvents"), ("product_events", "productEvents")):
        rows = db_select(table, anonymous_id=anon)
        if rows:
            db_update(table, {"anonymous_id": anon}, {"player_id": player["id"], "anonymous_id": None})
            claimed[key] = len(rows)
    # Feedback has a unique player/puzzle/kind constraint. Merge row-by-row so an existing
    # authenticated vote wins over a duplicate anonymous vote rather than making claim fail.
    for row in db_select("puzzle_feedback", anonymous_id=anon):
        candidates = db_select("puzzle_feedback", player_id=player["id"], puzzle_id=row.get("puzzle_id"), kind=row.get("kind"))
        if row.get("kind") == "word":
            report_word = str(row.get("word") or "").strip().casefold()
            existing = [candidate for candidate in candidates if str(candidate.get("word") or "").strip().casefold() == report_word]
        else:
            existing = candidates
        if existing:
            db_delete("puzzle_feedback", id=row["id"])
        else:
            db_update("puzzle_feedback", {"id": row["id"]}, {"player_id": player["id"], "anonymous_id": None})
        claimed["feedback"] += 1
    return {"ok": True, "claimed": claimed}


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


def _telemetry_attempt(actor: dict, attempt_id: str, puzzle_id: str, challenge_key: str) -> Optional[dict]:
    filters = {"id": attempt_id, **actor_filters(actor)}
    rows = db_select("puzzle_attempts", **filters)
    if not rows:
        return None
    row = rows[0]
    if row.get("puzzle_id") != puzzle_id or row.get("challenge_key") != challenge_key:
        raise HTTPException(400, "Telemetry neodpovídá pokusu")
    return row


@app.post("/api/helper-event")
def helper_event(
    payload: HelperEventCreate,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed_events = {"offered", "accepted", "dismissed"}
    if payload.event_type not in allowed_events:
        raise HTTPException(400, "Neplatný helper event")
    if not _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    player = actor.get("player")
    support_mode = (player or {}).get("support_mode") or "none"
    db_insert("helper_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "attempt_id": payload.attempt_id, "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "event_type": payload.event_type, "support_mode": support_mode,
        "elapsed_ms": payload.elapsed_ms, "idle_ms": payload.idle_ms,
        "found_words": payload.found_words, "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/hint-event")
def hint_event(
    payload: HintEventCreate,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if payload.source not in {"manual", "helper"}:
        raise HTTPException(400, "Neplatný zdroj nápovědy")
    if not _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    player = actor.get("player")
    support_mode = (player or {}).get("support_mode") or "none"
    af = actor_filters(actor)
    previous_hints = db_select("hint_events", attempt_id=payload.attempt_id, **af)
    sibling_attempts = db_select("puzzle_attempts", challenge_key=payload.challenge_key, **af)
    first_attempt_id = None
    if sibling_attempts:
        first_attempt_id = min(sibling_attempts, key=lambda a: (str(a.get("started_at") or ""), str(a.get("id") or ""))).get("id")
    complimentary = (
        actor.get("player_id") is not None
        and payload.hint_level == 1
        and support_mode in {"beginner", "younger"}
        and payload.attempt_id == first_attempt_id
        and not previous_hints
    )
    db_insert("hint_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "attempt_id": payload.attempt_id, "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "hint_level": payload.hint_level, "source": payload.source, "support_mode": support_mode,
        "complimentary": complimentary, "elapsed_ms": payload.elapsed_ms,
        "found_words": payload.found_words, "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True, "complimentary": complimentary}


@app.post("/api/product-event")
def product_event(
    payload: ProductEventCreate,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed = {
        "app_open", "onboarding_started", "onboarding_completed",
        "account_nudge_shown", "account_nudge_create", "account_nudge_login", "account_nudge_dismissed",
        "account_authenticated",
        *{f"account_nudge_{stage}_{action}" for stage in (1, 2, 3) for action in ("shown", "create", "login", "dismissed", "authenticated")},
    }
    if payload.event_type not in allowed:
        raise HTTPException(400, "Neplatný product event")
    db_insert("product_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "event_type": payload.event_type, "app_version": "3.20.1", "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/team-pin")
def set_team_pin(payload: TeamPinSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    team = norm_family(str(player.get("family_code") or ""))
    if is_solo_player(player):
        raise HTTPException(400, "Nejdřív se připoj k týmu nebo ho založ")
    rows = db_select("leagues", code=team)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    db_update("leagues", {"code": team}, {"pin_hash": hash_password(payload.pin.strip())})
    return {"ok": True, "hasPin": True}


@app.post("/api/team-membership")
def set_team_membership(payload: TeamMembershipSet, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    current_family = norm_family(str(player.get("family_code") or ""))
    if not is_solo_player(player):
        raise HTTPException(409, "Tento hráč už je v týmu")

    if payload.mode == "new":
        display_name = " ".join((payload.league_name or "").strip().split())[:40]
        family = norm_family(display_name)
        if len(family) < 2:
            raise HTTPException(400, "Pojmenuj nový tým")
        if db_select("leagues", code=family):
            raise HTTPException(409, "Tým s tímto názvem už existuje. Přidej se k němu.")
        db_insert("leagues", {
            "code": family, "name": display_name, "pin_hash": hash_password(payload.league_pin.strip()),
            "created_at": datetime.now(TZ).isoformat(),
        })
    else:
        family = norm_family(payload.family_code or "")
        if len(family) < 2:
            raise HTTPException(400, "Vyber tým")
        rows = db_select("leagues", code=family)
        if not rows:
            raise HTTPException(404, "Tým neexistuje")
        if not rows[0].get("pin_hash"):
            raise HTTPException(409, "Tento tým ještě nemá nastavený vstupní PIN")
        if not verify_password(payload.league_pin.strip(), rows[0].get("pin_hash")):
            raise HTTPException(401, "PIN týmu nesedí")

    target_players = db_select("players", family_code=family)
    if any(p.get("id") != player.get("id") and p.get("name", "").casefold() == player.get("name", "").casefold() for p in target_players):
        raise HTTPException(409, "V tomto týmu už je hráč se stejným jménem")
    db_update("players", {"id": player["id"]}, {"family_code": family, "team_joined_at": datetime.now(TZ).isoformat()})
    return {"ok": True, "familyCode": family, "leagueName": league_name_for(family)}


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
    public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"], "name": player["name"], "familyCode": public_family,
        "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
        "hasPassword": bool(player.get("password_hash")), "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": stats,
    }


@app.get("/api/progress")
def progress(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    rows = db_select("results", player_id=player["id"])
    def completion_payload(r: dict) -> dict:
        info = free_puzzle_info(str(r.get("puzzle_id") or ""), str(r.get("difficulty") or "")) if r.get("mode") == "free" else None
        return {
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
            "level": info.get("level") if info else None,
            "contentGeneration": info.get("generation") if info else None,
            "legacy": info.get("legacy") if info else False,
        }
    return {
        "completed": [completion_payload(r) for r in rows]
    }


def merged_hint_count(old_value, new_value: int) -> int:
    try:
        old = int(old_value) if old_value is not None else int(new_value)
    except (TypeError, ValueError):
        old = int(new_value)
    return min(old, int(new_value))


@app.post("/api/attempt/start")
def attempt_start(
    payload: AttemptStart,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
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
        if not daily_puzzle_matches_date(payload.puzzle_id, daily_date):
            raise HTTPException(400, "Tato úloha nepatří k Daily datu")
    filters = {"id": payload.attempt_id, **actor_filters(actor)}
    existing = db_select("puzzle_attempts", **filters)
    if existing:
        return {"ok": True, "attemptId": payload.attempt_id}
    db_insert("puzzle_attempts", {
        "id": payload.attempt_id, "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "mode": payload.mode, "difficulty": payload.difficulty,
        "started_at": datetime.now(TZ).isoformat(), "app_version": "3.20.1",
    })
    return {"ok": True, "attemptId": payload.attempt_id, "anonymous": actor.get("player_id") is None}


@app.post("/api/attempt/checkpoint")
def attempt_checkpoint(
    payload: AttemptCheckpoint,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed = {"correct", "hint", "reset", "resume", "leave"}
    if payload.event_type not in allowed:
        raise HTTPException(400, "Neplatný checkpoint")
    rows = db_select("puzzle_attempts", id=payload.attempt_id, **actor_filters(actor))
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


@app.post("/api/attempt/finish")
def attempt_finish(
    payload: AttemptFinishTelemetry,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    row = _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key)
    if not row:
        if payload.mode not in ("daily", "free") or payload.difficulty not in POINTS or not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
            raise HTTPException(400, "Neplatný dokončený pokus")
        if payload.mode == "free" and payload.challenge_key != f"free:{payload.puzzle_id}":
            raise HTTPException(400, "Neplatný klíč dokončeného pokusu")
        if payload.mode == "daily":
            if not payload.challenge_key.startswith("daily:"):
                raise HTTPException(400, "Neplatný klíč dokončeného Daily")
            daily_date = payload.challenge_key[6:]
            try:
                date.fromisoformat(daily_date)
            except ValueError:
                raise HTTPException(400, "Neplatné datum Daily")
            if not daily_puzzle_matches_date(payload.puzzle_id, daily_date):
                raise HTTPException(400, "Tato úloha nepatří k Daily datu")
        db_insert("puzzle_attempts", {
            "id": payload.attempt_id, "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
            "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key, "mode": payload.mode,
            "difficulty": payload.difficulty, "started_at": datetime.now(TZ).isoformat(), "app_version": "3.20.1",
        })
    completed_at = payload.completed_at or datetime.now(TZ).isoformat()
    try:
        completed_at = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00")).isoformat()
    except Exception:
        completed_at = datetime.now(TZ).isoformat()
    db_update("puzzle_attempts", {"id": payload.attempt_id}, {
        "completed_at": completed_at, "elapsed_ms": payload.elapsed_ms, "moves": payload.moves,
        "wrong_attempts": payload.wrong_attempts, "hints_used": payload.hints_used,
        "max_hint_level": payload.max_hint_level, "clean_solve": payload.clean_solve,
        "last_activity_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True, "anonymous": actor.get("player_id") is None}


@app.post("/api/feedback")
def puzzle_feedback(
    payload: FeedbackCreate,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if payload.kind not in ("difficulty", "word"):
        raise HTTPException(400, "Neplatný typ zpětné vazby")
    info = puzzle_info(payload.puzzle_id)
    if not info:
        raise HTTPException(400, "Neznámá úloha")
    if payload.kind == "difficulty" and payload.rating is None:
        raise HTTPException(400, "Chybí hodnocení obtížnosti")
    clean_word = " ".join(str(payload.word or "").strip().upper().split()) or None
    if payload.kind == "word":
        if not clean_word:
            raise HTTPException(400, "Vyber slovo, které chceš nahlásit")
        answers = {str(answer.get("word") or "").strip().upper() for answer in info["puzzle"].get("answers", [])}
        if clean_word not in answers:
            raise HTTPException(400, "Toto slovo do úlohy nepatří")
    af = actor_filters(actor)
    candidates = db_select("puzzle_feedback", puzzle_id=payload.puzzle_id, kind=payload.kind, **af)
    existing = candidates if payload.kind == "difficulty" else [
        item for item in candidates if str(item.get("word") or "").strip().casefold() == str(clean_word or "").casefold()
    ]
    row = {
        "rating": payload.rating if payload.kind == "difficulty" else None,
        "word": clean_word if payload.kind == "word" else None,
        "note": " ".join(str(payload.note or "").strip().split()) or None,
        "created_at": datetime.now(TZ).isoformat(),
    }
    if payload.kind == "word":
        row.update({"status": "new", "resolution_note": None, "reviewed_at": None, "reviewed_by": None})
    if existing:
        db_update("puzzle_feedback", {"id": existing[0]["id"]}, row)
    else:
        db_insert("puzzle_feedback", {
            "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
            "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key, "kind": payload.kind, **row,
        })
    return {"ok": True, "anonymous": actor.get("player_id") is None}


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
    attempts = db_select_all("puzzle_attempts")
    feedback = db_select_all("puzzle_feedback", kind="difficulty")
    word_feedback = db_select_all("puzzle_feedback", kind="word")
    hint_events = db_select_all("hint_events")
    helper_events = db_select_all("helper_events")
    product_events = db_select_all("product_events")

    def ts(row):
        raw = row.get("started_at") or ""
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except Exception:
            return datetime.max.replace(tzinfo=TZ)

    def telemetry_identity(row: dict) -> Optional[str]:
        if row.get("player_id"):
            return f"p:{row['player_id']}"
        if row.get("anonymous_id"):
            return f"a:{row['anonymous_id']}"
        return None

    first_by_actor_puzzle: dict[tuple[str, str], dict] = {}
    for a in sorted(attempts, key=ts):
        identity = telemetry_identity(a)
        if not identity:
            continue
        key = (identity, str(a.get("puzzle_id")))
        first_by_actor_puzzle.setdefault(key, a)

    first_attempts = list(first_by_actor_puzzle.values())
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
            "ratingVotes": {
                "lighter": sum(1 for rating in ratings if rating == -1),
                "justRight": sum(1 for rating in ratings if rating == 0),
                "harder": sum(1 for rating in ratings if rating == 1),
            },
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
    def event_identity(row: dict) -> Optional[str]:
        if row.get("player_id"):
            return f"p:{row['player_id']}"
        if row.get("anonymous_id"):
            return f"a:{row['anonymous_id']}"
        return None

    funnel = {}
    for event_type in (
        "app_open", "onboarding_started", "onboarding_completed", "account_nudge_shown",
        "account_nudge_create", "account_nudge_login", "account_nudge_dismissed", "account_authenticated",
        *[f"account_nudge_{stage}_{action}" for stage in (1, 2, 3) for action in ("shown", "create", "login", "dismissed", "authenticated")],
    ):
        identities = {event_identity(e) for e in product_events if e.get("event_type") == event_type}
        identities.discard(None)
        funnel[event_type] = len(identities)

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
        "registeredFirstAttempts": sum(1 for a in first_attempts if a.get("player_id")),
        "anonymousFirstAttempts": sum(1 for a in first_attempts if a.get("anonymous_id")),
        "puzzlesMeasured": len(rows),
        "summary": {
            "tooHard": sum(1 for r in rows if r["flag"] == "too_hard"),
            "tooEasy": sum(1 for r in rows if r["flag"] == "too_easy"),
            "watch": sum(1 for r in rows if r["flag"] == "watch"),
            "reliable": sum(1 for r in rows if r["starts"] >= 20),
        },
        "helper": helper_summary,
        "hints": hint_summary,
        "funnel": funnel,
        "priorities": priorities[:30],
        "rows": rows,
    }


def parse_timestamp(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except (TypeError, ValueError):
        return None


def public_admin_identity(admin: dict) -> dict:
    player = admin["player"]
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"],
        "name": player.get("name"),
        "familyCode": family,
        "team": public_team_name(player.get("family_code"), player.get("team_joined_at")) or "Bez týmu",
        "avatar": player.get("avatar") or "🙂",
        "role": admin["role"],
    }


@app.get("/api/admin/me")
def admin_me(authorization: Optional[str] = Header(default=None)):
    return public_admin_identity(require_admin(authorization))


@app.get("/api/admin/overview")
def admin_overview(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    now = datetime.now(TZ)
    today = current_prague_date()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    players = db_select_all("players")
    results = db_select_all("results")
    attempts = db_select_all("puzzle_attempts")
    reports = db_select_all("puzzle_feedback", kind="word")
    ratings = db_select_all("puzzle_feedback", kind="difficulty")
    leagues = db_select_all("leagues")
    try:
        runs = db_select_all("puzzle_runs")
    except HTTPException:
        runs = results

    last_activity: dict[str, datetime] = {}
    for row in attempts:
        player_id = row.get("player_id")
        stamp = parse_timestamp(row.get("last_activity_at") or row.get("completed_at") or row.get("started_at"))
        if player_id and stamp and (player_id not in last_activity or stamp > last_activity[player_id]):
            last_activity[player_id] = stamp
    for row in results:
        player_id = row.get("player_id")
        stamp = parse_timestamp(row.get("completed_at"))
        if player_id and stamp and (player_id not in last_activity or stamp > last_activity[player_id]):
            last_activity[player_id] = stamp

    run_times = [(row, parse_timestamp(row.get("completed_at"))) for row in runs]
    today_runs = [row for row, stamp in run_times if stamp and stamp.date() == today]
    week_runs = [row for row, stamp in run_times if stamp and stamp >= seven_days_ago]
    primary_daily = expected_daily_puzzle_id(today.isoformat())
    daily_today = {
        row.get("player_id") for row in results
        if row.get("mode") == "daily"
        and str(row.get("daily_date") or "")[:10] == today.isoformat()
        and row.get("puzzle_id") == primary_daily
    }
    daily_today.discard(None)

    version_counts: dict[str, int] = {}
    for row in attempts:
        stamp = parse_timestamp(row.get("started_at"))
        version = str(row.get("app_version") or "neznámá")
        if stamp and stamp >= thirty_days_ago:
            version_counts[version] = version_counts.get(version, 0) + 1
    versions = [
        {"version": version, "attempts": count}
        for version, count in sorted(version_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    open_reports = [row for row in reports if str(row.get("status") or "new") in ("new", "reviewing")]
    vote_counts = {str(value): sum(1 for row in ratings if row.get("rating") == value) for value in (-1, 0, 1)}
    return {
        "generatedAt": now.isoformat(),
        "today": today.isoformat(),
        "players": {
            "total": len(players),
            "active7": sum(1 for stamp in last_activity.values() if stamp >= seven_days_ago),
            "active30": sum(1 for stamp in last_activity.values() if stamp >= thirty_days_ago),
        },
        "games": {"today": len(today_runs), "last7Days": len(week_runs)},
        "daily": {"todayPlayers": len(daily_today), "puzzleId": primary_daily},
        "feedback": {"openWordReports": len(open_reports), "wordReportsTotal": len(reports), "ratingsTotal": len(ratings), "votes": vote_counts},
        "teams": len(leagues),
        "appVersions": versions[:8],
    }


def admin_user_summaries() -> list[dict]:
    players = db_select_all("players")
    results = db_select_all("results")
    attempts = db_select_all("puzzle_attempts")
    reports = db_select_all("puzzle_feedback", kind="word")
    try:
        leagues = {str(row.get("code")): row.get("name") or row.get("code") for row in db_select_all("leagues")}
    except HTTPException:
        leagues = {}
    results_by_player: dict[str, list[dict]] = {}
    attempts_by_player: dict[str, list[dict]] = {}
    reports_by_player: dict[str, list[dict]] = {}
    for row in results:
        if row.get("player_id"):
            results_by_player.setdefault(row["player_id"], []).append(row)
    for row in attempts:
        if row.get("player_id"):
            attempts_by_player.setdefault(row["player_id"], []).append(row)
    for row in reports:
        if row.get("player_id"):
            reports_by_player.setdefault(row["player_id"], []).append(row)

    summaries = []
    for player in players:
        player_results = results_by_player.get(player["id"], [])
        player_attempts = attempts_by_player.get(player["id"], [])
        activity_candidates = [
            parse_timestamp(row.get("last_activity_at") or row.get("completed_at") or row.get("started_at"))
            for row in player_attempts
        ] + [parse_timestamp(row.get("completed_at")) for row in player_results]
        activity = max((stamp for stamp in activity_candidates if stamp), default=None)
        latest_attempt = max(
            player_attempts,
            key=lambda row: parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ),
            default=None,
        )
        raw_family = str(player.get("family_code") or "")
        family = public_family_code(raw_family, player.get("team_joined_at"))
        player_reports = reports_by_player.get(player["id"], [])
        summaries.append({
            "id": player["id"],
            "name": player.get("name"),
            "avatar": player.get("avatar") or "🙂",
            "familyCode": family,
            "team": (leagues.get(family) or family) if family else "Bez týmu",
            "createdAt": player.get("created_at"),
            "lastActiveAt": activity.isoformat() if activity else None,
            "appVersion": latest_attempt.get("app_version") if latest_attempt else None,
            "supportMode": player.get("support_mode") or "none",
            "hasPassword": bool(player.get("password_hash")),
            "points": sum(int(row.get("points") or 0) for row in player_results),
            "completed": len(player_results),
            "dailyCompleted": len({str(row.get("daily_date"))[:10] for row in player_results if row.get("mode") == "daily" and row.get("daily_date")}),
            "openWordReports": sum(1 for row in player_reports if str(row.get("status") or "new") in ("new", "reviewing")),
        })
    summaries.sort(key=lambda row: row.get("lastActiveAt") or "", reverse=True)
    return summaries


@app.get("/api/admin/users")
def admin_users(
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=60, ge=1, le=200),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    needle = " ".join(q.strip().casefold().split())
    rows = admin_user_summaries()
    if needle:
        rows = [row for row in rows if needle in " ".join((str(row.get("name") or ""), str(row.get("team") or ""), str(row.get("familyCode") or ""))).casefold()]
    return {"total": len(rows), "users": rows[:limit]}


@app.get("/api/admin/users/{player_id}")
def admin_user_detail(player_id: str, authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    players = db_select("players", id=player_id)
    if not players:
        raise HTTPException(404, "Hráč neexistuje")
    player = players[0]
    results = db_select("results", player_id=player_id)
    results.sort(key=lambda row: parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    attempts = db_select("puzzle_attempts", player_id=player_id)
    attempts.sort(key=lambda row: parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    reports = db_select("puzzle_feedback", player_id=player_id, kind="word")
    try:
        session_count = len(db_select("player_sessions", player_id=player_id))
    except HTTPException:
        session_count = 0
    try:
        push_count = len(db_select("push_subscriptions", player_id=player_id))
    except HTTPException:
        push_count = 0
    return {
        "user": {
            "id": player["id"], "name": player.get("name"), "avatar": player.get("avatar") or "🙂",
            "familyCode": public_family_code(player.get("family_code"), player.get("team_joined_at")),
            "team": public_team_name(player.get("family_code"), player.get("team_joined_at")) or "Bez týmu",
            "createdAt": player.get("created_at"), "supportMode": player.get("support_mode") or "none",
            "hasPassword": bool(player.get("password_hash")), "additionalSessions": session_count, "pushSubscriptions": push_count,
        },
        "stats": player_stats(player_id),
        "latestAppVersion": attempts[0].get("app_version") if attempts else None,
        "wordReports": {"total": len(reports), "open": sum(1 for row in reports if str(row.get("status") or "new") in ("new", "reviewing"))},
        "recentResults": [{
            "puzzleId": row.get("puzzle_id"), "mode": row.get("mode"), "difficulty": row.get("difficulty"),
            "dailyDate": str(row.get("daily_date"))[:10] if row.get("daily_date") else None,
            "elapsedMs": row.get("best_elapsed_ms"), "moves": row.get("best_moves"), "points": row.get("points"),
            "hintsUsed": row.get("hints_used"), "cleanSolve": row.get("clean_solve") is True, "completedAt": row.get("completed_at"),
        } for row in results[:30]],
    }


@app.get("/api/admin/reports")
def admin_reports(
    status: str = Query(default="open", max_length=20),
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=100, ge=1, le=300),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    if status not in ("open", "all", "new", "reviewing", "resolved", "dismissed"):
        raise HTTPException(400, "Neplatný filtr stavu")
    reports = db_select_all("puzzle_feedback", kind="word")
    players = {row["id"]: row for row in db_select_all("players")}
    needle = " ".join(q.strip().casefold().split())
    output = []
    for report in reports:
        report_status = str(report.get("status") or "new")
        if status == "open" and report_status not in ("new", "reviewing"):
            continue
        if status not in ("open", "all") and report_status != status:
            continue
        player = players.get(report.get("player_id"))
        info = puzzle_info(str(report.get("puzzle_id") or ""))
        puzzle_meta = (info or {}).get("puzzle", {}).get("meta") or {}
        haystack = " ".join((
            str(report.get("word") or ""), str(report.get("note") or ""), str(report.get("puzzle_id") or ""),
            str(player.get("name") if player else "anonym"), str(player.get("family_code") if player else ""),
        )).casefold()
        if needle and needle not in haystack:
            continue
        output.append({
            "id": report.get("id"), "status": report_status, "word": report.get("word"), "note": report.get("note"),
            "puzzleId": report.get("puzzle_id"), "challengeKey": report.get("challenge_key"),
            "mode": (info or {}).get("mode"), "difficulty": (info or {}).get("difficulty"),
            "level": (info or {}).get("level") or puzzle_meta.get("level"), "legacy": bool((info or {}).get("legacy")),
            "reportedBy": {
                "id": player.get("id"), "name": player.get("name"),
                "team": public_team_name(player.get("family_code"), player.get("team_joined_at")),
            } if player else {"id": None, "name": "Anonymní hráč", "team": None},
            "createdAt": report.get("created_at"), "resolutionNote": report.get("resolution_note"),
            "reviewedAt": report.get("reviewed_at"), "reviewedBy": report.get("reviewed_by"),
        })
    status_order = {"new": 0, "reviewing": 1, "resolved": 2, "dismissed": 3}
    output.sort(key=lambda row: row.get("createdAt") or "", reverse=True)
    output.sort(key=lambda row: status_order.get(row["status"], 9))
    return {"total": len(output), "reports": output[:limit]}


@app.patch("/api/admin/reports/{report_id}")
def admin_report_update(report_id: str, payload: AdminReportUpdate, authorization: Optional[str] = Header(default=None)):
    admin = require_admin(authorization, write=True)
    if payload.status not in ("new", "reviewing", "resolved", "dismissed"):
        raise HTTPException(400, "Neplatný stav hlášení")
    reports = db_select("puzzle_feedback", id=report_id)
    if not reports or reports[0].get("kind") != "word":
        raise HTTPException(404, "Hlášení neexistuje")
    report = reports[0]
    note = " ".join(str(payload.resolution_note or "").strip().split()) or None
    values = {"status": payload.status, "resolution_note": note}
    if payload.status == "new":
        values.update({"reviewed_at": None, "reviewed_by": None})
    else:
        values.update({"reviewed_at": datetime.now(TZ).isoformat(), "reviewed_by": admin["player"]["id"]})
    db_update("puzzle_feedback", {"id": report_id}, values)
    record_admin_audit(admin, "word_report_status", "puzzle_feedback", report_id, {
        "word": report.get("word"), "puzzleId": report.get("puzzle_id"),
        "from": str(report.get("status") or "new"), "to": payload.status, "resolutionNote": note,
    })
    return {"ok": True, "id": report_id, **values}


@app.get("/api/admin/audit")
def admin_audit(
    limit: int = Query(default=80, ge=1, le=200),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    rows = db_select_all("admin_audit_log")
    players = {row["id"]: row for row in db_select_all("players")}
    rows.sort(key=lambda row: parse_timestamp(row.get("created_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    return {"entries": [{
        "id": row.get("id"), "action": row.get("action"), "targetType": row.get("target_type"),
        "targetId": row.get("target_id"), "details": row.get("details") or {}, "createdAt": row.get("created_at"),
        "admin": (players.get(row.get("admin_player_id")) or {}).get("name") or "Administrátor",
    } for row in rows[:limit]]}


@app.get("/api/admin/quality")
@app.get("/api/quality-report")
def quality_report(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    return build_quality_report()


@app.get("/api/admin/quality-history")
@app.get("/api/quality-history")
def quality_history(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
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
    free_info = free_puzzle_info(puzzle_id)
    if free_info:
        return free_info
    data = load_puzzles()
    for p in data.get("daily", []):
        if p.get("id") == puzzle_id:
            return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": False, "generation": int(data.get("dailyGeneration") or 1)}
    for bank in reversed(legacy_daily_banks(data)):
        for p in bank["puzzles"]:
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(bank.get("generation") or 1)}
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
        if not daily_puzzle_matches_date(payload.puzzle_id, payload.daily_date):
            raise HTTPException(400, "Tato úloha nepatří k uvedenému dni")
        points = POINTS["daily"]
    else:
        if payload.challenge_key != f"free:{payload.puzzle_id}":
            raise HTTPException(400, "Neplatný klíč volné úlohy")
        info = free_puzzle_info(payload.puzzle_id, payload.difficulty)
        if not info:
            raise HTTPException(400, "Neznámý slot volné úlohy")
        points, transferred_reward = claim_free_slot_points(
            player["id"], info, POINTS[payload.difficulty], payload.puzzle_id,
        )

    # Each actual completion is stored as one coherent run. Leaderboards never mix a fast hinted
    # attempt with a slower clean attempt into an impossible synthetic record.
    try:
        record_puzzle_run(player["id"], payload, effective_clean)
    except HTTPException:
        logger.warning("Could not store puzzle run for %s", payload.attempt_id)

    official_completed_at = payload_completed_at(payload.completed_at)
    daily_generation_upgrade = False
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
        daily_generation_upgrade = is_daily_generation_upgrade(old, payload)
        if daily_generation_upgrade:
            # The date already paid its 100 XP. Replace only the official board/result so
            # current Daily and weekly leaderboards can count the new generation.
            db_update("results", {"id": old["id"]}, {
                "puzzle_id": payload.puzzle_id, "difficulty": payload.difficulty,
                "daily_date": payload.daily_date, "best_elapsed_ms": payload.elapsed_ms,
                "best_moves": payload.moves, "hints_used": payload.hints_used,
                "wrong_attempts": payload.wrong_attempts, "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean, "completed_at": official_completed_at,
            })
        elif incoming_is_earlier and old.get("puzzle_id") == payload.puzzle_id:
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
            daily_generation_upgrade = is_daily_generation_upgrade(old, payload)
            if daily_generation_upgrade:
                db_update("results", {"id": old["id"]}, {
                    "puzzle_id": payload.puzzle_id, "difficulty": payload.difficulty,
                    "daily_date": payload.daily_date, "best_elapsed_ms": payload.elapsed_ms,
                    "best_moves": payload.moves, "hints_used": payload.hints_used,
                    "wrong_attempts": payload.wrong_attempts, "max_hint_level": payload.max_hint_level,
                    "clean_solve": effective_clean, "completed_at": official_completed_at,
                })
            elif old.get("puzzle_id") == payload.puzzle_id and completion_time({"completed_at": official_completed_at}) < completion_time(old):
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
        "awardedPoints": points if first else 0,
        "dailyGenerationUpgrade": daily_generation_upgrade,
        "transferredSlot": bool(payload.mode == "free" and transferred_reward),
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
    # The client clock excludes periods while the page is hidden or unfocused.
    # Rescue results are not part of a speed leaderboard, so wall-clock time is
    # neither a useful fairness signal nor worth penalising a phone interruption.
    passed = bool(payload.completed and payload.elapsed_ms <= 30000)
    final_elapsed = payload.elapsed_ms
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
    daily_results = [
        r for r in daily_results
        if str(r.get("daily_date") or "")[:10] in dates
        and r.get("puzzle_id") == expected_daily_puzzle_id(str(r.get("daily_date") or "")[:10])
    ]
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
                    created = datetime.fromisoformat(str(member.get("team_joined_at") or member.get("created_at") or "").replace("Z", "+00:00")).astimezone(TZ).date()
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
            if is_solo_player(player):
                raise HTTPException(404, "Hráč zatím není v týmu")
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
    if is_solo_player(player):
        raise HTTPException(400, "Nejdřív se připoj k týmu nebo ho založ")
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


@app.get("/api/free-global-leaderboard")
def free_global_leaderboard(
    puzzle_id: str = Query(min_length=2, max_length=80),
    authorization: Optional[str] = Header(default=None),
):
    """Privacy-safe worldwide standings for one active Free puzzle.

    Every player is represented by their first completed attempt only. The
    response deliberately contains no names, avatars, team codes or player IDs.
    """
    info = free_puzzle_info(puzzle_id)
    if not info or info.get("legacy") is True:
        raise HTTPException(404, "Aktivní volná úroveň nebyla nalezena")

    runs = db_select_all("puzzle_runs", puzzle_id=puzzle_id, mode="free")
    first_by_player: dict[str, dict] = {}
    for row in runs:
        player_id = str(row.get("player_id") or "")
        if not player_id:
            continue
        previous = first_by_player.get(player_id)
        if previous is None or first_run_key(row) < first_run_key(previous):
            first_by_player[player_id] = row

    ranked = sorted(first_by_player.values(), key=lambda row: (
        *run_rank_tuple(row),
        completion_time(row),
        str(row.get("player_id") or ""),
    ))

    my_player_id = None
    if authorization:
        try:
            my_player_id = str(auth_player(authorization)["id"])
        except HTTPException:
            pass
    my_index = next(
        (index for index, row in enumerate(ranked) if str(row.get("player_id")) == my_player_id),
        None,
    )
    total = len(ranked)
    if my_index is None:
        visible_indices = list(range(min(3, total)))
    else:
        start = max(0, min(my_index - 1, total - 3))
        visible_indices = list(range(start, min(total, start + 3)))

    board = []
    for index in visible_indices:
        row = ranked[index]
        board.append({
            "rank": index + 1,
            "isMine": index == my_index,
            "elapsedMs": int(row.get("elapsed_ms") or 0),
            "moves": int(row.get("moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0),
            "cleanSolve": row.get("clean_solve") is True,
        })

    my_rank = my_index + 1 if my_index is not None else None
    top_percent = max(1, math.ceil(my_rank / total * 100)) if my_rank and total else None
    return {
        "puzzleId": puzzle_id,
        "difficulty": info.get("difficulty"),
        "level": info.get("level"),
        "generation": info.get("generation"),
        "total": total,
        "myRank": my_rank,
        "topPercent": top_percent,
        "percentileMinimum": 10,
        "rows": board,
        "privacy": "anonymous-performance-only",
        "attemptPolicy": "first-completed-only",
    }


@app.get("/api/daily-global-leaderboard")
def daily_global_leaderboard(
    daily_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Privacy-safe global Daily standings: public performance, never player identity."""
    selected_date = daily_date or current_prague_date().isoformat()
    try:
        date.fromisoformat(selected_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")

    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    results = [
        row for row in db_select("results", mode="daily", daily_date=selected_date)
        if row.get("puzzle_id") == primary_puzzle_id
    ]
    # results is unique per player/challenge in the current schema. Defensive
    # deduplication keeps historical inconsistencies out of the public board.
    by_player: dict[str, dict] = {}
    for row in results:
        player_id = str(row.get("player_id") or "")
        if not player_id:
            continue
        previous = by_player.get(player_id)
        if previous is None or completion_time(row) < completion_time(previous):
            by_player[player_id] = row

    ranked = sorted(by_player.values(), key=lambda row: (
        0 if row.get("clean_solve") is True else 1,
        int(row.get("hints_used") or 0),
        int(row.get("best_elapsed_ms") or 10**12),
        int(row.get("best_moves") or 10**9),
        completion_time(row),
        str(row.get("player_id") or ""),
    ))

    my_player_id = None
    if authorization:
        try:
            my_player_id = str(auth_player(authorization)["id"])
        except HTTPException:
            pass
    my_index = next((index for index, row in enumerate(ranked) if str(row.get("player_id")) == my_player_id), None)
    total = len(ranked)
    if my_index is None:
        visible_indices = list(range(min(3, total)))
    else:
        start = max(0, min(my_index - 1, total - 3))
        visible_indices = list(range(start, min(total, start + 3)))

    board = []
    for index in visible_indices:
        row = ranked[index]
        board.append({
            "rank": index + 1,
            "isMine": index == my_index,
            "elapsedMs": int(row.get("best_elapsed_ms") or 0),
            "moves": int(row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0),
            "cleanSolve": row.get("clean_solve") is True,
        })

    my_rank = my_index + 1 if my_index is not None else None
    top_percent = max(1, math.ceil(my_rank / total * 100)) if my_rank and total else None
    return {
        "date": selected_date,
        "puzzleId": primary_puzzle_id,
        "total": total,
        "myRank": my_rank,
        "topPercent": top_percent,
        "rows": board,
        "privacy": "anonymous-performance-only",
    }


@app.get("/api/played-levels")
def played_levels(
    difficulty: str = Query(min_length=3, max_length=20),
    authorization: Optional[str] = Header(default=None),
):
    player = auth_player(authorization)
    data = load_puzzles()
    bank = sorted(data.get("free", {}).get(difficulty, []), key=lambda p: int((p.get("meta") or {}).get("level") or 9999))
    active = {p["id"]: p for p in bank}
    results = [r for r in db_select("results", player_id=player["id"]) if r.get("mode") == "free" and r.get("difficulty") == difficulty]
    legacy_slots: set[int] = set()
    legacy_history: list[dict] = []
    gen2_result_by_puzzle: dict[str, dict] = {}
    for row in results:
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if not info:
            continue
        if int(info["generation"]) >= 2:
            gen2_result_by_puzzle[str(row.get("puzzle_id"))] = row
        else:
            legacy_slots.add(int(info["level"]))
            legacy_history.append({
                "puzzleId": row.get("puzzle_id"), "level": int(info["level"]),
                "contentGeneration": int(info["generation"]),
                "elapsedMs": int(row.get("best_elapsed_ms") or 1000),
                "moves": int(row.get("best_moves") or 1),
                "hintsUsed": int(row.get("hints_used") or 0),
                "wrongAttempts": int(row.get("wrong_attempts") or 0),
                "cleanSolve": row.get("clean_solve") is True,
                "completedAt": row.get("completed_at"),
            })
    runs = [r for r in db_select("puzzle_runs", player_id=player["id"]) if r.get("mode") == "free" and r.get("difficulty") == difficulty and r.get("puzzle_id") in active]
    grouped: dict[str, list[dict]] = {}
    for r in runs:
        grouped.setdefault(r["puzzle_id"], []).append(r)
    items = []
    for p in bank:
        vals = grouped.get(p["id"], [])
        level = int((p.get("meta") or {}).get("level") or 0)
        result_row = gen2_result_by_puzzle.get(p["id"])
        if vals:
            first = min(vals, key=first_run_key)
            items.append({
                "puzzleId": p["id"], "level": level, "transferred": False,
                "elapsedMs": int(first["elapsed_ms"]), "moves": int(first["moves"]),
                "hintsUsed": int(first.get("hints_used") or 0), "wrongAttempts": int(first.get("wrong_attempts") or 0),
                "cleanSolve": first.get("clean_solve") is True, "attempts": len(vals), "completedAt": first.get("completed_at"),
            })
        elif result_row:
            items.append({
                "puzzleId": p["id"], "level": level, "transferred": False,
                "elapsedMs": int(result_row.get("best_elapsed_ms") or 1000), "moves": int(result_row.get("best_moves") or 1),
                "hintsUsed": int(result_row.get("hints_used") or 0), "wrongAttempts": int(result_row.get("wrong_attempts") or 0),
                "cleanSolve": result_row.get("clean_solve") is True, "attempts": 1, "completedAt": result_row.get("completed_at"),
            })
        elif level in legacy_slots:
            items.append({"puzzleId": p["id"], "level": level, "transferred": True, "attempts": 0})
    actual = sum(not item.get("transferred") for item in items)
    transferred = sum(bool(item.get("transferred")) for item in items)
    legacy_history.sort(key=lambda row: (row["level"], str(row.get("completedAt") or ""), str(row.get("puzzleId") or "")))
    return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}


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
    primary_daily_id = expected_daily_puzzle_id(daily_date)
    daily_rows = [r for r in daily_rows if r["player_id"] in player_map and r.get("puzzle_id") == primary_daily_id]
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
