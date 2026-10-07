"""Finite, server-only Daily bindings. This module never mutates player data."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Callable
from zoneinfo import ZoneInfo

PRAGUE = ZoneInfo("Europe/Prague")
GEOMETRY_KEYS = ("rows", "cols", "letters", "mask", "answers", "lengths")


class DailyUnavailable(RuntimeError):
    """No scheduled/released content. Never fall back to a modulo bank."""


class DailyNotReleased(DailyUnavailable):
    pass


class DailyPackInvalid(ValueError):
    pass


def iso_date(value: str) -> date:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Daily datum musí mít tvar YYYY-MM-DD")
    return date.fromisoformat(value)


def puzzle_digest(puzzle: dict) -> str:
    material = {key: puzzle.get(key) for key in GEOMETRY_KEYS}
    encoded = json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def prague_today(now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Serverový čas musí být timezone-aware")
    return now.astimezone(PRAGUE).date()


def next_midnight(now: datetime) -> datetime:
    """Calendar midnight, including 25h/23h Prague days."""
    day = prague_today(now)
    return datetime.combine(day + timedelta(days=1), time.min, PRAGUE)


@dataclass(frozen=True, slots=True)
class Binding:
    daily_date: str
    bank_version: str
    puzzle_id: str
    content_hash: str


class DatedDaily:
    def __init__(self, payload: dict, *, allow_candidate: bool = False):
        if payload.get("schemaVersion") != 1 or payload.get("timeZone") != "Europe/Prague":
            raise DailyPackInvalid("Nepodporovaný datovaný Daily manifest")
        if payload.get("status") != "approved" and not (allow_candidate and payload.get("status") == "candidate"):
            raise DailyPackInvalid("Daily banka nemá schválený stav")
        self.cutover = iso_date(payload["cutover"])
        self.active_until = iso_date(payload["activeUntil"])
        if self.active_until < self.cutover:
            raise DailyPackInvalid("Neplatné okno Daily banky")
        self.bank_version = str(payload.get("bankVersion") or "")
        if not self.bank_version:
            raise DailyPackInvalid("Chybí bankVersion")
        self._puzzles = deepcopy(payload.get("puzzles") or {})
        self._bindings: dict[str, Binding] = {}
        self._by_id: dict[str, Binding] = {}
        for row in payload.get("bindings") or []:
            day = iso_date(row["dailyDate"])
            binding = Binding(day.isoformat(), str(row["bankVersion"]), str(row["puzzleId"]), str(row["contentHash"]))
            if not self.cutover <= day <= self.active_until or binding.bank_version != self.bank_version:
                raise DailyPackInvalid("Binding leží mimo schválené okno/verzi")
            if binding.daily_date in self._bindings or binding.puzzle_id in self._by_id:
                raise DailyPackInvalid("Duplicitní datum nebo puzzleId")
            puzzle = self._puzzles.get(binding.puzzle_id)
            if not isinstance(puzzle, dict) or puzzle.get("id") != binding.puzzle_id:
                raise DailyPackInvalid("Chybí přesné puzzle body")
            if not re.fullmatch(r"[0-9a-f]{64}", binding.content_hash) or puzzle_digest(puzzle) != binding.content_hash:
                raise DailyPackInvalid("Nesouhlasí contentHash Daily desky")
            self._bindings[binding.daily_date] = binding
            self._by_id[binding.puzzle_id] = binding
        expected = {(self.cutover + timedelta(days=i)).isoformat() for i in range((self.active_until-self.cutover).days+1)}
        if set(self._bindings) != expected or set(self._puzzles) != set(self._by_id):
            raise DailyPackInvalid("Daily banka má mezeru nebo nepřiřazený obsah")

    @classmethod
    def load(cls, path: Path, *, allow_candidate: bool = False) -> "DatedDaily":
        return cls(json.loads(path.read_text(encoding="utf-8")), allow_candidate=allow_candidate)

    def handles(self, daily_date: str) -> bool:
        # Every post-cutover date belongs to dated resolution, including gaps/end.
        # Returning False after the end would accidentally reactivate legacy modulo.
        return iso_date(daily_date) >= self.cutover

    def binding(self, daily_date: str, *, today: date) -> Binding:
        selected = iso_date(daily_date)
        if selected > today:
            raise DailyNotReleased("Daily výzva ještě není vydaná")
        binding = self._bindings.get(daily_date)
        if binding is None:
            raise DailyUnavailable("Pro tento den chybí schválená Daily výzva")
        return binding

    def published_binding(self, daily_date: str) -> Binding:
        """Internal identity lookup for history/ranking; never a public list API."""
        binding = self._bindings.get(daily_date)
        if binding is None:
            raise DailyUnavailable("Pro tento den chybí schválená Daily výzva")
        return binding

    def valid_ids(self, daily_date: str, *, today: date) -> set[str]:
        return {self.binding(daily_date, today=today).puzzle_id}

    def puzzle_by_id(self, puzzle_id: str, *, today: date) -> dict | None:
        binding = self._by_id.get(puzzle_id)
        if binding is None or iso_date(binding.daily_date) > today:
            return None
        return deepcopy(self._puzzles[puzzle_id])

    def public_payload(self, *, now: datetime, daily_date: str | None = None, puzzle_id: str | None = None) -> dict:
        today = prague_today(now)
        selected = daily_date or today.isoformat()
        binding = self.binding(selected, today=today)
        if puzzle_id is not None and puzzle_id != binding.puzzle_id:
            raise DailyUnavailable("Tato úloha nepatří k vydané Daily výzvě")
        return {
            "schemaVersion": 1,
            "dailyDate": binding.daily_date,
            "bankVersion": binding.bank_version,
            "puzzleId": binding.puzzle_id,
            "contentHash": binding.content_hash,
            "challengeKey": f"daily:{binding.daily_date}",
            "serverToday": today.isoformat(),
            "validUntil": next_midnight(now).astimezone(timezone.utc).isoformat(),
            "cacheKey": f"daily:{binding.daily_date}:{binding.bank_version}",
            "puzzle": deepcopy(self._puzzles[binding.puzzle_id]),
        }


def public_runtime_projection(source: dict, *, cutover: str, active_until: str) -> dict:
    """Keep old ordering/history, remove all new Daily and old future bodies.

    This assumes the verified finite first Gen4 cycle and deliberately fails if
    the runtime baseline differs. New private bodies are never passed here.
    """
    cut = iso_date(cutover)
    end = iso_date(active_until)
    base = iso_date(str(source.get("dailyRotationBaseDate") or ""))
    if int(source.get("dailyGeneration") or 0) != 4 or base != date(2026, 8, 24):
        raise DailyPackInvalid("Veřejná projekce vyžaduje ověřenou Gen4 baseline")
    projected = deepcopy(source)
    projected.pop("datedDailyPrivate", None)
    for i, puzzle in enumerate(projected.get("daily") or []):
        # g3-d-007 is the verified compatibility Sunday, outside the Gen4 cycle.
        if puzzle.get("id") == "g3-d-007":
            continue
        if not str(puzzle.get("id") or "").startswith("g4-d-"):
            raise DailyPackInvalid("Neočekávaná Daily identita v baseline")
        if base + timedelta(days=i) >= cut:
            projected["daily"][i] = {
                "id": puzzle["id"], "difficulty": puzzle["difficulty"],
                "meta": {"contentGeneration": 4, "retiredFutureDaily": True},
            }
    projected["datedDaily"] = {
        "schemaVersion": 1, "cutover": cut.isoformat(), "activeUntil": end.isoformat(),
        "timeZone": "Europe/Prague", "endpoint": "/api/daily",
    }
    return projected


def assert_no_private_payload(root: Path, pack: DatedDaily) -> dict:
    """Scan every static output, including sourcemaps; fail on ID/hash/geometry.

    This detects copied/content-shaped leaks; route probing remains a release gate.
    """
    needles: list[tuple[str, bytes]] = []
    for puzzle_id, binding in pack._by_id.items():
        needles.extend([(puzzle_id, puzzle_id.encode()), (puzzle_id, binding.content_hash.encode())])
        letters = pack._puzzles[puzzle_id]["letters"]
        for ascii_json in (False, True):
            for separators in ((",", ":"), (", ", ": ")):
                needles.append((puzzle_id, json.dumps(letters, ensure_ascii=ascii_json, separators=separators).encode()))
    checked = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        checked += 1
        data = path.read_bytes()
        for puzzle_id, needle in needles:
            if needle in data:
                raise DailyPackInvalid(f"Neveřejný Daily obsah ve veřejném výstupu: {path.relative_to(root)} ({puzzle_id})")
    return {"filesChecked": checked, "futurePuzzleCount": len(pack._by_id), "result": "PASS"}
