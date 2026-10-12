"""Finite, immutable bonus Daily identities; never a rotating or free-game bank."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import json
from pathlib import Path
import re

from backend.dated_daily import PRAGUE, DailyPackInvalid, DailyUnavailable, iso_date, puzzle_digest

DIFFICULTIES = {3: "hardcore", 5: "mozkomor", 7: "mozkokalypsa"}
SPECIAL_XP = 100
PREVIEW_BRANCH = "work/daily-specials-integrated-20261012"
PREVIEW_DATABASE = "https://eanzztstmwlamwfdskbf.supabase.co"
KEY_RE = re.compile(r"^daily-special:(\d{4}-\d{2}-\d{2}):(hardcore|mozkomor|mozkokalypsa)$")


@dataclass(frozen=True, slots=True)
class SpecialBinding:
    daily_date: str
    difficulty: str
    puzzle_id: str
    content_hash: str
    bank_version: str

    @property
    def challenge_key(self):
        return f"daily-special:{self.daily_date}:{self.difficulty}"

    @property
    def practice_key(self):
        return f"daily-special-practice:{self.daily_date}:{self.difficulty}:{self.puzzle_id}"

    @property
    def starts_at(self):
        return datetime.combine(iso_date(self.daily_date), time.min, PRAGUE)

    @property
    def expires_at(self):
        return datetime.combine(iso_date(self.daily_date) + timedelta(days=1), time.min, PRAGUE)

    @property
    def grace_until(self):
        # Exactly 24 elapsed hours, not a second Prague calendar day during DST.
        return self.expires_at.astimezone(timezone.utc) + timedelta(hours=24)


class DailySpecials:
    def __init__(self, source: dict, *, allow_candidate=False):
        if source.get("schemaVersion") != 1 or source.get("timeZone") != "Europe/Prague":
            raise DailyPackInvalid("Neplatný manifest Daily speciálů")
        if source.get("status") != "approved" and not (allow_candidate and source.get("status") == "candidate"):
            raise DailyPackInvalid("Daily speciály čekají na schválení")
        self.launch = iso_date(source["launchDate"])
        self.active_until = iso_date(source["activeUntil"])
        if self.launch.isoweekday() != 1 or self.active_until != self.launch + timedelta(days=83):
            raise DailyPackInvalid("Banka musí pokrýt přesně dvanáct celých týdnů")
        self.bank_version = str(source["bankVersion"])
        self._puzzles = deepcopy(source["puzzles"])
        self._bindings = {}
        self._by_id = {}
        for row in source["bindings"]:
            day = iso_date(row["dailyDate"])
            binding = SpecialBinding(day.isoformat(), row["difficulty"], row["puzzleId"], row["contentHash"], self.bank_version)
            expected_week = (day - self.launch).days // 7 + 1
            if (not self.launch <= day <= self.active_until or DIFFICULTIES.get(day.isoweekday()) != binding.difficulty
                    or binding.puzzle_id != f"g6-ds-{binding.difficulty}-w{expected_week:02}"
                    or row.get("bankVersion") != self.bank_version or row.get("challengeKey") != binding.challenge_key):
                raise DailyPackInvalid("Nesouhlasí datum, obtížnost nebo identita speciálu")
            puzzle = self._puzzles.get(binding.puzzle_id)
            if (not isinstance(puzzle, dict) or puzzle.get("id") != binding.puzzle_id
                    or puzzle.get("difficulty") != binding.difficulty or not re.fullmatch(r"[0-9a-f]{64}", binding.content_hash)
                    or puzzle_digest(puzzle) != binding.content_hash):
                raise DailyPackInvalid("Nesouhlasí hash nebo obsah speciálu")
            if day.isoformat() in self._bindings or binding.puzzle_id in self._by_id:
                raise DailyPackInvalid("Duplicitní binding speciálu")
            self._bindings[day.isoformat()] = binding
            self._by_id[binding.puzzle_id] = binding
        expected = {(self.launch + timedelta(days=i)).isoformat() for i in range(84)
                    if (self.launch + timedelta(days=i)).isoweekday() in DIFFICULTIES}
        if set(self._bindings) != expected or set(self._puzzles) != set(self._by_id):
            raise DailyPackInvalid("Neúplná banka Daily speciálů")

    @classmethod
    def load(cls, path: Path, **kwargs):
        return cls(json.loads(path.read_text(encoding="utf-8")), **kwargs)

    def binding(self, daily_date: str, *, today: date):
        selected = iso_date(daily_date)
        if selected > today:
            raise DailyUnavailable("Speciál ještě není vydaný")
        return self._bindings.get(daily_date)

    def identity(self, *, challenge_key: str, puzzle_id: str, difficulty: str, today: date,
                 daily_date: str | None = None, allow_practice=True):
        binding = self._by_id.get(puzzle_id)
        if (binding is None or iso_date(binding.daily_date) > today or difficulty != binding.difficulty
                or daily_date is not None and daily_date != binding.daily_date):
            raise DailyUnavailable("Speciál neodpovídá vydané desce")
        if challenge_key == binding.challenge_key:
            return binding, False
        if allow_practice and challenge_key == binding.practice_key and iso_date(binding.daily_date) <= today:
            return binding, True
        raise DailyUnavailable("Neplatná identita Daily speciálu")

    def puzzle_by_id(self, puzzle_id: str, *, today: date):
        binding = self._by_id.get(puzzle_id)
        if binding is None or iso_date(binding.daily_date) > today:
            return None
        return deepcopy(self._puzzles[puzzle_id])

    def descriptor(self, binding: SpecialBinding, *, today: date):
        official = iso_date(binding.daily_date) == today
        return {"schemaVersion": 1, "mode": "daily_special", "challengeKind": "special",
                "dailyDate": binding.daily_date, "difficulty": binding.difficulty,
                "puzzleId": binding.puzzle_id, "bankVersion": binding.bank_version,
                "contentHash": binding.content_hash,
                "challengeKey": binding.challenge_key if official else binding.practice_key,
                "officialChallengeKey": binding.challenge_key, "practiceChallengeKey": binding.practice_key,
                "official": official, "rewardEligible": official, "rewardXp": SPECIAL_XP if official else 0,
                "expiresAt": binding.expires_at.isoformat(), "graceUntil": binding.grace_until.isoformat(),
                "cacheKey": f"{binding.challenge_key}:{binding.bank_version}:{binding.content_hash}",
                "puzzle": deepcopy(self._puzzles[binding.puzzle_id])}

    def week_metadata(self, today: date):
        monday = today - timedelta(days=today.weekday())
        # Metadata is allowed in advance; no IDs, hashes, words or geometry.
        return [{"dailyDate": (monday + timedelta(days=i)).isoformat(), "difficulty": DIFFICULTIES[(monday+timedelta(days=i)).isoweekday()],
                 "challengeKind": "special", "status": "today" if monday+timedelta(days=i) == today else
                 "archive" if monday+timedelta(days=i) < today else "upcoming"}
                for i in range(7) if (monday+timedelta(days=i)).isoformat() in self._bindings]


def official_completion_allowed(binding, *, now: datetime, session: dict | None,
                                effective_today: date | None = None, preview=False):
    """Current-day completion or a server-proven finished first run within grace."""
    day = effective_today or now.astimezone(PRAGUE).date()
    if day == iso_date(binding.daily_date):
        return True
    if day < iso_date(binding.daily_date) or not session:
        return False
    try:
        created = datetime.fromisoformat(str(session["created_at"]).replace("Z", "+00:00"))
        finished = datetime.fromisoformat(str(session["last_seen"]).replace("Z", "+00:00"))
    except (ValueError, KeyError, TypeError):
        return False
    return bool(not preview and now <= binding.grace_until and session.get("finished") is True
                and session.get("verified") is True and binding.starts_at <= created < binding.expires_at
                and created <= finished < binding.expires_at)
