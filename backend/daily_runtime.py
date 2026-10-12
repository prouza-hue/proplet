"""Narrow HTTP integration of the dated bank; opt-in and approved-pack only."""
from __future__ import annotations

from datetime import datetime
from functools import lru_cache
import os
from typing import Optional

from fastapi import HTTPException, Query, Request
from fastapi.responses import JSONResponse

from backend.dated_daily import DatedDaily, DailyPackInvalid, DailyUnavailable, iso_date, puzzle_digest, next_midnight


def install(namespace: dict) -> None:
    enabled = os.environ.get("PROPLET_DATED_DAILY_ENABLED", "false").strip().lower() == "true"
    if not enabled:
        return
    root = namespace["ROOT"]
    pack_path = root / "data" / "daily_gen6_private.json"
    today = namespace["current_prague_date"]
    runtime_now = namespace.get("current_prague_datetime", lambda: datetime.now(namespace["TZ"]))

    @lru_cache(maxsize=1)
    def pack() -> DatedDaily:
        try:
            return DatedDaily.load(pack_path)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            # A candidate pack does not become approved by setting the env flag.
            raise HTTPException(503, "Denní výzva teď není dostupná") from exc

    original = {name: namespace[name] for name in (
        "expected_daily_puzzle_id", "valid_daily_puzzle_ids", "resolved_puzzle",
        "puzzle_exists", "puzzle_info",
    )}

    def expected(daily_date: str) -> str:
        try:
            bank = pack()
            if bank.handles(daily_date):
                return bank.published_binding(daily_date).puzzle_id
            return original["expected_daily_puzzle_id"](daily_date)
        except ValueError as exc:
            raise HTTPException(400, "Neplatné datum") from exc
        except DailyUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    def valid(daily_date: str) -> set[str]:
        try:
            bank = pack()
            if iso_date(daily_date) > today():
                return set()
            if bank.handles(daily_date):
                # New official completions must use the existing atomic command
                # transaction. A flag-off release must never reach legacy writes.
                if not namespace["ATOMIC_RESULT_V1_ENABLED"]:
                    raise HTTPException(503, "Atomické ukládání Daily není připravené")
                try:
                    return bank.valid_ids(daily_date, today=today())
                except DailyUnavailable:
                    return set()
            return original["valid_daily_puzzle_ids"](daily_date)
        except ValueError as exc:
            raise HTTPException(400, "Neplatné datum") from exc

    def resolved(puzzle_id: str, mode: str, difficulty: str):
        if mode == "daily":
            puzzle = pack().puzzle_by_id(puzzle_id, today=today())
            if puzzle is not None:
                return puzzle if puzzle.get("difficulty") == difficulty else None
        return original["resolved_puzzle"](puzzle_id, mode, difficulty)

    def exists(puzzle_id: str, mode: str, difficulty: str) -> bool:
        if mode == "daily":
            puzzle = pack().puzzle_by_id(puzzle_id, today=today())
            if puzzle is not None:
                return puzzle.get("difficulty") == difficulty
        return original["puzzle_exists"](puzzle_id, mode, difficulty)

    def info(puzzle_id: str):
        puzzle = pack().puzzle_by_id(puzzle_id, today=today())
        if puzzle is not None:
            return {"puzzle": puzzle, "difficulty": puzzle.get("difficulty"), "mode": "daily",
                    "level": None, "legacy": False, "generation": 6}
        return original["puzzle_info"](puzzle_id)

    def shared_body(puzzle_id: str):
        return pack().puzzle_by_id(puzzle_id, today=today())

    namespace.update({"expected_daily_puzzle_id": expected, "valid_daily_puzzle_ids": valid,
                      "resolved_puzzle": resolved, "puzzle_exists": exists, "puzzle_info": info,
                      "dated_daily_shared_body": shared_body})

    @namespace["app"].get("/api/daily")
    def daily(request: Request, daily_date: Optional[str] = Query(default=None),
              puzzle_id: Optional[str] = Query(default=None)):
        # No list, preview-as-of or client clock switches on this endpoint.
        if set(request.query_params) - {"daily_date", "puzzle_id"}:
            raise HTTPException(404, "Tato Denní výzva není dostupná")
        namespace["enforce_rate_limit"](request, "dated_daily_read", limit=300, window_seconds=3600)
        selected = daily_date or today().isoformat()
        try:
            if iso_date(selected) > today():
                raise DailyUnavailable("Tato Denní výzva ještě není dostupná")
            bank = pack()
            if bank.handles(selected):
                payload = bank.public_payload(now=runtime_now(), daily_date=selected, puzzle_id=puzzle_id)
            else:
                official = expected(selected)
                if puzzle_id is not None and puzzle_id not in valid(selected):
                    raise DailyUnavailable("Tato úloha nepatří k vydané Daily výzvě")
                selected_id = puzzle_id or official
                old_info = original["puzzle_info"](selected_id) or {}
                body = old_info.get("puzzle")
                if not body or (body.get("meta") or {}).get("archiveSummaryOnly"):
                    raise DailyUnavailable("Tahle historická Daily není dostupná")
                payload = {"schemaVersion": 1, "dailyDate": selected, "bankVersion": "legacy-daily",
                           "puzzleId": selected_id, "contentHash": puzzle_digest(body),
                           "challengeKey": f"daily:{selected}", "serverToday": today().isoformat(),
                           "validUntil": next_midnight(runtime_now()).isoformat(),
                           "official": selected_id == official,
                           "cacheKey": f"daily:{selected}:legacy-daily", "puzzle": body}
        except ValueError as exc:
            raise HTTPException(400, "Neplatné datum") from exc
        except DailyUnavailable as exc:
            raise HTTPException(404, "Tato Denní výzva není dostupná") from exc
        return JSONResponse(payload, headers={"Cache-Control": "private, no-store",
                            "Vercel-CDN-Cache-Control": "no-store", "CDN-Cache-Control": "no-store"})
