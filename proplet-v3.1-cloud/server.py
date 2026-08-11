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

app = FastAPI(title="Proplet API", version="3.3-cloud")
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


def player_stats(player_id: str) -> dict:
    """Statistiky počítáme defenzivně, aby jeden starý/poškozený řádek neshodil synchronizaci."""
    rows = db_select("results", player_id=player_id)
    daily_dates: list[str] = []
    free = {k: 0 for k in ("easy", "medium", "hard", "hardcore")}
    daily_times: list[int] = []
    total_points = 0

    for r in rows:
        mode = r.get("mode")
        difficulty = r.get("difficulty")
        total_points += int(r.get("points") or 0)

        if mode == "daily" and r.get("daily_date"):
            raw_date = str(r.get("daily_date"))[:10]
            try:
                date.fromisoformat(raw_date)
                daily_dates.append(raw_date)
            except ValueError:
                logger.warning("Ignoring malformed daily_date for result %s: %r", r.get("id"), r.get("daily_date"))
            try:
                daily_times.append(int(r.get("best_elapsed_ms")))
            except (TypeError, ValueError):
                logger.warning("Ignoring malformed elapsed time for result %s", r.get("id"))

        if mode == "free" and difficulty in free:
            free[difficulty] += 1

    current, longest = streaks(daily_dates)
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
        "earnedBadges": earned,
        "nextBadge": next_badge,
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
        return {**base, "ok": True, "database": True, "accountMigration": account_migration}
    except HTTPException as exc:
        return {**base, "ok": False, "database": False, "accountMigration": False, "message": exc.detail}


@app.get("/api/config")
def config():
    p = load_puzzles()
    return {
        "badges": BADGES,
        "points": POINTS,
        "dictionarySize": p["dictionarySize"],
        "dailyRotationSize": p["dailyRotationSize"],
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
                "completedAt": r.get("completed_at"),
            }
            for r in rows
        ]
    }


@app.post("/api/result")
def result(payload: ResultCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
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
                })
            first = False

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
    daily_rows = db_select("results", mode="daily", daily_date=daily_date)
    daily_rows = [r for r in daily_rows if r["player_id"] in player_map]
    daily_rows.sort(key=lambda r: (r["best_elapsed_ms"], r["best_moves"], player_map[r["player_id"]]["name"].casefold()))
    daily = [
        {
            "rank": i,
            "id": r["player_id"],
            "name": player_map[r["player_id"]]["name"],
            "elapsedMs": r["best_elapsed_ms"],
            "moves": r["best_moves"],
        }
        for i, r in enumerate(daily_rows, 1)
    ]
    return {"familyCode": family, "date": daily_date, "overall": overall, "daily": daily}


# Lokální spuštění přes uvicorn: Vercel obslouží public/ sám z CDN.
if not os.environ.get("VERCEL"):
    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="local-static")
