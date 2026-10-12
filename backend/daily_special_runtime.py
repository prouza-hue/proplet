"""Optional Daily HTTP/session/result adapter. The original Daily stays untouched."""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
import math
import os
from typing import Optional

from fastapi import Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from backend.daily_specials import DailySpecials, PREVIEW_BRANCH, PREVIEW_DATABASE, SPECIAL_XP, official_completion_allowed
from backend.dated_daily import DailyUnavailable, iso_date, next_midnight


def install(namespace):
    enabled = os.environ.get("PROPLET_DAILY_SPECIALS_ENABLED", "false").lower() == "true"
    preview = (namespace["VERCEL_ENV"] == "preview" and namespace["VERCEL_GIT_COMMIT_REF"] == PREVIEW_BRANCH
               and namespace["SUPABASE_URL"] == PREVIEW_DATABASE)
    today = namespace["current_prague_date"]
    runtime_now = namespace["current_prague_datetime"]

    @lru_cache(maxsize=1)
    def pack():
        if not enabled:
            raise HTTPException(404, "Daily speciály zatím nejsou vydané")
        if not namespace["ATOMIC_RESULT_V1_ENABLED"]:
            raise HTTPException(503, "Atomické ukládání speciálů není připravené")
        try:
            return DailySpecials.load(namespace["ROOT"] / "data" / "daily_specials_private.json", allow_candidate=preview)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise HTTPException(503, "Daily speciály teď nejsou dostupné") from exc

    def identity(payload):
        try:
            return pack().identity(challenge_key=payload.challenge_key, puzzle_id=payload.puzzle_id,
                                   difficulty=payload.difficulty, daily_date=getattr(payload, "daily_date", None), today=today())
        except (ValueError, DailyUnavailable) as exc:
            raise HTTPException(400, "Tato úloha nepatří k vydanému Daily speciálu") from exc

    def session_for(payload, actor):
        filters = {"actor_key": actor.get("actor_key") or ("p:" + str(actor["player_id"]) if actor.get("player_id") else "a:" + actor["anonymous_id"]),
                   "challenge_key": payload.challenge_key, "puzzle_id": payload.puzzle_id}
        rows = namespace["db_select"]("play_sessions", **filters)
        return rows[0] if rows else None

    def session_identity(payload, actor):
        binding, practice = identity(payload)
        if not practice and iso_date(binding.daily_date) != today():
            session = session_for(payload, actor)
            # An already-finished verified queue may obtain its durable receipt;
            # a newly received finish cannot prove that offline work finished yesterday.
            if not official_completion_allowed(binding, now=datetime.now(timezone.utc), session=session,
                                                effective_today=today(), preview=preview):
                raise HTTPException(409, "Speciál už je v archivu. Dohrát ho můžeš bez XP.")
        return binding, practice

    def attempt_identity(payload, actor, *, starting):
        binding, practice = identity(payload)
        if not practice and iso_date(binding.daily_date) != today():
            if starting:
                raise HTTPException(409, "Nový oficiální pokus už nelze zahájit")
            session_identity(payload, actor)
        return binding, practice

    def result_context(payload, player):
        binding, practice = identity(payload)
        if payload.daily_date != binding.daily_date or not payload.attempt_id:
            raise HTTPException(400, "Speciál musí mít přesné datum a identitu pokusu")
        session = session_for(payload, {"player_id": player["id"]})
        if not practice and session and session.get("attempt_id") != payload.attempt_id:
            raise HTTPException(409, "Výsledek neodpovídá serverovému pokusu")
        if not practice and (not session or session.get("finished") is not True):
            raise HTTPException(409, "Nejdříve je potřeba potvrdit dokončení herního pokusu")
        if not practice and not official_completion_allowed(binding, now=datetime.now(timezone.utc), session=session,
                                                            effective_today=today(), preview=preview):
            raise HTTPException(409, "Oficiální speciál už skončil. Archiv je bez XP.")
        return {"binding": binding, "practice": practice, "points": 0 if practice else SPECIAL_XP}

    original_resolved = namespace["resolved_puzzle"]
    original_exists = namespace["puzzle_exists"]
    original_info = namespace["puzzle_info"]

    def resolved(puzzle_id, mode, difficulty):
        if mode == "daily_special":
            puzzle = pack().puzzle_by_id(puzzle_id, today=today())
            return puzzle if puzzle and puzzle.get("difficulty") == difficulty else None
        return original_resolved(puzzle_id, mode, difficulty)

    def exists(puzzle_id, mode, difficulty):
        return bool(resolved(puzzle_id, mode, difficulty)) if mode == "daily_special" else original_exists(puzzle_id, mode, difficulty)

    def info(puzzle_id):
        if enabled:
            puzzle = pack().puzzle_by_id(puzzle_id, today=today())
            if puzzle:
                return {"puzzle": puzzle, "difficulty": puzzle["difficulty"], "mode": "daily_special",
                        "level": None, "generation": 6, "legacy": False}
        return original_info(puzzle_id)

    def shared_body(puzzle_id, daily_date):
        try:
            binding = pack().binding(daily_date or "", today=today())
            if not binding or binding.puzzle_id != puzzle_id:
                return None
            return pack().puzzle_by_id(puzzle_id, today=today())
        except (ValueError, DailyUnavailable):
            return None

    namespace.update({"daily_special_result_context": result_context, "daily_special_session_identity": session_identity,
                      "daily_special_attempt_identity": attempt_identity, "resolved_puzzle": resolved,
                      "puzzle_exists": exists, "puzzle_info": info, "daily_special_shared_body": shared_body})

    @namespace["app"].get("/api/daily-special")
    def daily_special(request: Request, daily_date: Optional[str] = Query(default=None), puzzle_id: Optional[str] = Query(default=None)):
        if set(request.query_params) - {"daily_date", "puzzle_id"}:
            raise HTTPException(404, "Tento speciál není dostupný")
        namespace["enforce_rate_limit"](request, "daily_special_read", limit=300, window_seconds=3600)
        response = {"schemaVersion": 1, "serverToday": today().isoformat(),
                    "validUntil": next_midnight(runtime_now()).isoformat(), "special": None, "schedule": []}
        if enabled:
            bank = pack()
            try:
                binding = bank.binding(daily_date or today().isoformat(), today=today())
                if puzzle_id and (binding is None or binding.puzzle_id != puzzle_id):
                    raise DailyUnavailable("Neplatná identita speciálu")
                if binding:
                    response["special"] = bank.descriptor(binding, today=today())
                response["schedule"] = bank.week_metadata(today())
            except (ValueError, DailyUnavailable) as exc:
                raise HTTPException(404, "Tento speciál není dostupný") from exc
        return JSONResponse(response, headers={"Cache-Control": "private, no-store", "Vercel-CDN-Cache-Control": "no-store", "CDN-Cache-Control": "no-store"})

    @namespace["app"].get("/api/rankings/daily-special")
    def rankings_daily_special(request: Request, challenge_key: str = Query(min_length=20, max_length=100),
                               authorization: Optional[str] = Header(default=None),
                               offset: Optional[int] = Query(default=None, ge=0)):
        namespace["enforce_rate_limit"](request, "special_ranking_read", limit=300, window_seconds=3600)
        bank = pack()
        candidates = [binding for binding in bank._bindings.values() if binding.challenge_key == challenge_key
                      and iso_date(binding.daily_date) <= today()]
        if not candidates:
            raise HTTPException(404, "Pořadí tohoto speciálu není dostupné")
        binding = candidates[0]
        viewer = namespace["_ranking_viewer"](authorization)
        viewer_id = str(viewer["id"]) if viewer else None
        rows = namespace["db_select_bounded"]("results", columns="player_id,mode,challenge_key,puzzle_id,best_elapsed_ms,best_moves,hints_used,wrong_attempts,clean_solve,completed_at,timing_verified,calm_mode",
            filters={"mode": "eq.daily_special", "challenge_key": f"eq.{binding.challenge_key}", "puzzle_id": f"eq.{binding.puzzle_id}",
                     "calm_mode": "eq.false", "timing_verified": "eq.true"}, max_rows=5000)
        rows = [row for row in rows if row.get("mode") == "daily_special" and row.get("challenge_key") == binding.challenge_key
                and row.get("puzzle_id") == binding.puzzle_id and row.get("timing_verified") is True and row.get("calm_mode") is not True]
        rows = sorted(rows, key=lambda row: (*namespace["run_rank_tuple"](row), str(row.get("completed_at")), str(row["player_id"])))
        ranks = namespace["competition_ranks"](rows)
        my_index = next((index for index, row in enumerate(rows) if str(row.get("player_id")) == viewer_id), None)
        total = len(rows)
        page_offset = offset if isinstance(offset, int) else None
        if page_offset is not None:
            visible = set(range(page_offset, min(total, page_offset + 50)))
        elif my_index is None:
            visible = set(range(min(total, 3)))
        else:
            first = max(0, min(my_index - 1, total - 3))
            visible = set(range(first, min(total, first + 3)))
        ids = {str(row["player_id"]) for row in rows}
        if viewer_id:
            ids.add(viewer_id)
        _, players, _, team_names = namespace["_ranking_context"](ids, set())
        used_aliases = set()
        output = []
        for index, row in enumerate(rows):
            pid = str(row["player_id"])
            player = players.get(pid)
            if not player:
                continue
            display = namespace["_ranking_display_identity"](player, viewer_id, binding.challenge_key, used_aliases)
            if index not in visible:
                continue
            team = namespace["public_family_code"](player.get("family_code"), player.get("team_joined_at"))
            output.append({"name": display["name"], "avatar": display["avatar"], "anonymous": display["anonymous"],
                           "teamName": team_names.get(team or "") if not display["anonymous"] else None,
                           "elapsedMs": row["best_elapsed_ms"], "moves": row["best_moves"],
                           "hintsUsed": row.get("hints_used") or 0, "cleanSolve": row.get("clean_solve") is True,
                           "isMine": pid == viewer_id, "rank": ranks[index]})
        my_rank = ranks[my_index] if my_index is not None else None
        return {"kind": "daily_special", "date": binding.daily_date, "challengeKey": binding.challenge_key,
                "puzzleId": binding.puzzle_id, "difficulty": binding.difficulty, "players": output, "teams": [],
                "rows": output, "total": total, "myRank": my_rank,
                "topPercent": max(1, math.ceil(my_rank / total * 100)) if my_rank and total else None,
                "percentileMinimum": 10,
                "nextOffset": page_offset + 50 if page_offset is not None and page_offset + 50 < total else None,
                "privacy": "opt-in-identity-otherwise-alias", "attemptPolicy": "first-completed-only",
                "playerScoring": "clean-hints-time-moves", "officialFirstOnly": True}
