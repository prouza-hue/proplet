from __future__ import annotations

import hashlib
import json
import os
import secrets
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
PUZZLES_PATH = ROOT / "public" / "puzzles.json"
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

POINTS = {"daily": 100, "easy": 10, "medium": 20, "hard": 35}

app = FastAPI(title="Proplet API", version="3.0-cloud")


class PlayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    family_code: str = Field(min_length=2, max_length=24)


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


def auth_player(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Chybí přihlášení hráče")
    token = authorization[7:].strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    rows = db_select("players", token_hash=token_hash)
    if not rows:
        raise HTTPException(401, "Neplatný hráčský token")
    return rows[0]


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
    rows = db_select("results", player_id=player_id)
    daily_dates = [str(r["daily_date"]) for r in rows if r["mode"] == "daily" and r.get("daily_date")]
    current, longest = streaks(daily_dates)
    free = {k: 0 for k in ("easy", "medium", "hard")}
    daily_times = []
    for r in rows:
        if r["mode"] == "free" and r["difficulty"] in free:
            free[r["difficulty"]] += 1
        if r["mode"] == "daily":
            daily_times.append(r["best_elapsed_ms"])
    earned = [b for b in BADGES if longest >= b["days"]]
    next_badge = next((b for b in BADGES if current < b["days"]), None)
    return {
        "points": sum(r["points"] for r in rows),
        "totalCompleted": len(rows),
        "dailyCompleted": len(daily_dates),
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
    return any(p["id"] == puzzle_id for p in data["free"].get(difficulty, []))


@app.get("/")
def home():
    return RedirectResponse(url="/index.html", status_code=307)


@app.get("/api/health")
def health():
    if not supabase_ready():
        return {"ok": False, "database": False, "date": current_prague_date().isoformat(), "message": "Chybí SUPABASE_URL nebo SUPABASE_SECRET_KEY"}
    try:
        db_request("GET", "players", params={"select": "id", "limit": "1"})
        return {"ok": True, "database": True, "date": current_prague_date().isoformat()}
    except HTTPException as exc:
        return {"ok": False, "database": False, "date": current_prague_date().isoformat(), "message": exc.detail}


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

    # Kontrola bez závislosti na case-insensitive PostgREST filtru.
    family_players = db_select("players", family_code=family)
    if any(p["name"].casefold() == name.casefold() for p in family_players):
        raise HTTPException(409, "V této rodině už hráč s tímto jménem existuje")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    player_id = str(uuid.uuid4())
    now = datetime.now(TZ).isoformat()
    try:
        db_insert("players", {
            "id": player_id,
            "name": name,
            "family_code": family,
            "token_hash": token_hash,
            "created_at": now,
        })
    except HTTPException as exc:
        if exc.status_code == 409:
            raise HTTPException(409, "V této rodině už hráč s tímto jménem existuje")
        raise
    stats = player_stats(player_id)
    return {"id": player_id, "name": name, "familyCode": family, "token": token, "stats": stats}


@app.get("/api/me")
def me(authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    stats = player_stats(player["id"])
    return {"id": player["id"], "name": player["name"], "familyCode": player["family_code"], "stats": stats}


@app.post("/api/result")
def result(payload: ResultCreate, authorization: Optional[str] = Header(default=None)):
    player = auth_player(authorization)
    if payload.mode not in ("daily", "free"):
        raise HTTPException(400, "Neplatný režim")
    if payload.difficulty not in ("easy", "medium", "hard"):
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
                "best_elapsed_ms": min(old["best_elapsed_ms"], payload.elapsed_ms),
                "best_moves": min(old["best_moves"], payload.moves),
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
                    "best_elapsed_ms": min(old["best_elapsed_ms"], payload.elapsed_ms),
                    "best_moves": min(old["best_moves"], payload.moves),
                })
            first = False

    return {"ok": True, "firstCompletion": first, "stats": player_stats(player["id"])}


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
