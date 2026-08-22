#!/usr/bin/env python3
"""One-shot source patch for v3.34 quality release.

This file is intentionally removed by the workflow after applying the patch. It keeps the
large server.py edit deterministic and reviewable while avoiding a costly Gen4 rebuild.
"""
from pathlib import Path

PATH = Path("server.py")
text = PATH.read_text(encoding="utf-8")


def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, got {count}")
    text = text.replace(old, new, 1)


# ---- API contracts ---------------------------------------------------------
once(
'''    clean_solve: bool = False
    # Client timestamp lets delayed/offline sync preserve the actual first completion.
    completed_at: Optional[str] = Field(default=None, max_length=40)


class AttemptStart(BaseModel):''',
'''    clean_solve: bool = False
    # Client timestamp lets delayed/offline sync preserve the actual first completion.
    completed_at: Optional[str] = Field(default=None, max_length=40)
    # Klidny rezim keeps XP/progress but is excluded from competitive standings.
    calm_mode: bool = False


class AttemptStart(BaseModel):''',
"ResultCreate.calm_mode",
)
once(
'''class AttemptStart(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str


class AttemptCheckpoint(BaseModel):''',
'''class AttemptStart(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    puzzle_id: str
    challenge_key: str
    mode: str
    difficulty: str
    calm_mode: bool = False


class AttemptCheckpoint(BaseModel):''',
"AttemptStart.calm_mode",
)
once(
'''class AttemptCheckpoint(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    event_type: str
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)


class AttemptFinishTelemetry(BaseModel):''',
'''class AttemptCheckpoint(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=80)
    event_type: str
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    found_words: int = Field(default=0, ge=0, le=99)
    calm_mode: Optional[bool] = None


class AttemptFinishTelemetry(BaseModel):''',
"AttemptCheckpoint.calm_mode",
)
once(
'''class AttemptFinishTelemetry(BaseModel):
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
''',
'''class AttemptFinishTelemetry(BaseModel):
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
    calm_mode: bool = False
''',
"AttemptFinishTelemetry.calm_mode",
)

# ---- Attempt telemetry -----------------------------------------------------
once(
'''        "mode": payload.mode, "difficulty": payload.difficulty,
        "started_at": datetime.now(TZ).isoformat(), "app_version": APP_VERSION,
    })
    return {"ok": True, "attemptId": payload.attempt_id, "anonymous": actor.get("player_id") is None}
''',
'''        "mode": payload.mode, "difficulty": payload.difficulty,
        "started_at": datetime.now(TZ).isoformat(), "app_version": APP_VERSION,
        "calm_mode": bool(payload.calm_mode),
    })
    return {"ok": True, "attemptId": payload.attempt_id, "anonymous": actor.get("player_id") is None}
''',
"attempt_start persistence",
)
once(
'''    values = {
        "last_found_words": max(int(row.get("last_found_words") or 0), int(payload.found_words)),
        "last_activity_at": datetime.now(TZ).isoformat(),
    }
    if payload.event_type == "correct" and row.get("first_correct_ms") is None:
''',
'''    values = {
        "last_found_words": max(int(row.get("last_found_words") or 0), int(payload.found_words)),
        "last_activity_at": datetime.now(TZ).isoformat(),
    }
    if payload.calm_mode is not None:
        # A run may switch into calm mode mid-game; it never switches back within that run.
        values["calm_mode"] = bool(row.get("calm_mode") is True or payload.calm_mode)
    if payload.event_type == "correct" and row.get("first_correct_ms") is None:
''',
"attempt_checkpoint persistence",
)
once(
'''            "difficulty": payload.difficulty, "started_at": datetime.now(TZ).isoformat(), "app_version": APP_VERSION,
        })
    completed_at = payload.completed_at or datetime.now(TZ).isoformat()
''',
'''            "difficulty": payload.difficulty, "started_at": datetime.now(TZ).isoformat(), "app_version": APP_VERSION,
            "calm_mode": bool(payload.calm_mode),
        })
    completed_at = payload.completed_at or datetime.now(TZ).isoformat()
''',
"attempt_finish fallback insert",
)
once(
'''        "wrong_attempts": payload.wrong_attempts, "hints_used": payload.hints_used,
        "max_hint_level": payload.max_hint_level, "clean_solve": payload.clean_solve,
        "last_activity_at": datetime.now(TZ).isoformat(),
    })
''',
'''        "wrong_attempts": payload.wrong_attempts, "hints_used": payload.hints_used,
        "max_hint_level": payload.max_hint_level, "clean_solve": payload.clean_solve,
        "calm_mode": bool(payload.calm_mode),
        "last_activity_at": datetime.now(TZ).isoformat(),
    })
''',
"attempt_finish update",
)

# ---- Quality analytics: calm attempts stay measured, but do not calibrate difficulty ----
once(
'''    # Retired IDs remain syncable for historical data, but must not calibrate the active bank.
    first_attempts = [a for a in first_attempts if a.get("puzzle_id") in puzzle_index]
    groups = {}
''',
'''    # Retired IDs remain syncable for historical data. Calm runs stay in their own cohort so
    # interruptions and intentionally unhurried play never distort the difficulty calibration.
    active_first_attempts = [a for a in first_attempts if a.get("puzzle_id") in puzzle_index]

    def calm_cohort(rows: list[dict]) -> dict:
        completed = [row for row in rows if row.get("completed_at")]
        times = [int(row.get("elapsed_ms")) for row in completed if row.get("elapsed_ms") is not None]
        hints = [int(row.get("hints_used") or 0) for row in completed]
        clean = [1 if row.get("clean_solve") is True else 0 for row in completed]
        return {
            "starts": len(rows),
            "completed": len(completed),
            "completionRate": round(len(completed) / len(rows), 3) if rows else None,
            "medianMs": _median(times),
            "avgHints": round(sum(hints) / len(hints), 2) if hints else None,
            "cleanRate": round(sum(clean) / len(clean), 3) if clean else None,
        }

    calm_mode_summary = {
        "standard": calm_cohort([a for a in active_first_attempts if a.get("calm_mode") is not True]),
        "calm": calm_cohort([a for a in active_first_attempts if a.get("calm_mode") is True]),
    }
    first_attempts = [a for a in active_first_attempts if a.get("calm_mode") is not True]
    groups = {}
''',
"quality calm cohort",
)
once(
'''        "helper": helper_summary,
        "hints": hint_summary,
        "funnel": funnel,
''',
'''        "helper": helper_summary,
        "hints": hint_summary,
        "calmMode": calm_mode_summary,
        "funnel": funnel,
''',
"quality output calm cohort",
)

# ---- Run/result persistence ------------------------------------------------
once(
'''        "moves": payload.moves, "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
        "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
        "completed_at": completed_at,
    })


@app.post("/api/result")
''',
'''        "moves": payload.moves, "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
        "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
        "calm_mode": bool(payload.calm_mode), "completed_at": completed_at,
    })


@app.post("/api/result")
''',
"puzzle_run calm persistence",
)
# Existing-result updates only adopt calm_mode when they replace the chronologically official
# completion (earlier offline completion or new Daily generation). A later standard replay remains
# a separate competitive puzzle_run and does not retroactively turn calm-earned XP into ranked XP.
text = text.replace(
'''                "clean_solve": effective_clean, "completed_at": official_completed_at,
            })''',
'''                "clean_solve": effective_clean, "calm_mode": bool(payload.calm_mode), "completed_at": official_completed_at,
            })''',
)
if text.count('"clean_solve": effective_clean, "calm_mode": bool(payload.calm_mode), "completed_at": official_completed_at,') < 4:
    raise SystemExit("result replacement branches: expected at least four calm_mode updates")
once(
'''                "clean_solve": effective_clean,
                "completed_at": official_completed_at,
            })
            first = True
''',
'''                "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
                "completed_at": official_completed_at,
            })
            first = True
''',
"result insert calm persistence",
)
once(
'''                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
            }
''',
'''                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
            }
''',
"result attempt telemetry calm persistence",
)

# ---- Competitive helpers --------------------------------------------------
once(
'''def first_run_key(r: dict) -> tuple:
    return (completion_time(r), str(r.get("id") or r.get("attempt_id") or ""))

def run_rank_tuple(r: dict) -> tuple:
''',
'''def first_run_key(r: dict) -> tuple:
    return (completion_time(r), str(r.get("id") or r.get("attempt_id") or ""))

def competitive_row(row: dict) -> bool:
    """Klidny rezim counts for personal progression, never for competitive standings."""
    return row.get("calm_mode") is not True

def daily_run_date(row: dict) -> Optional[str]:
    key = str(row.get("challenge_key") or "")
    if not key.startswith("daily:"):
        return None
    value = key[6:16]
    try:
        date.fromisoformat(value)
        return value
    except ValueError:
        return None

def run_rank_tuple(r: dict) -> tuple:
''',
"competitive helpers",
)
once(
'''    elapsed = int(row.get("best_elapsed_ms") or 86_400_000)
''',
'''    elapsed = int(row.get("best_elapsed_ms") or row.get("elapsed_ms") or 86_400_000)
''',
"daily score run elapsed fallback",
)

# Team puzzle leaderboard and Free global already use puzzle_runs; filter calm rows before picking
# the first competitive completion.
once(
'''    rows = [r for r in db_select("puzzle_runs", puzzle_id=puzzle_id) if r.get("player_id") in pmap]
''',
'''    rows = [r for r in db_select("puzzle_runs", puzzle_id=puzzle_id) if r.get("player_id") in pmap and competitive_row(r)]
''',
"team puzzle leaderboard calm filter",
)
once(
'''    runs = db_select_all("puzzle_runs", puzzle_id=puzzle_id, mode="free")
''',
'''    runs = [row for row in db_select_all("puzzle_runs", puzzle_id=puzzle_id, mode="free") if competitive_row(row)]
''',
"free global calm filter",
)

# Daily global: use runs instead of the first-completion XP record. This lets someone who first
# played calmly later make a standard competitive attempt without awarding XP twice.
once(
'''    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    results = [
        row for row in db_select("results", mode="daily", daily_date=selected_date)
        if row.get("puzzle_id") == primary_puzzle_id
    ]
    # results is unique per player/challenge in the current schema. Defensive
    # deduplication keeps historical inconsistencies out of the public board.
    by_player: dict[str, dict] = {}
    for row in results:
''',
'''    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    results = [
        row for row in db_select_all("puzzle_runs", mode="daily")
        if competitive_row(row)
        and daily_run_date(row) == selected_date
        and row.get("puzzle_id") == primary_puzzle_id
    ]
    # A calm first completion may be followed by a standard replay. Rank each player by
    # their first non-calm completion only; replays never improve an existing standard result.
    by_player: dict[str, dict] = {}
    for row in results:
''',
"daily global source",
)
once(
'''            "elapsedMs": int(row.get("best_elapsed_ms") or 0),
            "moves": int(row.get("best_moves") or 0),
''',
'''            "elapsedMs": int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 0),
            "moves": int(row.get("moves") or row.get("best_moves") or 0),
''',
"daily global run fields",
)

# Family league Daily uses the same first non-calm run contract.
once(
'''    daily_results = db_select("results", mode="daily")
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
''',
'''    daily_results = [r for r in db_select_all("puzzle_runs", mode="daily") if competitive_row(r)]
    daily_results = [
        r for r in daily_results
        if daily_run_date(r) in dates
        and r.get("puzzle_id") == expected_daily_puzzle_id(daily_run_date(r))
    ]
    rows_by_day: dict[str, list[dict]] = {d: [] for d in dates}
    for r in daily_results:
        d = daily_run_date(r)
        if d in rows_by_day:
            rows_by_day[d].append(r)
    for d, day_rows in rows_by_day.items():
        first_by_player: dict[str, dict] = {}
        for row in day_rows:
            pid = str(row.get("player_id") or "")
            if not pid:
                continue
            previous = first_by_player.get(pid)
            if previous is None or first_run_key(row) < first_run_key(previous):
                first_by_player[pid] = row
        rows_by_day[d] = list(first_by_player.values())
''',
"family league daily run source",
)

# XP standings: calm XP remains in personal lifetime stats/rank, but does not become competitive XP.
once(
'''    period_results = [
        row for row in results
        if period_start is None or ((parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ)) >= period_start)
    ]
''',
'''    period_results = [
        row for row in results
        if competitive_row(row)
        and (period_start is None or ((parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ)) >= period_start))
    ]
''',
"XP ranking calm filter",
)

# Daily ranking: first non-calm run per player, plus team attribution at the run timestamp.
once(
'''    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    day_rows = [
        row for row in results
        if row.get("mode") == "daily" and str(row.get("daily_date") or "")[:10] == selected_date
        and row.get("puzzle_id") == primary_puzzle_id
    ]
''',
'''    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    day_rows = [
        row for row in db_select_all("puzzle_runs", mode="daily")
        if competitive_row(row) and daily_run_date(row) == selected_date
        and row.get("puzzle_id") == primary_puzzle_id
    ]
''',
"rankings daily run source",
)
once(
'''    ranked_all = sorted(by_player.values(), key=lambda row: (
        0 if row.get("clean_solve") is True else 1,
        int(row.get("hints_used") or 0), int(row.get("best_elapsed_ms") or 10**12),
        int(row.get("best_moves") or 10**9), completion_time(row), str(row.get("player_id") or ""),
    ))
''',
'''    ranked_all = sorted(by_player.values(), key=lambda row: (
        0 if row.get("clean_solve") is True else 1,
        int(row.get("hints_used") or 0), int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 10**12),
        int(row.get("moves") or row.get("best_moves") or 10**9), completion_time(row), str(row.get("player_id") or ""),
    ))
    day_rows = list(by_player.values())
''',
"rankings daily first standard rows",
)
# The next exact occurrence is the v2 Daily board (the older global endpoint was patched above).
once(
'''            "elapsedMs": int(row.get("best_elapsed_ms") or 0), "moves": int(row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0), "cleanSolve": row.get("clean_solve") is True,
            "isMine": pid == viewer_id,
''',
'''            "elapsedMs": int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 0), "moves": int(row.get("moves") or row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0), "cleanSolve": row.get("clean_solve") is True,
            "isMine": pid == viewer_id,
''',
"rankings daily run fields",
)
once(
'''        family = _ranking_result_team(row, player)
        if family:
            by_team.setdefault(family, []).append(_daily_individual_score(row, day_rows))
''',
'''        family = team_code_for_player_at(player or {}, row.get("completed_at")) if player else None
        if family:
            by_team.setdefault(family, []).append(_daily_individual_score(row, day_rows))
''',
"rankings daily team attribution",
)

# Played-level archive exposes the calm flag for product analysis and history UX.
once(
'''                "cleanSolve": row.get("clean_solve") is True,
                "completedAt": row.get("completed_at"),
''',
'''                "cleanSolve": row.get("clean_solve") is True, "calmMode": row.get("calm_mode") is True,
                "completedAt": row.get("completed_at"),
''',
"played levels legacy calm flag",
)
once(
'''                "cleanSolve": first.get("clean_solve") is True, "attempts": len(vals), "completedAt": first.get("completed_at"),
''',
'''                "cleanSolve": first.get("clean_solve") is True, "calmMode": first.get("calm_mode") is True,
                "attempts": len(vals), "completedAt": first.get("completed_at"),
''',
"played levels run calm flag",
)
once(
'''                "cleanSolve": result_row.get("clean_solve") is True, "attempts": 1, "completedAt": result_row.get("completed_at"),
''',
'''                "cleanSolve": result_row.get("clean_solve") is True, "calmMode": result_row.get("calm_mode") is True,
                "attempts": 1, "completedAt": result_row.get("completed_at"),
''',
"played levels result calm flag",
)

PATH.write_text(text, encoding="utf-8")
print("Applied v3.34 quality/calm server patch")
