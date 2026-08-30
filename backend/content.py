"""Content/domain contracts shared by the HTTP adapter and contract tests.

The web API owns request validation and database access.  This module owns the
deterministic parts of content selection: release windows, Daily compatibility,
archive lookup, and the small set of progression/ranking rules that the browser
also implements.  Functions deliberately accept plain dictionaries and loader
results so that the runtime keeps its existing cache and monkeypatch seams.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Iterable, Optional


def parse_content_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def daily_rotation_index(daily_date: str, bank_size: int, base_date: str = "2026-01-01") -> int:
    if bank_size <= 0:
        raise ValueError("Daily banka je prázdná")
    try:
        selected = date.fromisoformat(daily_date)
        base = date.fromisoformat(base_date)
    except ValueError as exc:
        raise ValueError("Neplatné datum") from exc
    return (selected - base).days % bank_size


def daily_bank_puzzle_id(bank: dict, daily_date: str, fallback_base: str = "2026-01-01") -> str:
    puzzles = bank.get("puzzles") or []
    base = str(bank.get("rotationBaseDate") or fallback_base)
    return puzzles[daily_rotation_index(daily_date, len(puzzles), base)]["id"]


def legacy_daily_banks(data: dict) -> list[dict]:
    return [bank for bank in data.get("legacyDaily", []) if bank.get("puzzles")]


def previous_daily_bank(data: dict) -> Optional[dict]:
    bank = data.get("previousDaily") or {}
    return bank if bank.get("puzzles") else None


def legacy_daily_bank_by_generation(data: dict, generation: int) -> Optional[dict]:
    return next(
        (bank for bank in legacy_daily_banks(data) if int(bank.get("generation") or 0) == int(generation)),
        None,
    )


def expected_daily_puzzle_id(data: dict, daily_date: str, *, candidate_preview: bool = False) -> str:
    """Resolve the official Daily while preserving all historic generation paths."""
    try:
        selected = date.fromisoformat(daily_date)
    except ValueError as exc:
        raise ValueError("Neplatné datum") from exc

    def active_id(base: str) -> str:
        bank = data.get("daily", [])
        return bank[daily_rotation_index(daily_date, len(bank), base)]["id"]

    if int(data.get("dailyGeneration") or 0) == 4:
        release = data.get("release") or {}
        switch_raw = data.get("dailyGeneration4From") or release.get("dailyGeneration4From")
        switch = parse_content_date(switch_raw)
        if switch is None and candidate_preview:
            return active_id(str(data.get("dailyRotationBaseDate") or "2026-01-01"))
        if switch is None:
            raise RuntimeError("Generation 4 Daily nemá schválené datum spuštění")
        if selected >= switch:
            return active_id(str(data.get("dailyRotationBaseDate") or switch.isoformat()))
        # Archive windows are resolved without reading puzzle letters.
        archived = daily_window_id(data, daily_date)
        if archived:
            return archived
        raise RuntimeError("Pro datum chybí bezpečně svázané Daily okno")

    switch3 = parse_content_date(data.get("dailyGeneration3From"))
    if switch3 and selected >= switch3:
        return active_id(str(data.get("dailyRotationBaseDate") or switch3.isoformat()))

    switch2 = parse_content_date(data.get("dailyGeneration2From"))
    if switch2 and selected >= switch2:
        previous = previous_daily_bank(data)
        if previous and int(previous.get("generation") or 0) == 2:
            return daily_bank_puzzle_id(previous, daily_date)
        legacy2 = legacy_daily_bank_by_generation(data, 2)
        if legacy2:
            return daily_bank_puzzle_id(legacy2, daily_date)
        if int(data.get("dailyGeneration") or 1) == 2:
            return active_id("2026-01-01")

    legacy1 = legacy_daily_bank_by_generation(data, 1)
    if legacy1:
        return daily_bank_puzzle_id(legacy1, daily_date)
    return active_id(str(data.get("dailyRotationBaseDate") or "2026-01-01"))


def daily_window_puzzle_id(window: dict, daily_date: str) -> Optional[str]:
    try:
        selected = date.fromisoformat(daily_date)
        base = date.fromisoformat(str(window.get("rotationBaseDate") or "2026-01-01"))
    except ValueError:
        return None
    ids = list(window.get("puzzleIds") or [])
    if not ids:
        return None
    return str(ids[(selected - base).days % len(ids)])


def daily_window_id(runtime: dict, daily_date: str) -> Optional[str]:
    try:
        selected = date.fromisoformat(daily_date)
    except ValueError:
        return None
    windows = ((runtime.get("archive") or {}).get("dailyWindows") or [])
    for window in sorted(windows, key=lambda item: int(item.get("generation") or 0), reverse=True):
        start_raw, end_raw = window.get("activeFrom"), window.get("activeUntil")
        try:
            start = date.fromisoformat(start_raw) if start_raw else date.min
            end = date.fromisoformat(end_raw) if end_raw else date.max
        except ValueError:
            continue
        if start <= selected <= end:
            return daily_window_puzzle_id(window, daily_date)
    return None


def free_puzzle_info(data: dict, rolling: dict, puzzle_id: str, difficulties: Iterable[str], difficulty: Optional[str] = None) -> Optional[dict]:
    """Resolve active, rolling, or legacy Free content to a stable slot."""
    selected = (difficulty,) if difficulty in difficulties else tuple(difficulties)
    for diff in selected:
        for index, puzzle in enumerate(data.get("free", {}).get(diff, []), start=1):
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {"puzzle": puzzle, "difficulty": diff, "mode": "free", "level": int(meta.get("level") or index), "generation": int(meta.get("contentGeneration") or data.get("freeGeneration") or 1), "legacy": False}
    for diff in selected:
        for puzzle in rolling.get("puzzles", {}).get(diff, []):
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {"puzzle": puzzle, "difficulty": diff, "mode": "free", "level": int(meta.get("level") or 0), "generation": int(meta.get("contentGeneration") or data.get("freeGeneration") or 1), "legacy": False, "rolling": True}
    for diff in selected:
        bank = data.get("legacyFree", {}).get(diff, [])
        for index in range(len(bank) - 1, -1, -1):
            puzzle = bank[index]
            if puzzle.get("id") == puzzle_id:
                meta = puzzle.get("meta") or {}
                return {"puzzle": puzzle, "difficulty": diff, "mode": "free", "level": int(meta.get("level") or index + 1), "generation": int(meta.get("contentGeneration") or 1), "legacy": True}
    indexed = (data.get("legacyFreeIndex") or {}).get(puzzle_id)
    if indexed and (difficulty is None or indexed.get("difficulty") == difficulty):
        return {"puzzle": None, "difficulty": indexed.get("difficulty"), "mode": "free", "level": int(indexed.get("level") or 0), "generation": int(indexed.get("generation") or 1), "legacy": True, "lineageConfidence": indexed.get("lineageConfidence") or "slot-exact"}
    return None


def released_free_bank(data: dict, rolling: dict, difficulty: str, as_of: Optional[date]) -> list[dict]:
    base = list(data.get("free", {}).get(difficulty, []))
    if rolling.get("releaseEnabled", True) is False:
        return base
    return base + [p for p in rolling.get("puzzles", {}).get(difficulty, []) if is_puzzle_released(p, as_of)]


def is_puzzle_released(puzzle: dict, as_of: Optional[date] = None) -> bool:
    released = parse_content_date((puzzle.get("meta") or {}).get("availableFrom"))
    return released is None or released <= (as_of or date.today())


def run_rank_tuple(row: dict) -> tuple:
    elapsed = int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 10**12)
    return (0 if row.get("clean_solve") is True else 1, int(row.get("hints_used") or 0), elapsed // 1000, int(row.get("moves") or row.get("best_moves") or 10**9))


def competition_ranks(rows: list[dict]) -> list[int]:
    ranks: list[int] = []
    previous = None
    rank = 0
    for position, row in enumerate(rows, 1):
        value = run_rank_tuple(row)
        if value != previous:
            rank, previous = position, value
        ranks.append(rank)
    return ranks


def streak_ending_on(date_strings: Iterable[str], anchor: date) -> int:
    values = {str(value)[:10] for value in date_strings if value}
    count = 0
    current = anchor
    while current.isoformat() in values:
        count += 1
        current = date.fromordinal(current.toordinal() - 1)
    return count


def streaks(dates: Iterable[str], today: date) -> tuple[int, int]:
    values = sorted({date.fromisoformat(str(value)) for value in dates if value}, reverse=True)
    if not values:
        return 0, 0
    value_set = set(values)
    anchor = today if today in value_set else (date.fromordinal(today.toordinal() - 1) if date.fromordinal(today.toordinal() - 1) in value_set else None)
    current = streak_ending_on((item.isoformat() for item in value_set), anchor) if anchor else 0
    longest = max(streak_ending_on((item.isoformat() for item in value_set), item) for item in values)
    return current, longest


def mozkomor_unlocked_from_rows(rows: list[dict], slots: dict, required: int = 200) -> bool:
    if any(row.get("mode") == "free" and row.get("difficulty") == "mozkomor" for row in rows):
        return True
    return int((slots.get("baseCurrent") or {}).get("hardcore") or 0) >= required


def challenge_key(mode: str, puzzle_id: str, daily_date: Optional[str] = None) -> str:
    if mode == "daily":
        return f"daily:{daily_date}"
    if mode == "starter":
        return f"starter:{puzzle_id}"
    if mode == "tajenka":
        return f"tajenka:{puzzle_id}"
    return f"free:{puzzle_id}"


def xp_for(mode: str, difficulty: Optional[str], points: dict[str, int], *, starter_xp: int = 10, reward_xp: Optional[int] = None) -> int:
    if mode == "daily":
        return int(points["daily"])
    if mode == "starter":
        return int(reward_xp if reward_xp is not None else starter_xp)
    if mode == "tajenka":
        return int(reward_xp if reward_xp is not None else 0)
    return int(points[difficulty or ""])
